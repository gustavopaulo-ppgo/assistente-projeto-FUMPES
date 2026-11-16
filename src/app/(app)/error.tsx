'use client'

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-lg rounded-lg border border-red-200 bg-white p-6 text-center">
      <h1 className="text-lg font-semibold text-red-800">Não foi possível carregar esta página</h1>
      <p className="mt-2 text-sm text-slate-600">Ocorreu um erro inesperado. Nenhum detalhe técnico é exibido por segurança.</p>
      {error.digest && <p className="mt-1 font-mono text-xs text-slate-400">Código: {error.digest}</p>}
      <button type="button" onClick={reset} className="mt-4 rounded-md bg-brand px-4 py-2 text-sm text-white">
        Tentar novamente
      </button>
    </div>
  )
}
