import { useMutation } from '@tanstack/react-query'
import { useState, type SubmitEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth-context'
import { Btn, ErrorText, Label } from '../components/ui'
import { input } from '../lib/ui'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('translator')
  const [password, setPassword] = useState('translator123')
  const m = useMutation({ mutationFn: () => login(username, password), onSuccess: () => void navigate('/') })
  if (user) return <Navigate to="/" replace />
  const submit = (e: SubmitEvent): void => {
    e.preventDefault()
    m.mutate()
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <span className="inline-block h-3 w-3 rounded-full bg-red-700" /> Rotpunkt Übersetzungstool
        </h1>
        <Label text="Benutzername">
          <input
            className={input}
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
            }}
          />
        </Label>
        <Label text="Passwort">
          <input
            className={input}
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
            }}
          />
        </Label>
        <ErrorText error={m.error} />
        <Btn variant="primary" type="submit" className="w-full" disabled={m.isPending}>
          Anmelden
        </Btn>
        <p className="text-xs text-slate-600">Demo: translator/translator123 · reviewer/reviewer123 · admin/admin123</p>
      </form>
    </div>
  )
}
