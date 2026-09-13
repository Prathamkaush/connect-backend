import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Master } from '@prisma/client';
import { RedisService } from '../redis/redis.service';
import { CreateMasterDto, UpdateMasterDto } from './dto/master.dto';
import { MastersRepository } from './masters.repository';

@Injectable()
export class MastersService {
  constructor(private readonly masters: MastersRepository, private readonly redis: RedisService, private readonly config: ConfigService) {}
  list() { return this.masters.listPublic(); }
  async bySlug(slug: string) { const master = await this.masters.findPublicBySlug(slug); if (!master) throw new NotFoundException({ code: 'MASTER_NOT_FOUND', message: 'Master not found.' }); return master; }
  async getConfig(id: string): Promise<Master> {
    const key = `master:${id}:config`;
    const cached = await this.redis.getJson<Master>(key);
    if (cached) return { ...cached, createdAt: new Date(cached.createdAt), updatedAt: new Date(cached.updatedAt) };
    const master = await this.masters.findConfigById(id);
    if (!master?.isActive) throw new NotFoundException({ code: 'MASTER_NOT_FOUND', message: 'Master not found.' });
    await this.redis.setJson(key, master, this.config.get<number>('redis.masterCacheTtl', 900));
    return master;
  }
  listAdmin() { return this.masters.listAdmin(); }
  create(dto: CreateMasterDto) { this.assertPromptSafe(dto); this.assertGuideValid(dto.guideContent); return this.masters.create(dto); }
  async update(id: string, dto: UpdateMasterDto) { this.assertPromptSafe(dto); this.assertGuideValid(dto.guideContent); const result = await this.masters.update(id, dto); await this.redis.del(`master:${id}:config`); return result; }
  deactivate(id: string) { return this.update(id, { isActive: false }); }
  private assertPromptSafe(dto: Pick<UpdateMasterDto, 'systemPrompt' | 'personalityPrompt' | 'voiceInstructions'>) {
    const editable = `${dto.systemPrompt ?? ''}\n${dto.personalityPrompt ?? ''}\n${dto.voiceInstructions ?? ''}`;
    if (/\b(ignore|override|bypass|disable)\b.{0,40}\b(system|platform|safety|previous)\b|\breveal\b.{0,30}\b(prompt|instruction|secret)\b/i.test(editable)) throw new BadRequestException({ code: 'UNSAFE_MASTER_PROMPT', message: 'Master instructions cannot override or expose platform safety rules.' });
  }
  private assertGuideValid(blocks?: UpdateMasterDto['guideContent']) {
    if (!blocks) return;
    const fail = () => { throw new BadRequestException({ code: 'INVALID_GUIDE_CONTENT', message: 'One or more guide blocks are invalid.' }); };
    for (const block of blocks) {
      if (!block || typeof block !== 'object' || !('type' in block)) fail();
      const value: Record<string, unknown> = block;
      const text = (key: string, max = 20000) => { const candidate = value[key]; return typeof candidate === 'string' && candidate.trim().length > 0 && candidate.length <= max; };
      if (value.type === 'heading' && (!text('text', 300) || (value.level !== 2 && value.level !== 3))) fail();
      else if (value.type === 'paragraph' && !text('text')) fail();
      else if (value.type === 'quote' && (!text('text', 5000) || (value.attribution !== undefined && typeof value.attribution !== 'string'))) fail();
      else if (value.type === 'image' && (!text('url', 2000) || !text('alt', 300) || !/^https?:\/\//i.test(value.url as string))) fail();
      else if (value.type === 'list') { if (!['bullet', 'numbered'].includes(String(value.style)) || !Array.isArray(value.items) || !value.items.length || value.items.length > 50 || value.items.some((item) => typeof item !== 'string' || !item.trim() || item.length > 2000)) fail(); }
      else if (value.type === 'table') { if (!Array.isArray(value.headers) || !value.headers.length || value.headers.length > 12 || !Array.isArray(value.rows) || value.rows.length > 100 || value.headers.some((cell) => typeof cell !== 'string' || !cell.trim()) || value.rows.some((row) => !Array.isArray(row) || row.length !== (value.headers as unknown[]).length || row.some((cell) => typeof cell !== 'string'))) fail(); }
      else if (!['heading', 'paragraph', 'quote', 'image', 'list', 'table'].includes(String(value.type))) fail();
    }
  }
}
