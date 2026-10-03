import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { get, post, put, type S } from '@/shared/api/client'
import { Checkbox, SelectField, TextField } from '@/shared/components/form'
import { Form, PageHeader, Table } from '@/shared/components/layout'
import { Btn, Modal } from '@/shared/components/ui'
import { useAction, useFields } from '@/shared/lib/hooks'
import { optionsOf } from '@/shared/lib/ui'
import { ROLES } from '@/shared/constants'
import { EMPTY } from './constants'

type UserIn = S['UserIn']

const UserDialog = ({ id, initial, onClose }: { id?: number; initial: UserIn; onClose: () => void }) => {
  const { t } = useTranslation(['users', 'common'])
  const { values: f, set } = useFields(initial)
  const save = useAction(() => (id ? put(`/users/${id}`, { ...f }) : post('/users', { ...f })), {
    invalidate: ['users'],
    onSuccess: onClose,
  })
  return (
    <Modal title={id ? t('editUser') : t('newUser')} onClose={onClose}>
      <Form
        onSubmit={() => {
          save.mutate()
        }}
        submitLabel={t('common:save')}
        disabled={save.isPending}
        error={save.error}
      >
        <TextField label={t('username')} value={f.username} onChange={set('username')} disabled={!!id} required />
        <TextField label={t('name')} value={f.full_name} onChange={set('full_name')} />
        <TextField
          label={id ? t('passwordNew') : t('passwordRequired')}
          type="password"
          value={f.password}
          onChange={set('password')}
        />
        <SelectField
          label={t('role')}
          value={f.role}
          options={optionsOf(ROLES, (r) => t(`common:role.${r}`))}
          onChange={(role) => {
            set('role')(role as UserIn['role'])
          }}
        />
        <Checkbox label={t('active')} checked={f.active} onChange={set('active')} />
      </Form>
    </Modal>
  )
}

const Users = () => {
  const { t } = useTranslation(['users', 'common'])
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => get<S['UserOut'][]>('/users') })
  const [editing, setEditing] = useState<{ id?: number; initial: UserIn } | null>(null)
  return (
    <div className="space-y-4">
      <PageHeader title={t('title')}>
        <Btn
          variant="primary"
          onClick={() => {
            setEditing({ initial: EMPTY })
          }}
        >
          {t('addUser')}
        </Btn>
      </PageHeader>
      <Table headers={[t('user'), t('name'), t('role'), t('active'), '']}>
        {users.map((u) => (
          <tr key={u.id}>
            <td className="px-3 py-2 font-medium">{u.username}</td>
            <td className="px-3 py-2">{u.full_name}</td>
            <td className="px-3 py-2">{t(`common:role.${u.role}`)}</td>
            <td className="px-3 py-2">{u.active ? '✔' : '—'}</td>
            <td className="px-3 py-2 text-right">
              <Btn
                variant="ghost"
                onClick={() => {
                  setEditing({
                    id: u.id,
                    initial: { ...EMPTY, username: u.username, full_name: u.full_name, role: u.role, active: u.active },
                  })
                }}
              >
                {t('common:edit')}
              </Btn>
            </td>
          </tr>
        ))}
      </Table>
      <p className="text-xs text-slate-600">{t('rights')}</p>
      {editing && (
        <UserDialog
          id={editing.id}
          initial={editing.initial}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

export default Users
