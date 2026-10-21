import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

export function renderWithQueryClient(element: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  return {
    queryClient,
    ...render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>),
  };
}
