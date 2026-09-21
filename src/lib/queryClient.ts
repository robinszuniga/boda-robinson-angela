import { MutationCache, QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { describeError } from './errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Al volver a la pestaña se recargan los datos: así cada uno ve lo que editó el otro.
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.meta?.silent) return
      toast.error(describeError(error))
    },
  }),
})
