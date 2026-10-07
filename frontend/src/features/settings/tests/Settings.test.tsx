import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { AuthProvider } from '@/features/auth'
import type { SettingsOut } from '@/shared/api/generated'
import { setToken } from '@/shared/api/session'
import { settings } from '@/testing/fixtures'
import { renderApp } from '@/testing/render'
import { server } from '@/testing/server'
import Settings from '../Settings'

const setup = (over: Partial<SettingsOut> = {}) => {
  setToken('t')
  const saved: unknown[] = []
  server.use(
    http.get('*/api/users/current-user', () =>
      HttpResponse.json({ id: 1, username: 'admin', full_name: '', role: 'admin', active: true }),
    ),
    http.get('*/api/settings', () => HttpResponse.json({ ...settings(), ...over })),
    http.put('*/api/settings', async ({ request }) => {
      saved.push(await request.json())
      return HttpResponse.json({ ...settings(), ...over })
    }),
  )
  renderApp(
    <AuthProvider>
      <Settings />
    </AuthProvider>,
  )
  return saved
}

describe('Settings', () => {
  it('offers the models of the provider as a list, not a text field', async () => {
    const saved = setup({ llm_provider: 'gemini', llm_model: 'test' })
    const model = await screen.findByRole('combobox', { name: 'Modell' })
    expect([...(model as HTMLSelectElement).options].map((o) => o.value)).toEqual(['test', 'test-2'])
    await userEvent.selectOptions(model, 'test-2')
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await waitFor(() => {
      expect(saved).toHaveLength(1)
    })
    expect(saved[0]).toMatchObject({ llm_provider: 'gemini', llm_model: 'test-2' })
  })

  it('needs no model for the offline mock', async () => {
    setup({ llm_provider: 'mock' })
    expect(await screen.findByText('Der Offline-Modus braucht kein Modell.')).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Modell' })).not.toBeInTheDocument()
  })

  it('switching the provider picks one of its models', async () => {
    setup({ llm_provider: 'mock', llm_model: 'from-before' })
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Provider' }), 'gemini')
    expect(screen.getByRole('combobox', { name: 'Modell' })).toHaveValue('test')
  })
})
