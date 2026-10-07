import { CheckCircle2, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { TextField } from '@/shared/components/form'
import { Form } from '@/shared/components/layout'
import { LinkBtn } from '@/shared/components/ui'
import { useMutation } from '@/shared/api/base'
import { useFields } from '@/shared/lib/hooks'
import { AuthService } from './api/AuthService'
import { AuthLayout } from './AuthLayout'
import { useAuth } from './auth-context'

const Login = () => {
  const { t } = useTranslation('auth')
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const state: unknown = useLocation().state // set by the registration page
  const justRegistered = typeof state === 'object' && state !== null && 'registered' in state
  const { values, set } = useFields({ username: '', password: '' })
  const signIn = useMutation(() => login(values.username, values.password), { onSuccess: () => void navigate('/') })
  const { data: options } = AuthService.useFetchAuthOptions()
  if (user) return <Navigate to="/" replace />
  return (
    <AuthLayout title={t('title')} subtitle={t('subtitle')}>
      {justRegistered && (
        <p
          role="status"
          className="mb-6 flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t('registered')}
        </p>
      )}
      <Form
        onSubmit={() => {
          signIn.mutate()
        }}
        submitLabel={t('signIn')}
        submitClassName="w-full !py-3"
        disabled={signIn.isPending}
        error={signIn.error}
        className="space-y-5"
      >
        <TextField label={t('username')} autoComplete="username" value={values.username} onChange={set('username')} />
        <TextField
          label={t('password')}
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={set('password')}
        />
      </Form>
      {options?.registration_enabled && (
        <>
          <p className="my-6 flex items-center gap-4 text-xs font-semibold uppercase tracking-wider text-stone-600 before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
            {t('or')}
          </p>
          <LinkBtn to="/register" variant="secondary" className="w-full !py-3">
            <UserPlus className="size-4" aria-hidden="true" />
            {t('createAccount')}
          </LinkBtn>
        </>
      )}
    </AuthLayout>
  )
}

export default Login
