import * as PDFDocument from 'pdfkit';

export type InvoiceCustomer = { name: string; email: string; phone?: string | null; city?: string | null; postalCode?: string | null };
export type InvoicePlan = { name: string; description: string; questionQuota: number; voiceSeconds: number; startsAt?: string; expiresAt?: string };
export type InvoicePdfData = {
  invoiceNumber: string; issuedAt: Date; customer: InvoiceCustomer; plan: InvoicePlan;
  subtotal: string; tax: string; total: string; currency: string; paymentId: string;
  provider: string; providerOrderId: string; providerPaymentId: string | null; status: string;
  seller: { name: string; address?: string; email?: string; taxId?: string };
};

/** Generate from the owned invoice record, never from client-supplied totals. */
export function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true,
      info: { Title: `Invoice ${data.invoiceNumber}`, Author: 'connect2infinity', Subject: 'Subscription invoice' } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    for (const subset of ['latin', 'latin-ext', 'devanagari']) {
      for (const weight of [400, 700]) doc.registerFont(`${subset}-${weight}`, require.resolve(`@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-${subset}-${weight}-normal.woff`));
    }
    const navy = '#1e2b4d';
    const muted = '#656d7b';
    const width = doc.page.width - 96;
    const date = (value: string | Date) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
    const amount = (value: string) => `${data.currency} ${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    function text(value: string, x: number, y: number, options: { width?: number; size?: number; bold?: boolean; color?: string } = {}) {
      const runs: { subset: string; value: string }[] = [];
      for (const character of value) {
        const code = character.codePointAt(0)!;
        const subset = (code >= 0x0900 && code <= 0x097f) || (code >= 0x1cd0 && code <= 0x1cff) || (code >= 0xa8e0 && code <= 0xa8ff) || code === 0x200c || code === 0x200d || code === 0x20b9
          ? 'devanagari' : (code >= 0x0100 && code <= 0x036f) || (code >= 0x1e00 && code <= 0x1eff) ? 'latin-ext' : 'latin';
        const previous = runs[runs.length - 1];
        if (previous?.subset === subset) previous.value += character; else runs.push({ subset, value: character });
      }
      if (!runs.length) runs.push({ subset: 'latin', value: '' });
      runs.forEach((run, index) => {
        doc.font(`${run.subset}-${options.bold ? 700 : 400}`).fontSize(options.size ?? 10).fillColor(options.color ?? navy);
        const settings = { width: options.width ?? width, continued: index < runs.length - 1, lineGap: 1 };
        if (index === 0) doc.text(run.value, x, y, settings); else doc.text(run.value, settings);
      });
      return doc.y;
    }
    function section(title: string) {
      if (doc.y > doc.page.height - 150) doc.addPage();
      const y = doc.y + 10;
      doc.moveTo(48, y).lineTo(doc.page.width - 48, y).strokeColor('#e2e5eb').stroke();
      text(title, 48, y + 10, { bold: true, size: 10 });
      doc.y += 5;
    }
    function detail(label: string, value: string) {
      if (doc.y > doc.page.height - 110) doc.addPage();
      const y = doc.y;
      text(label, 48, y, { width: 135, color: muted, size: 9 });
      text(value, 190, y, { width: width - 142, size: 9 });
      doc.y += 3;
    }

    // The same Om mark and wordmark used in the site's header.
    doc.roundedRect(48, 44, 48, 48, 12).fill('#ff7722');
    doc.font('devanagari-700').fontSize(29).fillColor('#ffffff').text('ॐ', 54, 56, { width: 36, align: 'center' });
    text('connect2infinity', 108, 45, { bold: true, size: 22, width: 330 });
    text('Parmatma Realization', 109, 77, { size: 9, color: muted });
    text('INVOICE', 48, 111, { bold: true, size: 25 });
    text(data.invoiceNumber, 48, 146, { size: 11, bold: true });
    text(`Issued ${date(data.issuedAt)}  |  ${data.status}`, 48, doc.y + 3, { color: muted, size: 9 });
    doc.y += 7;
    section('BILLING DETAILS');
    const billingY = doc.y;
    text('Billed to', 48, billingY, { size: 9, color: muted });
    let customerY = text(data.customer.name, 48, doc.y + 3, { width: 235, bold: true, size: 12 });
    for (const line of [data.customer.email, data.customer.phone, [data.customer.city, data.customer.postalCode].filter(Boolean).join(' · ')]) {
      if (line) customerY = text(line, 48, customerY + 3, { width: 235, size: 9 });
    }
    text('Issued by', 316, billingY, { size: 9, color: muted, width: 230 });
    let sellerY = text(data.seller.name, 316, doc.y + 3, { width: 230, bold: true, size: 12 });
    for (const line of [data.seller.address, data.seller.email, data.seller.taxId ? `Tax ID: ${data.seller.taxId}` : undefined]) {
      if (line) sellerY = text(line, 316, sellerY + 3, { width: 230, size: 9 });
    }
    doc.y = Math.max(customerY, sellerY);
    section('SUBSCRIPTION');
    text(data.plan.name, 48, doc.y, { bold: true, size: 14 });
    if (data.plan.description) text(data.plan.description, 48, doc.y + 5, { color: muted });
    doc.y += 10;
    detail('Quantity', '1 subscription');
    detail('Included allowance', `${data.plan.questionQuota} questions · ${Math.floor(data.plan.voiceSeconds / 60)}m ${data.plan.voiceSeconds % 60}s call time`);
    if (data.plan.startsAt && data.plan.expiresAt) detail('Validity', `${date(data.plan.startsAt)} to ${date(data.plan.expiresAt)}`);
    section('PAYMENT DETAILS');
    detail('Payment provider', data.provider);
    detail('Order reference', data.providerOrderId);
    detail('Transaction reference', data.providerPaymentId ?? 'Not available');
    detail('Payment reference', data.paymentId);
    detail('Payment status', data.status);
    if (doc.y > doc.page.height - 195) doc.addPage();
    section('TOTALS');
    detail('Subtotal', amount(data.subtotal));
    detail('Tax', amount(data.tax));
    const totalY = doc.y + 4;
    doc.roundedRect(48, totalY, width, 42, 8).fill(navy);
    text('Invoice total', 62, totalY + 10, { bold: true, size: 12, color: '#ffffff', width: 150 });
    text(amount(data.total), 250, totalY + 10, { bold: true, size: 14, color: '#ffffff', width: width - 218 });
    doc.y = totalY + 57;
    text('Thank you for choosing connect2infinity. This is a computer-generated invoice.', 48, doc.y, { size: 8, color: muted });
    const pages = doc.bufferedPageRange();
    for (let i = pages.start; i < pages.start + pages.count; i++) {
      doc.switchToPage(i);
      const bottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font('latin-400').fontSize(8).fillColor(muted).text(`${data.invoiceNumber}  |  Page ${i + 1} of ${pages.count}`, 48, doc.page.height - 30, { width, lineBreak: false, align: 'right' });
      doc.page.margins.bottom = bottom;
    }
    doc.end();
  });
}
