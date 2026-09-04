import type { CodeAnnotation, HighlightColor, OutlineItem } from './types'

const META_START = '<!-- paper-reader-code-highlights:'
const META_END = '-->'

export function splitMetadata(source: string): { markdown: string; annotations: CodeAnnotation[] } {
  const start = source.lastIndexOf(META_START)
  if (start === -1) return { markdown: source, annotations: [] }
  const end = source.indexOf(META_END, start)
  if (end === -1) return { markdown: source, annotations: [] }
  try {
    const annotations = JSON.parse(source.slice(start + META_START.length, end).trim()) as CodeAnnotation[]
    if (!Array.isArray(annotations)) throw new Error('Invalid metadata')
    return { markdown: source.slice(0, start).trimEnd() + '\n', annotations }
  } catch {
    return { markdown: source, annotations: [] }
  }
}

export function withMetadata(markdown: string, annotations: CodeAnnotation[]) {
  if (!annotations.length) return markdown.trimEnd() + '\n'
  return `${markdown.trimEnd()}\n\n${META_START}${JSON.stringify(annotations)} ${META_END}\n`
}

export function outlineFromMarkdown(markdown: string): OutlineItem[] {
  const seen = new Map<string, number>()
  return markdown.split('\n').flatMap((line, lineIndex) => {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!match) return []
    const title = match[2].replace(/[`*_~]/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim()
    const base = title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-') || 'section'
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    return [{ level: match[1].length, title, id: count ? `${base}-${count}` : base, sourceLine: lineIndex + 1 }]
  })
}

export function markText(source: string, selection: string, color: HighlightColor): string | null {
  const needle = selection.replace(/\u00a0/g, ' ')
  if (!needle.trim()) return null
  const index = source.indexOf(needle)
  if (index < 0) return null
  const before = source.slice(0, index)
  const after = source.slice(index + needle.length)
  return `${before}<mark data-md-reader-color="${color}">${needle}</mark>${after}`
}

export function annotationsForText(annotations: CodeAnnotation[], content: string) {
  return annotations.filter((item) => item.content === content)
}

export function highlightCode(content: string, annotations: CodeAnnotation[]) {
  if (!annotations.length) return content
  const ranges = [...annotations].sort((a, b) => b.start - a.start)
  let result: Array<string | { value: string; color: HighlightColor }> = [content]
  for (const annotation of ranges) {
    const next: typeof result = []
    for (const piece of result) {
      if (typeof piece !== 'string') { next.push(piece); continue }
      next.push(piece.slice(0, annotation.start), { value: piece.slice(annotation.start, annotation.end), color: annotation.color }, piece.slice(annotation.end))
    }
    result = next
  }
  return result
}

export const SAMPLE_MARKDOWN = `# The quiet work of reading

Markdown is a wonderfully portable format, but it deserves a calm place to be read. This small reader keeps the document at the center and the controls close at hand.

## A page, not a dashboard

Use the outline to move through long documents. On a wide window, the text settles into a two-page spread; on a smaller screen it becomes one generous page.

> Choose a color, then select a passage to keep it in view.

## Notes worth keeping

- Highlights are saved with the document.
- Press **⌘S** whenever you want to save.
- Refresh reloads the source file from disk.

| Reader feature | What it does |
| --- | --- |
| Outline | Detects every heading |
| Highlights | Keeps five colors in the Markdown |

\`\`\`ts
const thought = 'A good page makes room for thought.'
\`\`\`
`
