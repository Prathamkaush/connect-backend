import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches } from 'class-validator';
export class RegisterDto {
  @ApiProperty() @IsString() @Length(2, 80) name: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty({ minLength: 10 }) @IsString() @Length(10, 72) @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, { message: 'password must contain upper, lower and numeric characters' }) password: string;
}
