import type { Metadata } from 'next'
import { Card, PageHeader } from '@/components/ui'
import { InstitutionForm, RetentionForm, TemplateForm, WorkflowForm } from '@/features/admin/components/admin-forms'
import { env } from '@/lib/env'
import { requireContext } from '@/server/auth/session'
import { getWorkflow } from '@/server/services/projects'
import { getDocumentTemplate, getInstitution, getRetention } from '@/server/settings'

export const metadata: Metadata = { title: 'Configurações' }

export default async function ConfiguracoesPage() {
  const { store } = await requireContext()
  const [institution, template, workflow, retention] = await Promise.all([getInstitution(store), getDocumentTemplate(store), getWorkflow(store), getRetention(store)])
  const e = env()
  return (
    <>
      <PageHeader title="Configurações do sistema" description="Parâmetros institucionais, modelos documentais, fluxo de tramitação e retenção de registros — sem alterar o código-fonte." />
      <div className="space-y-6">
        <Card title="Identidade visual">
          <InstitutionForm initial={institution} />
        </Card>
        <Card title="Modelo documental">
          <TemplateForm initial={template} />
        </Card>
        <Card title="Fluxo de tramitação">
          <WorkflowForm initial={workflow} />
        </Card>
        <Card title="Retenção de registros">
          <RetentionForm initial={retention} />
        </Card>
        <Card title="Ambiente (somente leitura)">
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-slate-500">Persistência</dt>
              <dd>{e.DATA_BACKEND === 'supabase' ? 'Supabase (PostgreSQL)' : 'Demonstração (memória)'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Provedor de IA</dt>
              <dd>
                {e.AI_PROVIDER}
                {e.AI_PROVIDER !== 'local' && e.AI_EXTERNAL_ALLOWED !== 'true' && ' (bloqueado: AI_EXTERNAL_ALLOWED=false)'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Limite de upload</dt>
              <dd>{e.UPLOAD_MAX_MB} MB</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-slate-500">Esses parâmetros são definidos por variáveis de ambiente no servidor (ver .env.example).</p>
        </Card>
      </div>
    </>
  )
}
