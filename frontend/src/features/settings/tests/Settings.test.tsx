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

  it('does not offer the offline mock as a provider', async () => {
    setup()
    const provider = await screen.findByRole('combobox', { name: 'Provider' })
    expect([...(provider as HTMLSelectElement).options].map((o) => o.value)).toEqual(['gemini'])
    expect(screen.queryByText(/Offline-Testmodus/)).not.toBeInTheDocument()
  })

  it('says when the server runs the offline mock', async () => {
    setup({ offline_mock: true })
    expect(await screen.findByText(/Offline-Testmodus/)).toBeInTheDocument()
  })

  it('keeps a stored model the list no longer has visible', async () => {
    setup({ llm_model: 'retired-model' })
    const model = await screen.findByRole('combobox', { name: 'Modell' })
    expect(model).toHaveValue('retired-model')
    expect([...(model as HTMLSelectElement).options].map((o) => o.value)).toEqual(['retired-model', 'test', 'test-2'])
  })
})
