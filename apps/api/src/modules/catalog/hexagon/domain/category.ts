export type CategoryStatus = 'active' | 'inactive';

export class InvalidCategoryNameError extends Error {
  constructor() {
    super('El nombre de la categoría es obligatorio.');
    this.name = 'InvalidCategoryNameError';
  }
}

export interface CategoryProperties {
  id: string;
  name: string;
  nameNormalized: string;
  description: string | null;
  status: CategoryStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class Category {
  private constructor(private properties: CategoryProperties) {}

  static create(input: {
    id: string;
    name: string;
    description: string | null | undefined;
    now: Date;
  }): Category {
    const name = normalizeDisplayName(input.name);

    if (name.length === 0) {
      throw new InvalidCategoryNameError();
    }

    return new Category({
      id: input.id,
      name,
      nameNormalized: normalizeCategoryName(name),
      description: normalizeDescription(input.description),
      status: 'active',
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static restore(properties: CategoryProperties): Category {
    return new Category({ ...properties });
  }

  rename(input: { name: string; description?: string | null; now: Date }): void {
    const name = normalizeDisplayName(input.name);
    if (name.length === 0) throw new InvalidCategoryNameError();
    this.properties = {
      ...this.properties,
      name,
      nameNormalized: normalizeCategoryName(name),
      description:
        input.description === undefined
          ? this.properties.description
          : normalizeDescription(input.description),
      updatedAt: input.now,
    };
  }

  deactivate(now: Date): void {
    if (this.properties.status === 'inactive') return;
    this.properties = { ...this.properties, status: 'inactive', updatedAt: now };
  }

  toPrimitives(): CategoryProperties {
    return { ...this.properties };
  }
}

export function normalizeCategoryName(value: string): string {
  return normalizeDisplayName(value).normalize('NFKC').toLocaleLowerCase('es-PE');
}

function normalizeDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeDescription(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const description = value.trim();
  return description.length === 0 ? null : description;
}
