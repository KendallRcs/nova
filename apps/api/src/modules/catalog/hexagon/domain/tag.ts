export type TagStatus = 'active' | 'inactive';

export class InvalidTagNameError extends Error {
  constructor() {
    super('El nombre de la etiqueta es obligatorio.');
    this.name = 'InvalidTagNameError';
  }
}

export interface TagProperties {
  id: string;
  name: string;
  nameNormalized: string;
  status: TagStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class Tag {
  private constructor(private properties: TagProperties) {}

  static create(input: { id: string; name: string; now: Date }): Tag {
    const name = normalizeTagDisplayName(input.name);
    if (name.length === 0) throw new InvalidTagNameError();
    return new Tag({
      id: input.id,
      name,
      nameNormalized: normalizeTagName(name),
      status: 'active',
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static restore(properties: TagProperties): Tag {
    return new Tag({ ...properties });
  }

  rename(nameInput: string, now: Date): void {
    const name = normalizeTagDisplayName(nameInput);
    if (name.length === 0) throw new InvalidTagNameError();
    this.properties = {
      ...this.properties,
      name,
      nameNormalized: normalizeTagName(name),
      updatedAt: now,
    };
  }

  deactivate(now: Date): void {
    if (this.properties.status === 'inactive') return;
    this.properties = { ...this.properties, status: 'inactive', updatedAt: now };
  }

  toPrimitives(): TagProperties {
    return { ...this.properties };
  }
}

export function normalizeTagName(value: string): string {
  return normalizeTagDisplayName(value).normalize('NFKC').toLocaleLowerCase('es-PE');
}

function normalizeTagDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}
