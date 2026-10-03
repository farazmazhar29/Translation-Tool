import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './auth-context'
import { TextField } from '@/shared/components/form'
import { Form } from '@/shared/components/layout'
import { useAction } from '@/shared/lib/hooks'

const Login = () => {
  const { t } = useTranslation('auth')
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('translator')
  const [password, setPassword] = useState('translator123')
  const signIn = useAction(() => login(username, password), { onSuccess: () => void navigate('/') })
  if (user) return <Navigate to="/" replace />
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Form
        onSubmit={() => {
          signIn.mutate()
        }}
        submitLabel={t('signIn')}
        submitClassName="w-full"
        disabled={signIn.isPending}
        error={signIn.error}
        className="w-full max-w-sm space-y-4 rounded-lg border bg-white p-6 shadow-sm"
      >
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <span className="inline-block h-3 w-3 rounded-full bg-red-700" /> {t('title')}
        </h1>
        <TextField label={t('username')} value={username} onChange={setUsername} />
        <TextField label={t('password')} type="password" value={password} onChange={setPassword} />
        <p className="text-xs text-slate-600">{t('demo')}</p>
      </Form>
    </div>
  )
}

export default Login
