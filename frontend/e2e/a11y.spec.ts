import { test } from './fixtures'
import { createProject, expectAccessible, login } from './helpers'

test.describe('accessibility (axe, WCAG 2.x A/AA)', () => {
  test('login page', async ({ page }) => {
    await page.goto('/login')
    await expectAccessible(page, 'login')
  })

  test('main screens and dialogs', async ({ page }) => {
    await login(page, 'admin')
    await expectAccessible(page, 'dashboard')

    await page.goto('/projects/new')
    await expectAccessible(page, 'new project')

    const url = await createProject(page, 'A11y Projekt')
    await expectAccessible(page, 'project before translation')
    await page.getByRole('button', { name: 'Übersetzung starten' }).click()
    await page.getByRole('button', { name: 'Korpus' }).first().waitFor()
    await expectAccessible(page, 'project preview')

    await page.getByRole('button', { name: 'Korpus' }).first().click()
    await expectAccessible(page, 'term dialog')
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Qualitätsprüfung' }).click()
    await expectAccessible(page, 'quality panel')

    await page.getByRole('button', { name: 'Übersetzung freigeben' }).click()
    await expectAccessible(page, 'confirmation dialog')
    await page.getByRole('dialog').getByRole('button', { name: 'Übersetzung freigeben' }).click()
    await page.getByRole('button', { name: 'Exportieren', exact: true }).click()
    await page.getByLabel('Format').selectOption('xlsx')
    await expectAccessible(page, 'export dialog')
    await page.keyboard.press('Escape')

    await page.goto('/projects')
    await expectAccessible(page, 'project list')
    await page.goto('/glossary')
    await expectAccessible(page, 'glossary')
    await page.goto('/users')
    await expectAccessible(page, 'users')
    await page.goto('/settings')
    await expectAccessible(page, 'settings')
    await page.goto(url)
  })
})
