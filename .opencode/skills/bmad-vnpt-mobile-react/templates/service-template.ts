import { httpClient } from '../../lib/http/client';

export async function getExample() {
  const response = await httpClient.get('/example');
  return response.data as { items: Array<{ id: string; title: string }> };
}
