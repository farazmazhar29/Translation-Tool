import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Checkbox, LangCheckboxes, SelectField, TextArea, TextField } from '../components/form'

describe('TextField', () => {
  it('is labelled and reports the typed value (not the DOM event)', async () => {
    const onChange = vi.fn()
    render(<TextField label="Name" value="" onChange={onChange} />)
    await userEvent.type(screen.getByLabelText('Name'), 'a')
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('shows the given value and passes native attributes through', () => {
    render(<TextField label="Passwort" type="password" placeholder="geheim" disabled value="abc" onChange={vi.fn()} />)
    const field = screen.getByLabelText('Passwort')
    expect(field).toHaveValue('abc')
    expect(field).toHaveAttribute('type', 'password')
    expect(field).toHaveAttribute('placeholder', 'geheim')
    expect(field).toBeDisabled()
  })

  it('keeps the label for screen readers only when hideLabel is set', () => {
    render(<TextField hideLabel label="Suche" placeholder="Suche …" value="" onChange={vi.fn()} />)
    expect(screen.getByLabelText('Suche')).toBeInTheDocument() // accessible name
    expect(screen.queryByText('Suche')).not.toBeInTheDocument() // but nothing visible
  })

  it('accepts numbers as values', () => {
    render(<TextField label="Zeile" type="number" value={2} onChange={vi.fn()} />)
    expect(screen.getByLabelText('Zeile')).toHaveValue(2)
  })
})

describe('TextArea', () => {
  it('reports the value and honours rows', async () => {
    const onChange = vi.fn()
    render(<TextArea label="Beschreibung" rows={4} value="" onChange={onChange} />)
    const area = screen.getByLabelText('Beschreibung')
    expect(area).toHaveAttribute('rows', '4')
    await userEvent.type(area, 'x')
    expect(onChange).toHaveBeenCalledWith('x')
  })
})

describe('SelectField', () => {
  const options = [
    ['de', 'Deutsch'],
    ['en', 'Englisch'],
  ] as const

  it('renders one option per [value, label] pair and reports the chosen value', async () => {
    const onChange = vi.fn()
    render(<SelectField label="Sprache" value="de" options={options} onChange={onChange} />)
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Deutsch', 'Englisch'])
    expect(screen.getByLabelText('Sprache')).toHaveValue('de')
    await userEvent.selectOptions(screen.getByLabelText('Sprache'), 'en')
    expect(onChange).toHaveBeenCalledWith('en')
  })

  it('can hide its label and still be named for screen readers', () => {
    render(<SelectField hideLabel label="Status" value="" options={[['', 'alle']]} onChange={vi.fn()} />)
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeInTheDocument()
  })
})

describe('Checkbox', () => {
  it('is labelled and reports the new state', async () => {
    const onChange = vi.fn()
    render(<Checkbox label="Aktiv" checked={false} onChange={onChange} />)
    await userEvent.click(screen.getByLabelText('Aktiv'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('reflects checked and disabled', () => {
    render(<Checkbox label="Aktiv" checked disabled onChange={vi.fn()} />)
    expect(screen.getByLabelText('Aktiv')).toBeChecked()
    expect(screen.getByLabelText('Aktiv')).toBeDisabled()
  })
})

describe('LangCheckboxes', () => {
  it('is a labelled group with one checkbox per language and reflects the selection', () => {
    render(<LangCheckboxes label="Zielsprachen" value={['en']} onChange={vi.fn()} />)
    expect(screen.getByRole('group', { name: 'Zielsprachen' })).toBeInTheDocument()
    expect(screen.getByLabelText('Englisch')).toBeChecked()
    expect(screen.getByLabelText('Deutsch')).not.toBeChecked()
  })

  it('adds a language that is not selected yet', async () => {
    const onChange = vi.fn()
    render(<LangCheckboxes label="Zielsprachen" value={['en']} onChange={onChange} />)
    await userEvent.click(screen.getByLabelText('Deutsch'))
    expect(onChange).toHaveBeenCalledWith(['en', 'de'])
  })

  it('removes a language that is selected', async () => {
    const onChange = vi.fn()
    render(<LangCheckboxes label="Zielsprachen" value={['en', 'de']} onChange={onChange} />)
    await userEvent.click(screen.getByLabelText('Englisch'))
    expect(onChange).toHaveBeenCalledWith(['de'])
  })
})
