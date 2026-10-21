import Image from 'next/image';

import type { Product } from './inventory-api';
import styles from './inventory.module.css';

export function ProductPicture({
  product,
  priority = false,
}: Readonly<{ product: Product; priority?: boolean }>) {
  const image = product.images.toSorted((left, right) => left.position - right.position)[0];

  if (image === undefined) {
    return (
      <span className={styles.pictureFallback} aria-hidden="true">
        {product.name.charAt(0).toLocaleUpperCase('es-PE')}
      </span>
    );
  }

  return (
    <Image
      className={styles.picture}
      src={image.url}
      alt={`Imagen de ${product.name}`}
      width={image.width}
      height={image.height}
      priority={priority}
      sizes="(max-width: 620px) 72px, 112px"
    />
  );
}
