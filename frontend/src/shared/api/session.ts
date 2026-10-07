import type { Role, UserOut } from './generated'

/** The sign-in token, kept in the browser so a reload stays signed in. */
const TOKEN = 'token'
export const getToken = (): string | null => localStorage.getItem(TOKEN)
export const setToken = (t: string | null): void => {
  if (t) localStorage.setItem(TOKEN, t)
  else localStorage.removeItem(TOKEN)
}

/** Called when the server rejects our token. Replaceable in tests. */
export const session = {
  redirect: (): void => {
    window.location.assign('/login')
  },
  expire: (): void => {
    setToken(null)
    session.redirect()
  },
}

const RANK: Record<Role, number> = { translator: 1, reviewer: 2, admin: 3 }
/** Roles build on each other: a reviewer may do what a translator may, an admin everything. */
export const can = (user: UserOut | null | undefined, min: Role): boolean => !!user && RANK[user.role] >= RANK[min]
