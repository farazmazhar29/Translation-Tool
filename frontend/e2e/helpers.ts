import { resolve } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

const SAMPLE = resolve('..', 'samples', 'Montageanleitung_Unterschrank.docx')

export async function login(page: Page, user: 'translator' | 'reviewer' | 'admin'): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Benutzername').fill(user)
  await page.getByLabel('Passwort').fill(`${user}123`)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.getByText('Offene Projekte')).toBeVisible()
}

/** Creates a project from the sample file through the UI and returns its URL. */
export async function createProject(page: Page, name: string): Promise<string> {
  await page.goto('/projects/new')
  await page.locator('input[type=file]').setInputFiles(SAMPLE)
  await page.getByPlaceholder('Standard: Dateiname').fill(name)
  await page.getByRole('button', { name: 'Projekt anlegen' }).click()
  await page.waitForURL(/\/projects\/\d+$/)
  return page.url()
}

/** Fails with a readable list when axe finds WCAG 2.x A/AA violations. */
export async function expectAccessible(page: Page, where: string): Promise<void> {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  const found = result.violations.map(
    (v) => `${v.id} [${v.impact ?? '?'}] ×${String(v.nodes.length)} e.g. ${v.nodes[0]?.target.join(' ') ?? ''}`,
  )
  expect(found, `accessibility violations on ${where}`).toEqual([])
}
