import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type SubmitEvent } from 'react'
import { get, post, put, type S } from '../api/client'
import { Btn, Card, ErrorText, Label, Modal } from '../components/ui'
import { input } from '../lib/ui'

type UserIn = S['UserIn']
const EMPTY: UserIn = { username: '', full_name: '', password: '', role: 'translator', active: true }
const ROLES: Record<S['UserOut']['role'], string> = {
  translator: 'Übersetzer',
  reviewer: 'Prüfer',
  admin: 'Administrator',
}

export default function Users() {
  const qc = useQueryClient()
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => get<S['UserOut'][]>('/users') })
  const [edit, setEdit] = useState<{ id?: number; form: UserIn } | null>(null)
  const save = useMutation({
    mutationFn: () => (edit?.id ? put(`/users/${edit.id}`, { ...edit.form }) : post('/users', { ...edit?.form })),
    onSuccess: async () => {
      setEdit(null)
      await qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
  const form = edit?.form
  const patch = (p: Partial<UserIn>): void => {
    if (edit) setEdit({ ...edit, form: { ...edit.form, ...p } })
  }
  const submit = (e: SubmitEvent): void => {
    e.preventDefault()
    save.mutate()
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Benutzerverwaltung</h1>
        <Btn
          variant="primary"
          onClick={() => {
            setEdit({ form: EMPTY })
          }}
        >
          + Benutzer
        </Btn>
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              {['Benutzer', 'Name', 'Rolle', 'Aktiv', ''].map((h) => (
                <th key={h} className="px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-3 py-2 font-medium">{u.username}</td>
                <td className="px-3 py-2">{u.full_name}</td>
                <td className="px-3 py-2">{ROLES[u.role]}</td>
                <td className="px-3 py-2">{u.active ? '✔' : '—'}</td>
                <td className="px-3 py-2 text-right">
                  <Btn
                    variant="ghost"
                    onClick={() => {
                      setEdit({
                        id: u.id,
                        form: {
                          ...EMPTY,
                          username: u.username,
                          full_name: u.full_name,
                          role: u.role,
                          active: u.active,
                        },
                      })
                    }}
                  >
                    Bearbeiten
                  </Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-slate-600">
        Rechte: Übersetzer erstellen, übersetzen und bearbeiten · Prüfer kontrollieren und geben frei · Administratoren
        verwalten Benutzer, Glossar, Einstellungen und Rechte.
      </p>
      {edit && form && (
        <Modal
          title={edit.id ? 'Benutzer bearbeiten' : 'Neuer Benutzer'}
          onClose={() => {
            setEdit(null)
          }}
        >
          <form onSubmit={submit} className="space-y-3">
            <Label text="Benutzername">
              <input
                className={input}
                value={form.username}
                disabled={!!edit.id}
                onChange={(e) => {
                  patch({ username: e.target.value })
                }}
                required
              />
            </Label>
            <Label text="Name">
              <input
                className={input}
                value={form.full_name}
                onChange={(e) => {
                  patch({ full_name: e.target.value })
                }}
              />
            </Label>
            <Label text={edit.id ? 'Neues Passwort (leer = unverändert)' : 'Passwort (min. 10 Zeichen)'}>
              <input
                className={input}
                type="password"
                value={form.password}
                onChange={(e) => {
                  patch({ password: e.target.value })
                }}
              />
            </Label>
            <Label text="Rolle">
              <select
                className={input}
                value={form.role}
                onChange={(e) => {
                  patch({ role: e.target.value as UserIn['role'] })
                }}
              >
                {Object.entries(ROLES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => {
                  patch({ active: e.target.checked })
                }}
              />{' '}
              Aktiv
            </label>
            <ErrorText error={save.error} />
            <Btn variant="primary" type="submit" disabled={save.isPending}>
              Speichern
            </Btn>
          </form>
        </Modal>
      )}
    </div>
  )
}
