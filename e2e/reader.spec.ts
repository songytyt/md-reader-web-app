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

test('highlights repeated heading text in the selected heading', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Highlight', { exact: true }).click()
  await page.getByRole('heading', { name: 'Notes worth keeping' }).evaluate((heading) => {
    const text = heading.firstChild!
    const start = text.textContent!.indexOf('ee')
    const selection = window.getSelection()!
    const range = document.createRange()
    range.setStart(text, start)
    range.setEnd(text, start + 2)
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })

  await expect(page.getByRole('heading', { name: 'Notes worth keeping' }).locator('mark')).toHaveText('ee')
  await expect(page.locator('p mark')).toHaveCount(0)
})

test('does not nest highlight tags when a later selection overlaps a heading highlight', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Highlight', { exact: true }).click()
  const heading = page.getByRole('heading', { name: 'The quiet work of reading' })
  await heading.evaluate((element) => {
    const text = element.firstChild!
    const selection = window.getSelection()!
    const range = document.createRange()
    range.setStart(text, 'The '.length)
    range.setEnd(text, 'The quiet'.length)
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })
  await expect(heading.locator('mark')).toHaveText('quiet')

  await heading.evaluate((element) => {
    const highlighted = element.querySelector('mark')!.firstChild!
    const trailingText = element.lastChild!
    const selection = window.getSelection()!
    const range = document.createRange()
    range.setStart(highlighted, 3)
    range.setEnd(trailingText, ' work'.length)
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })

  await expect(heading.locator('mark')).toHaveText(['quiet', ' work'])
  await expect(heading.locator('mark mark')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'The quiet work of reading' })).toBeVisible()
})

test('does not add another mark when the same highlighted phrase is selected again', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Highlight', { exact: true }).click()
  const paragraph = page.locator('p').first()

  await paragraph.evaluate((element) => {
    const text = element.firstChild!
    const selection = window.getSelection()!
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 'Markdown is'.length)
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })
  await expect(paragraph.locator('mark')).toHaveText('Markdown is')

  await paragraph.evaluate((element) => {
    const text = element.querySelector('mark')!.firstChild!
    const selection = window.getSelection()!
    const range = document.createRange()
    range.selectNodeContents(text)
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })

  await expect(paragraph.locator('mark')).toHaveCount(1)
  await expect(paragraph).toHaveText('Markdown is a wonderfully portable format, but it deserves a calm place to be read. This small reader keeps the document at the center and the controls close at hand.')
})

test('does not highlight a later duplicate when an existing highlight is selected again', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Highlight', { exact: true }).click()
  const paragraph = page.locator('p').first()

  await paragraph.evaluate((element) => {
    const text = element.firstChild!
    const selection = window.getSelection()!
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 'Markdown'.length)
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })
  await expect(paragraph.locator('mark')).toHaveText('Markdown')

  await paragraph.evaluate((element) => {
    const text = element.querySelector('mark')!.firstChild!
    const selection = window.getSelection()!
    const range = document.createRange()
    range.selectNodeContents(text)
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })

  await expect(page.locator('mark')).toHaveCount(1)
  await expect(page.getByRole('cell', { name: 'Keeps five colors in the Markdown' }).locator('mark')).toHaveCount(0)
})

test('keeps a word intact when separately highlighting adjacent fragments', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Highlight', { exact: true }).click()
  const paragraph = page.locator('p').first()

  await paragraph.evaluate((element) => {
    const text = element.firstChild!
    const selection = window.getSelection()!
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 'Markdown is a w'.length)
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })
  await expect(paragraph.locator('mark')).toHaveText('Markdown is a w')

  await paragraph.evaluate((element) => {
    const text = element.childNodes[1]!
    const selection = window.getSelection()!
    const range = document.createRange()
    range.setStart(text, 1)
    range.setEnd(text, 1 + 'nderfully'.length)
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })
  await expect(paragraph.locator('mark')).toHaveText(['Markdown is a w', 'nderfully'])

  await paragraph.evaluate((element) => {
    const text = element.childNodes[1]!
    const selection = window.getSelection()!
    const range = document.createRange()
    range.selectNodeContents(text)
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })

  await expect(paragraph.locator('mark')).toHaveText(['Markdown is a w', 'o', 'nderfully'])
  await expect(paragraph.locator('mark mark')).toHaveCount(0)
  await expect(paragraph.locator(':scope > mark')).toHaveCount(3)
  await expect(paragraph.locator(':scope > mark').nth(1)).toHaveCSS('padding-left', '0px')
  await expect(paragraph.locator(':scope > mark').nth(1)).toHaveCSS('padding-right', '0px')
  await expect(paragraph).toHaveText('Markdown is a wonderfully portable format, but it deserves a calm place to be read. This small reader keeps the document at the center and the controls close at hand.')
})

test('highlights the remaining letter when extending an existing table highlight', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Highlight', { exact: true }).click()
  const cell = page.getByRole('cell', { name: 'Keeps five colors in the Markdown' })

  await cell.evaluate((element) => {
    const text = element.firstChild!
    const selection = window.getSelection()!
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 'Keep'.length)
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })
  await expect(cell.locator('mark')).toHaveText('Keep')

  await cell.evaluate((element) => {
    const highlighted = element.querySelector('mark')!.firstChild!
    const trailingText = element.lastChild!
    const selection = window.getSelection()!
    const range = document.createRange()
    range.setStart(highlighted, 0)
    range.setEnd(trailingText, 1)
    selection.removeAllRanges()
    selection.addRange(range)
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  })

  await expect(cell.locator('mark')).toHaveText(['Keep', 's'])
  await expect(page.getByText('Markdown is a wonderfully portable format, but it deserves a calm place to be read. This small reader keeps the document at the center and the controls close at hand.').locator('mark')).toHaveCount(0)
})

test('anchors repeated selections to the correct Markdown content block', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    const source = '# keep and keep\n\nkeep and keep\n\n- keep and keep\n\n> keep and keep\n\n| Label | Value |\n| --- | --- |\n| Item | keep and keep |\n'
    window.showOpenFilePicker = async () => [{
      name: 'repeated.md',
      getFile: async () => new File([source], 'repeated.md', { type: 'text/markdown' }),
      createWritable: async () => ({ write: async () => undefined, close: async () => undefined }),
    }]
  })
  await page.getByLabel('Upload Markdown file').click()
  await page.getByText('Highlight', { exact: true }).click()

  const targets = [
    page.getByRole('heading', { name: 'keep and keep' }),
    page.locator('p').first(),
    page.locator('li'),
    page.locator('blockquote p'),
    page.getByRole('cell', { name: 'keep and keep' }),
  ]
  for (const target of targets) {
    await target.evaluate((element) => {
      const text = element.firstChild!
      const value = text.textContent!
      const selection = window.getSelection()!
      const range = document.createRange()
      const start = value.lastIndexOf('keep')
      range.setStart(text, start)
      range.setEnd(text, start + 'keep'.length)
      selection.removeAllRanges()
      selection.addRange(range)
      document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    })
    await expect(target.locator('mark')).toHaveText('keep')
  }
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
