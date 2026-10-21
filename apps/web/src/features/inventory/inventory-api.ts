import type { components } from '@/shared/api/schema';
import { apiClient } from '@/shared/api/client';
import { toApiProblem } from '@/shared/api/problem-details';
export { formatMoney } from '@/shared/formatters';

export type Product = components['schemas']['ProductCatalogResponse'];
export type ProductPage = components['schemas']['ProductCatalogPageResponse'];

export const productCatalogQueryKey = (query: string) => ['product-catalog', query] as const;
export const productDetailQueryKey = (productId: string) => ['product', productId] as const;

export async function searchProducts(query: string, cursor?: string): Promise<ProductPage> {
  const { data, error, response } = await apiClient.GET('/api/v1/products', {
    params: {
      query: {
        ...(query.length > 0 ? { query } : {}),
        ...(cursor === undefined ? {} : { cursor }),
      },
    },
  });
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data;
}

export async function getProduct(productId: string): Promise<Product> {
  const { data, error, response } = await apiClient.GET('/api/v1/products/{productId}', {
    params: { path: { productId } },
  });
  if (!response.ok || data === undefined) throw toApiProblem(response, error);
  return data;
}

export function availableStock(product: Product): number {
  return product.stock.reduce((total, position) => total + position.availableQuantity, 0);
}
