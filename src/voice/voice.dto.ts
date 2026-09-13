import { IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';

export class CreateVoiceCallDto {
  @IsString() @Length(1, 100) masterId: string;
  @IsUUID() requestId: string;
  @IsOptional() @IsString() @Length(1, 100) conversationId?: string;
  @IsString() @Length(40, 30000) sdp: string;
}

export class EndVoiceCallDto {
  @IsOptional() @IsString() @MaxLength(40) reason?: string;
}
