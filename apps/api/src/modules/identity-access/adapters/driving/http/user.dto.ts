import { ApiProperty } from '@nestjs/swagger';

export class TemporaryCredentialResponse {
  @ApiProperty({ description: 'Se muestra una sola vez y no puede recuperarse después.' })
  temporaryPassword!: string;
}
