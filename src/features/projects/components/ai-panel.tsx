'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, Bot, Check, HelpCircle, Send, X } from 'lucide-react'
import { Alert, Badge, Button, inputClass } from '@/components/ui'
import type { AssistantResult } from '@/ai/types'
import { askAssistantAction, suggestionDecisionAction } from '@/server/actions/projects'
import { useWizard } from './wizard-context'

interface Turn {
  question: string
  result: AssistantResult | null
  error?: string
  decided: Record<number, 'inserida' | 'descartada'>
}

export function AiPanel({ stepTitle, hasFields }: { stepTitle: string; hasFields: boolean }) {
  const { projectId, step, insertSuggestion } = useWizard()
  const [message, setMessage] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [pending, start] = useTransition()

  const ask = (text: string) =>
    start(async () => {
      const r = await askAssistantAction(projectId, step, text)
      setTurns((t) => [{ question: text, result: r.ok ? (r.data as AssistantResult) : null, error: r.ok ? undefined : r.error, decided: {} }, ...t])
      setMessage('')
    })

  const decide = (ti: number, si: number, accepted: boolean) => {
    const turn = turns[ti]
    const s = turn.result?.sugestoes[si]
    if (!s || !turn.result?.interactionId) return
    if (accepted && !insertSuggestion(s.campo, s.texto)) return
    setTurns((all) => all.map((t, i) => (i === ti ? { ...t, decided: { ...t.decided, [si]: accepted ? 'inserida' : 'descartada' } } : t)))
    void suggestionDecisionAction(turn.result.interactionId, s.campo, accepted)
  }

  return (
    <aside aria-label="Assistente de elaboração" className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <Bot aria-hidden className="h-5 w-5 text-brand" />
        <div>
          <h2 className="text-sm font-semibold">Assistente técnico</h2>
          <p className="text-[11px] text-slate-500">Etapa: {stepTitle}</p>
        </div>
      </header>
      <div className="space-y-3 p-4">
        <p className="text-xs text-slate-600">
          Descreva com suas palavras o que você sabe. O assistente faz perguntas, organiza o texto e aponta pendências. Ele <strong>não inventa dados</strong>, não fornece preços e{' '}
          <strong>não decide</strong> sobre o projeto. Nada é gravado sem você inserir a sugestão e salvar.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            ask(message)
          }}
          className="space-y-2"
        >
          <label htmlFor="ai-msg" className="sr-only">
            Mensagem ao assistente
          </label>
          <textarea
            id="ai-msg"
            rows={3}
            maxLength={4000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ex.: Precisamos de computadores novos porque os atuais estão ultrapassados."
            className={inputClass}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              <Send aria-hidden className="h-3.5 w-3.5" /> {pending ? 'Analisando…' : 'Enviar'}
            </Button>
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => ask('')}>
              O que falta nesta etapa?
            </Button>
          </div>
        </form>

        <div aria-live="polite" className="space-y-4">
          {turns.map((t, ti) => (
            <div key={ti} className="space-y-2 border-t border-slate-100 pt-3 text-sm">
              {t.question && <p className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">Você: {t.question}</p>}
              {t.error && <Alert tone="danger">{t.error}</Alert>}
              {t.result && (
                <>
                  {!t.result.ok ? <Alert tone="warning">{t.result.mensagem}</Alert> : <p className="text-slate-800">{t.result.mensagem}</p>}
                  {t.result.alertas.map((a, i) => (
                    <Alert key={i} tone="warning">
                      {a}
                    </Alert>
                  ))}
                  {t.result.perguntas.length > 0 && (
                    <div>
                      <p className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                        <HelpCircle aria-hidden className="h-3.5 w-3.5" /> Perguntas para completar
                      </p>
                      <ul className="mt-1 space-y-1">
                        {t.result.perguntas.map((q, i) => (
                          <li key={i}>
                            <button type="button" className="text-left text-xs text-brand hover:underline" onClick={() => setMessage(`${q}\nResposta: `)}>
                              {q}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {t.result.sugestoes.map((s, si) => (
                    <div key={si} className="rounded-md border border-blue-200 bg-blue-50/50 p-2">
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge tone="info">
                          <Bot aria-hidden className="h-3 w-3" /> Sugestão da IA
                        </Badge>
                        <span className="text-xs font-medium">para “{s.rotulo}”</span>
                        {s.contemDadosNaoConfirmados && (
                          <Badge tone="danger">
                            <AlertTriangle aria-hidden className="h-3 w-3" /> contém números não informados — confirme
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{s.texto}</p>
                      {s.explicacao && <p className="mt-1 text-xs text-slate-600">Por quê: {s.explicacao}</p>}
                      {t.decided[si] ? (
                        <p className="mt-1 text-xs text-slate-500">{t.decided[si] === 'inserida' ? 'Inserida no campo — revise e salve.' : 'Descartada.'}</p>
                      ) : (
                        <div className="mt-2 flex gap-2">
                          {hasFields && (
                            <Button size="sm" onClick={() => decide(ti, si, true)}>
                              <Check aria-hidden className="h-3.5 w-3.5" /> Inserir no campo
                            </Button>
                          )}
                          <Button size="sm" variant="secondary" onClick={() => decide(ti, si, false)}>
                            <X aria-hidden className="h-3.5 w-3.5" /> Descartar
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {t.result.pendencias.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-700">Informações pendentes</p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-700">
                        {t.result.pendencias.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400">Provedor: {t.result.provider}</p>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
