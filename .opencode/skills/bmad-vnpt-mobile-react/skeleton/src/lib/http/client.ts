export const httpClient = {
  async get(path: string) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return { data: await response.json() };
  },
};
