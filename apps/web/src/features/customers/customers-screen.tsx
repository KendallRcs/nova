'use client';

import { useQuery } from '@tanstack/react-query';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type SyntheticEvent } from 'react';

import { getCurrentActor, hasPermission, sessionQueryKey } from '@/features/auth/auth-api';
import { problemMessage } from '@/shared/api/problem-details';
import { formatDate } from '@/shared/formatters';
import { Icon } from '@/shared/ui/icons';
import { ModuleStart } from '@/shared/ui/module-start';
import { CustomerForm } from './customer-form';
import { CustomerMergeForm } from './customer-merge-form';
import {
  customersQueryKey,
  searchCustomers,
  type Customer,
  type CustomerMerge,
} from './customers-api';
import styles from './customers.module.css';

export function CustomersScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q')?.trim() ?? '';
  const actor = useQuery({ queryKey: sessionQueryKey, queryFn: getCurrentActor, retry: false });
  const customers = useQuery({
    queryKey: customersQueryKey(query),
    queryFn: () => searchCustomers(query),
  });
  const [form, setForm] = useState<'create' | 'merge' | Customer | null>(null);
  const [saved, setSaved] = useState<Customer | null>(null);
  const [merged, setMerged] = useState<CustomerMerge | null>(null);
  const canWrite = actor.data !== undefined && hasPermission(actor.data, 'customers:write-basic');
  const canMerge = actor.data !== undefined && hasPermission(actor.data, 'customers:merge');

  function submitSearch(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('q');
    const normalized = typeof value === 'string' ? value.trim() : '';
    router.replace(normalized ? `/customers?q=${encodeURIComponent(normalized)}` : '/customers');
  }

  return (
    <ModuleStart
      title="Clientes"
      description="Encuentra a una persona y revisa sus ventas, pagos y saldo vigente."
      help="Cada pago pertenece a una venta. La cuenta del cliente reúne todos sus acuerdos sin perder el detalle de cada operación."
    >
      <section className={styles.commandBar} aria-labelledby="customer-search-title">
        <div>
          <p className={styles.kicker}>Directorio</p>
          <h2 id="customer-search-title">Busca por nombre o teléfono</h2>
        </div>
        <form role="search" onSubmit={submitSearch}>
          <Icon name="search" />
          <input
            key={query}
            name="q"
            type="search"
            defaultValue={query}
            aria-label="Nombre o teléfono del cliente"
            placeholder="Ej. María o 999 888 777"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                router.replace('/customers');
              }}
            >
              Limpiar
            </button>
          ) : null}
          <button type="submit">Buscar</button>
        </form>
        {(canWrite || canMerge) && form === null ? (
          <div className={styles.commandActions}>
            {canMerge ? (
              <button
                type="button"
                onClick={() => {
                  setSaved(null);
                  setMerged(null);
                  setForm('merge');
                }}
              >
                Fusionar duplicados
              </button>
            ) : null}
            {canWrite ? (
              <button
                className={styles.newButton}
                type="button"
                onClick={() => {
                  setSaved(null);
                  setMerged(null);
                  setForm('create');
                }}
              >
                Registrar cliente
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      {form !== null && form !== 'merge' ? (
        <CustomerForm
          {...(form === 'create' ? {} : { customer: form })}
          onCancel={() => {
            setForm(null);
          }}
          onDone={(customer) => {
            setForm(null);
            setSaved(customer);
          }}
        />
      ) : null}
      {form === 'merge' ? (
        <CustomerMergeForm
          onCancel={() => {
            setForm(null);
          }}
          onDone={(result) => {
            setForm(null);
            setMerged(result);
          }}
        />
      ) : null}
      {saved !== null ? (
        <p className={styles.savedNotice} role="status">
          <span>{saved.name} quedó guardado.</span>
          <Link href={`/customers/${saved.id}` as Route}>Ver su cuenta</Link>
        </p>
      ) : null}
      {merged !== null ? (
        <p className={styles.savedNotice} role="status">
          <span>Los registros se fusionaron en {merged.name}.</span>
          <Link href={`/customers/${merged.primaryCustomerId}` as Route}>
            Ver cuenta consolidada
          </Link>
        </p>
      ) : null}

      <section
        className={styles.directory}
        aria-labelledby="customer-list-title"
        aria-live="polite"
      >
        <header>
          <div>
            <p className={styles.kicker}>{query ? 'Coincidencias' : 'Clientes activos'}</p>
            <h2 id="customer-list-title">
              {query ? `Resultados para “${query}”` : 'Personas registradas'}
            </h2>
          </div>
          {!customers.isPending && !customers.isError ? (
            <span>
              {customers.data.length} {customers.data.length === 1 ? 'cliente' : 'clientes'}
            </span>
          ) : null}
        </header>
        {customers.isPending ? <DirectorySkeleton /> : null}
        {customers.isError ? (
          <Feedback
            title="No pudimos cargar los clientes"
            detail={problemMessage(customers.error)}
            action="Intentar nuevamente"
            onAction={() => {
              void customers.refetch();
            }}
          />
        ) : null}
        {customers.data?.length === 0 ? (
          <Feedback
            title={query ? 'No encontramos clientes' : 'Todavía no hay clientes'}
            detail={
              query
                ? 'Prueba con otro nombre o revisa el teléfono.'
                : 'Registra al primer cliente cuando necesites identificar una venta.'
            }
            {...(query ? { action: 'Ver todos' } : canWrite ? { action: 'Registrar cliente' } : {})}
            onAction={() => {
              if (query) router.replace('/customers');
              else setForm('create');
            }}
          />
        ) : null}
        {customers.data?.map((customer) => (
          <CustomerRow
            key={customer.id}
            customer={customer}
            canWrite={canWrite}
            onEdit={() => {
              setSaved(null);
              setForm(customer);
            }}
          />
        ))}
      </section>
    </ModuleStart>
  );
}

function CustomerRow({
  customer,
  canWrite,
  onEdit,
}: Readonly<{ customer: Customer; canWrite: boolean; onEdit: () => void }>) {
  return (
    <article className={styles.customerRow}>
      <Link href={`/customers/${customer.id}` as Route}>
        <span className={styles.avatar} aria-hidden="true">
          {initials(customer.name)}
        </span>
        <span className={styles.identity}>
          <strong>{customer.name}</strong>
          <small>Actualizado {formatDate(customer.updatedAt)}</small>
        </span>
        <span className={styles.contact}>
          <small>Teléfono</small>
          <strong>{customer.phone}</strong>
        </span>
        <span className={styles.document}>
          <small>DNI</small>
          <strong>{customer.dni ?? 'No registrado'}</strong>
        </span>
        <Icon name="arrow" />
      </Link>
      {canWrite ? (
        <button type="button" onClick={onEdit}>
          Editar
        </button>
      ) : null}
    </article>
  );
}

function Feedback({
  title,
  detail,
  action,
  onAction,
}: Readonly<{ title: string; detail: string; action?: string; onAction: () => void }>) {
  return (
    <div className={styles.feedback}>
      <strong>{title}</strong>
      <p>{detail}</p>
      {action ? (
        <button type="button" onClick={onAction}>
          {action}
        </button>
      ) : null}
    </div>
  );
}

function DirectorySkeleton() {
  return (
    <div className={styles.skeleton} aria-label="Cargando clientes">
      {[0, 1, 2].map((item) => (
        <span key={item} />
      ))}
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
