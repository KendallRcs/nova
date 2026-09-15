import type { Tag } from '../domain/tag';

export interface TagView {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toTagView(tag: Tag): TagView {
  const values = tag.toPrimitives();
  return {
    id: values.id,
    name: values.name,
    isActive: values.status === 'active',
    createdAt: values.createdAt,
    updatedAt: values.updatedAt,
  };
}
