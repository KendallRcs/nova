'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type SyntheticEvent } from 'react';

import { getCurrentActor, hasPermission, sessionQueryKey } from '@/features/auth/auth-api';
import { problemMessage } from '@/shared/api/problem-details';
import { formatDateTime, formatMoney } from '@/shared/formatters';
import { ModuleStart } from '@/shared/ui/module-start';
import {
  attachExpenseReceipt,
  cancelExpense,
  createExpenseCategory,
  deactivateExpenseCategory,
  expenseCategoriesQueryKey,
  expensesQueryKey,
  getExpenseReceiptUrl,
  listExpenseCategories,
  listExpenses,
  newOperationId,
  paymentMethodLabels,
  registerExpense,
  renameExpenseCategory,
  removeExpenseReceipt,
  type Expense,
  type PaymentMethod,
} from './expenses-api';
import styles from './expenses.module.css';

export function ExpensesScreen() {
  const queryClient = useQueryClient();
  const actor = useQuery({ queryKey: sessionQueryKey, queryFn: getCurrentActor, retry: false });
  const allowed = actor.data !== undefined && hasPermission(actor.data, 'expenses:manage');
  const categories = useQuery({
    queryKey: expenseCategoriesQueryKey,
    queryFn: listExpenseCategories,
    enabled: allowed,
  });
  const expenses = useQuery({
    queryKey: expensesQueryKey,
    queryFn: listExpenses,
    enabled: allowed,
  });
  const [composer, setComposer] = useState<'expense' | 'category' | null>(null);
  const activeTotal =
    expenses.data?.reduce(
      (total, expense) => total + (expense.status === 'confirmed' ? expense.amountCents : 0),
      0,
    ) ?? 0;

  if (actor.isPending) return <div className={styles.skeleton} aria-label="Cargando gastos" />;
  if (!allowed) {
    return (
      <ModuleStart
        title="Gastos"
        description="Esta sección está reservada para administración."
        help="Los gastos afectan caja y resultados, por eso solo administración puede registrarlos."
      >
        <Feedback message="No tienes acceso a los gastos operativos." />
      </ModuleStart>
    );
  }

  return (
    <ModuleStart
      title="Gastos"
      description="Registra las salidas operativas sin confundirlas con compras de inventario."
      help="Alquiler, movilidad, comida y servicios son gastos operativos. La mercadería y los anticipos se controlan en Compras. Los comprobantes son privados y su enlace de consulta vence a los cinco minutos."
    >
      <section className={styles.command}>
        <div>
          <p>Control mensual</p>
          <h2>Salidas operativas del negocio</h2>
          <span>Conserva categoría, método, responsable y evidencia opcional.</span>
        </div>
        <div>
          <button
            type="button"
            onClick={() => {
              setComposer('category');
            }}
          >
            Nueva categoría
          </button>
          <button
            type="button"
            onClick={() => {
              setComposer('expense');
            }}
          >
            Registrar gasto
          </button>
        </div>
      </section>

      {composer === 'category' ? (
        <CategoryForm
          onClose={() => {
            setComposer(null);
          }}
          onSaved={() =>
            void queryClient.invalidateQueries({ queryKey: expenseCategoriesQueryKey })
          }
        />
      ) : null}
      {composer === 'expense' ? (
        <ExpenseForm
          categories={categories.data?.filter((category) => category.status === 'active') ?? []}
          onClose={() => {
            setComposer(null);
          }}
          onSaved={() => {
            setComposer(null);
            void queryClient.invalidateQueries({ queryKey: expensesQueryKey });
          }}
        />
      ) : null}

      <section className={styles.metrics} aria-label="Resumen de gastos">
        <div>
          <span>Gastos vigentes</span>
          <strong>{formatMoney(activeTotal)}</strong>
        </div>
        <div>
          <span>Operaciones</span>
          <strong>{expenses.data?.length ?? 0}</strong>
        </div>
        <div>
          <span>Categorías activas</span>
          <strong>
            {categories.data?.filter((category) => category.status === 'active').length ?? 0}
          </strong>
        </div>
      </section>

      <section className={styles.ledger}>
        <header>
          <div>
            <p>Historial auditable</p>
            <h2>Gastos registrados</h2>
          </div>
          <span>{expenses.data?.length ?? 0} operaciones</span>
        </header>
        {expenses.isPending ? (
          <div className={styles.skeleton} aria-label="Cargando gastos" />
        ) : null}
        {expenses.isError ? <Feedback message={problemMessage(expenses.error)} /> : null}
        {!expenses.isPending && !expenses.isError && expenses.data.length === 0 ? (
          <Feedback message="Todavía no hay gastos. Registra el primero cuando ocurra." />
        ) : null}
        {expenses.data?.map((expense) => (
          <ExpenseRow key={expense.id} expense={expense} />
        ))}
      </section>
      <CategoryDirectory categories={categories.data ?? []} />
    </ModuleStart>
  );
}

function CategoryDirectory({
  categories,
}: Readonly<{ categories: { id: string; name: string; status: 'active' | 'inactive' }[] }>) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: expenseCategoriesQueryKey });
  };
  const rename = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) => renameExpenseCategory(id, value),
    onSuccess() {
      setEditing(null);
      refresh();
    },
  });
  const deactivate = useMutation({ mutationFn: deactivateExpenseCategory, onSuccess: refresh });
  return (
    <section className={styles.categories}>
      <header>
        <div>
          <p>Clasificación mantenible</p>
          <h2>Categorías</h2>
        </div>
        <span>Las inactivas conservan su historial</span>
      </header>
      {categories.map((category) => (
        <div key={category.id}>
          {editing === category.id ? (
            <input
              aria-label={`Nuevo nombre de ${category.name}`}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          ) : (
            <strong>{category.name}</strong>
          )}
          <small>{category.status === 'active' ? 'Activa' : 'Inactiva'}</small>
          {editing === category.id ? (
            <button
              type="button"
              disabled={!name.trim() || rename.isPending}
              onClick={() => {
                rename.mutate({ id: category.id, value: name.trim() });
              }}
            >
              Guardar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditing(category.id);
                setName(category.name);
              }}
            >
              Renombrar
            </button>
          )}
          {category.status === 'active' ? (
            <button
              type="button"
              disabled={deactivate.isPending}
              onClick={() => {
                deactivate.mutate(category.id);
              }}
            >
              Desactivar
            </button>
          ) : null}
        </div>
      ))}
    </section>
  );
}

function CategoryForm({
  onClose,
  onSaved,
}: Readonly<{ onClose: () => void; onSaved: () => void }>) {
  const [name, setName] = useState('');
  const save = useMutation({
    mutationFn: () => createExpenseCategory(name.trim()),
    onSuccess() {
      onSaved();
      onClose();
    },
  });
  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) save.mutate();
      }}
    >
      <div>
        <p>Clasificación</p>
        <h2>Nueva categoría</h2>
      </div>
      <label>
        <span>Nombre</span>
        <input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder="Ej. Movilidad"
        />
      </label>
      {save.isError ? <small className={styles.error}>{problemMessage(save.error)}</small> : null}
      <div className={styles.actions}>
        <button type="button" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" disabled={!name.trim() || save.isPending}>
          Guardar categoría
        </button>
      </div>
    </form>
  );
}

function ExpenseForm({
  categories,
  onClose,
  onSaved,
}: Readonly<{
  categories: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}>) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [description, setDescription] = useState('');
  const [effectiveAt, setEffectiveAt] = useState(localDateTime());
  const [receipt, setReceipt] = useState<File | null>(null);
  const operation = useRef<{ signature: string; id: string } | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const input = {
        categoryId,
        amountCents: parseMoney(amount),
        method,
        description: description.trim() || null,
        effectiveAt: new Date(effectiveAt).toISOString(),
      };
      const signature = JSON.stringify(input);
      if (operation.current?.signature !== signature) {
        operation.current = { signature, id: newOperationId() };
      }
      const expense = await registerExpense({ operationId: operation.current.id, ...input });
      if (receipt !== null) await attachExpenseReceipt(expense.id, receipt);
    },
    onSuccess: onSaved,
  });
  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (categoryId && parseMoney(amount) > 0) save.mutate();
  }
  return (
    <form className={styles.form} onSubmit={submit}>
      <div>
        <p>Nueva salida</p>
        <h2>Registrar gasto</h2>
      </div>
      <label>
        <span>Categoría</span>
        <select
          aria-label="Categoría"
          value={categoryId}
          onChange={(event) => {
            setCategoryId(event.target.value);
          }}
        >
          <option value="">Selecciona</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Monto</span>
        <input
          aria-label="Monto"
          inputMode="decimal"
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
          }}
          placeholder="0.00"
        />
      </label>
      <label>
        <span>Método</span>
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
        <span>Fecha y hora</span>
        <input
          type="datetime-local"
          value={effectiveAt}
          onChange={(event) => {
            setEffectiveAt(event.target.value);
          }}
        />
      </label>
      <label className={styles.wide}>
        <span>Descripción opcional</span>
        <input
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
          }}
        />
      </label>
      <label className={styles.wide}>
        <span>Comprobante opcional · imagen o PDF, máximo 5 MiB</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(event) => {
            setReceipt(event.target.files?.[0] ?? null);
          }}
        />
      </label>
      {save.isError ? <small className={styles.error}>{problemMessage(save.error)}</small> : null}
      <div className={styles.actions}>
        <button type="button" onClick={onClose}>
          Cancelar
        </button>
        <button type="submit" disabled={!categoryId || parseMoney(amount) === 0 || save.isPending}>
          {save.isPending ? 'Guardando…' : 'Confirmar gasto'}
        </button>
      </div>
    </form>
  );
}

function ExpenseRow({ expense }: Readonly<{ expense: Expense }>) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'receipt' | 'cancel' | null>(null);
  const [reason, setReason] = useState('');
  const [refund, setRefund] = useState(false);
  const [refundMethod, setRefundMethod] = useState<PaymentMethod>('cash');
  const cancellationOperation = useRef<{ signature: string; id: string } | null>(null);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: expensesQueryKey });
  const upload = useMutation({
    mutationFn: (file: File) => attachExpenseReceipt(expense.id, file),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => removeExpenseReceipt(expense.id),
    onSuccess: refresh,
  });
  const cancel = useMutation({
    mutationFn: () => {
      const input = {
        expenseId: expense.id,
        reason: reason.trim(),
        refundReceived: refund,
        refundMethod: refund ? refundMethod : null,
      };
      const signature = JSON.stringify(input);
      if (cancellationOperation.current?.signature !== signature) {
        cancellationOperation.current = { signature, id: newOperationId() };
      }
      return cancelExpense({ operationId: cancellationOperation.current.id, ...input });
    },
    onSuccess: refresh,
  });
  const access = useMutation({
    mutationFn: () => getExpenseReceiptUrl(expense.id),
    onSuccess(url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    },
  });
  const error = upload.error ?? remove.error ?? cancel.error ?? access.error;
  return (
    <article className={styles.row} data-cancelled={expense.status === 'cancelled'}>
      <div>
        <strong>{expense.categoryName}</strong>
        <small>
          {expense.description ?? 'Sin descripción'} · {formatDateTime(expense.effectiveAt)}
        </small>
      </div>
      <span>
        <small>Método</small>
        <strong>{paymentMethodLabels[expense.method]}</strong>
      </span>
      <span>
        <small>Importe</small>
        <strong>{formatMoney(expense.amountCents)}</strong>
      </span>
      <b>{expense.status === 'confirmed' ? 'Vigente' : 'Anulado'}</b>
      <div className={styles.rowActions}>
        {expense.hasReceipt ? (
          <>
            <button
              type="button"
              onClick={() => {
                access.mutate();
              }}
            >
              Ver comprobante
            </button>
            <button
              type="button"
              onClick={() => {
                remove.mutate();
              }}
            >
              Eliminar
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              setMode('receipt');
            }}
          >
            Adjuntar comprobante
          </button>
        )}
        {expense.status === 'confirmed' ? (
          <button
            type="button"
            onClick={() => {
              setMode('cancel');
            }}
          >
            Anular
          </button>
        ) : null}
      </div>
      {mode === 'receipt' ? (
        <label className={styles.inline}>
          <span>Imagen o PDF, máximo 5 MiB</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload.mutate(file);
            }}
          />
        </label>
      ) : null}
      {mode === 'cancel' ? (
        <div className={styles.inline}>
          <label>
            <span>Razón obligatoria</span>
            <input
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
              }}
            />
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={refund}
              onChange={(event) => {
                setRefund(event.target.checked);
              }}
            />
            El dinero regresó completo
          </label>
          {refund ? (
            <select
              aria-label="Método de devolución"
              value={refundMethod}
              onChange={(event) => {
                setRefundMethod(event.target.value as PaymentMethod);
              }}
            >
              {Object.entries(paymentMethodLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            disabled={!reason.trim() || cancel.isPending}
            onClick={() => {
              cancel.mutate();
            }}
          >
            Confirmar anulación
          </button>
        </div>
      ) : null}
      {error ? <small className={styles.error}>{problemMessage(error)}</small> : null}
    </article>
  );
}

function Feedback({ message }: Readonly<{ message: string }>) {
  return <div className={styles.feedback}>{message}</div>;
}
function parseMoney(value: string): number {
  const normalized = value.trim().replace(',', '.');
  return /^\d+(\.\d{0,2})?$/.test(normalized) ? Math.round(Number(normalized) * 100) : 0;
}
function localDateTime(): string {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
}
