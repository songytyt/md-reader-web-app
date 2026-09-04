export type HighlightColor = 'yellow' | 'pink' | 'blue' | 'green' | 'purple'

export type CodeAnnotation = {
  content: string
  start: number
  end: number
  color: HighlightColor
}

export type OutlineItem = { level: number; title: string; id: string; sourceLine: number }

export type FileSystemFileHandleLike = {
  name: string
  getFile: () => Promise<File>
  createWritable: () => Promise<{ write: (data: string) => Promise<void>; close: () => Promise<void> }>
}

declare global {
  interface Window {
    showOpenFilePicker?: (options?: { types?: Array<{ description: string; accept: Record<string, string[]> }>; multiple?: boolean }) => Promise<FileSystemFileHandleLike[]>
  }
}
