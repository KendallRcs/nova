'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type SyntheticEvent } from 'react';

import { newOperationId } from '@/shared/api/idempotency';
import { problemMessage } from '@/shared/api/problem-details';
import {
  customerAccountsQueryRoot,
  customersQueryRoot,
  mergeCustomers,
  searchCustomers,
  type Customer,
  type CustomerInput,
  type CustomerMerge,
} from './customers-api';
import styles from './customers.module.css';

interface Attempt {
  signature: string;
  operationId: string;
}

export function CustomerMergeForm({
  onCancel,
  onDone,
}: Readonly<{ onCancel: () => void; onDone: (merge: CustomerMerge) => void }>) {
  const queryClient = useQueryClient();
  const attempt = useRef<Attempt | null>(null);
  const [primary, setPrimary] = useState<Customer | null>(null);
  const [duplicate, setDuplicate] = useState<Customer | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dni, setDni] = useState('');
  const [address, setAddress] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const resolved: CustomerInput = {
    name: name.trim(),
    phone: phone.trim(),
    dni: dni.trim() || null,
    address: address.trim() || null,
  };
  const ready =
    primary !== null &&
    duplicate !== null &&
    primary.id !== duplicate.id &&
    resolved.name.length > 0 &&
    resolved.phone.length > 0 &&
    acknowledged;
  const merge = useMutation({
    mutationFn: async () => {
      if (primary === null || duplicate === null) throw new Error('Customer selection is missing.');
      const signature = JSON.stringify({
        primaryId: primary.id,
        primaryVersion: primary.version,
        duplicateId: duplicate.id,
        duplicateVersion: duplicate.version,
        resolved,
      });
      if (attempt.current?.signature !== signature) {
        attempt.current = { signature, operationId: newOperationId() };
      }
      return mergeCustomers({
        operationId: attempt.current.operationId,
        primary,
        duplicate,
        resolved,
      });
    },
    onSuccess(result) {
      attempt.current = null;
      void queryClient.invalidateQueries({ queryKey: customersQueryRoot });
      void queryClient.invalidateQueries({ queryKey: customerAccountsQueryRoot });
      onDone(result);
    },
  });

  function choosePrimary(customer: Customer) {
    setPrimary(customer);
    if (duplicate?.id === customer.id) setDuplicate(null);
    setName(customer.name);
    setPhone(customer.phone);
    setDni(customer.dni ?? '');
    setAddress(customer.address ?? '');
    setAcknowledged(false);
    merge.reset();
  }

  function chooseDuplicate(customer: Customer) {
    setDuplicate(customer);
    if (primary?.id === customer.id) setPrimary(null);
    setAcknowledged(false);
    merge.reset();
  }

  function swapCustomers() {
    if (primary === null || duplicate === null) return;
    const previousPrimary = primary;
    choosePrimary(duplicate);
    setDuplicate(previousPrimary);
  }

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (ready) merge.mutate();
  }

  return (
    <form className={styles.mergeDesk} onSubmit={submit} noValidate>
      <header className={styles.formHeading}>
        <div>
          <p className={styles.kicker}>Solo administración</p>
          <strong>Fusionar clientes duplicados</strong>
          <p>
            Elige el registro que permanecerá activo y luego revisa la identidad final del cliente.
          </p>
        </div>
        <button type="button" onClick={onCancel}>
          Cerrar
        </button>
      </header>

      <div className={styles.mergePickers}>
        <CustomerPicker
          kind="primary"
          title="Cliente principal"
          detail="Este registro permanecerá activo."
          selected={primary}
          {...(duplicate === null ? {} : { excludedId: duplicate.id })}
          onSelect={choosePrimary}
          onClear={() => {
            setPrimary(null);
            setAcknowledged(false);
          }}
        />
        <CustomerPicker
          kind="duplicate"
          title="Registro duplicado"
          detail="Este registro se desactivará."
          selected={duplicate}
          {...(primary === null ? {} : { excludedId: primary.id })}
          onSelect={chooseDuplicate}
          onClear={() => {
            setDuplicate(null);
            setAcknowledged(false);
          }}
        />
      </div>

      {primary !== null && duplicate !== null ? (
        <div className={styles.mergeResolution}>
          <div className={styles.mergeResolutionHeading}>
            <div>
              <p className={styles.kicker}>Identidad resultante</p>
              <strong>Confirma los datos que se conservarán</strong>
            </div>
            <button type="button" onClick={swapCustomers}>
              Intercambiar principal y duplicado
            </button>
          </div>
          <div className={styles.mergeComparison} aria-label="Comparación de clientes">
            <IdentitySummary label="Principal" customer={primary} />
            <IdentitySummary label="Duplicado" customer={duplicate} />
          </div>
          <div className={styles.formGrid}>
            <label>
              <span>Nombre final</span>
              <input
                aria-label="Nombre final"
                value={name}
                maxLength={160}
                onChange={(event) => {
                  setName(event.target.value);
                }}
              />
            </label>
            <label>
              <span>Teléfono final</span>
              <input
                aria-label="Teléfono final"
                value={phone}
                maxLength={32}
                inputMode="tel"
                onChange={(event) => {
                  setPhone(event.target.value);
                }}
              />
            </label>
            <label>
              <span>
                DNI final <small>Opcional</small>
              </span>
              <input
                aria-label="DNI final"
                value={dni}
                inputMode="numeric"
                onChange={(event) => {
                  setDni(event.target.value);
                }}
              />
            </label>
            <label>
              <span>
                Dirección final <small>Opcional</small>
              </span>
              <input
                aria-label="Dirección final"
                value={address}
                maxLength={500}
                onChange={(event) => {
                  setAddress(event.target.value);
                }}
              />
            </label>
          </div>
          <label className={styles.mergeAcknowledgement}>
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => {
                setAcknowledged(event.target.checked);
              }}
            />
            <span>
              Entiendo que <strong>{duplicate.name}</strong> se desactivará y que su historial se
              consultará desde <strong>{primary.name}</strong>.
            </span>
          </label>
        </div>
      ) : null}

      {merge.isError ? (
        <p className={styles.formError} role="alert">
          {problemMessage(merge.error)} Actualiza la selección si alguno de los registros cambió.
        </p>
      ) : null}
      <div className={styles.formActions}>
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" disabled={!ready || merge.isPending}>
          {merge.isPending ? 'Fusionando…' : 'Fusionar y conservar principal'}
        </button>
      </div>
    </form>
  );
}

function CustomerPicker({
  kind,
  title,
  detail,
  selected,
  excludedId,
  onSelect,
  onClear,
}: Readonly<{
  kind: 'primary' | 'duplicate';
  title: string;
  detail: string;
  selected: Customer | null;
  excludedId?: string;
  onSelect: (customer: Customer) => void;
  onClear: () => void;
}>) {
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const customers = useQuery({
    queryKey: [...customersQueryRoot, 'merge-picker', kind, query],
    queryFn: () => searchCustomers(query),
  });

  return (
    <section className={styles.mergePicker} aria-labelledby={`${kind}-customer-title`}>
      <div>
        <strong id={`${kind}-customer-title`}>{title}</strong>
        <p>{detail}</p>
      </div>
      {selected === null ? (
        <>
          <div className={styles.pickerSearch} role="search">
            <input
              aria-label={`Buscar ${title.toLowerCase()}`}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
              }}
              placeholder="Nombre o teléfono"
            />
            <button
              type="button"
              onClick={() => {
                setQuery(draft.trim());
              }}
            >
              Buscar
            </button>
          </div>
          <div className={styles.pickerResults} aria-live="polite">
            {customers.isPending ? <span>Buscando clientes…</span> : null}
            {customers.isError ? <span>No pudimos cargar los clientes.</span> : null}
            {customers.data
              ?.filter((customer) => customer.id !== excludedId)
              .slice(0, 6)
              .map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  aria-label={`Elegir a ${customer.name}, teléfono ${customer.phone} como ${title.toLowerCase()}`}
                  onClick={() => {
                    onSelect(customer);
                  }}
                >
                  <span>
                    <strong>{customer.name}</strong>
                    <small>{customer.phone}</small>
                  </span>
                  <b>Elegir</b>
                </button>
              ))}
            {customers.data?.filter((customer) => customer.id !== excludedId).length === 0 ? (
              <span>No encontramos otro cliente con esa búsqueda.</span>
            ) : null}
          </div>
        </>
      ) : (
        <div className={styles.selectedCustomer}>
          <span>
            <strong>{selected.name}</strong>
            <small>{selected.phone}</small>
          </span>
          <button type="button" onClick={onClear}>
            Cambiar
          </button>
        </div>
      )}
    </section>
  );
}

function IdentitySummary({ label, customer }: Readonly<{ label: string; customer: Customer }>) {
  return (
    <article>
      <span>{label}</span>
      <strong>{customer.name}</strong>
      <dl>
        <div>
          <dt>Teléfono</dt>
          <dd>{customer.phone}</dd>
        </div>
        <div>
          <dt>DNI</dt>
          <dd>{customer.dni ?? 'No registrado'}</dd>
        </div>
        <div>
          <dt>Dirección</dt>
          <dd>{customer.address ?? 'No registrada'}</dd>
        </div>
      </dl>
    </article>
  );
}
