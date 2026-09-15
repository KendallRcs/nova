import { describe, expect, it } from 'vitest';

import type { Tag } from '../domain/tag';
import { CreateTag, DeactivateTag, ListTags, RenameTag } from './manage-tags';
import { TagNameAlreadyExistsError, type TagRepository } from './tag.repository';

class FakeTags implements TagRepository {
  readonly items: Tag[] = [];

  findById(id: string): Promise<Tag | null> {
    return Promise.resolve(this.items.find((tag) => tag.toPrimitives().id === id) ?? null);
  }

  findByNormalizedName(name: string): Promise<Tag | null> {
    return Promise.resolve(
      this.items.find((tag) => tag.toPrimitives().nameNormalized === name) ?? null,
    );
  }

  listActive(): Promise<Tag[]> {
    return Promise.resolve(this.items.filter((tag) => tag.toPrimitives().status === 'active'));
  }

  save(tag: Tag): Promise<void> {
    this.items.push(tag);
    return Promise.resolve();
  }

  update(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

const clock = { now: () => new Date('2026-09-15T15:00:00.000Z') };

describe('tag management', () => {
  it('creates, renames and deactivates reusable tags', async () => {
    const repository = new FakeTags();
    const create = new CreateTag(repository, { generate: () => 'tag-1' }, clock);
    await expect(create.execute(' Peluche ')).resolves.toMatchObject({
      id: 'tag-1',
      name: 'Peluche',
      isActive: true,
    });
    await expect(
      new RenameTag(repository, clock).execute({ id: 'tag-1', name: 'Suave' }),
    ).resolves.toMatchObject({ ok: true, tag: { name: 'Suave' } });
    await expect(new DeactivateTag(repository, clock).execute('tag-1')).resolves.toMatchObject({
      ok: true,
      tag: { isActive: false },
    });
    await expect(new ListTags(repository).execute()).resolves.toEqual([]);
  });

  it('rejects an equivalent normalized name', async () => {
    const repository = new FakeTags();
    const create = new CreateTag(repository, { generate: () => 'tag-1' }, clock);
    await create.execute('Edición especial');
    await expect(create.execute(' EDICIÓN   ESPECIAL ')).rejects.toBeInstanceOf(
      TagNameAlreadyExistsError,
    );
  });
});
