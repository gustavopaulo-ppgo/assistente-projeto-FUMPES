'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

export type SaveOptions = { nextStep?: number }
type Saver = (opts: SaveOptions) => Promise<boolean>
type Inserter = (field: string, text: string) => void

interface WizardCtx {
  projectId: string
  step: number
  canEdit: boolean
  dirty: boolean
  setDirty: (key: string, dirty: boolean) => void
  registerSaver: (key: string, fn: Saver | null) => void
  registerInserter: (fn: Inserter | null) => void
  insertSuggestion: (field: string, text: string) => boolean
  saveAll: (opts?: SaveOptions) => Promise<boolean>
}

const Ctx = createContext<WizardCtx | null>(null)

export function useWizard() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useWizard fora do WizardProvider')
  return c
}

/**
 * Coordena as partes editáveis de uma etapa: cada formulário/tabela registra
 * a sua função de salvar; a navegação entre etapas salva tudo antes de sair.
 */
export function WizardProvider({ projectId, step, canEdit, children }: { projectId: string; step: number; canEdit: boolean; children: ReactNode }) {
  const savers = useRef(new Map<string, Saver>())
  const inserter = useRef<Inserter | null>(null)
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set())

  const setDirty = useCallback((key: string, d: boolean) => {
    setDirtyKeys((prev) => {
      if (prev.has(key) === d) return prev
      const next = new Set(prev)
      if (d) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  const registerSaver = useCallback((key: string, fn: Saver | null) => {
    if (fn) savers.current.set(key, fn)
    else savers.current.delete(key)
  }, [])

  const registerInserter = useCallback((fn: Inserter | null) => {
    inserter.current = fn
  }, [])

  const insertSuggestion = useCallback((field: string, text: string) => {
    if (!inserter.current) return false
    inserter.current(field, text)
    return true
  }, [])

  const saveAll = useCallback(async (opts: SaveOptions = {}) => {
    for (const fn of savers.current.values()) {
      if (!(await fn(opts))) return false
    }
    return true
  }, [])

  const dirty = dirtyKeys.size > 0
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const value = useMemo(
    () => ({ projectId, step, canEdit, dirty, setDirty, registerSaver, registerInserter, insertSuggestion, saveAll }),
    [projectId, step, canEdit, dirty, setDirty, registerSaver, registerInserter, insertSuggestion, saveAll],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
