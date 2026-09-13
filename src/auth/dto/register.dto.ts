import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
export class RegisterDto {
  @ApiProperty() @IsString() @Length(2, 80) name: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty({ example: '+919876543210' })
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().replace(/[\s()-]/g, '') : value)
  @IsString() @Matches(/^\+?[0-9]{7,15}$/, { message: 'phone must contain 7 to 15 digits, optionally starting with +' }) phone: string;
  @ApiProperty() @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(2, 100) city: string;
  @ApiProperty() @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString() @Matches(/^[A-Z0-9][A-Z0-9 -]{1,11}$/, { message: 'postalCode must contain 2 to 12 letters, digits, spaces or hyphens' }) postalCode: string;
  @ApiProperty({ minLength: 10 }) @IsString() @Length(10, 72) @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, { message: 'password must contain upper, lower and numeric characters' }) password: string;
}
