import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { useState } from 'react'

/** Returns a function that refreshes every cached query whose key starts with one of `keys`. */
export const useInvalidate = (keys: readonly string[]): (() => Promise<void>) => {
  const qc = useQueryClient()
  return async () => {
    await Promise.all(keys.map((key) => qc.invalidateQueries({ queryKey: [key] })))
  }
}

/**
 * A user action against the API (save, delete, archive ...): runs `fn`, refreshes the listed queries and then
 * calls `onSuccess`. Replaces the useMutation + invalidateQueries boilerplate.
 */
export const useAction = <A = void, R = unknown>(
  fn: (arg: A) => Promise<R>,
  { invalidate = [], onSuccess }: { invalidate?: readonly string[]; onSuccess?: (result: R) => void } = {},
): UseMutationResult<R, Error, A> => {
  const refresh = useInvalidate(invalidate)
  return useMutation({
    mutationFn: fn,
    onSuccess: async (result) => {
      await refresh()
      onSuccess?.(result)
    },
  })
}

/**
 * State of a form. `set('name')` returns the `onChange(value)` handler of that field, so a field is one line:
 * `<TextField label="Name" value={values.name} onChange={set('name')} />`.
 */
export const useFields = <T extends object>(initial: T) => {
  const [values, setValues] = useState(initial)
  const set =
    <K extends keyof T>(key: K) =>
    (value: T[K]): void => {
      setValues((current) => ({ ...current, [key]: value }))
    }
  return { values, setValues, set }
}
