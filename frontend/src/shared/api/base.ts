import {
  useMutation as useQueryMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseMutationResult,
  type UseQueryOptions,
} from '@tanstack/react-query'
import type { AxiosResponse } from 'axios'

/** The data of an API answer: `unwrap(api.getProject({ pid }))` gives the project, not the axios response. */
export const unwrap = async <T>(request: Promise<AxiosResponse<T>>): Promise<T> => (await request).data

interface ApiRequest<T, R> {
  /** Identifies the data, like the deps of an effect: when it changes, the data is loaded again; views that use the
   *  same key share it, and saving refreshes it by its first part (see `useMutation({ invalidate })`). */
  key: QueryKey
  apiCall: () => Promise<AxiosResponse<T>>
  postProcess?: (data: T) => R
  /** Do not load (yet), e.g. while the id is not known. */
  preventRequest?: boolean
  /** Further TanStack Query options: polling (`refetchInterval`), `retry`, `staleTime` ... */
  options?: Omit<UseQueryOptions<R>, 'queryKey' | 'queryFn' | 'enabled'>
}

/**
 * Loads data from the API and keeps it as state. TanStack Query holds the state underneath, so views showing the
 * same data share one request and one cache, and a save refreshes them.
 */
export const useApiRequest = <T, R = T>({
  key,
  apiCall,
  postProcess,
  preventRequest = false,
  options,
}: ApiRequest<T, R>) => {
  // The service names the key: it identifies the data. `postProcess` only shapes that data, so it is no part of it.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const query = useQuery<R>({
    ...options,
    queryKey: key,
    queryFn: async () => {
      const data = await unwrap(apiCall())
      return postProcess ? postProcess(data) : (data as unknown as R)
    },
    enabled: !preventRequest,
  })
  return {
    data: query.data,
    loading: query.isLoading,
    fetching: query.isFetching, // also while refreshing data that is already shown
    error: query.error,
    refetch: query.refetch,
  }
}

/**
 * A change through the API (save, delete, archive ...): runs `apiCall`, refreshes the data whose key starts with one
 * of `invalidate`, then calls `onSuccess`. `mutate(arg)` starts it; `isPending` and `error` describe it.
 */
export const useMutation = <A = void, R = unknown>(
  apiCall: (arg: A) => Promise<R>,
  { invalidate = [], onSuccess }: { invalidate?: readonly string[]; onSuccess?: (result: R) => void } = {},
): UseMutationResult<R, Error, A> => {
  const qc = useQueryClient()
  return useQueryMutation({
    mutationFn: apiCall,
    onSuccess: async (result) => {
      await Promise.all(invalidate.map((key) => qc.invalidateQueries({ queryKey: [key] })))
      onSuccess?.(result)
    },
  })
}

/** Refreshes the data whose key starts with one of `keys`, e.g. after a change made elsewhere. */
export const useRefresh = (keys: readonly string[]): (() => Promise<void>) => {
  const qc = useQueryClient()
  return async () => {
    await Promise.all(keys.map((key) => qc.invalidateQueries({ queryKey: [key] })))
  }
}
