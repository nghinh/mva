import { useQuery } from '@tanstack/react-query';

import { getExample } from '../api/get-example';

export const exampleKeys = {
  all: ['example'] as const,
  list: () => [...exampleKeys.all, 'list'] as const,
};

export function useExampleQuery() {
  return useQuery({
    queryKey: exampleKeys.list(),
    queryFn: getExample,
  });
}
