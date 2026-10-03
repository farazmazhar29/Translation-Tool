import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useAction, useFields, useInvalidate } from '../lib/hooks'

const setup = () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { invalidate, wrapper }
}

describe('useInvalidate', () => {
  it('refreshes every query that starts with one of the keys', async () => {
    const { invalidate, wrapper } = setup()
    const { result } = renderHook(() => useInvalidate(['projects', 'users']), { wrapper })
    await act(async () => {
      await result.current()
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['projects'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['users'] })
  })
})

describe('useAction', () => {
  it('passes its argument to the function, refreshes the listed queries and then calls onSuccess', async () => {
    const { invalidate, wrapper } = setup()
    const onSuccess = vi.fn()
    const { result } = renderHook(
      () => useAction((n: number) => Promise.resolve(n * 2), { invalidate: ['a', 'b'], onSuccess }),
      { wrapper },
    )
    act(() => {
      result.current.mutate(21)
    })
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(42)
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['a'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['b'] })
    expect(invalidate.mock.invocationCallOrder[0]).toBeLessThan(onSuccess.mock.invocationCallOrder[0] ?? 0)
  })

  it('works without arguments, options or invalidations', async () => {
    const { invalidate, wrapper } = setup()
    const run = vi.fn(() => Promise.resolve('fertig'))
    const { result } = renderHook(() => useAction(run), { wrapper })
    act(() => {
      result.current.mutate()
    })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data).toBe('fertig')
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('exposes the error and does not refresh or call onSuccess when the action fails', async () => {
    const { invalidate, wrapper } = setup()
    const onSuccess = vi.fn()
    const { result } = renderHook(
      () => useAction(() => Promise.reject(new Error('kaputt')), { invalidate: ['x'], onSuccess }),
      { wrapper },
    )
    act(() => {
      result.current.mutate()
    })
    await waitFor(() => {
      expect(result.current.error?.message).toBe('kaputt')
    })
    expect(onSuccess).not.toHaveBeenCalled()
    expect(invalidate).not.toHaveBeenCalled()
  })
})

describe('useFields', () => {
  it('updates one field and keeps the others', () => {
    const { result } = renderHook(() => useFields({ name: 'a', count: 1 }))
    act(() => {
      result.current.set('count')(2)
    })
    expect(result.current.values).toEqual({ name: 'a', count: 2 })
  })

  it('handlers of different fields do not overwrite each other', () => {
    const { result } = renderHook(() => useFields({ name: 'a', count: 1 }))
    act(() => {
      result.current.set('name')('b')
      result.current.set('count')(5)
    })
    expect(result.current.values).toEqual({ name: 'b', count: 5 })
  })

  it('can replace all values at once', () => {
    const { result } = renderHook(() => useFields({ name: 'a', count: 1 }))
    act(() => {
      result.current.setValues({ name: 'z', count: 9 })
    })
    expect(result.current.values).toEqual({ name: 'z', count: 9 })
  })
})
