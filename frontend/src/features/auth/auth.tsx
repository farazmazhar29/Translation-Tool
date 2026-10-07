import { useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { RegisterIn } from '@/shared/api/generated'
import { getToken, setToken } from '@/shared/api/session'
import { AuthService, CURRENT_USER } from './api/AuthService'
import { Ctx } from './auth-context'

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const qc = useQueryClient()
  const { data, loading } = AuthService.useFetchCurrentUser()
  const login = async (username: string, password: string): Promise<void> => {
    const res = await AuthService.login(username, password)
    setToken(res.access_token)
    qc.setQueryData(CURRENT_USER, res.user)
  }
  const register = async (body: RegisterIn): Promise<void> => {
    await AuthService.register(body) // creating the account does not sign in
  }
  const logout = (): void => {
    setToken(null)
    qc.clear()
  }
  return (
    <Ctx
      value={{ user: getToken() ? (data ?? null) : null, loading: !!getToken() && loading, login, register, logout }}
    >
      {children}
    </Ctx>
  )
}
