import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { SAMPLE_MARKDOWN, annotationsForText, highlightCode, markText, outlineFromMarkdown, splitMetadata, withMetadata } from './markdown'
import type { CodeAnnotation, FileSystemFileHandleLike, HighlightColor } from './types'

const colors: Array<{ value: HighlightColor; label: string }> = [
  { value: 'yellow', label: 'Sun' }, { value: 'pink', label: 'Rose' }, { value: 'blue', label: 'Sky' }, { value: 'green', label: 'Sage' }, { value: 'purple', label: 'Lavender' },
]

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'mark'],
  attributes: { ...defaultSchema.attributes, mark: ['dataMdReaderColor'] },
}

export default function App() {
  const [source, setSource] = useState(SAMPLE_MARKDOWN)
  const [annotations, setAnnotations] = useState<CodeAnnotation[]>([])
  const [savedSnapshot, setSavedSnapshot] = useState(SAMPLE_MARKDOWN)
  const [fileName, setFileName] = useState('Welcome.md')
  const [handle, setHandle] = useState<FileSystemFileHandleLike | null>(null)
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('yellow')
  const [armed, setArmed] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [outlineOpen, setOutlineOpen] = useState(true)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [message, setMessage] = useState('Open a Markdown file or begin with this sample.')
  const readerRef = useRef<HTMLElement>(null)
  const highlightControlRef = useRef<HTMLDivElement>(null)

  const outline = useMemo(() => outlineFromMarkdown(source), [source])
  const dirty = withMetadata(source, annotations) !== savedSnapshot
  const savedLabel = dirty ? 'Unsaved changes' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Not saved yet'

  const loadText = (text: string, name: string, nextHandle: FileSystemFileHandleLike | null) => {
    const parsed = splitMetadata(text)
    setSource(parsed.markdown)
    setAnnotations(parsed.annotations)
    setSavedSnapshot(withMetadata(parsed.markdown, parsed.annotations))
    setFileName(name)
    setHandle(nextHandle)
    setLastSaved(null)
    setMessage(`Loaded ${name}`)
  }

  const openFile = async () => {
    try {
      if (window.showOpenFilePicker) {
        const [nextHandle] = await window.showOpenFilePicker({ types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md', '.markdown', '.mdx'], 'text/plain': ['.txt'] } }] })
        const file = await nextHandle.getFile()
        loadText(await file.text(), file.name, nextHandle)
        return
      }
      setMessage('Opening local files requires a Chromium browser with File System Access enabled.')
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') setMessage('Could not open that file.')
    }
  }

  const save = async () => {
    if (!handle) {
      setMessage('Open a local Markdown file first. This reader only saves directly to that file.')
      return
    }
    const output = withMetadata(source, annotations)
    try {
      const writable = await handle.createWritable()
      await writable.write(output)
      await writable.close()
      setSavedSnapshot(output)
      setLastSaved(new Date())
      setMessage('Saved directly to disk.')
    } catch {
      setMessage('Save failed. Your changes are still in this reader.')
    }
  }

  const refresh = async () => {
    if (!handle) { setMessage('Refresh is available after opening a local file in Chromium.'); return }
    if (dirty && !window.confirm('Reload from disk and discard unsaved highlights?')) return
    try {
      const file = await handle.getFile()
      loadText(await file.text(), file.name, handle)
    } catch { setMessage('Could not reload the file from disk.') }
  }

  const applyHighlight = () => {
    if (!armed) return
    const selection = window.getSelection()
    if (!selection?.rangeCount || selection.isCollapsed) return
    const range = selection.getRangeAt(0)
    const walker = document.createTreeWalker(readerRef.current ?? document.body, NodeFilter.SHOW_TEXT)
    const textParts: Array<{ text: string; code: HTMLElement | null }> = []
    let node: Node | null
    while ((node = walker.nextNode())) {
      if (!range.intersectsNode(node)) continue
      const raw = node.textContent ?? ''
      const start = node === range.startContainer ? range.startOffset : 0
      const end = node === range.endContainer ? range.endOffset : raw.length
      const text = raw.slice(start, end)
      if (text) textParts.push({ text, code: node.parentElement?.closest('code') ?? null })
    }
    if (!textParts.some((part) => part.text.trim())) return

    const proseParts = textParts.filter((part) => !part.code && part.text.trim())
    let nextSource = source
    let cursor = 0
    for (const part of proseParts) {
      const index = nextSource.indexOf(part.text, cursor)
      if (index < 0) continue
      const openMark = `<mark data-md-reader-color="${selectedColor}">`
      nextSource = `${nextSource.slice(0, index)}${openMark}${part.text}</mark>${nextSource.slice(index + part.text.length)}`
      cursor = index + openMark.length + part.text.length + '</mark>'.length
    }
    if (nextSource === source) {
      const fallback = markText(source, selection.toString(), selectedColor)
      if (fallback) nextSource = fallback
    }
    const codeParts = textParts.filter((part) => part.code && part.text)
    // Commit before clearing the selection so the colored mark is visible immediately on mouse-up.
    flushSync(() => {
      if (nextSource !== source) setSource(nextSource)
      if (codeParts.length) {
        setAnnotations((current) => {
          const additions = codeParts.flatMap((part) => {
            const content = part.code?.textContent ?? ''
            const start = content.indexOf(part.text)
            return start < 0 ? [] : [{ content, start, end: start + part.text.length, color: selectedColor }]
          })
          return [...current, ...additions]
        })
      }
    })
    setMessage(`${colors.find((item) => item.value === selectedColor)?.label} highlight added.`)
    selection?.removeAllRanges()
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void save() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  useEffect(() => {
    const closePalette = (event: MouseEvent) => {
      if (highlightControlRef.current && !highlightControlRef.current.contains(event.target as Node)) setPaletteOpen(false)
    }
    document.addEventListener('mousedown', closePalette)
    return () => document.removeEventListener('mousedown', closePalette)
  }, [])

  useEffect(() => {
    const onPointerUp = () => {
      // Browsers finalize a text range after pointer-up. Waiting one frame avoids
      // reading the stale, pre-selection range that made highlights intermittent.
      requestAnimationFrame(() => {
        const selection = window.getSelection()
        if (!armed || !selection?.rangeCount || selection.isCollapsed) return
        if (!readerRef.current?.contains(selection.anchorNode) || !readerRef.current.contains(selection.focusNode)) return
        applyHighlight()
      })
    }
    document.addEventListener('pointerup', onPointerUp, true)
    return () => document.removeEventListener('pointerup', onPointerUp, true)
  })

  return <main className="app-shell">
    <header className="toolbar">
      <div className="tool-group toolbar-capsule toolbar-start">
        <button className="icon-button" onClick={() => setOutlineOpen(!outlineOpen)} aria-label="Toggle table of contents" title="Table of contents">☷</button>
        <button className="icon-button" onClick={() => void openFile()} aria-label="Upload Markdown file" title="Upload Markdown file">
          <svg className="toolbar-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0 4 4m-4-4-4 4M5 14v5h14v-5" /></svg>
        </button>
        <button className="icon-button" onClick={() => void refresh()} aria-label="Reload file" title="Reload file">↻</button>
      </div>
      <div className="document-name"><span>{fileName}</span><small>{savedLabel}</small></div>
      <div className="tool-group right-tools">
        <div ref={highlightControlRef} className="highlight-control toolbar-capsule">
          <button className={`highlight-button ${armed ? 'armed' : ''}`} onClick={() => setArmed(!armed)} aria-pressed={armed}>Highlight</button>
          <button className="color-trigger" onClick={() => setPaletteOpen(!paletteOpen)} aria-label={`Choose highlight color; currently ${colors.find((item) => item.value === selectedColor)?.label}`} aria-expanded={paletteOpen}>
            <i className={`swatch ${selectedColor}`} />
          </button>
          {paletteOpen && <div className="palette" role="menu" aria-label="Highlight colors">
            {colors.map((color) => <button key={color.value} className={color.value} onClick={() => { setSelectedColor(color.value); setPaletteOpen(false) }} title={color.label}><i className={`swatch ${color.value}`} /><span>{color.label}</span></button>)}
          </div>}
        </div>
        <div className="toolbar-capsule save-capsule">
          <button className="text-button save-button" onClick={() => void save()} aria-label="Save file" title="Save file">Save</button>
        </div>
      </div>
    </header>

    <div className="status-line" aria-live="polite">{armed ? `Highlight mode on · ${colors.find((item) => item.value === selectedColor)?.label} selected` : message}</div>
    <div className={`reader-layout ${outlineOpen ? 'contents-open' : ''}`}>
      <aside className={`outline ${outlineOpen ? 'visible' : ''}`} aria-label="Table of contents">
        <div className="outline-heading"><span>Contents</span><button onClick={() => setOutlineOpen(false)} aria-label="Close contents">×</button></div>
        {outline.length ? outline.map((item) => <button key={item.id} className={`outline-item level-${item.level}`} onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{item.title}</button>) : <p>No headings found.</p>}
      </aside>
      <section ref={readerRef} className="reader">
        <article className="paper">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]} components={{
            h1: ({ children, node }) => <h1 id={outline.find((item) => item.sourceLine === node?.position?.start.line)?.id}>{children}</h1>,
            h2: ({ children, node }) => <h2 id={outline.find((item) => item.sourceLine === node?.position?.start.line)?.id}>{children}</h2>,
            h3: ({ children, node }) => <h3 id={outline.find((item) => item.sourceLine === node?.position?.start.line)?.id}>{children}</h3>,
            h4: ({ children, node }) => <h4 id={outline.find((item) => item.sourceLine === node?.position?.start.line)?.id}>{children}</h4>,
            h5: ({ children, node }) => <h5 id={outline.find((item) => item.sourceLine === node?.position?.start.line)?.id}>{children}</h5>,
            h6: ({ children, node }) => <h6 id={outline.find((item) => item.sourceLine === node?.position?.start.line)?.id}>{children}</h6>,
            code: ({ children, className }) => {
              const content = String(children).replace(/\n$/, '')
              const pieces = highlightCode(content, annotationsForText(annotations, content))
              return <code className={className}>{Array.isArray(pieces) ? pieces.map((piece, index) => typeof piece === 'string' ? piece : <mark key={index} data-md-reader-color={piece.color}>{piece.value}</mark>) : pieces}</code>
            },
          }}>{source}</ReactMarkdown>
        </article>
      </section>
    </div>
  </main>
}
