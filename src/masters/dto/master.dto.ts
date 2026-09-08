import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, IsUrl, Length, Matches, Max, Min } from 'class-validator';

export type GuideBlock =
  | { type: 'heading'; text: string; level: 2 | 3 }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; style: 'bullet' | 'numbered'; items: string[] }
  | { type: 'quote'; text: string; attribution?: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'image'; url: string; alt: string; caption?: string };

export class CreateMasterDto {
  @ApiProperty() @IsString() @Length(2, 100) name: string;
  @ApiProperty() @IsString() @Length(2, 100) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug: string;
  @ApiProperty() @IsString() @Length(10, 240) shortDescription: string;
  @ApiProperty() @IsString() @Length(20, 10000) description: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 100) tradition?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 100) era?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 180) guideTitle?: string;
  @ApiPropertyOptional({ type: 'array', description: 'Structured guide blocks: heading, paragraph, list, quote, table, or image.' }) @IsOptional() @IsArray() @ArrayMaxSize(100) guideContent?: GuideBlock[];
  @ApiPropertyOptional() @IsOptional() @IsUrl() imageUrl?: string;
  @ApiProperty() @IsString() @Length(20, 20000) systemPrompt: string;
  @ApiProperty() @IsString() @Length(20, 20000) personalityPrompt: string;
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) allowedTopics: string[];
  @ApiProperty({ type: [String] }) @IsArray() @IsString({ each: true }) restrictedTopics: string[];
  @ApiProperty() @IsString() @Length(2, 1000) responseStyle: string;
  @ApiProperty() @IsString() @Length(2, 2000) fallbackMessage: string;
  @ApiProperty() @IsString() @Length(2, 2000) greetingMessage: string;
  @ApiProperty() @IsString() model: string;
  @ApiProperty() @IsNumber() @Min(0) @Max(2) temperature: number;
  @ApiProperty() @IsInt() @Min(64) @Max(8192) maxOutputTokens: number;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateMasterDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 100) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(10, 240) shortDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(20, 10000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 100) tradition?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 100) era?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 180) guideTitle?: string;
  @ApiPropertyOptional({ type: 'array' }) @IsOptional() @IsArray() @ArrayMaxSize(100) guideContent?: GuideBlock[];
  @ApiPropertyOptional() @IsOptional() @IsUrl() imageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(20, 20000) systemPrompt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(20, 20000) personalityPrompt?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) allowedTopics?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) restrictedTopics?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() responseStyle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() fallbackMessage?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() greetingMessage?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() model?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(2) temperature?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(64) @Max(8192) maxOutputTokens?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
