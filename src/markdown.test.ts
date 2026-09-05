import { describe, expect, it } from 'vitest'
import { annotationsForText, highlightCode, markText, outlineFromMarkdown, splitMetadata, withMetadata } from './markdown'

describe('Markdown persistence helpers', () => {
  it('creates an ordered outline with stable duplicate IDs', () => {
    expect(outlineFromMarkdown('# Start\n## Detail\n## Detail\n###### End')).toEqual([
      { level: 1, title: 'Start', id: 'start', sourceLine: 1 },
      { level: 2, title: 'Detail', id: 'detail', sourceLine: 2 },
      { level: 2, title: 'Detail', id: 'detail-1', sourceLine: 3 },
      { level: 6, title: 'End', id: 'end', sourceLine: 4 },
    ])
  })

  it('persists and restores code annotations without changing Markdown source', () => {
    const source = '# Note\n\n```ts\nconst answer = 42\n```\n'
    const annotations = [{ content: 'const answer = 42', start: 6, end: 12, color: 'green' as const }]
    const saved = withMetadata(source, annotations)

    expect(saved).toContain('paper-reader-code-highlights')
    expect(splitMetadata(saved)).toEqual({ markdown: source, annotations })
  })

  it('leaves malformed annotation comments as regular Markdown', () => {
    const source = 'Text\n<!-- paper-reader-code-highlights: not-json -->'
    expect(splitMetadata(source)).toEqual({ markdown: source, annotations: [] })
  })

  it('wraps selected prose with a persisted color mark', () => {
    expect(markText('Read this now.', 'this', 'pink')).toBe('Read <mark data-md-reader-color="pink">this</mark> now.')
    expect(markText('Read this.', 'missing', 'yellow')).toBeNull()
  })

  it('returns annotations for the matching code node and renders their pieces', () => {
    const annotations = [{ content: 'const value = 1', start: 6, end: 11, color: 'blue' as const }]
    expect(annotationsForText(annotations, 'const value = 1')).toEqual(annotations)
    expect(highlightCode('const value = 1', annotations)).toEqual(['const ', { value: 'value', color: 'blue' }, ' = 1'])
  })
})
