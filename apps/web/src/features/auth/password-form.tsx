'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { problemMessage } from '@/shared/api/problem-details';
import { establishPassword, getCurrentActor, isUnauthenticated, sessionQueryKey } from './auth-api';
import { Brand } from './session-entry';
import styles from './auth.module.css';

interface PasswordFields {
  newPassword: string;
  confirmation: string;
}

export function PasswordForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: sessionQueryKey, queryFn: getCurrentActor, retry: false });
  const form = useForm<PasswordFields>({ defaultValues: { newPassword: '', confirmation: '' } });
  const password = useMutation({
    mutationFn: establishPassword,
    onSuccess() {
      queryClient.removeQueries({ queryKey: sessionQueryKey });
      router.replace('/login?password=updated');
    },
  });

  useEffect(() => {
    if (session.error !== null && isUnauthenticated(session.error)) router.replace('/login');
    if (session.data !== undefined && !session.data.requiresPasswordChange) router.replace('/home');
  }, [router, session.data, session.error]);

  return (
    <main className={styles.passwordPage}>
      <header className={styles.passwordHeader}>
        <Brand />
        <span>Primer acceso</span>
      </header>
      <section className={styles.passwordCard} aria-labelledby="password-title">
        <p className={styles.kicker}>Protege tu cuenta</p>
        <h1 id="password-title">Crea tu contraseña personal</h1>
        <p className={styles.intro}>
          La credencial temporal dejará de funcionar. Después volverás a ingresar con la nueva.
        </p>

        {password.error !== null ? (
          <div className={styles.errorMessage} role="alert">
            <strong>Revisa la contraseña</strong>
            <span>{problemMessage(password.error)}</span>
          </div>
        ) : null}

        <form
          className={styles.form}
          onSubmit={(event) => {
            void form.handleSubmit(({ newPassword }) => {
              password.mutate(newPassword);
            })(event);
          }}
        >
          <label className={styles.field}>
            <span>Nueva contraseña</span>
            <input
              type="password"
              autoComplete="new-password"
              aria-describedby="password-rules"
              aria-invalid={form.formState.errors.newPassword !== undefined}
              {...form.register('newPassword', {
                required: 'Escribe una contraseña nueva.',
                minLength: { value: 10, message: 'Usa al menos 10 caracteres.' },
                validate: (value) =>
                  value.toLocaleLowerCase('es-PE') !==
                    session.data?.username.toLocaleLowerCase('es-PE') ||
                  'La contraseña no puede ser igual a tu usuario.',
              })}
            />
            {form.formState.errors.newPassword ? (
              <small role="alert">{form.formState.errors.newPassword.message}</small>
            ) : null}
          </label>
          <div className={styles.passwordRules} id="password-rules">
            <span aria-hidden="true">✓</span>
            Usa al menos 10 caracteres y no repitas tu usuario.
          </div>
          <label className={styles.field}>
            <span>Repite la contraseña</span>
            <input
              type="password"
              autoComplete="new-password"
              aria-invalid={form.formState.errors.confirmation !== undefined}
              {...form.register('confirmation', {
                required: 'Repite la contraseña.',
                validate: (value) =>
                  value === form.getValues('newPassword') || 'Las contraseñas no coinciden.',
              })}
            />
            {form.formState.errors.confirmation ? (
              <small role="alert">{form.formState.errors.confirmation.message}</small>
            ) : null}
          </label>
          <button className={styles.primaryButton} type="submit" disabled={password.isPending}>
            {password.isPending ? 'Creando contraseña…' : 'Crear contraseña'}
          </button>
        </form>
      </section>
    </main>
  );
}
