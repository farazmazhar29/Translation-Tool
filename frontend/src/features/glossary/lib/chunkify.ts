import type { Term } from '@/shared/api/generated'

interface Chunk {
  text: string
  term?: Term
}

const WORD = /[\p{L}\p{N}]/u
const isWord = (c: string | undefined): boolean => c !== undefined && WORD.test(c)

/** Widens a match to whole words: "hinge" marks all of "hinges", and a typo after the term ("steelll") stays visible. */
const toWords = (text: string, start: number, end: number): { start: number; end: number } => {
  while (start > 0 && isWord(text[start - 1])) start--
  while (end < text.length && isWord(text[end])) end++
  return { start, end }
}

/** The term's translation as it stands in `text` (whole words), or the stored translation when it is not there. */
export const shownTarget = (text: string, target: string): string => {
  const i = target ? text.toLowerCase().indexOf(target.toLowerCase()) : -1
  if (i === -1) return target
  const { start, end } = toWords(text, i, i + target.length)
  return text.slice(start, end)
}

/**
 * Split `text` into plain and highlighted chunks (longest terms first, no overlaps). In the translation a match covers
 * whole words; the source keeps exact matches, so a German compound is not marked as one of its parts.
 */
export const chunkify = (text: string, terms: Term[], side: 'source' | 'target'): Chunk[] => {
  const spans: { start: number; end: number; term: Term }[] = []
  const lower = text.toLowerCase()
  for (const term of [...terms].sort((a, b) => b[side].length - a[side].length)) {
    const needle = term[side].toLowerCase()
    if (!needle) continue
    for (let i = lower.indexOf(needle); i !== -1; i = lower.indexOf(needle, i + needle.length)) {
      const span = side === 'target' ? toWords(text, i, i + needle.length) : { start: i, end: i + needle.length }
      if (!spans.some((s) => span.start < s.end && span.end > s.start)) spans.push({ ...span, term })
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
