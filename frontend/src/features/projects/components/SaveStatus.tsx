import { CheckCircle2, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const SHOW_SAVING_AFTER = 400 // ms: a quick save shows no "saving" at all, only "saved"
const SHOW_SAVED_FOR = 1800 // ms

/**
 * A small notice in the corner instead of a dialog that blocks the page: "Saving …" only when an action takes a
 * moment, then "Saved" for a short time. Screen readers hear it through `role="status"`.
 */
export const SaveStatus = ({ pending, failed }: { pending: boolean; failed: boolean }) => {
  const { t } = useTranslation('projects')
  const [shown, setShown] = useState<'saving' | 'saved' | null>(null)
  const wasPending = useRef(false)

  useEffect(() => {
    if (pending) {
      wasPending.current = true
      const timer = setTimeout(() => {
        setShown('saving')
      }, SHOW_SAVING_AFTER)
      return () => {
        clearTimeout(timer)
      }
    }
    if (!wasPending.current) return undefined
    wasPending.current = false
    setShown(failed ? null : 'saved') // an error is shown where the action was started
    const timer = setTimeout(() => {
      setShown(null)
    }, SHOW_SAVED_FOR)
    return () => {
      clearTimeout(timer)
    }
  }, [pending, failed])

  return (
    <div role="status" className="pointer-events-none fixed bottom-6 right-6 z-40">
      {shown && (
        <span className="inline-flex items-center gap-2 rounded-full bg-night px-4 py-2.5 text-sm font-semibold text-white shadow-pop">
          {shown === 'saving' ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="size-4 text-emerald-400" aria-hidden="true" />
          )}
          {shown === 'saving' ? t('view.saving') : t('view.saved')}
        </span>
      )}
    </div>
  )
}
