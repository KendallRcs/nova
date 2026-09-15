import type { Tag } from '../domain/tag';

export class TagNameAlreadyExistsError extends Error {
  constructor() {
    super('Ya existe una etiqueta con un nombre equivalente.');
    this.name = 'TagNameAlreadyExistsError';
  }
}

export interface TagRepository {
  findById(id: string): Promise<Tag | null>;
  findByNormalizedName(nameNormalized: string): Promise<Tag | null>;
  listActive(): Promise<Tag[]>;
  save(tag: Tag): Promise<void>;
  update(tag: Tag): Promise<boolean>;
}
