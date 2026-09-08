import { ApiProperty } from '@nestjs/swagger';
import { IsDefined } from 'class-validator';
export class UpdateSettingDto { @ApiProperty() @IsDefined() value: unknown; }
