import { FileText, ListChecks } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type View = 'page' | 'list'

/** Reading (the document as a page) or editing (one row per segment, with the actions). */
export const ViewSwitch = ({ value, onChange }: { value: View; onChange: (view: View) => void }) => {
  const { t } = useTranslation('projects')
  const options = [
    { view: 'page', label: t('view.pageView'), icon: FileText },
    { view: 'list', label: t('view.listView'), icon: ListChecks },
  ] as const
  return (
    <div role="group" aria-label={t('view.viewLabel')} className="flex rounded-full bg-stone-200/70 p-1">
      {options.map(({ view, label, icon: Icon }) => (
        <button
          key={view}
          type="button"
          aria-pressed={value === view}
          onClick={() => {
            onChange(view)
          }}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition ${value === view ? 'bg-white text-ink shadow-sm' : 'text-stone-600 hover:text-ink'}`}
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  )
}
