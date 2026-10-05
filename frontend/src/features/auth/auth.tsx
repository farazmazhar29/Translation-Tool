import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ApiError, get, getToken, post, setToken, type S } from '@/shared/api/client'
import { Ctx } from './auth-context'

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => get<S['UserOut']>('/users/current-user'),
    enabled: !!getToken(),
    // A restart or a short network gap of the server must not look like "signed out": try again a few times.
    // A rejected token (401) is final: the API client has already ended the session.
    retry: (failures, error) => !(error instanceof ApiError && error.status === 401) && failures < 3,
    retryDelay: (failure) => 400 * 2 ** failure,
  })
  const login = async (username: string, password: string): Promise<void> => {
    const res = await post<S['LoginOut']>('/auth/login', new URLSearchParams({ username, password }))
    setToken(res.access_token)
    qc.setQueryData(['current-user'], res.user)
  }
  const register = async (body: S['RegisterIn']): Promise<void> => {
    await post<S['UserOut']>('/auth/register', { ...body }) // creating the account does not sign in
  }
  const logout = (): void => {
    setToken(null)
    qc.clear()
  }
  return (
    <Ctx
      value={{ user: getToken() ? (data ?? null) : null, loading: !!getToken() && isLoading, login, register, logout }}
    >
      {children}
    </Ctx>
  )
}
