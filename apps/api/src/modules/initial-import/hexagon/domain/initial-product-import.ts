import { normalizeProductCode } from '../../../catalog/hexagon/domain/product';

export const INITIAL_IMPORT_HEADERS = [
  'codigo',
  'nombre',
  'descripcion',
  'categoria',
  'etiquetas',
  'precio_minimo_centimos',
  'precio_sugerido_centimos',
  'precio_maximo_centimos',
  'costo_unitario_centimos',
  'stock_tienda',
  'stock_almacen',
] as const;

export interface InitialProductRow {
  rowNumber: number;
  code: string;
  codeNormalized: string;
  name: string;
  description: string | null;
  category: string;
  categoryNormalized: string;
  tags: readonly { name: string; nameNormalized: string }[];
  minimumPriceCents: number;
  suggestedPriceCents: number | null;
  maximumPriceCents: number | null;
  unitCostCents: number;
  storeQuantity: number;
  warehouseQuantity: number;
}
export interface ImportIssue {
  rowNumber: number | null;
  field: string | null;
  severity: 'warning' | 'error';
  code: string;
  message: string;
}
export interface ImportValidation {
  rows: InitialProductRow[];
  issues: ImportIssue[];
  totalRows: number;
}

export function validateInitialProductRows(
  sheet: readonly (readonly unknown[])[],
): ImportValidation {
  if (sheet.length === 0) return invalidFile('EMPTY_FILE', 'La plantilla no contiene filas.');
  const header = sheet[0]?.map(cellText) ?? [];
  if (
    header.length !== INITIAL_IMPORT_HEADERS.length ||
    INITIAL_IMPORT_HEADERS.some((value, index) => header[index] !== value)
  ) {
    return invalidFile(
      'INVALID_HEADERS',
      `Las columnas deben ser: ${INITIAL_IMPORT_HEADERS.join(', ')}.`,
    );
  }
  const data = sheet.slice(1).filter((row) => row.some((cell) => cell !== null && cell !== ''));
  if (data.length === 0) return invalidFile('EMPTY_IMPORT', 'La plantilla no contiene productos.');
  if (data.length > 1_000)
    return invalidFile('TOO_MANY_ROWS', 'La plantilla admite como máximo 1000 productos.');
  const rows: InitialProductRow[] = [];
  const issues: ImportIssue[] = [];
  const codes = new Set<string>();
  data.forEach((cells, index) => {
    const rowNumber = index + 2;
    const code = requiredText(cells[0], rowNumber, 'codigo', issues);
    const name = requiredText(cells[1], rowNumber, 'nombre', issues);
    const category = requiredText(cells[3], rowNumber, 'categoria', issues);
    const minimum = integer(cells[5], rowNumber, 'precio_minimo_centimos', 0, issues);
    const suggested = optionalInteger(cells[6], rowNumber, 'precio_sugerido_centimos', 0, issues);
    const maximum = optionalInteger(cells[7], rowNumber, 'precio_maximo_centimos', 0, issues);
    const cost = integer(cells[8], rowNumber, 'costo_unitario_centimos', 1, issues);
    const store = integer(cells[9], rowNumber, 'stock_tienda', 0, issues);
    const warehouse = integer(cells[10], rowNumber, 'stock_almacen', 0, issues);
    const normalizedCode = normalizeProductCode(code);
    if (normalizedCode.length > 0 && codes.has(normalizedCode))
      add(
        issues,
        rowNumber,
        'codigo',
        'error',
        'DUPLICATE_CODE',
        'El código está repetido dentro de la plantilla.',
      );
    codes.add(normalizedCode);
    if (suggested !== null && minimum > suggested)
      add(
        issues,
        rowNumber,
        'precio_sugerido_centimos',
        'error',
        'INVALID_PRICE_ORDER',
        'El precio sugerido no puede ser menor que el mínimo.',
      );
    if (maximum !== null && minimum > maximum)
      add(
        issues,
        rowNumber,
        'precio_maximo_centimos',
        'error',
        'INVALID_PRICE_ORDER',
        'El precio máximo no puede ser menor que el mínimo.',
      );
    if (suggested !== null && maximum !== null && suggested > maximum)
      add(
        issues,
        rowNumber,
        'precio_maximo_centimos',
        'error',
        'INVALID_PRICE_ORDER',
        'El precio máximo no puede ser menor que el sugerido.',
      );
    if (suggested === null)
      add(
        issues,
        rowNumber,
        'precio_sugerido_centimos',
        'warning',
        'SUGGESTED_PRICE_OMITTED',
        'Se recomienda completar el precio sugerido.',
      );
    if (store + warehouse === 0)
      add(
        issues,
        rowNumber,
        null,
        'warning',
        'NO_INITIAL_STOCK',
        'El producto se importará sin stock inicial; su costo quedará en el historial de importación hasta una reposición.',
      );
    if (
      [code, name, category].some((value) => value.length === 0) ||
      [minimum, cost, store, warehouse].some((value) => value < 0)
    )
      return;
    rows.push({
      rowNumber,
      code,
      codeNormalized: normalizedCode,
      name,
      description: optionalText(cells[2]),
      category,
      categoryNormalized: normalizeName(category),
      tags: parseTags(cells[4]),
      minimumPriceCents: minimum,
      suggestedPriceCents: suggested,
      maximumPriceCents: maximum,
      unitCostCents: cost,
      storeQuantity: store,
      warehouseQuantity: warehouse,
    });
  });
  return { rows, issues, totalRows: data.length };
}

function invalidFile(code: string, message: string): ImportValidation {
  return {
    rows: [],
    issues: [{ rowNumber: null, field: null, severity: 'error', code, message }],
    totalRows: 0,
  };
}
function cellText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase('es-PE') : '';
}
function requiredText(value: unknown, row: number, field: string, issues: ImportIssue[]): string {
  const text =
    typeof value === 'number' && field === 'codigo' ? String(value) : (optionalText(value) ?? '');
  if (text.length === 0)
    add(issues, row, field, 'error', 'REQUIRED_VALUE', 'El valor es obligatorio.');
  return text;
}
function optionalText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
    return null;
  }
  const text = String(value).trim().replace(/\s+/g, ' ');
  return text.length === 0 ? null : text;
}
function integer(
  value: unknown,
  row: number,
  field: string,
  minimum: number,
  issues: ImportIssue[],
): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    add(
      issues,
      row,
      field,
      'error',
      'INVALID_INTEGER',
      `Debe ser un entero mayor o igual que ${String(minimum)}.`,
    );
    return -1;
  }
  return value;
}
function optionalInteger(
  value: unknown,
  row: number,
  field: string,
  minimum: number,
  issues: ImportIssue[],
): number | null {
  if (value === null || value === undefined || value === '') return null;
  return integer(value, row, field, minimum, issues);
}
function normalizeName(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('es-PE');
}
function parseTags(value: unknown): { name: string; nameNormalized: string }[] {
  const text = optionalText(value);
  if (text === null) return [];
  const unique = new Map<string, string>();
  for (const raw of text.split(',')) {
    const name = raw.trim().replace(/\s+/g, ' ');
    if (name.length > 0) unique.set(normalizeName(name), name);
  }
  return [...unique].map(([nameNormalized, name]) => ({ name, nameNormalized }));
}
function add(
  issues: ImportIssue[],
  rowNumber: number,
  field: string | null,
  severity: ImportIssue['severity'],
  code: string,
  message: string,
): void {
  issues.push({ rowNumber, field, severity, code, message });
}
