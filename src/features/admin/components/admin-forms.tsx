'use client'

import { useState } from 'react'
import { Feedback, useServerAction } from '@/components/action-feedback'
import { Badge, Button, Field, inputClass } from '@/components/ui'
import { ROLE_LABELS } from '@/features/workflow/config'
import { applyRetentionAction, saveUnitAction, saveUserAction, updateSettingAction } from '@/server/actions/admin'
import type { DocumentTemplate, InstitutionSettings, RetentionSettings } from '@/server/settings/defaults'
import { ROLES, type OrganizationalUnit, type Role } from '@/types/domain'

type Unit = Pick<OrganizationalUnit, 'id' | 'name' | 'acronym' | 'city' | 'active'>
interface UserRow {
  id: string
  full_name: string
  email: string
  registration: string | null
  unit_id: string | null
  active: boolean
  roles: { role: Role; unit_id: string | null }[]
}

export function UserEditor({ user, units, onDone }: { user?: UserRow; units: Unit[]; onDone?: () => void }) {
  const [f, setF] = useState<UserRow>(user ?? { id: '', full_name: '', email: '', registration: '', unit_id: null, active: true, roles: [] })
  const { pending, result, execute } = useServerAction()
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        execute(() => saveUserAction({ ...f, id: f.id || null }), () => onDone?.())
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" htmlFor={`u-name-${f.id}`} required>
          <input id={`u-name-${f.id}`} required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} className={inputClass} />
        </Field>
        <Field label="E-mail" htmlFor={`u-email-${f.id}`} required>
          <input id={`u-email-${f.id}`} type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Matrícula" htmlFor={`u-reg-${f.id}`}>
          <input id={`u-reg-${f.id}`} value={f.registration ?? ''} onChange={(e) => setF({ ...f, registration: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Unidade de lotação" htmlFor={`u-unit-${f.id}`}>
          <select id={`u-unit-${f.id}`} value={f.unit_id ?? ''} onChange={(e) => setF({ ...f, unit_id: e.target.value || null })} className={inputClass}>
            <option value="">—</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.acronym}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Usuário ativo
      </label>
      <fieldset className="space-y-2 rounded-md border border-slate-200 p-3">
        <legend className="px-1 text-sm font-semibold">Perfis de acesso</legend>
        {f.roles.map((r, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            <select aria-label="Perfil" value={r.role} onChange={(e) => setF({ ...f, roles: f.roles.map((x, j) => (j === i ? { ...x, role: e.target.value as Role } : x)) })} className={`${inputClass} max-w-56`}>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
            <select aria-label="Abrangência" value={r.unit_id ?? ''} onChange={(e) => setF({ ...f, roles: f.roles.map((x, j) => (j === i ? { ...x, unit_id: e.target.value || null } : x)) })} className={`${inputClass} max-w-56`}>
              <option value="">Todas as unidades</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  Somente {u.acronym}
                </option>
              ))}
            </select>
            <Button size="sm" variant="ghost" onClick={() => setF({ ...f, roles: f.roles.filter((_, j) => j !== i) })}>
              Remover
            </Button>
          </div>
        ))}
        <Button size="sm" variant="secondary" onClick={() => setF({ ...f, roles: [...f.roles, { role: 'proponente', unit_id: f.unit_id }] })}>
          Adicionar perfil
        </Button>
      </fieldset>
      <Button type="submit" disabled={pending}>
        Salvar usuário
      </Button>
      <Feedback result={result} />
    </form>
  )
}

export function UserRowItem({ user, units }: { user: UserRow; units: Unit[] }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div>
          <p className="font-medium">
            {user.full_name} {!user.active && <Badge tone="danger">inativo</Badge>}
          </p>
          <p className="text-xs text-slate-500">{user.email}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {user.roles.map((r, i) => (
              <Badge key={i} tone="info">
                {ROLE_LABELS[r.role]} · {r.unit_id ? units.find((u) => u.id === r.unit_id)?.acronym : 'todas'}
              </Badge>
            ))}
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
          {open ? 'Fechar' : 'Editar'}
        </Button>
      </div>
      {open && (
        <div className="mt-3">
          <UserEditor user={user} units={units} onDone={() => setOpen(false)} />
        </div>
      )}
    </li>
  )
}

export function UnitEditor({ unit }: { unit?: Unit }) {
  const [f, setF] = useState<Unit>(unit ?? { id: '', name: '', acronym: '', city: '', active: true })
  const { pending, result, execute } = useServerAction()
  return (
    <form
      className="grid items-end gap-2 sm:grid-cols-[1fr_8rem_10rem_auto_auto]"
      onSubmit={(e) => {
        e.preventDefault()
        execute(() => saveUnitAction({ ...f, id: f.id || null }), () => !unit && setF({ id: '', name: '', acronym: '', city: '', active: true }))
      }}
    >
      <input aria-label="Nome da unidade" required placeholder="Nome" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputClass} />
      <input aria-label="Sigla" required placeholder="Sigla" value={f.acronym} onChange={(e) => setF({ ...f, acronym: e.target.value })} className={inputClass} />
      <input aria-label="Município" placeholder="Município" value={f.city ?? ''} onChange={(e) => setF({ ...f, city: e.target.value })} className={inputClass} />
      <label className="flex items-center gap-1 text-xs">
        <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Ativa
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        {unit ? 'Salvar' : 'Cadastrar'}
      </Button>
      <div className="sm:col-span-5">
        <Feedback result={result} />
      </div>
    </form>
  )
}

export function InstitutionForm({ initial }: { initial: InstitutionSettings }) {
  const [f, setF] = useState(initial)
  const { pending, result, execute, setResult } = useServerAction()
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        execute(() => updateSettingAction('institution', f))
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome da instituição" htmlFor="in-name">
          <input id="in-name" value={f.institution_name} onChange={(e) => setF({ ...f, institution_name: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Fundo / departamento" htmlFor="in-dep">
          <input id="in-dep" value={f.department_name} onChange={(e) => setF({ ...f, department_name: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Nome do sistema" htmlFor="in-sys">
          <input id="in-sys" value={f.system_name} onChange={(e) => setF({ ...f, system_name: e.target.value })} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cor principal" htmlFor="in-c1">
            <input id="in-c1" type="color" value={f.primary_color} onChange={(e) => setF({ ...f, primary_color: e.target.value })} className="h-10 w-full" />
          </Field>
          <Field label="Cor de destaque" htmlFor="in-c2">
            <input id="in-c2" type="color" value={f.accent_color} onChange={(e) => setF({ ...f, accent_color: e.target.value })} className="h-10 w-full" />
          </Field>
        </div>
      </div>
      <Field label="Logotipo/brasão autorizado (PNG ou JPEG, até 250 KB)" htmlFor="in-logo" help="Insira somente arquivos cuja utilização esteja autorizada.">
        <input
          id="in-logo"
          type="file"
          accept=".png,.jpg,.jpeg"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            if (file.size > 250_000 || !['image/png', 'image/jpeg'].includes(file.type)) {
              setResult({ ok: false, error: 'Use PNG ou JPEG com até 250 KB.' })
              return
            }
            const reader = new FileReader()
            reader.onload = () => setF((x) => ({ ...x, logo_data_url: String(reader.result) }))
            reader.readAsDataURL(file)
          }}
        />
      </Field>
      {f.logo_data_url && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={f.logo_data_url} alt="Pré-visualização do logotipo" className="h-12 w-auto rounded border" />
          <Button size="sm" variant="ghost" onClick={() => setF({ ...f, logo_data_url: null })}>
            Remover logotipo
          </Button>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        Salvar identidade visual
      </Button>
      <Feedback result={result} />
    </form>
  )
}

const SECTION_KEYS = ['apresentacao', 'identificacao', 'diagnostico', 'justificativa', 'objetivos', 'metodologia', 'solucao', 'beneficiarios', 'orcamento', 'cronograma', 'riscos', 'fundamentacao', 'conclusao', 'anexos']

export function TemplateForm({ initial }: { initial: DocumentTemplate }) {
  const [f, setF] = useState(initial)
  const { pending, result, execute } = useServerAction()
  const text = (k: 'cover_title' | 'cover_subtitle' | 'header_text' | 'footer_text', label: string) => (
    <Field label={label} htmlFor={`tp-${k}`}>
      <input id={`tp-${k}`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={inputClass} />
    </Field>
  )
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        execute(() => updateSettingAction('document_template', f))
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {text('cover_title', 'Título da capa')}
        {text('cover_subtitle', 'Subtítulo da capa')}
        {text('header_text', 'Cabeçalho')}
        {text('footer_text', 'Rodapé')}
      </div>
      <Field label="Aviso final (isenção de responsabilidade)" htmlFor="tp-disc">
        <textarea id="tp-disc" rows={3} value={f.disclaimer} onChange={(e) => setF({ ...f, disclaimer: e.target.value })} className={inputClass} />
      </Field>
      <details className="rounded-md border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold">Títulos e textos introdutórios das seções</summary>
        <div className="mt-3 space-y-3">
          {SECTION_KEYS.map((k) => (
            <div key={k} className="grid gap-2 sm:grid-cols-[14rem_1fr]">
              <input aria-label={`Título da seção ${k}`} value={f.section_titles[k] ?? ''} onChange={(e) => setF({ ...f, section_titles: { ...f.section_titles, [k]: e.target.value } })} className={inputClass} />
              <textarea aria-label={`Texto introdutório da seção ${k}`} rows={1} placeholder="Texto introdutório padrão (opcional)" value={f.section_intros[k] ?? ''} onChange={(e) => setF({ ...f, section_intros: { ...f.section_intros, [k]: e.target.value } })} className={inputClass} />
            </div>
          ))}
        </div>
      </details>
      <Button type="submit" disabled={pending}>
        Salvar modelo documental
      </Button>
      <Feedback result={result} />
    </form>
  )
}

export function WorkflowForm({ initial }: { initial: unknown }) {
  const [json, setJson] = useState(() => JSON.stringify(initial, null, 2))
  const { pending, result, execute, setResult } = useServerAction()
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        let value: unknown
        try {
          value = JSON.parse(json)
        } catch {
          setResult({ ok: false, error: 'JSON inválido.' })
          return
        }
        execute(() => updateSettingAction('workflow', value))
      }}
    >
      <p className="text-xs text-slate-600">
        Cada transição define origem (<code>from</code>), destino (<code>to</code>), rótulo, atores autorizados (perfis ou <code>responsavel</code>/<code>colaborador</code>) e exigências. Transições para
        Aprovado, Rejeitado e Encerrado sempre exigem referência administrativa, e o próprio proponente nunca pode validar ou aprovar.
      </p>
      <label htmlFor="wf-json" className="sr-only">
        Configuração do fluxo (JSON)
      </label>
      <textarea id="wf-json" rows={18} value={json} onChange={(e) => setJson(e.target.value)} className={`${inputClass} font-mono text-xs`} spellCheck={false} />
      <Button type="submit" disabled={pending}>
        Salvar fluxo
      </Button>
      <Feedback result={result} />
    </form>
  )
}

export function RetentionForm({ initial }: { initial: RetentionSettings }) {
  const [f, setF] = useState(initial)
  const { pending, result, execute } = useServerAction()
  return (
    <div className="space-y-3">
      <form
        className="grid items-end gap-3 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault()
          execute(() => updateSettingAction('retention', f))
        }}
      >
        <Field label="Interações de IA (dias)" htmlFor="rt-ai">
          <input id="rt-ai" type="number" min={30} max={3650} value={f.ai_interactions_days} onChange={(e) => setF({ ...f, ai_interactions_days: Number(e.target.value) })} className={inputClass} />
        </Field>
        <Field label="Logs de auditoria (dias)" htmlFor="rt-audit">
          <input id="rt-audit" type="number" min={365} max={7300} value={f.audit_logs_days} onChange={(e) => setF({ ...f, audit_logs_days: Number(e.target.value) })} className={inputClass} />
        </Field>
        <Button type="submit" disabled={pending}>
          Salvar política
        </Button>
      </form>
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          confirm('Excluir definitivamente os registros mais antigos que o prazo de retenção?') &&
          execute(async () => {
            const r = await applyRetentionAction()
            return r.ok ? { ok: true, message: `Removidos: ${r.data?.ai ?? 0} interações de IA e ${r.data?.audit ?? 0} registros de auditoria.` } : r
          })
        }
      >
        Aplicar política de retenção agora
      </Button>
      <Feedback result={result} />
    </div>
  )
}
