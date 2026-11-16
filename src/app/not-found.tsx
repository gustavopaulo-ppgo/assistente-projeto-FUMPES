import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-bold">Página ou registro não encontrado</h1>
      <p className="max-w-md text-sm text-slate-600">O endereço não existe ou você não tem permissão para acessá-lo.</p>
      <Link href="/painel" className="rounded-md bg-brand px-4 py-2 text-sm text-white">
        Voltar ao painel
      </Link>
    </main>
  )
}
