import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class PaymentHistoryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 5;
  @IsOptional() @IsDateString() before?: string;
  @IsOptional() @Matches(/^c[a-z0-9]{20,30}$/i) beforeId?: string;
}
