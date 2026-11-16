'use client'

import { useState } from 'react'
import { Feedback, useServerAction } from '@/components/action-feedback'
import { Button, Field, inputClass } from '@/components/ui'
import { addReviewAction } from '@/server/actions/projects'

const TYPE_LABEL = { gestor_unidade: 'Parecer do gestor da unidade', tecnica: 'Análise técnica', financeira: 'Análise financeira' }

export function ReviewForm({ projectId, types }: { projectId: string; types: (keyof typeof TYPE_LABEL)[] }) {
  const [type, setType] = useState(types[0])
  const [rec, setRec] = useState('favoravel')
  const [opinion, setOpinion] = useState('')
  const { pending, result, execute } = useServerAction()
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        execute(() => addReviewAction(projectId, { review_type: type, recommendation: rec, opinion }), () => setOpinion(''))
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tipo" htmlFor="rv-type">
          <select id="rv-type" value={type} onChange={(e) => setType(e.target.value as keyof typeof TYPE_LABEL)} className={inputClass}>
            {types.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Recomendação" htmlFor="rv-rec">
          <select id="rv-rec" value={rec} onChange={(e) => setRec(e.target.value)} className={inputClass}>
            <option value="favoravel">Favorável</option>
            <option value="correcao">Necessita correção</option>
            <option value="desfavoravel">Desfavorável</option>
            <option value="informativa">Apenas informativa / recomendação</option>
          </select>
        </Field>
      </div>
      <Field label="Parecer / recomendações" htmlFor="rv-op" required>
        <textarea id="rv-op" rows={5} required maxLength={8000} value={opinion} onChange={(e) => setOpinion(e.target.value)} className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending}>
        Registrar parecer
      </Button>
      <p className="text-xs text-slate-500">O parecer é registrado com seu nome, data e hora. Para mudar a situação do projeto, use a tramitação na visão geral.</p>
      <Feedback result={result} />
    </form>
  )
}
