import { Fragment } from 'react'
import type { S } from '../api/client'
import { FALLBACK, chunkify } from '../lib/chunkify'
import { useSettings } from '../lib/ui'

type Term = S['Term']

interface Props {
  text: string
  terms: Term[]
  side: 'source' | 'target'
  onTerm: (t: Term) => void
}

export function Highlighted({ text, terms, side, onTerm }: Props) {
  const colors = useSettings()?.colors ?? FALLBACK
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed">
      {chunkify(text, terms, side).map((c, i) => {
        const term = c.term
        if (!term) return <Fragment key={i}>{c.text}</Fragment>
        const color = colors[term.category] ?? FALLBACK[term.category] ?? '#999'
        return (
          <button
            key={i}
            type="button"
            title={`${term.source} → ${term.target || '?'}`}
            onClick={() => {
              onTerm(term)
            }}
            className={`cursor-pointer rounded px-0.5 ${term.ok ? '' : 'underline decoration-red-600 decoration-wavy'}`}
            style={{ backgroundColor: `${color}33`, borderBottom: `2px solid ${color}` }}
          >
            {c.text}
          </button>
        )
      })}
    </p>
  )
}
