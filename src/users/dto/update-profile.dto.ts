import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
export class UpdateProfileDto {
  @ApiPropertyOptional() @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(2, 80) name?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().replace(/[\s()-]/g, '') || null : value)
  @IsString() @Matches(/^\+?[0-9]{7,15}$/, { message: 'phone must contain 7 to 15 digits, optionally starting with +' }) phone?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() || null : value)
  @IsString() @Length(2, 100) city?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() || null : value)
  @IsString() @Matches(/^[A-Z0-9][A-Z0-9 -]{1,11}$/, { message: 'postalCode must contain 2 to 12 letters, digits, spaces or hyphens' }) postalCode?: string | null;
}
