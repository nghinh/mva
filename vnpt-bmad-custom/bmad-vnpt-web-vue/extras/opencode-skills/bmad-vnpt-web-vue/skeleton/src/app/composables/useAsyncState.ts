import { ref } from 'vue'

export function useAsyncState<T>() {
  const loading = ref(false)
  const error = ref<unknown>(null)
  const data = ref<T | null>(null)

  return { loading, error, data }
}
