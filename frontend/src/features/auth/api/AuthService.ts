import { useApiRequest, unwrap } from '@/shared/api/base'
import { API_CONFIG, ApiError } from '@/shared/api/config'
import { AuthApiFactory, UsersApiFactory, type RegisterIn } from '@/shared/api/generated'
import { getToken } from '@/shared/api/session'

const auth = AuthApiFactory(API_CONFIG)
const users = UsersApiFactory(API_CONFIG)

export const CURRENT_USER = ['current-user'] as const

export const AuthService = {
  /** The signed-in user, while there is a token. */
  useFetchCurrentUser() {
    return useApiRequest({
      key: CURRENT_USER,
      apiCall: () => users.readCurrentUser(),
      preventRequest: !getToken(),
      options: {
        // A restart or a short network gap of the server must not look like "signed out": try again a few times.
        // A rejected token (401) is final: the API configuration has already ended the session.
        retry: (failures, error) => !(error instanceof ApiError && error.status === 401) && failures < 3,
        retryDelay: (failure) => 400 * 2 ** failure,
      },
    })
  },

  /** Whether new accounts may be created, for the sign-in and register pages. */
  useFetchAuthOptions() {
    return useApiRequest({ key: ['auth-options'], apiCall: () => auth.authOptions() })
  },

  login: (username: string, password: string) => unwrap(auth.login({ username, password })),

  /** Creates the account; it does not sign in. */
  register: (body: RegisterIn) => unwrap(auth.register({ registerIn: body })),
}
