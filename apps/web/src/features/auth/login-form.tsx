'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';

import { problemMessage } from '@/shared/api/problem-details';
import { sessionQueryKey, startSession, type LoginInput } from './auth-api';
import { Brand } from './session-entry';
import styles from './auth.module.css';

export function LoginForm({ passwordUpdated = false }: Readonly<{ passwordUpdated?: boolean }>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const form = useForm<LoginInput>({ defaultValues: { username: '', password: '' } });
  const login = useMutation({
    mutationFn: startSession,
    onSuccess(actor) {
      queryClient.setQueryData(sessionQueryKey, actor);
      router.replace(actor.requiresPasswordChange ? '/password' : '/home');
    },
  });

  return (
    <main className={styles.authPage}>
      <section className={styles.tracePanel} aria-labelledby="trace-title">
        <Brand />
        <div className={styles.traceContent}>
          <p className={styles.kicker}>Tu negocio, con memoria</p>
          <h1 id="trace-title">Cada movimiento deja un rastro claro.</h1>
          <p>Stock, ventas y pagos permanecen conectados para que siempre puedas saber qué pasó.</p>
          <ol className={styles.traceList} aria-label="Rastro de una operación">
            <li>
              <span aria-hidden="true" />
              <div>
                <strong>Venta registrada</strong>
                <small>Responsable y momento exacto</small>
              </div>
            </li>
            <li>
              <span aria-hidden="true" />
              <div>
                <strong>Stock actualizado</strong>
                <small>Tienda y almacén por separado</small>
              </div>
            </li>
            <li>
              <span aria-hidden="true" />
              <div>
                <strong>Saldo visible</strong>
                <small>Pagos vinculados al cliente</small>
              </div>
            </li>
          </ol>
        </div>
        <p className={styles.traceFootnote}>Sistema interno · Datos protegidos por perfil</p>
      </section>

      <section className={styles.formPanel} aria-labelledby="login-title">
        <div className={styles.mobileBrand}>
          <Brand />
        </div>
        <div className={styles.formWrap}>
          <p className={styles.kicker}>Acceso al sistema</p>
          <h2 id="login-title">Ingresa a Nova</h2>
          <p className={styles.intro}>Usa la cuenta que te asignó el administrador.</p>

          {passwordUpdated ? (
            <div className={styles.successMessage} role="status">
              Contraseña creada. Ingresa nuevamente con tu contraseña personal.
            </div>
          ) : null}

          {login.error !== null ? (
            <div className={styles.errorMessage} role="alert">
              <strong>No pudimos iniciar sesión</strong>
              <span>{problemMessage(login.error)}</span>
            </div>
          ) : null}

          <form
            className={styles.form}
            onSubmit={(event) => {
              void form.handleSubmit((values) => {
                login.mutate(values);
              })(event);
            }}
          >
            <label className={styles.field}>
              <span>Usuario</span>
              <input
                autoComplete="username"
                inputMode="text"
                aria-invalid={form.formState.errors.username !== undefined}
                {...form.register('username', {
                  required: 'Escribe tu nombre de usuario.',
                  setValueAs: (value: string) => value.trim(),
                })}
              />
              {form.formState.errors.username ? (
                <small role="alert">{form.formState.errors.username.message}</small>
              ) : null}
            </label>

            <label className={styles.field}>
              <span>Contraseña</span>
              <input
                type="password"
                autoComplete="current-password"
                aria-invalid={form.formState.errors.password !== undefined}
                {...form.register('password', { required: 'Escribe tu contraseña.' })}
              />
              {form.formState.errors.password ? (
                <small role="alert">{form.formState.errors.password.message}</small>
              ) : null}
            </label>

            <button className={styles.primaryButton} type="submit" disabled={login.isPending}>
              {login.isPending ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>

          <div className={styles.helpText}>
            <strong>¿Olvidaste tu contraseña?</strong>
            <span>Solicita al administrador una credencial temporal.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
