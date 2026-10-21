'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

let browserQueryClient: QueryClient | undefined;

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
      mutations: { retry: false },
    },
  });
}

function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') return createQueryClient();
  browserQueryClient ??= createQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
