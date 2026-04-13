import { useQuery } from '@tanstack/react-query';

import { getExample } from '../api/get-example';

export function useExampleQuery() {
  return useQuery({
    queryKey: ['example', 'list'],
    queryFn: getExample,
  });
}
