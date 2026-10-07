import { useQuery } from '@tanstack/react-query'
import { Check, Minus, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { get, post, put, type S } from '@/shared/api/client'
import { Checkbox, SelectField, TextField } from '@/shared/components/form'
import { Form, PageHeader, Table } from '@/shared/components/layout'
import { Btn, IconAction, Modal } from '@/shared/components/ui'
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
          <Plus className="size-4" aria-hidden="true" />
          {t('addUser')}
        </Btn>
      </PageHeader>
      <Table
        headers={[
          t('user'),
          { label: t('name'), className: 'hidden lg:table-cell' },
          t('role'),
          { label: t('active'), className: 'hidden sm:table-cell' },
          '',
        ]}
      >
        {users.map((u) => (
          <tr key={u.id}>
            <td className="w-full max-w-0 px-4 py-3">
              <span className="block truncate font-medium">{u.username}</span>
              <span className="block truncate text-xs text-stone-600 lg:hidden">{u.full_name}</span>
            </td>
            <td className="hidden whitespace-nowrap px-4 py-3 lg:table-cell">{u.full_name}</td>
            <td className="whitespace-nowrap px-4 py-3">
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                {t(`common:role.${u.role}`)}
              </span>
            </td>
            <td className="hidden px-4 py-3 sm:table-cell">
              {u.active ? (
                <Check className="size-4 text-emerald-600" aria-label={t('activeYes')} />
              ) : (
                <Minus className="size-4 text-stone-400" aria-label={t('activeNo')} />
              )}
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-right">
              <IconAction
                label={t('common:edit')}
                icon={Pencil}
                onClick={() => {
                  setEditing({
                    id: u.id,
                    initial: { ...EMPTY, username: u.username, full_name: u.full_name, role: u.role, active: u.active },
                  })
                }}
              />
            </td>
          </tr>
        ))}
      </Table>
      <p className="text-xs text-stone-600">{t('rights')}</p>
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
