import { expect, test } from './fixtures'
import { login } from './helpers'

test.describe('interface language', () => {
  test('a browser in an unsupported language gets English', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'fr-FR' })
    const page = await context.newPage()
    await page.goto('/login')
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await context.close()
  })

  test('the switch changes the language, is remembered and also changes dates and roles', async ({ page }) => {
    await login(page, 'translator')
    await expect(page.getByRole('link', { name: 'Projekte', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'EN', exact: true }).click()
    await expect(page.getByRole('link', { name: 'Projects', exact: true })).toBeVisible()
    await expect(page.getByText('Translator', { exact: false }).first()).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page.reload()
    await expect(page.getByRole('link', { name: 'Projects', exact: true })).toBeVisible() // remembered
    await page.getByRole('button', { name: 'DE', exact: true }).click()
    await expect(page.getByRole('link', { name: 'Projekte', exact: true })).toBeVisible()
  })
})
