import { createContext, use } from 'react'
import type { RegisterIn, UserOut } from '@/shared/api/generated'

interface Auth {
  user: UserOut | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  register: (body: RegisterIn) => Promise<void>
  logout: () => void
}

export const Ctx = createContext<Auth | null>(null)

export const useAuth = (): Auth => {
  const ctx = use(Ctx)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
