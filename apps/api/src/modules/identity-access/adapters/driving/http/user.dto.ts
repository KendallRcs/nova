import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

import type { UserAccountSummary } from '../../../hexagon/application/user-account-directory';

export class CreateUserAccountRequest {
  @ApiProperty({ example: 'empleado1' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ enum: ['administrator', 'employee'] })
  @IsIn(['administrator', 'employee'])
  profile!: 'administrator' | 'employee';
}

export class UserAccountResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ enum: ['administrator', 'employee'] })
  profile!: 'administrator' | 'employee';

  @ApiProperty({ enum: ['active', 'inactive', 'password-change-required'] })
  status!: 'active' | 'inactive' | 'password-change-required';

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class UserAccountListResponse {
  @ApiProperty({ type: [UserAccountResponse] })
  items!: UserAccountResponse[];
}

export class TemporaryCredentialResponse {
  @ApiProperty({ description: 'Se muestra una sola vez y no puede recuperarse después.' })
  temporaryPassword!: string;
}

export class UserAccountWithTemporaryCredentialResponse extends TemporaryCredentialResponse {
  @ApiProperty({ type: UserAccountResponse })
  account!: UserAccountResponse;
}

export function presentUserAccount(account: UserAccountSummary): UserAccountResponse {
  return {
    id: account.id,
    username: account.username,
    profile: account.profile,
    status: account.status,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}
