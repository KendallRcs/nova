'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { SyntheticEvent } from 'react';

import { problemMessage } from '@/shared/api/problem-details';
import { Icon } from '@/shared/ui/icons';
import { ModuleStart } from '@/shared/ui/module-start';
import {
  availableStock,
  formatMoney,
  productCatalogQueryKey,
  searchProducts,
  type Product,
} from './inventory-api';
import styles from './inventory.module.css';
import { ProductPicture } from './product-picture';

export function InventoryScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get('q')?.trim() ?? '';

  const products = useInfiniteQuery({
    queryKey: productCatalogQueryKey(query),
    queryFn: ({ pageParam }) => searchProducts(query, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.pageInfo.nextCursor ?? undefined,
  });
  const items = products.data?.pages.flatMap((page) => page.items) ?? [];

  function submitSearch(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('q');
    const normalized = typeof value === 'string' ? value.trim() : '';
    router.replace(normalized ? `/inventory?q=${encodeURIComponent(normalized)}` : '/inventory');
  }

  function clearSearch() {
    router.replace('/inventory');
  }

  return (
    <ModuleStart
      title="Inventario"
      description="Consulta precios y disponibilidad real en tienda y almacén."
      help="Disponible es lo que puedes ofrecer ahora. Las unidades reservadas pertenecen a una separación y las unidades en revisión todavía no pueden venderse."
    >
      <section className={styles.searchPanel} aria-labelledby="product-search-title">
        <div className={styles.searchHeading}>
          <div>
            <p className={styles.eyebrow}>Consulta de productos</p>
            <h2 id="product-search-title">Busca por código o nombre</h2>
          </div>
          <p>Los costos y márgenes permanecen protegidos.</p>
        </div>
        <form className={styles.searchForm} role="search" onSubmit={submitSearch}>
          <label htmlFor="product-query">Código o nombre del producto</label>
          <div className={styles.searchControl}>
            <Icon name="search" />
            <input
              id="product-query"
              key={query}
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Ejemplo: MUN-001 o muñeca"
              autoComplete="off"
            />
            {query ? (
              <button type="button" className={styles.clearButton} onClick={clearSearch}>
                Limpiar
              </button>
            ) : null}
          </div>
          <button type="submit" className={styles.searchButton}>
            Buscar
          </button>
        </form>
      </section>

      <section className={styles.results} aria-labelledby="results-title" aria-live="polite">
        <div className={styles.resultsHeading}>
          <div>
            <p className={styles.eyebrow}>{query ? 'Coincidencias' : 'Catálogo activo'}</p>
            <h2 id="results-title">
              {query ? `Resultados para “${query}”` : 'Todos los productos'}
            </h2>
          </div>
          {!products.isPending && !products.isError ? (
            <span>
              {items.length} {items.length === 1 ? 'producto' : 'productos'}
            </span>
          ) : null}
        </div>
        {products.isPending ? <ProductListSkeleton /> : null}
        {products.isError ? (
          <div className={styles.feedback} role="alert">
            <strong>No pudimos cargar los productos</strong>
            <p>{problemMessage(products.error)}</p>
            <button
              type="button"
              onClick={() => {
                void products.refetch();
              }}
            >
              Intentar nuevamente
            </button>
          </div>
        ) : null}
        {!products.isPending && !products.isError && items.length === 0 ? (
          <div className={styles.feedback}>
            <strong>No encontramos productos</strong>
            <p>Prueba con otro nombre, revisa el código o limpia la búsqueda.</p>
            {query ? (
              <button type="button" onClick={clearSearch}>
                Ver todos los productos
              </button>
            ) : null}
          </div>
        ) : null}
        {items.length ? (
          <div className={styles.productList}>
            {items.map((product) => (
              <ProductRow key={product.id} product={product} />
            ))}
          </div>
        ) : null}
        {products.hasNextPage ? (
          <button
            type="button"
            className={styles.moreButton}
            onClick={() => {
              void products.fetchNextPage();
            }}
            disabled={products.isFetchingNextPage}
          >
            {products.isFetchingNextPage ? 'Cargando…' : 'Cargar más productos'}
          </button>
        ) : null}
      </section>
    </ModuleStart>
  );
}

function ProductRow({ product }: Readonly<{ product: Product }>) {
  const available = availableStock(product);
  return (
    <Link className={styles.productRow} href={`/inventory/${product.id}` as Route}>
      <span className={styles.productVisual}>
        <ProductPicture product={product} />
      </span>
      <span className={styles.productIdentity}>
        <span className={styles.productCode}>{product.code}</span>
        <strong>{product.name}</strong>
        <small>{product.category.name}</small>
      </span>
      <span className={styles.productPrice}>
        <small>Precio sugerido</small>
        <strong>{formatMoney(product.suggestedPriceCents ?? product.minimumPriceCents)}</strong>
      </span>
      <span className={styles.productStock} data-empty={available === 0}>
        <small>Disponible</small>
        <strong>{available}</strong>
        <span>{available === 1 ? 'unidad' : 'unidades'}</span>
      </span>
      <span className={styles.rowArrow} aria-hidden="true">
        <Icon name="arrow" />
      </span>
    </Link>
  );
}

function ProductListSkeleton() {
  return (
    <div className={styles.skeletonList} aria-label="Cargando productos">
      {[0, 1, 2].map((item) => (
        <div className={styles.skeletonRow} key={item}>
          <span />
          <div>
            <span />
            <span />
          </div>
          <span />
        </div>
      ))}
    </div>
  );
}
