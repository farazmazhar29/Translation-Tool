import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { S } from '@/shared/api/client'

const STEPS = ['new', 'preview_ready', 'approved'] as const

/** Where the project is in the process: translated (in review), approved. Archiving is not a step. */
export const WorkflowSteps = ({ status }: { status: S['ProjectOut']['status'] }) => {
  const { t } = useTranslation('common')
  const current = STEPS.indexOf(status)
  return (
    <ol className="flex items-start">
      {STEPS.map((step, i) => {
        const done = i < current || (i === current && step === 'approved')
        const active = i === current && !done
        return (
          <li
            key={step}
            aria-current={i === current ? 'step' : undefined}
            className={`relative flex flex-1 flex-col items-center gap-2 text-center ${i < STEPS.length - 1 ? 'after:absolute after:left-[calc(50%+1.25rem)] after:right-[calc(-50%+1.25rem)] after:top-4 after:h-0.5 after:content-[""]' : ''} ${i < current ? 'after:bg-brand' : 'after:bg-stone-200'}`}
          >
            <span
              className={`relative z-10 grid size-8 place-items-center rounded-full text-xs font-bold transition ${done ? 'bg-brand text-white' : active ? 'border-2 border-brand bg-white text-brand ring-4 ring-brand/15' : 'bg-stone-100 text-stone-600'}`}
            >
              {done ? <Check className="size-4" aria-hidden="true" /> : i + 1}
            </span>
            <span className={`text-xs font-semibold ${i <= current ? 'text-ink' : 'text-stone-600'}`}>
              {t(`status.${step}`)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
