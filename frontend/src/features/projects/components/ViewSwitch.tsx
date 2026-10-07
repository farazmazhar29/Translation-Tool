import { FileText, ListChecks, Sheet } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type View = 'page' | 'list'

/** Reading (the document as a page, an Excel file as its table) or editing (one row per segment, with actions). */
export const ViewSwitch = ({
  value,
  table,
  onChange,
}: {
  value: View
  table?: boolean // an Excel file: the reading view is a table, not a page
  onChange: (view: View) => void
}) => {
  const { t } = useTranslation('projects')
  const options = [
    { view: 'page', label: table ? t('view.tableView') : t('view.pageView'), icon: table ? Sheet : FileText },
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
