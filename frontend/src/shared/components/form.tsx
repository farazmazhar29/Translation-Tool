import { useTranslation } from 'react-i18next'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import type { Lang } from '../api/client'
import { LANGS } from '../constants'
import { input, toggle, type Option } from '../lib/ui'
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
  value,
  onChange,
  ...rest
}: Base &
  Native<InputHTMLAttributes<HTMLInputElement>> & { value: string | number; onChange: (value: string) => void }) => (
  <Field label={label} hideLabel={hideLabel}>
    <input
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
  <label className={`flex items-center gap-1 text-sm ${className}`}>
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(e) => {
        onChange(e.target.checked)
      }}
    />{' '}
    {label}
  </label>
)

/** One checkbox per supported language (German, English). */
export const LangCheckboxes = ({
  label,
  value,
  onChange,
}: {
  label: string
  value: readonly Lang[]
  onChange: (value: Lang[]) => void
}) => {
  const { t } = useTranslation()
  return (
    <fieldset>
      <legend className="mb-1 block text-sm font-medium text-slate-600">{label}</legend>
      <div className="flex gap-4 py-1.5">
        {LANGS.map((code) => (
          <Checkbox
            key={code}
            label={t(`lang.${code}`)}
            checked={value.includes(code)}
            onChange={() => {
              onChange(toggle(value, code))
            }}
          />
        ))}
      </div>
    </fieldset>
  )
}
