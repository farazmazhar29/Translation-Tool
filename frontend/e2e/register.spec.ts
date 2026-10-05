import { expect, test } from './fixtures'
import { expectAccessible } from './helpers'

test.describe('create account', () => {
  test('the sign-in page starts empty, shows no demo credentials and offers to create an account', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByLabel('Benutzername')).toHaveValue('')
    await expect(page.getByLabel('Passwort')).toHaveValue('')
    await expect(page.getByText(/translator123|admin123/)).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Konto erstellen' })).toBeVisible()
  })

  test('a new account is created, the user is sent to the sign-in page and signs in there', async ({ page }) => {
    const name = `e2e.${String(Date.now())}`
    await page.goto('/login')
    await page.getByRole('link', { name: 'Konto erstellen' }).click()
    await expectAccessible(page, 'create account')
    await page.getByLabel('Vollständiger Name').fill('E2E Person')
    await page.getByLabel('Benutzername').fill(name)
    await page.getByLabel('Passwort', { exact: true }).fill('ein-langes-passwort')
    await page.getByLabel('Passwort wiederholen').fill('ein-langes-passwort')
    await page.getByRole('button', { name: 'Konto erstellen' }).click()

    await expect(page).toHaveURL(/\/login$/) // not signed in: back at the sign-in page
    await expect(page.getByText('Ihr Konto wurde erstellt')).toBeVisible()
    await expect(page.getByText('Offene Projekte')).toHaveCount(0)

    await page.getByLabel('Benutzername').fill(name)
    await page.getByLabel('Passwort').fill('ein-langes-passwort')
    await page.getByRole('button', { name: 'Anmelden' }).click()
    await expect(page.getByText('Offene Projekte')).toBeVisible()
    await expect(page.locator('aside').getByText('E2E Person')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Benutzer' })).toHaveCount(0) // a translator, not an admin
  })

  test('a taken username is refused with a clear message', async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Benutzername').fill('Admin') // other letters, same name
    await page.getByLabel('Passwort', { exact: true }).fill('ein-langes-passwort')
    await page.getByLabel('Passwort wiederholen').fill('ein-langes-passwort')
    await page.getByRole('button', { name: 'Konto erstellen' }).click()
    await expect(page.getByText('Benutzername existiert bereits')).toBeVisible()
  })
})
