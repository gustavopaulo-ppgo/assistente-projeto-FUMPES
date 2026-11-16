'use client'

import { useActionState } from 'react'
import { LogIn } from 'lucide-react'
import { Button, Field, inputClass } from '@/components/ui'
import { loginAction } from '@/server/actions/projects'

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null)
  return (
    <form action={action} className="mt-4 space-y-4">
      <Field label="E-mail institucional" htmlFor="email" required>
        <input id="email" name="email" type="email" autoComplete="username" required className={inputClass} />
      </Field>
      <Field label="Senha" htmlFor="password" required>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      {state && !state.ok && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        <LogIn aria-hidden className="h-4 w-4" /> {pending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}
