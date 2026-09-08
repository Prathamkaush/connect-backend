import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
export class CreateConversationDto { @ApiProperty() @IsString() @Matches(/^c[a-z0-9]{20,30}$/i) masterId: string; }
export class ConversationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^c[a-z0-9]{20,30}$/i) masterId?: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
export class MessageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^c[a-z0-9]{20,30}$/i) cursor?: string;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
