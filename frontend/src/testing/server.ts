import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { settings } from './fixtures'

/** Default handlers; individual tests add or override handlers with `server.use(...)`. */
export const server = setupServer(
  http.get('*/api/settings', () => HttpResponse.json(settings())),
  http.get('*/api/auth/options', () => HttpResponse.json({ registration_enabled: true })),
)
