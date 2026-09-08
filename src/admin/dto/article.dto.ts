import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArticleStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUrl, Length, Matches } from 'class-validator';

export class CreateArticleDto {
  @ApiProperty() @IsString() @Length(3, 180) title: string;
  @ApiProperty() @IsString() @Length(2, 160) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug: string;
  @ApiProperty() @IsString() @Length(10, 500) excerpt: string;
  @ApiProperty() @IsString() @Length(20, 100000) content: string;
  @ApiProperty() @IsString() @Length(2, 80) category: string;
  @ApiProperty() @IsString() @Length(2, 100) author: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl() coverImageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 70) metaTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(10, 170) metaDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 80) focusKeyword?: string;
  @ApiPropertyOptional({ enum: ArticleStatus }) @IsOptional() @IsEnum(ArticleStatus) status?: ArticleStatus;
}

export class UpdateArticleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(3, 180) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 160) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(10, 500) excerpt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(20, 100000) content?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 80) category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 100) author?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl() coverImageUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 70) metaTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(10, 170) metaDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 80) focusKeyword?: string;
  @ApiPropertyOptional({ enum: ArticleStatus }) @IsOptional() @IsEnum(ArticleStatus) status?: ArticleStatus;
}
