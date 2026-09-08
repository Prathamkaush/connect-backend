import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';
export class ChatMessageDto {
  @ApiProperty() @IsString() @Matches(/^c[a-z0-9]{20,30}$/i) conversationId: string;
  @ApiProperty({ minLength: 1, maxLength: 4000 }) @IsString() @Length(1, 4000) message: string;
}
