'use client';

import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';

import { ApiProblem, problemMessage } from '@/shared/api/problem-details';
import { Icon } from '@/shared/ui/icons';
import { availableStock, formatMoney, getProduct, productDetailQueryKey } from './inventory-api';
import styles from './inventory.module.css';
import { ProductPicture } from './product-picture';

export function ProductDetailScreen({ productId }: Readonly<{ productId: string }>) {
  const product = useQuery({
    queryKey: productDetailQueryKey(productId),
    queryFn: () => getProduct(productId),
  });
  if (product.isPending) return <DetailSkeleton />;
  if (product.isError) {
    const missing = product.error instanceof ApiProblem && product.error.problem.status === 404;
    return (
      <div className={styles.detailPage}>
        <BackLink />
        <div className={styles.feedback} role="alert">
          <strong>{missing ? 'Este producto no existe' : 'No pudimos cargar el producto'}</strong>
          <p>
            {missing ? 'Es posible que el enlace ya no sea válido.' : problemMessage(product.error)}
          </p>
          {!missing ? (
            <button
              type="button"
              onClick={() => {
                void product.refetch();
              }}
            >
              Intentar nuevamente
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const item = product.data;
  const available = availableStock(item);
  const images = item.images.toSorted((left, right) => left.position - right.position);
  return (
    <div className={styles.detailPage}>
      <BackLink />
      <header className={styles.detailHeader}>
        <div className={styles.detailIdentity}>
          <span className={styles.detailPicture}>
            <ProductPicture product={item} priority />
          </span>
          <div>
            <span className={styles.productCode}>{item.code}</span>
            <h1>{item.name}</h1>
            <p>{item.description ?? 'Este producto no tiene una descripción registrada.'}</p>
          </div>
        </div>
        <div className={styles.totalAvailability} data-empty={available === 0}>
          <span>Disponible para vender</span>
          <strong>{available}</strong>
          <small>{available === 1 ? 'unidad en total' : 'unidades en total'}</small>
        </div>
      </header>

      <div className={styles.detailGrid}>
        <section className={styles.detailCard} aria-labelledby="stock-title">
          <div className={styles.cardHeading}>
            <div>
              <p className={styles.eyebrow}>Existencias</p>
              <h2 id="stock-title">Stock por ubicación</h2>
            </div>
            <details className={styles.stockHelp}>
              <summary>¿Qué significa?</summary>
              <p>Físico incluye todo lo presente; reservado y en revisión no están disponibles.</p>
            </details>
          </div>
          <div className={styles.locationList}>
            {item.stock.length ? (
              item.stock.map((stock) => (
                <article className={styles.locationCard} key={stock.locationId}>
                  <div>
                    <span>{stock.locationCode}</span>
                    <h3>{stock.locationName}</h3>
                  </div>
                  <dl>
                    <div className={styles.availableValue}>
                      <dt>Disponible</dt>
                      <dd>{stock.availableQuantity}</dd>
                    </div>
                    <div>
                      <dt>Físico</dt>
                      <dd>{stock.physicalQuantity}</dd>
                    </div>
                    <div>
                      <dt>Reservado</dt>
                      <dd>{stock.reservedQuantity}</dd>
                    </div>
                    <div>
                      <dt>En revisión</dt>
                      <dd>{stock.reviewQuantity}</dd>
                    </div>
                  </dl>
                </article>
              ))
            ) : (
              <p className={styles.noStock}>
                Todavía no hay existencias registradas en ninguna ubicación.
              </p>
            )}
          </div>
        </section>

        <aside className={styles.detailAside}>
          <section className={styles.detailCard} aria-labelledby="prices-title">
            <p className={styles.eyebrow}>Información comercial</p>
            <h2 id="prices-title">Precios de venta</h2>
            <dl className={styles.priceList}>
              <div>
                <dt>Mínimo</dt>
                <dd>{formatMoney(item.minimumPriceCents)}</dd>
              </div>
              <div className={styles.suggestedPrice}>
                <dt>Sugerido</dt>
                <dd>
                  {item.suggestedPriceCents === null
                    ? 'No definido'
                    : formatMoney(item.suggestedPriceCents)}
                </dd>
              </div>
              <div>
                <dt>Máximo</dt>
                <dd>
                  {item.maximumPriceCents === null
                    ? 'No definido'
                    : formatMoney(item.maximumPriceCents)}
                </dd>
              </div>
            </dl>
          </section>
          <section className={styles.detailCard} aria-labelledby="classification-title">
            <p className={styles.eyebrow}>Organización</p>
            <h2 id="classification-title">Categoría y etiquetas</h2>
            <p className={styles.category}>{item.category.name}</p>
            {item.tags.length ? (
              <div className={styles.tags}>
                {item.tags.map((tag) => (
                  <span key={tag.id}>{tag.name}</span>
                ))}
              </div>
            ) : (
              <p className={styles.muted}>Sin etiquetas.</p>
            )}
          </section>
        </aside>
      </div>

      {images.length > 1 ? (
        <section
          className={[styles.detailCard, styles.gallery].join(' ')}
          aria-labelledby="gallery-title"
        >
          <p className={styles.eyebrow}>Referencia visual</p>
          <h2 id="gallery-title">Imágenes del producto</h2>
          <div>
            {images.map((image) => (
              <Image
                key={image.id}
                src={image.url}
                alt={`${item.name}, imagen ${String(image.position)}`}
                width={image.width}
                height={image.height}
                sizes="(max-width: 620px) 100vw, 440px"
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function BackLink() {
  return (
    <Link className={styles.backLink} href="/inventory">
      <Icon name="arrow" /> Volver al inventario
    </Link>
  );
}
function DetailSkeleton() {
  return (
    <div className={styles.detailPage} aria-label="Cargando producto">
      <div className={styles.detailSkeletonHeader} />
      <div className={styles.detailSkeletonGrid}>
        <div />
        <div />
      </div>
    </div>
  );
}
