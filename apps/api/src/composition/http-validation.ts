import { UnprocessableEntityException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

export function validationProblem(errors: ValidationError[]): UnprocessableEntityException {
  return new UnprocessableEntityException({
    type: 'https://nova.example/problems/validation-failed',
    title: 'La solicitud contiene datos inválidos',
    status: 422,
    detail: 'Corrige los campos indicados e inténtalo nuevamente.',
    code: 'VALIDATION_FAILED',
    errors: flattenValidationErrors(errors),
  });
}

function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): { pointer: string; code: string; message: string }[] {
  return errors.flatMap((error) => {
    const path = `${parentPath}/${escapeJsonPointer(error.property)}`;
    const ownErrors = Object.entries(error.constraints ?? {}).map(([code, message]) => ({
      pointer: path,
      code: code.toUpperCase(),
      message,
    }));

    return [...ownErrors, ...flattenValidationErrors(error.children ?? [], path)];
  });
}

function escapeJsonPointer(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}
