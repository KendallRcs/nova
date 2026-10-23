'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type SyntheticEvent } from 'react';

import { problemMessage } from '@/shared/api/problem-details';
import { formatMoney } from '@/shared/formatters';
import {
  advancesQueryRoot,
  newOperationId,
  paymentMethodLabels,
  registerSupplier,
  registerSupplierAdvance,
  resolveSupplierAdvance,
  suppliersQueryRoot,
  type PaymentMethod,
  type Supplier,
  type SupplierAdvance,
} from './procurement-api';
import styles from './procurement.module.css';

interface Attempt {
  signature: string;
  operationId: string;
}

export function SupplierForm({ onClose }: Readonly<{ onClose: () => void }>) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Supplier['kind']>('registered');
  const [phone, setPhone] = useState('');
  const [document, setDocument] = useState('');
  const [description, setDescription] = useState('');
  const save = useMutation({
    mutationFn: () =>
      registerSupplier({
        name: name.trim(),
        kind,
        phone: phone.trim() || null,
        document: document.trim() || null,
        description: description.trim() || null,
      }),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: suppliersQueryRoot });
      onClose();
    },
  });

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim()) save.mutate();
  }

  return (
    <form className={styles.composer} onSubmit={submit} noValidate>
      <FormHeading
        title="Registrar proveedor"
        detail="Usa una identidad estable incluso si solo le compras ocasionalmente."
        onClose={onClose}
      />
      <div className={styles.formGrid}>
        <label>
          <span>Nombre</span>
          <input
            value={name}
            maxLength={200}
            autoFocus
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
        </label>
        <label>
          <span>Tipo</span>
          <select
            value={kind}
            onChange={(event) => {
              setKind(event.target.value as Supplier['kind']);
            }}
          >
            <option value="registered">Registrado</option>
            <option value="occasional">Ocasional</option>
          </select>
        </label>
        <label>
          <span>Teléfono · opcional</span>
          <input
            value={phone}
            maxLength={50}
            inputMode="tel"
            onChange={(event) => {
              setPhone(event.target.value);
            }}
          />
        </label>
        <label>
          <span>Documento · opcional</span>
          <input
            value={document}
            maxLength={50}
            onChange={(event) => {
              setDocument(event.target.value);
            }}
          />
        </label>
      </div>
      <label className={styles.wideField}>
        <span>Descripción · opcional</span>
        <textarea
          value={description}
          maxLength={500}
          rows={2}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
          placeholder="Productos que suele ofrecer o información útil"
        />
      </label>
      <FormFeedback mutation={save} />
      <FormActions
        pending={save.isPending}
        disabled={!name.trim()}
        pendingLabel="Guardando…"
        submitLabel="Guardar proveedor"
        onCancel={onClose}
      />
    </form>
  );
}

export function AdvanceForm({
  suppliers,
  onClose,
  onSaved,
}: Readonly<{ suppliers: Supplier[]; onClose: () => void; onSaved: () => void }>) {
  const queryClient = useQueryClient();
  const attempt = useRef<Attempt | null>(null);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [purpose, setPurpose] = useState('');
  const amountCents = parseMoney(amount);
  const save = useMutation({
    mutationFn: async () => {
      const signature = JSON.stringify({
        supplierId,
        amountCents,
        method,
        purpose: purpose.trim(),
      });
      const operationId = operationIdFor(attempt, signature);
      return registerSupplierAdvance({
        operationId,
        supplierId,
        amountCents,
        method,
        purpose: purpose.trim() || null,
      });
    },
    onSuccess() {
      attempt.current = null;
      void queryClient.invalidateQueries({ queryKey: advancesQueryRoot });
      onSaved();
    },
  });
  const issue =
    suppliers.length === 0
      ? 'Primero registra un proveedor.'
      : !supplierId
        ? 'Selecciona un proveedor.'
        : amountCents <= 0
          ? 'Ingresa un importe mayor que cero.'
          : null;

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (issue === null) save.mutate();
  }

  return (
    <form className={styles.composer} onSubmit={submit} noValidate>
      <FormHeading
        title="Registrar anticipo"
        detail="Esto registra una salida de caja, pero todavía no crea inventario ni gasto operativo."
        onClose={onClose}
      />
      <div className={styles.formGrid}>
        <label>
          <span>Proveedor</span>
          <select
            value={supplierId}
            onChange={(event) => {
              setSupplierId(event.target.value);
            }}
          >
            {suppliers.length === 0 ? <option value="">Sin proveedores</option> : null}
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Monto entregado</span>
          <span className={styles.moneyInput}>
            <b>S/</b>
            <input
              aria-label="Monto entregado"
              inputMode="decimal"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
              }}
              placeholder="0.00"
            />
          </span>
        </label>
        <label>
          <span>Método de pago</span>
          <select
            value={method}
            onChange={(event) => {
              setMethod(event.target.value as PaymentMethod);
            }}
          >
            {Object.entries(paymentMethodLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Qué se espera recibir · opcional</span>
          <input
            value={purpose}
            maxLength={1000}
            onChange={(event) => {
              setPurpose(event.target.value);
            }}
            placeholder="Puede cambiar cuando llegue la compra"
          />
        </label>
      </div>
      {issue !== null && amount.length > 0 ? <p className={styles.formHint}>{issue}</p> : null}
      <FormFeedback mutation={save} />
      <FormActions
        pending={save.isPending}
        disabled={issue !== null}
        pendingLabel="Registrando…"
        submitLabel="Confirmar anticipo"
        onCancel={onClose}
      />
    </form>
  );
}

export function AdvanceResolutionForm({
  advance,
  onDone,
}: Readonly<{ advance: SupplierAdvance; onDone: () => void }>) {
  const queryClient = useQueryClient();
  const attempt = useRef<Attempt | null>(null);
  const [type, setType] = useState<'refund' | 'loss'>('refund');
  const [amount, setAmount] = useState(centsToInput(advance.currentBalanceCents));
  const [method, setMethod] = useState<PaymentMethod>(advance.method);
  const [reason, setReason] = useState('');
  const amountCents = parseMoney(amount);
  const issue =
    amountCents <= 0
      ? 'Ingresa un importe mayor que cero.'
      : amountCents > advance.currentBalanceCents
        ? `No puede superar ${formatMoney(advance.currentBalanceCents)}.`
        : type === 'loss' && reason.trim().length === 0
          ? 'Escribe la razón de la pérdida.'
          : null;
  const resolve = useMutation({
    mutationFn: async () => {
      const signature = JSON.stringify({
        version: advance.version,
        type,
        amountCents,
        method,
        reason: reason.trim(),
      });
      return resolveSupplierAdvance({
        operationId: operationIdFor(attempt, signature),
        advanceId: advance.id,
        expectedVersion: advance.version,
        type,
        amountCents,
        method,
        reason: reason.trim(),
      });
    },
    onSuccess() {
      attempt.current = null;
      void queryClient.invalidateQueries({ queryKey: advancesQueryRoot });
      onDone();
    },
  });

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (issue === null) resolve.mutate();
  }

  return (
    <form className={styles.resolutionForm} onSubmit={submit} noValidate>
      <fieldset>
        <legend>¿Cómo se resuelve?</legend>
        <label data-selected={type === 'refund'}>
          <input
            type="radio"
            name={`resolution-${advance.id}`}
            checked={type === 'refund'}
            onChange={() => {
              setType('refund');
            }}
          />
          Dinero devuelto
        </label>
        <label data-selected={type === 'loss'}>
          <input
            type="radio"
            name={`resolution-${advance.id}`}
            checked={type === 'loss'}
            onChange={() => {
              setType('loss');
            }}
          />
          Pérdida no recuperable
        </label>
      </fieldset>
      <label>
        <span>Importe</span>
        <span className={styles.moneyInput}>
          <b>S/</b>
          <input
            aria-label="Importe a resolver"
            inputMode="decimal"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
            }}
          />
        </span>
      </label>
      {type === 'refund' ? (
        <label>
          <span>Método de devolución</span>
          <select
            value={method}
            onChange={(event) => {
              setMethod(event.target.value as PaymentMethod);
            }}
          >
            {Object.entries(paymentMethodLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label>
          <span>Razón obligatoria</span>
          <input
            value={reason}
            maxLength={500}
            onChange={(event) => {
              setReason(event.target.value);
            }}
            placeholder="Explica por qué no se recuperará"
          />
        </label>
      )}
      <button type="submit" disabled={issue !== null || resolve.isPending}>
        {resolve.isPending
          ? 'Registrando…'
          : type === 'refund'
            ? 'Registrar devolución'
            : 'Registrar pérdida'}
      </button>
      {issue !== null ? <p className={styles.formHint}>{issue}</p> : null}
      <FormFeedback mutation={resolve} />
    </form>
  );
}

function FormHeading({
  title,
  detail,
  onClose,
}: Readonly<{ title: string; detail: string; onClose: () => void }>) {
  return (
    <header className={styles.formHeading}>
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      <button type="button" onClick={onClose}>
        Cerrar
      </button>
    </header>
  );
}

function FormActions({
  pending,
  disabled,
  pendingLabel,
  submitLabel,
  onCancel,
}: Readonly<{
  pending: boolean;
  disabled: boolean;
  pendingLabel: string;
  submitLabel: string;
  onCancel: () => void;
}>) {
  return (
    <div className={styles.formActions}>
      <button type="button" onClick={onCancel}>
        Cancelar
      </button>
      <button type="submit" disabled={disabled || pending}>
        {pending ? pendingLabel : submitLabel}
      </button>
    </div>
  );
}

function FormFeedback({ mutation }: Readonly<{ mutation: { isError: boolean; error: unknown } }>) {
  return mutation.isError ? (
    <p className={styles.formError} role="alert">
      {problemMessage(mutation.error)}
    </p>
  ) : null;
}

function operationIdFor(reference: { current: Attempt | null }, signature: string): string {
  if (reference.current?.signature !== signature) {
    reference.current = { signature, operationId: newOperationId() };
  }
  return reference.current.operationId;
}

function parseMoney(value: string): number {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return 0;
  return Math.round(Number(normalized) * 100);
}

function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
