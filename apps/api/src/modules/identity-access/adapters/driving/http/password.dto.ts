import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class EstablishPersonalPasswordRequest {
  @ApiProperty({ format: 'password', writeOnly: true, minLength: 10 })
  @IsString()
  @IsNotEmpty()
  newPassword!: string;
}
