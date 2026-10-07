import { useTranslation } from 'react-i18next'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import type { Lang } from '@/shared/api/generated'
import { LANGS } from '../constants'
import { input, type Option } from '../lib/ui'
import { Label } from './ui'

/**
 * Form controls with a label and a value-based `onChange(value)`: no `(e) => { set(e.target.value) }` at the call site.
 * `hideLabel` keeps the label for screen readers only (filters, inline inputs).
 */
interface Base {
  label: string
  hideLabel?: boolean
  className?: string
}

const Field = ({ label, hideLabel, children }: { label: string; hideLabel?: boolean; children: ReactNode }) =>
  hideLabel ? children : <Label text={label}>{children}</Label>

type Native<T> = Omit<T, 'value' | 'onChange' | 'className' | 'children'>

export const TextField = ({
  label,
  hideLabel,
  className = '',
  prefix,
  value,
  onChange,
  ...rest
}: Base &
  Native<InputHTMLAttributes<HTMLInputElement>> & {
    value: string | number
    onChange: (value: string) => void
    prefix?: string // a short word inside the field, before the value
  }) => {
  const field = (
    <input
      {...rest}
      aria-label={hideLabel ? label : undefined}
      className={`${input} ${prefix ? 'pl-12' : ''} ${className}`}
      value={value}
      onChange={(e) => {
        onChange(e.target.value)
      }}
    />
  )
  return (
    <Field label={label} hideLabel={hideLabel}>
      {prefix ? (
        <div className="relative">
          <span
            className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-xs font-semibold text-stone-600"
            aria-hidden="true"
          >
            {prefix}
          </span>
          {field}
        </div>
      ) : (
        field
      )}
    </Field>
  )
}

export const TextArea = ({
  label,
  hideLabel,
  className = '',
  value,
  onChange,
  ...rest
}: Base &
  Native<TextareaHTMLAttributes<HTMLTextAreaElement>> & { value: string; onChange: (value: string) => void }) => (
  <Field label={label} hideLabel={hideLabel}>
    <textarea
      {...rest}
      aria-label={hideLabel ? label : undefined}
      className={`${input} ${className}`}
      value={value}
      onChange={(e) => {
        onChange(e.target.value)
      }}
    />
  </Field>
)

export const SelectField = ({
  label,
  hideLabel,
  className = '',
  value,
  onChange,
  options,
  ...rest
}: Base &
  Native<SelectHTMLAttributes<HTMLSelectElement>> & {
    value: string
    onChange: (value: string) => void
    options: readonly Option[]
  }) => (
  <Field label={label} hideLabel={hideLabel}>
    <select
      {...rest}
      aria-label={hideLabel ? label : undefined}
      className={`${input} ${className}`}
      value={value}
      onChange={(e) => {
        onChange(e.target.value)
      }}
    >
      {options.map(([optionValue, optionLabel]) => (
        <option key={optionValue} value={optionValue}>
          {optionLabel}
        </option>
      ))}
    </select>
  </Field>
)

export const Checkbox = ({
  label,
  checked,
  onChange,
  disabled,
  className = '',
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}) => (
  <label className={`flex cursor-pointer items-center gap-2 text-sm font-medium ${className}`}>
    <input
      type="checkbox"
      className="size-4 cursor-pointer accent-brand"
      checked={checked}
      disabled={disabled}
      onChange={(e) => {
        onChange(e.target.checked)
      }}
    />{' '}
    {label}
  </label>
)

/**
 * The target language is not chosen: with two languages it is always the other one. Shown as a fixed value next
 * to the source language; `unknown` is shown while the source is not known yet.
 */
export const TargetLanguage = ({ label, source, unknown }: { label: string; source: string; unknown: string }) => {
  const { t } = useTranslation()
  const target = LANGS.includes(source as Lang) ? LANGS.find((code) => code !== source) : undefined
  return (
    <div>
      <p className="mb-1.5 block text-sm font-semibold text-stone-700">{label}</p>
      <p className="rounded-xl bg-stone-100 px-3.5 py-2.5 text-sm text-stone-700" aria-live="polite">
        {target ? t(`lang.${target}`) : unknown}
      </p>
    </div>
  )
}
