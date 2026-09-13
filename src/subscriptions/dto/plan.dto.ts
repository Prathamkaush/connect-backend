import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';
export class CreatePlanDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() voiceEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(360000) voiceSeconds?: number;
  @ApiProperty() @IsString() @Length(2, 80) name: string;
  @ApiProperty() @IsString() @Length(2, 500) description: string;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price: number;
  @ApiProperty({ default: 'INR' }) @IsString() @IsIn(['INR', 'USD', 'EUR']) currency = 'INR';
  @ApiProperty() @IsInt() @Min(1) questionQuota: number;
  @ApiProperty() @IsInt() @Min(1) validityDays: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdatePlanDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() voiceEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(360000) voiceSeconds?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 80) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 500) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsIn(['INR', 'USD', 'EUR']) currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) questionQuota?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) validityDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
