'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type SyntheticEvent } from 'react';

import { problemMessage } from '@/shared/api/problem-details';
import {
  customersQueryRoot,
  registerCustomer,
  updateCustomer,
  type Customer,
  type CustomerInput,
} from './customers-api';
import styles from './customers.module.css';

export function CustomerForm({
  customer,
  onDone,
  onCancel,
}: Readonly<{
  customer?: Customer;
  onDone: (customer: Customer) => void;
  onCancel: () => void;
}>) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [dni, setDni] = useState(customer?.dni ?? '');
  const [address, setAddress] = useState(customer?.address ?? '');
  const normalized: CustomerInput = {
    name: name.trim(),
    phone: phone.trim(),
    dni: dni.trim() || null,
    address: address.trim() || null,
  };
  const issue =
    normalized.name.length === 0
      ? 'Escribe el nombre del cliente.'
      : normalized.phone.length === 0
        ? 'Escribe un teléfono para identificarlo.'
        : null;
  const save = useMutation({
    mutationFn: () =>
      customer === undefined
        ? registerCustomer(normalized)
        : updateCustomer(customer.id, customer.version, normalized),
    onSuccess(saved) {
      void queryClient.invalidateQueries({ queryKey: customersQueryRoot });
      onDone(saved);
    },
  });

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (issue === null) save.mutate();
  }

  return (
    <form className={styles.customerForm} onSubmit={submit} noValidate>
      <div className={styles.formHeading}>
        <div>
          <strong>{customer === undefined ? 'Nuevo cliente' : `Editar a ${customer.name}`}</strong>
          <p>Nombre y teléfono son obligatorios. DNI y dirección pueden añadirse después.</p>
        </div>
        <button type="button" onClick={onCancel}>
          Cerrar
        </button>
      </div>
      <div className={styles.formGrid}>
        <label>
          <span>Nombre</span>
          <input
            value={name}
            maxLength={160}
            onChange={(event) => {
              setName(event.target.value);
            }}
            autoFocus
          />
        </label>
        <label>
          <span>Teléfono</span>
          <input
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
            DNI <small>Opcional</small>
          </span>
          <input
            value={dni}
            inputMode="numeric"
            onChange={(event) => {
              setDni(event.target.value);
            }}
          />
        </label>
        <label>
          <span>
            Dirección <small>Opcional</small>
          </span>
          <input
            value={address}
            maxLength={500}
            onChange={(event) => {
              setAddress(event.target.value);
            }}
          />
        </label>
      </div>
      {save.isError ? (
        <p className={styles.formError} role="alert">
          {problemMessage(save.error)}
        </p>
      ) : null}
      <div className={styles.formActions}>
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" disabled={issue !== null || save.isPending}>
          {save.isPending
            ? 'Guardando…'
            : customer === undefined
              ? 'Registrar cliente'
              : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
