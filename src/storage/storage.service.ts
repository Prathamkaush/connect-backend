export type UploadInput = { key: string; body: Buffer; contentType: string; cacheControl?: string };
export abstract class StorageService {
  abstract upload(input: UploadInput): Promise<{ key: string; url: string }>;
  abstract delete(key: string): Promise<void>;
  abstract getPublicUrl(key: string): string;
}
