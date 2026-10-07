import { useState } from 'react'

/**
 * State of a form. `set('name')` returns the `onChange(value)` handler of that field, so a field is one line:
 * `<TextField label="Name" value={values.name} onChange={set('name')} />`.
 */
export const useFields = <T extends object>(initial: T) => {
  const [values, setValues] = useState(initial)
  const set =
    <K extends keyof T>(key: K) =>
    (value: T[K]): void => {
      setValues((current) => ({ ...current, [key]: value }))
    }
  return { values, setValues, set }
}
