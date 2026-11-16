'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Feedback, useServerAction } from '@/components/action-feedback'
import { Button, inputClass } from '@/components/ui'
import { addMemberAction, removeMemberAction } from '@/server/actions/projects'

const LABEL = { responsavel: 'Responsável', colaborador: 'Colaborador (edita)', leitor: 'Leitor' }

export function MembersPanel({
  projectId,
  members,
  canManage,
}: {
  projectId: string
  members: { id: string; name: string; role: keyof typeof LABEL }[]
  canManage: boolean
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'colaborador' | 'leitor'>('colaborador')
  const { pending, result, execute } = useServerAction()
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-slate-100 text-sm">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between py-1.5">
            <span>
              {m.name} <span className="text-xs text-slate-500">— {LABEL[m.role]}</span>
            </span>
            {canManage && m.role !== 'responsavel' && (
              <button type="button" aria-label={`Remover ${m.name}`} className="rounded p-1 text-red-700 hover:bg-red-50" onClick={() => execute(() => removeMemberAction(projectId, m.id))}>
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {canManage && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            execute(() => addMemberAction(projectId, email, role), () => setEmail(''))
          }}
        >
          <label className="sr-only" htmlFor="member-email">
            E-mail do servidor
          </label>
          <input id="member-email" type="email" required placeholder="e-mail do servidor" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} max-w-56`} />
          <label className="sr-only" htmlFor="member-role">
            Papel
          </label>
          <select id="member-role" value={role} onChange={(e) => setRole(e.target.value as 'colaborador' | 'leitor')} className={`${inputClass} max-w-44`}>
            <option value="colaborador">Colaborador</option>
            <option value="leitor">Leitor</option>
          </select>
          <Button type="submit" size="sm" disabled={pending}>
            Adicionar
          </Button>
        </form>
      )}
      <Feedback result={result} />
    </div>
  )
}
