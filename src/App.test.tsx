import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { FileSystemFileHandleLike } from './types'

const makeHandle = (contents = '# Imported title\n\nBody') => {
  const write = vi.fn().mockResolvedValue(undefined)
  const close = vi.fn().mockResolvedValue(undefined)
  const handle: FileSystemFileHandleLike = {
    name: 'imported.md',
    getFile: vi.fn().mockResolvedValue({ name: 'imported.md', text: async () => contents } as File),
    createWritable: vi.fn().mockResolvedValue({ write, close }),
  }
  return { handle, write, close }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  delete window.showOpenFilePicker
})

describe('Reader controls', () => {
  it('shows the contents sidebar by default and toggles it without leaving a narrow reader', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    const layout = container.querySelector('.reader-layout')!
    expect(screen.getByLabelText('Table of contents')).toBeInTheDocument()
    expect(layout).toHaveClass('contents-open')

    await user.click(screen.getByLabelText('Toggle table of contents'))
    expect(layout).not.toHaveClass('contents-open')
    expect(container.querySelector('.reader')).toHaveClass('reader')
  })

  it('keeps Sun selected by default and separates mode toggle from color selection', async () => {
    const user = userEvent.setup()
    render(<App />)
    const mode = screen.getByText('Highlight')
    const colorTrigger = screen.getByLabelText('Choose highlight color; currently Sun')

    expect(mode).toHaveAttribute('aria-pressed', 'false')
    await user.click(mode)
    expect(mode).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('menu', { name: 'Highlight colors' })).not.toBeInTheDocument()

    await user.click(colorTrigger)
    await user.click(screen.getByRole('button', { name: 'Rose' }))
    expect(screen.getByLabelText('Choose highlight color; currently Rose')).toBeInTheDocument()
    expect(mode).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('menu', { name: 'Highlight colors' })).not.toBeInTheDocument()
  })

  it('closes the color picker when the user clicks elsewhere without changing selection', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByLabelText('Choose highlight color; currently Sun'))
    expect(screen.getByRole('menu', { name: 'Highlight colors' })).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu', { name: 'Highlight colors' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Choose highlight color; currently Sun')).toBeInTheDocument()
  })

  it('opens a local Markdown file and saves directly through its writable handle', async () => {
    const user = userEvent.setup()
    const { handle, write, close } = makeHandle()
    window.showOpenFilePicker = vi.fn().mockResolvedValue([handle])
    render(<App />)

    await user.click(screen.getByLabelText('Upload Markdown file'))
    expect(await screen.findByText('imported.md')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Imported title' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save file' }))
    await waitFor(() => expect(write).toHaveBeenCalledWith('# Imported title\n\nBody\n'))
    expect(close).toHaveBeenCalled()
    expect(screen.getByText(/Saved \d/)).toBeInTheDocument()
  })

  it('explains that a local file must be opened before direct save is available', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Save file' }))
    expect(screen.getByText('Open a local Markdown file first. This reader only saves directly to that file.')).toBeInTheDocument()
  })

  it('uses the same save path for Cmd/Ctrl+S', async () => {
    const user = userEvent.setup()
    const { handle, write } = makeHandle()
    window.showOpenFilePicker = vi.fn().mockResolvedValue([handle])
    render(<App />)
    await user.click(screen.getByLabelText('Upload Markdown file'))
    fireEvent.keyDown(window, { key: 's', metaKey: true })
    await waitFor(() => expect(write).toHaveBeenCalled())
  })
})
