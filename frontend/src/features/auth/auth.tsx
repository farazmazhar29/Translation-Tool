import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { get, getToken, post, setToken, type S } from '@/shared/api/client'
import { Ctx } from './auth-context'

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => get<S['UserOut']>('/auth/me'),
    enabled: !!getToken(),
    retry: false,
  })
  const login = async (username: string, password: string): Promise<void> => {
    const res = await post<S['LoginOut']>('/auth/login', new URLSearchParams({ username, password }))
    setToken(res.access_token)
    qc.setQueryData(['me'], res.user)
  }
  const logout = (): void => {
    setToken(null)
    qc.clear()
  }
  return (
    <Ctx value={{ user: getToken() ? (data ?? null) : null, loading: !!getToken() && isLoading, login, logout }}>
      {children}
    </Ctx>
  )
}
