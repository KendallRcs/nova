import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSION_METADATA = 'nova.required-permission';

export const RequirePermission = (permissionCode: string): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_PERMISSION_METADATA, permissionCode);
