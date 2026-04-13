import { Stack } from 'expo-router';
import { QueryProvider } from '../lib/query/query-client';

export default function RootLayout() {
  return (
    <QueryProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryProvider>
  );
}
