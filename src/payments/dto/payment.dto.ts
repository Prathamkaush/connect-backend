import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
export class CreateOrderDto { @ApiProperty() @IsString() @Matches(/^c[a-z0-9]{20,30}$/i) planId: string; }
export class VerifyPaymentDto {
  @ApiProperty() @IsString() razorpayOrderId: string;
  @ApiProperty() @IsString() razorpayPaymentId: string;
  @ApiProperty() @IsString() razorpaySignature: string;
}
