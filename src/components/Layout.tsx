import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth.tsx'
import { useContas, useMembroAtual } from '../hooks/useDados.ts'
import { SeletorMes } from './SeletorMes.tsx'
import { Bolinha } from './ui.tsx'

const classeAba = ({ isActive }: { isActive: boolean }) =>
  `flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors duration-150 ${
    isActive ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
  }`

export function Layout() {
  const { sair } = useAuth()
  const { membro } = useMembroAtual()
  const contas = useContas()

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto max-w-3xl px-4">
          <div className="flex h-12 items-center justify-between">
            <span className="font-bold tracking-tight">Contas da Casa</span>
            <div className="flex items-center gap-3 text-sm">
              {membro && (
                <span className="flex items-center gap-1.5 text-stone-600">
                  <Bolinha cor={membro.cor} />
                  {membro.nome}
                </span>
              )}
              <button onClick={sair} className="rounded-lg px-2 py-1 font-medium text-stone-500 hover:bg-stone-100">
                Sair
              </button>
            </div>
          </div>

          <SeletorMes />

          <nav aria-label="Abas" className="-mx-4 mt-1 flex gap-1 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
            <NavLink to="/" end className={classeAba}>
              Resumo
            </NavLink>
            {contas.data?.map((conta) => (
              <NavLink key={conta.id} to={`/conta/${conta.id}`} className={classeAba}>
                <Bolinha cor={conta.cor} />
                {conta.nome}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
    </div>
  )
}
