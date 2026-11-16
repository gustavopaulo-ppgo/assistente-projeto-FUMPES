'use client'

import { useState, useTransition } from 'react'
import { Alert } from './ui'

export type Result = { ok: true; message?: string; data?: unknown } | { ok: false; error: string; details?: string[] }

/** Executa uma Server Action e guarda a mensagem de retorno para exibição. */
export function useServerAction() {
  const [pending, start] = useTransition()
  const [result, setResult] = useState<Result | null>(null)
  const execute = (fn: () => Promise<Result>, onOk?: (r: Result) => void) =>
    start(async () => {
      const r = await fn()
      setResult(r)
      if (r.ok) onOk?.(r)
    })
  return { pending, result, setResult, execute }
}

export function Feedback({ result }: { result: Result | null }) {
  if (!result) return null
  if (result.ok) return result.message ? <Alert tone="success">{result.message}</Alert> : null
  return (
    <Alert tone="danger" title={result.error}>
      {result.details?.length ? (
        <ul className="list-disc space-y-0.5 pl-4">
          {result.details.slice(0, 15).map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      ) : null}
    </Alert>
  )
}
