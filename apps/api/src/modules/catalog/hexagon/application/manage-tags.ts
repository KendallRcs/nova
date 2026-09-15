import { Tag, normalizeTagName } from '../domain/tag';
import type { Clock, IdGenerator } from './category.dependencies';
import { TagNameAlreadyExistsError, type TagRepository } from './tag.repository';
import { toTagView, type TagView } from './tag.view';

export class CreateTag {
  constructor(
    private readonly repository: TagRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(name: string): Promise<TagView> {
    if ((await this.repository.findByNormalizedName(normalizeTagName(name))) !== null) {
      throw new TagNameAlreadyExistsError();
    }
    const tag = Tag.create({ id: this.idGenerator.generate(), name, now: this.clock.now() });
    await this.repository.save(tag);
    return toTagView(tag);
  }
}

export class ListTags {
  constructor(private readonly repository: TagRepository) {}
  async execute(): Promise<TagView[]> {
    return (await this.repository.listActive()).map(toTagView);
  }
}

export type ManageTagResult =
  | { readonly ok: true; readonly tag: TagView }
  | { readonly ok: false; readonly reason: 'tag-not-found' | 'conflict' };

export class RenameTag {
  constructor(
    private readonly repository: TagRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { id: string; name: string }): Promise<ManageTagResult> {
    const tag = await this.repository.findById(input.id);
    if (tag === null) return { ok: false, reason: 'tag-not-found' };
    const sameName = await this.repository.findByNormalizedName(normalizeTagName(input.name));
    if (sameName !== null && sameName.toPrimitives().id !== input.id) {
      throw new TagNameAlreadyExistsError();
    }
    tag.rename(input.name, this.clock.now());
    return (await this.repository.update(tag))
      ? { ok: true, tag: toTagView(tag) }
      : { ok: false, reason: 'conflict' };
  }
}

export class DeactivateTag {
  constructor(
    private readonly repository: TagRepository,
    private readonly clock: Clock,
  ) {}

  async execute(id: string): Promise<ManageTagResult> {
    const tag = await this.repository.findById(id);
    if (tag === null) return { ok: false, reason: 'tag-not-found' };
    if (tag.toPrimitives().status === 'inactive') return { ok: true, tag: toTagView(tag) };
    tag.deactivate(this.clock.now());
    return (await this.repository.update(tag))
      ? { ok: true, tag: toTagView(tag) }
      : { ok: false, reason: 'conflict' };
  }
}
