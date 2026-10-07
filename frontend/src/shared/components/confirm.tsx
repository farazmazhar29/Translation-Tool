import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Btn, Modal } from './ui'

interface Options {
  title: string
  message: string
  confirmLabel: string
  destructive?: boolean // deleting something: the confirm button is red
  details?: (close: (ok: boolean) => void) => ReactNode // for example a list of findings; `close` ends the dialog
}

/**
 * Our own confirmation dialog instead of the browser's `window.confirm`.
 * `if (await confirm({ ... })) doIt()`, and render `dialog` somewhere in the component.
 */
export const useConfirm = (): { confirm: (options: Options) => Promise<boolean>; dialog: ReactNode } => {
  const { t } = useTranslation()
  const [pending, setPending] = useState<(Options & { answer: (ok: boolean) => void }) | null>(null)
  const confirm = (options: Options): Promise<boolean> =>
    new Promise((resolve) => {
      setPending({ ...options, answer: resolve })
    })
  const close = (ok: boolean): void => {
    pending?.answer(ok)
    setPending(null)
  }
  const dialog = pending && (
    <Modal
      title={pending.title}
      onClose={() => {
        close(false)
      }}
    >
      <p className="text-sm leading-relaxed text-stone-600">{pending.message}</p>
      {pending.details?.(close)}
      <div className="mt-7 flex flex-wrap justify-end gap-3">
        <Btn
          onClick={() => {
            close(false)
          }}
        >
          {t('cancel')}
        </Btn>
        <Btn
          variant={pending.destructive ? 'destructive' : 'primary'}
          onClick={() => {
            close(true)
          }}
        >
          {pending.confirmLabel}
        </Btn>
      </div>
    </Modal>
  )
  return { confirm, dialog }
}
