import { notFound } from 'next/navigation'
import { Alert, Badge, Card } from '@/components/ui'
import { analyzeFraming } from '@/features/legal/framing'
import { evaluateCompleteness, fieldValue } from '@/features/projects/completeness'
import { STEPS, TOTAL_STEPS, getStep, suggestedDocumentsFor } from '@/features/projects/steps'
import { AiPanel } from '@/features/projects/components/ai-panel'
import { DocumentsPanel } from '@/features/projects/components/documents-panel'
import { StepFieldsForm } from '@/features/projects/components/step-fields-form'
import { StepFooter, Stepper } from '@/features/projects/components/step-nav'
import { BudgetTable, ObjectivesTables, RisksTable, ScheduleTable } from '@/features/projects/components/step-tables'
import type { Row } from '@/features/projects/components/table-editor'
import { WizardProvider } from '@/features/projects/components/wizard-context'
import { STATUS_LABELS } from '@/features/workflow/config'
import { env } from '@/lib/env'
import { canEditContent, canReviewDocuments } from '@/server/auth/permissions'
import { loadProjectPage } from '@/server/pages'
import type { FieldMeta } from '@/types/domain'

const asRows = (list: object[]) => list.map((r) => ({ ...r }) as unknown as Row)

export default async function EtapaPage({ params }: { params: Promise<{ id: string; etapa: string }> }) {
  const { id, etapa } = await params
  const stepNumber = Number(etapa)
  const step = getStep(stepNumber)
  if (!step) notFound()
  const { ctx, bundle } = await loadProjectPage(id)
  const p = bundle.project
  const canEdit = canEditContent(ctx.user, p, bundle.members)
  const completeness = evaluateCompleteness(bundle)
  const initial = Object.fromEntries(step.fields.map((f) => [f.key, fieldValue(bundle, step, f.key)]))
  const meta: Record<string, FieldMeta> = bundle.sections[step.section]?.field_meta ?? {}
  const elabDocs = bundle.documents.filter((d) => d.context === 'elaboracao')
  const docRows = elabDocs.map((d) => ({ id: d.id, name: d.name, category: d.category, status: d.status, size: d.size_bytes, review_note: d.review_note, created_at: d.created_at }))
  const stepPendings = completeness.pendings.filter((x) => x.step === stepNumber)
  const framing = step.kind === 'review' ? analyzeFraming(bundle, await ctx.store.list('legal_references')) : null

  return (
    <WizardProvider projectId={p.id} step={stepNumber} canEdit={canEdit}>
      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_22rem]">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <Stepper steps={STEPS.map((s) => ({ number: s.number, title: s.title, percent: completeness.byStep[s.number].percent }))} />
        </div>

        <div className="min-w-0">
          <Card
            title={
              <span>
                Etapa {step.number} de {TOTAL_STEPS} — {step.title}
              </span>
            }
            actions={stepPendings.length ? <Badge tone="warning">{stepPendings.length} pendência(s)</Badge> : <Badge tone="success">Completa</Badge>}
          >
            <p className="mb-4 text-sm text-slate-600">{step.description}</p>
            {!canEdit && (
              <Alert tone="info" className="mb-4">
                Modo somente leitura: o projeto está “{STATUS_LABELS[p.status]}” ou você não faz parte da equipe de elaboração.
              </Alert>
            )}

            {step.fields.length > 0 && <StepFieldsForm fields={step.fields} initial={initial} meta={meta} />}

            {step.kind === 'objectives' && (
              <div className="mt-6">
                <ObjectivesTables objectives={asRows(bundle.objectives)} indicators={asRows(bundle.indicators)} />
              </div>
            )}
            {step.kind === 'budget' && (
              <div className="mt-6">
                <BudgetTable rows={asRows(bundle.budget)} documents={elabDocs.map((d) => ({ id: d.id, name: d.name }))} />
              </div>
            )}
            {step.kind === 'schedule' && (
              <div className="mt-6">
                <ScheduleTable rows={asRows(bundle.schedule)} />
              </div>
            )}
            {step.kind === 'risks' && <RisksTable rows={asRows(bundle.risks)} />}
            {step.kind === 'documents' && (
              <div className="space-y-4">
                <Alert tone="info" title="Documentos sugeridos para este tipo de projeto">
                  <ul className="list-disc pl-4">
                    {suggestedDocumentsFor(p.project_type).map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs">Sugestões de instrução — confirme as exigências com a área técnica e as normas vigentes.</p>
                </Alert>
                <DocumentsPanel
                  projectId={p.id}
                  context="elaboracao"
                  documents={docRows}
                  categories={[...suggestedDocumentsFor(p.project_type), 'Cotação / pesquisa de preço', 'Declaração', 'Estudo técnico', 'Registro fotográfico']}
                  canUpload={canEdit}
                  canReview={canReviewDocuments(ctx.user, p)}
                  maxMb={env().UPLOAD_MAX_MB}
                />
              </div>
            )}

            {step.kind === 'review' && framing && (
              <div className="mt-6 space-y-4">
                <Card title="Conferência de campos obrigatórios">
                  {completeness.pendings.length ? (
                    <ul className="space-y-1 text-sm">
                      {completeness.pendings.map((x, i) => (
                        <li key={i}>
                          <a href={`/projetos/${p.id}/elaborar/${x.step}`} className="text-brand hover:underline">
                            Etapa {x.step} ({STEPS[x.step - 1].title})
                          </a>
                          : {x.message}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-emerald-700">Todos os campos obrigatórios estão preenchidos.</p>
                  )}
                </Card>
                <Card title="Inconsistências identificadas">
                  {completeness.inconsistencies.length ? (
                    <ul className="list-disc space-y-1 pl-4 text-sm text-amber-900">
                      {completeness.inconsistencies.map((x, i) => (
                        <li key={i}>
                          Etapa {x.step}: {x.message}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-emerald-700">Nenhuma inconsistência detectada.</p>
                  )}
                </Card>
                <Card title="Avaliação preliminar de enquadramento">
                  <div className="space-y-2 text-sm">
                    <Badge
                      tone={
                        framing.classification === 'favoravel'
                          ? 'success'
                          : framing.classification === 'possivel_incompatibilidade'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {framing.label}
                    </Badge>
                    <p>
                      <strong>Hipótese:</strong> {framing.hypothesis}
                    </p>
                    {framing.basis.length > 0 && (
                      <div>
                        <strong>Base normativa validada:</strong>
                        <ul className="list-disc pl-4">
                          {framing.basis.map((b) => (
                            <li key={b.id}>
                              {b.number} — {b.title}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {framing.provisions.length > 0 && (
                      <div>
                        <strong>Dispositivos confirmados:</strong>
                        <ul className="list-disc pl-4">
                          {framing.provisions.map((x) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {framing.restrictions.length > 0 && (
                      <div>
                        <strong>Restrições:</strong>
                        <ul className="list-disc pl-4">
                          {framing.restrictions.map((x) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {framing.requiredDocuments.length > 0 && (
                      <div>
                        <strong>Documentos necessários:</strong>
                        <ul className="pl-4">
                          {framing.requiredDocuments.map((d) => (
                            <li key={d.name}>
                              {d.present ? '✔' : '✖'} {d.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {framing.pendings.length > 0 && (
                      <div>
                        <strong>Pendências:</strong>
                        <ul className="list-disc pl-4">
                          {framing.pendings.slice(0, 12).map((x) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {framing.unverifiedReferences.length > 0 && (
                      <p className="text-xs text-slate-600">Normas cadastradas ainda não verificadas (não utilizadas na análise): {framing.unverifiedReferences.join('; ')}.</p>
                    )}
                    <Alert tone="warning" title="Necessária análise humana">
                      {framing.disclaimer}
                    </Alert>
                  </div>
                </Card>
                <Card title="Exportação do projeto consolidado">
                  <div className="flex flex-wrap gap-3 text-sm">
                    <a className="text-brand underline" href={`/api/projetos/${p.id}/exportar?doc=projeto&format=pdf`}>
                      Projeto (PDF)
                    </a>
                    <a className="text-brand underline" href={`/api/projetos/${p.id}/exportar?doc=projeto&format=docx`}>
                      Projeto editável (DOCX)
                    </a>
                    <a className="text-brand underline" href={`/api/projetos/${p.id}/exportar?doc=orcamento&format=xlsx`}>
                      Orçamento (XLSX)
                    </a>
                    <a className="text-brand underline" href={`/api/projetos/${p.id}/exportar?doc=pendencias&format=pdf`}>
                      Relatório de pendências (PDF)
                    </a>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Para encaminhar o projeto à revisão, use a tramitação na visão geral (o encaminhamento exige ausência de pendências obrigatórias).
                  </p>
                </Card>
              </div>
            )}

            <StepFooter total={TOTAL_STEPS} />
          </Card>
        </div>

        {canEdit && (
          <div className="lg:col-span-2 xl:col-span-1 xl:sticky xl:top-20 xl:self-start">
            <AiPanel stepTitle={step.title} hasFields={step.fields.length > 0} />
          </div>
        )}
      </div>
    </WizardProvider>
  )
}
