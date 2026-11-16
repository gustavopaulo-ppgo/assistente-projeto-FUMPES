'use client'

import { useActionState } from 'react'
import { Alert, Button, Field, inputClass } from '@/components/ui'
import { PROJECT_TYPES, THEMATIC_AREAS } from '@/features/projects/steps'
import { createProjectAction } from '@/server/actions/projects'

export function NewProjectForm({ units, defaultUnit }: { units: { id: string; label: string }[]; defaultUnit: string | null }) {
  const [state, action, pending] = useActionState(createProjectAction, null)
  return (
    <form action={action} className="space-y-4">
      <Field label="Título do projeto" htmlFor="title" required help='Ex.: "Modernização do parque de informática da Unidade X". Você poderá alterá-lo depois.'>
        <input id="title" name="title" required maxLength={200} className={inputClass} />
      </Field>
      <Field label="Unidade proponente" htmlFor="unit_id" required>
        <select id="unit_id" name="unit_id" required defaultValue={units.some((u) => u.id === defaultUnit) ? (defaultUnit ?? '') : ''} className={inputClass}>
          <option value="" disabled>
            Selecione…
          </option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="O que você pretende fazer?" htmlFor="project_type" required>
        <select id="project_type" name="project_type" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Selecione…
          </option>
          {PROJECT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Área temática" htmlFor="thematic_area">
        <select id="thematic_area" name="thematic_area" defaultValue="" className={inputClass}>
          <option value="">Definir depois</option>
          {THEMATIC_AREAS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </Field>
      {state && !state.ok && (
        <Alert tone="danger" title={state.error}>
          {state.details?.length ? (
            <ul className="list-disc pl-4">
              {state.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Criando…' : 'Criar e iniciar o assistente'}
      </Button>
    </form>
  )
}
