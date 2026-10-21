import type { components } from '@/shared/api/schema';
import { apiClient } from '@/shared/api/client';
import { ApiProblem, toApiProblem } from '@/shared/api/problem-details';

export type Actor = components['schemas']['CurrentActorResponse'];
export type LoginInput = components['schemas']['StartSessionRequest'];

export const sessionQueryKey = ['current-actor'] as const;

export async function getCurrentActor(): Promise<Actor> {
  const { data, error, response } = await apiClient.GET('/api/v1/auth/me');
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data;
}

export async function startSession(input: LoginInput): Promise<Actor> {
  const { data, error, response } = await apiClient.POST('/api/v1/auth/sessions', {
    body: input,
  });
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data.actor;
}

export async function establishPassword(newPassword: string): Promise<void> {
  const { error, response } = await apiClient.PUT('/api/v1/auth/password', {
    body: { newPassword },
  });
  if (!response.ok) throw toApiProblem(response, error);
}

export async function closeSession(): Promise<void> {
  const { error, response } = await apiClient.DELETE('/api/v1/auth/sessions/current');
  if (!response.ok) throw toApiProblem(response, error);
}

export function hasPermission(actor: Actor, permission: string): boolean {
  return actor.permissionCodes.includes(permission);
}

export function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiProblem && error.problem.status === 401;
}
