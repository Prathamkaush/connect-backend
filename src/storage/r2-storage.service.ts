import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { StorageService, UploadInput } from './storage.service';

@Injectable()
export class R2StorageService extends StorageService {
  private readonly client: S3Client | null;
  private readonly bucket?: string;
  private readonly publicUrl?: string;
  constructor(config: ConfigService) {
    super();
    const accountId = config.get<string>('CLOUDFLARE_ACCOUNT_ID');
    const accessKeyId = config.get<string>('CLOUDFLARE_R2_ACCESS_KEY');
    const secretAccessKey = config.get<string>('CLOUDFLARE_R2_SECRET_KEY');
    this.bucket = config.get<string>('CLOUDFLARE_R2_BUCKET');
    this.publicUrl = config.get<string>('CLOUDFLARE_PUBLIC_URL')?.replace(/\/$/, '');
    this.client = accountId && accessKeyId && secretAccessKey ? new S3Client({ region: 'auto', endpoint: `https://${accountId}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey } }) : null;
  }
  async upload(input: UploadInput) {
    this.assertConfigured();
    await this.client!.send(new PutObjectCommand({ Bucket: this.bucket!, Key: input.key, Body: input.body, ContentType: input.contentType, CacheControl: input.cacheControl ?? 'public, max-age=31536000, immutable' }));
    return { key: input.key, url: this.getPublicUrl(input.key) };
  }
  async delete(key: string) { this.assertConfigured(); await this.client!.send(new DeleteObjectCommand({ Bucket: this.bucket!, Key: key })); }
  getPublicUrl(key: string) { this.assertConfigured(); return `${this.publicUrl}/${key}`; }
  private assertConfigured() { if (!this.client || !this.bucket || !this.publicUrl) throw new ServiceUnavailableException({ code: 'STORAGE_NOT_CONFIGURED', message: 'Object storage is not configured.' }); }
}
