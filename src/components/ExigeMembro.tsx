import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth.tsx'
import { useMembroAtual } from '../hooks/useDados.ts'
import { Aviso, Carregando } from './ui.tsx'

/**
 * Só mostra o conteúdo para quem está logado E está na tabela `membros`.
 * Sem login → vai para /login. Logado sem ser membro → aviso.
 */
export function ExigeMembro({ children }: { children: ReactNode }) {
  const { sessao, carregando, sair } = useAuth()
  const location = useLocation()
  const { membro, isPending, isError, error } = useMembroAtual()

  if (carregando) return <Carregando />
  if (!sessao) return <Navigate to="/login" replace state={{ de: location.pathname }} />
  if (isPending) return <Carregando />

  if (isError) {
    return (
      <main className="mx-auto max-w-sm px-4 py-16">
        <Aviso titulo="Não foi possível carregar seus dados">{(error as Error).message}</Aviso>
      </main>
    )
  }

  if (!membro) {
    return (
      <main className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-16">
        <Aviso titulo="Login ainda não liberado">
          Você entrou como <strong>{sessao.user.email}</strong>, mas esse e-mail ainda não está ligado a
          um membro. Confira se o <code>setup_casal.sql</code> foi rodado com este e-mail.
        </Aviso>
        <button onClick={sair} className="h-11 rounded-xl border border-stone-300 bg-white font-medium">
          Sair
        </button>
      </main>
    )
  }

  return <>{children}</>
}
