import { createHash, randomUUID } from 'node:crypto';
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const newRequestId = () => randomUUID();
