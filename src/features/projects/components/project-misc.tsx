'use client'

import { useState } from 'react'
import { Feedback, useServerAction } from '@/components/action-feedback'
import { Button, inputClass } from '@/components/ui'
import { createVersionAction, deleteProjectAction } from '@/server/actions/projects'

export function VersionButton({ projectId }: { projectId: string }) {
  const [reason, setReason] = useState('')
  const { pending, result, execute } = useServerAction()
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        execute(() => createVersionAction(projectId, reason), () => setReason(''))
      }}
    >
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="version-reason">
          Motivo da versão
        </label>
        <input id="version-reason" placeholder="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={inputClass} />
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          Registrar versão
        </Button>
      </div>
      <Feedback result={result} />
    </form>
  )
}

export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const { pending, result, execute } = useServerAction()
  return (
    <div className="space-y-2">
      <Button
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (confirm('Excluir este projeto? Ele deixará de aparecer nas listagens (exclusão lógica, mantida para auditoria).')) {
            execute(() => deleteProjectAction(projectId))
          }
        }}
      >
        Excluir projeto
      </Button>
      <Feedback result={result} />
    </div>
  )
}
