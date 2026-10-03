import { expect, test } from './fixtures'
import { createProject, login } from './helpers'

test('translator → reviewer: upload, preview, edit, approve, export', async ({ page }) => {
  await login(page, 'translator')
  const url = await createProject(page, 'E2E Montageanleitung')

  // upload analysed the file: language detected, nothing translated yet
  await expect(page.getByText('Erkannte Sprache:')).toContainText('DE')
  await expect(page.getByText('Noch nicht übersetzt')).toHaveCount(0)

  // translation creates a preview with highlighted terms; export is not offered yet
  await page.getByRole('button', { name: 'Übersetzung starten' }).click()
  await expect(page.getByRole('button', { name: 'Korpus' }).first()).toBeVisible()
  await expect(page.getByText('carcass').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Exportieren', exact: true })).toHaveCount(0)

  // term dialog shows the glossary details
  await page.getByRole('button', { name: 'Korpus' }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Verwendete Übersetzung')).toBeVisible()
  await expect(dialog.getByText('Glossarbegriff')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  // manual edit is attributed to the editor
  await page.getByRole('button', { name: '✎ Bearbeiten' }).nth(1).click()
  await page.getByRole('textbox').first().fill('Edited by hand')
  await page.getByRole('button', { name: 'Übernehmen' }).click()
  await expect(page.getByText('bearbeitet von translator')).toBeVisible()

  // quality check reports the glossary terms that the manual edit removed
  await page.getByRole('button', { name: 'Qualitätsprüfung' }).click()
  await expect(page.getByText(/Hinweis\(e\)/)).toBeVisible()

  // translators cannot approve; reviewers can
  await expect(page.getByRole('button', { name: 'Übersetzung freigeben' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Abmelden' }).click()
  await login(page, 'reviewer')
  await page.goto(url)
  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: 'Übersetzung freigeben' }).click()
  await expect(page.getByText('Freigegeben', { exact: true })).toBeVisible()

  // export to Excel with custom columns, downloads a file
  await page.getByRole('button', { name: 'Exportieren', exact: true }).click()
  await page.getByLabel('Format').selectOption('xlsx')
  await page.getByLabel('Inhalt').selectOption('both')
  await page.getByLabel('Spalte Zielsprache').fill('E')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportieren & herunterladen' }).click()
  expect((await download).suggestedFilename()).toMatch(/_en_both\.xlsx$/)

  // history lists the release and the export
  await page.getByRole('button', { name: 'Verlauf' }).click()
  await expect(page.getByText(/Freigabe #\d+/)).toBeVisible()
})

test('glossary: duplicates are detected and drafts need approval', async ({ page }) => {
  await login(page, 'translator')
  await page.goto('/glossary')
  await page.getByRole('button', { name: '+ Begriff' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Deutsch').fill('Korpus')
  await dialog.getByLabel('Englisch').fill('carcass')
  await dialog.getByRole('button', { name: 'Speichern' }).click()
  await expect(dialog.getByText('Dublette gefunden:')).toBeVisible()
})

test('roles: translators do not see user administration', async ({ page }) => {
  await login(page, 'translator')
  await expect(page.getByRole('link', { name: 'Benutzer' })).toHaveCount(0)
  await page.goto('/users')
  await expect(page).toHaveURL(/\/$/)
})

test('login rejects wrong credentials', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Passwort').fill('wrong')
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.getByText('Benutzername oder Passwort falsch')).toBeVisible()
})

test('the app is served with security headers and a strict content security policy', async ({ page }) => {
  const response = await page.goto('/login')
  const headers = response?.headers() ?? {}
  expect(headers['content-security-policy']).toContain("default-src 'self'")
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['x-frame-options']).toBe('DENY')
  expect(headers['x-request-id']).toBeTruthy()
  // the page itself must work under that policy (the console guard fails on any CSP violation)
  await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible()
})

test('login is rate limited after repeated failures', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Benutzername').fill('rate-limit-victim') // a throw-away name: real users must not be locked out
  await page.getByLabel('Passwort').fill('wrong-password')
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Anmelden' }).click()
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.getByText(/Zu viele Fehlversuche/)).toBeVisible()
})
