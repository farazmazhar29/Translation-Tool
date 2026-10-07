import { useApiRequest, useMutation, unwrap } from '@/shared/api/base'
import { API_CONFIG } from '@/shared/api/config'
import { UsersApiFactory, type UserIn } from '@/shared/api/generated'

const api = UsersApiFactory(API_CONFIG)

/** User administration (admins only). */
export const UserService = {
  useFetchUsers() {
    return useApiRequest({ key: ['users'], apiCall: () => api.listUsers() })
  },

  /** Creates a user, or updates the one with `id`. */
  useCreateOrUpdateUser(onSuccess?: () => void) {
    return useMutation(
      ({ id, user }: { id?: number; user: UserIn }) =>
        unwrap(id ? api.updateUser({ uid: id, userIn: user }) : api.createUser({ userIn: user })),
      { invalidate: ['users'], onSuccess },
    )
  },

  /** Deletes a user. Their name stays in the history and is never given to anyone else. */
  useDeleteUser() {
    return useMutation((id: number) => unwrap(api.deleteUser({ uid: id })), { invalidate: ['users', 'editors'] })
  },
}
