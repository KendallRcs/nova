export interface AuthorizationSubject {
  permissionCodes: readonly string[];
  requiresPasswordChange: boolean;
}

export function hasPermission(subject: AuthorizationSubject, requiredPermission: string): boolean {
  return !subject.requiresPasswordChange && subject.permissionCodes.includes(requiredPermission);
}
