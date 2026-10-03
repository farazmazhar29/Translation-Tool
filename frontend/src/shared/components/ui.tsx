import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { STATUS_STYLE, isStatus } from '../constants'
import { btnClass, errMsg, type Variant } from '../lib/ui'

export const Btn = ({
  variant = 'secondary',
  className = '',
  ...p
}: { variant?: Variant } & ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button type="button" {...p} className={btnClass(variant, className)} />
)

/** A link that looks like a button. */
export const LinkBtn = ({
  to,
  variant = 'secondary',
  children,
}: {
  to: string
  variant?: Variant
  children: ReactNode
}) => (
  <Link to={to} className={btnClass(variant)}>
    {children}
  </Link>
)

export const StatusBadge = ({ status }: { status: string }) => {
  const { t } = useTranslation()
  const known = isStatus(status)
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${known ? STATUS_STYLE[status] : 'bg-slate-100'}`}
    >
      {known ? t(`status.${status}`) : status}
    </span>
  )
}

export const Card = ({
  title,
  children,
  className = '',
}: {
  title?: string
  children: ReactNode
  className?: string
}) => {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {title && <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>}
      {children}
    </section>
  )
}

export const Modal = ({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) => {
  const { t } = useTranslation()
  const titleId = useId()
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    dialog.current?.focus()
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])
  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose() // backdrop only
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`mt-10 w-full rounded-lg bg-white p-5 shadow-xl outline-none ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 id={titleId} className="text-lg font-semibold">
            {title}
          </h3>
          <button
            type="button"
            aria-label={t('close')}
            className="text-slate-600 hover:text-slate-700"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export const Label = ({ text, children }: { text: string; children: ReactNode }) => (
  <label className="block text-sm">
    <span className="mb-1 block font-medium text-slate-600">{text}</span>
    {children}
  </label>
)

export const ErrorText = ({ error }: { error: unknown }) =>
  error ? <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{errMsg(error)}</p> : null
