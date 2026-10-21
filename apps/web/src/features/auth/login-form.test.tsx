import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithQueryClient } from '@/test/render';
import { LoginForm } from './login-form';

const auth = vi.hoisted(() => ({ startSession: vi.fn() }));
const navigation = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock('./auth-api', () => ({
  sessionQueryKey: ['current-actor'],
  startSession: auth.startSession,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: navigation.replace }),
}));

describe('LoginForm', () => {
  beforeEach(() => {
    auth.startSession.mockReset();
  });

  it('explains which required credentials are missing', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<LoginForm />);

    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Escribe tu nombre de usuario.')).toBeInTheDocument();
    expect(screen.getByText('Escribe tu contraseña.')).toBeInTheDocument();
    expect(auth.startSession).not.toHaveBeenCalled();
  });

  it('sends trimmed credentials and routes a temporary account to password setup', async () => {
    const user = userEvent.setup();
    auth.startSession.mockResolvedValue({
      userId: '01900000-0000-7000-8000-000000000001',
      username: 'empleada',
      permissionCodes: ['catalog:read'],
      requiresPasswordChange: true,
    });
    renderWithQueryClient(<LoginForm />);

    await user.type(screen.getByRole('textbox', { name: 'Usuario' }), '  empleada  ');
    await user.type(screen.getByLabelText('Contraseña'), 'temporal-segura');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => {
      expect(auth.startSession).toHaveBeenNthCalledWith(
        1,
        { username: 'empleada', password: 'temporal-segura' },
        expect.anything(),
      );
      expect(navigation.replace).toHaveBeenCalledWith('/password');
    });
  });
});
