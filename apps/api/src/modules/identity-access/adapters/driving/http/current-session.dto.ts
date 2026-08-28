import { ApiProperty } from '@nestjs/swagger';

export class CurrentActorResponse {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ type: [String] })
  permissionCodes!: string[];

  @ApiProperty()
  requiresPasswordChange!: boolean;
}
