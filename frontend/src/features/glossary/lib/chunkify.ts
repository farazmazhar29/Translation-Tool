import type { Term } from '@/shared/api/generated'

interface Chunk {
  text: string
  term?: Term
}

/** Split `text` into plain and highlighted chunks (longest terms first, no overlaps). */
export const chunkify = (text: string, terms: Term[], side: 'source' | 'target'): Chunk[] => {
  const spans: { start: number; end: number; term: Term }[] = []
  const lower = text.toLowerCase()
  for (const term of [...terms].sort((a, b) => b[side].length - a[side].length)) {
    const needle = term[side].toLowerCase()
    if (!needle) continue
    for (let i = lower.indexOf(needle); i !== -1; i = lower.indexOf(needle, i + needle.length)) {
      const end = i + needle.length
      if (!spans.some((s) => i < s.end && end > s.start)) spans.push({ start: i, end, term })
    }
  }
  spans.sort((a, b) => a.start - b.start)
  const chunks: Chunk[] = []
  let pos = 0
  for (const s of spans) {
    if (s.start > pos) chunks.push({ text: text.slice(pos, s.start) })
    chunks.push({ text: text.slice(s.start, s.end), term: s.term })
    pos = s.end
  }
  if (pos < text.length) chunks.push({ text: text.slice(pos) })
  return chunks
}
