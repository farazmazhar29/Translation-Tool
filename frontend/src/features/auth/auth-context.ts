import { createContext, use } from 'react'
import type { S } from '@/shared/api/client'

interface Auth {
  user: S['UserOut'] | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (body: S['RegisterIn']) => Promise<void>
  logout: () => void
}

export const Ctx = createContext<Auth | null>(null)

export const useAuth = (): Auth => {
  const ctx = use(Ctx)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
