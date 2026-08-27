import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class StartSessionRequest {
  @ApiProperty({ example: 'empleado1' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ format: 'password', writeOnly: true })
  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class SessionActorResponse {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ type: [String] })
  permissionCodes!: string[];

  @ApiProperty()
  requiresPasswordChange!: boolean;
}

export class StartSessionResponse {
  @ApiProperty({ type: SessionActorResponse })
  actor!: SessionActorResponse;
}
