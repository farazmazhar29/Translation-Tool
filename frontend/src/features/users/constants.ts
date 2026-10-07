import type { UserIn } from '@/shared/api/generated'

/** The user form always holds every field; in the request they are optional (the server has defaults). */
export type UserForm = Required<UserIn>

export const EMPTY: UserForm = { username: '', full_name: '', password: '', role: 'translator', active: true }
