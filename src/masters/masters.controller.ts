import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MastersService } from './masters.service';
@ApiTags('masters') @Controller('masters')
export class MastersController {
  constructor(private readonly masters: MastersService) {}
  @Get() list() { return this.masters.list(); }
  @Get(':slug') get(@Param('slug') slug: string) { return this.masters.bySlug(slug); }
}
