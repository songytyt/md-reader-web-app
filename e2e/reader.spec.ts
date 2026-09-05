import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    let source = '# Imported reader\n\nSelect this sentence for a saved highlight.\n'
    window.showOpenFilePicker = async () => [{
      name: 'reader.md',
      getFile: async () => new File([source], 'reader.md', { type: 'text/markdown' }),
      createWritable: async () => ({ write: async (value: string) => { source = value }, close: async () => undefined }),
    }]
  })
})

test('opens, highlights, saves, and refreshes a local Markdown document', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Upload Markdown file').click()
  await expect(page.getByText('reader.md', { exact: true })).toBeVisible()

  await page.getByText('Highlight', { exact: true }).click()
  await page.locator('p').first().evaluate((paragraph) => {
    const text = paragraph.firstChild!
    const selection = window.getSelection()!
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 'Select this sentence'.length)
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })
  await expect(page.locator('mark')).toHaveText('Select this sentence')

  await page.getByRole('button', { name: 'Save file' }).click()
  await expect(page.getByText(/Saved \d/)).toBeVisible()
  await page.getByLabel('Reload file').click()
  await expect(page.locator('mark')).toHaveCount(1)
})

test('refresh confirms before discarding an unsaved annotation', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Upload Markdown file').click()
  await page.getByText('Highlight', { exact: true }).click()
  await page.locator('p').first().evaluate((paragraph) => {
    const text = paragraph.firstChild!
    const selection = window.getSelection()!
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 'Select this sentence'.length)
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })
  await expect(page.locator('mark')).toHaveCount(1)

  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByLabel('Reload file').click()
  await expect(page.locator('mark')).toHaveCount(1)

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByLabel('Reload file').click()
  await expect(page.locator('mark')).toHaveCount(0)
})

test('changes colors, closes the picker on outside click, and reclaims width when contents closes', async ({ page }) => {
  await page.goto('/')
  const reader = page.locator('.reader')
  const widthWithContents = await reader.evaluate((element) => element.getBoundingClientRect().width)

  await page.getByLabel('Choose highlight color; currently Sun').click()
  await page.getByRole('button', { name: 'Rose' }).click()
  await expect(page.getByLabel('Choose highlight color; currently Rose')).toBeVisible()
  await expect(page.getByRole('menu', { name: 'Highlight colors' })).toHaveCount(0)

  await page.getByLabel('Choose highlight color; currently Rose').click()
  await page.locator('.paper').click()
  await expect(page.getByRole('menu', { name: 'Highlight colors' })).toHaveCount(0)

  await page.getByLabel('Toggle table of contents').click()
  await expect(page.locator('.reader-layout')).not.toHaveClass(/contents-open/)
  await expect.poll(async () => reader.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(widthWithContents)
})

test('uses a one-page reader at a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 800 })
  await page.goto('/')
  await expect(page.locator('.paper')).toHaveCSS('column-count', 'auto')
})
