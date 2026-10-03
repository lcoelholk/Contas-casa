import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useMembroAtual, useTodasContas } from '../hooks/useDados.ts'
import { useTempoReal } from '../hooks/useTempoReal.ts'
import { PessoaProvider } from '../hooks/usePessoa.tsx'
import { NovoLancamentoContexto } from '../hooks/useNovoLancamento.tsx'
import { abasDoMembro } from '../lib/contas.ts'
import { SeletorMes } from './SeletorMes.tsx'
import { NovoLancamento, type TipoNovo } from './NovoLancamento.tsx'
import { Bolinha } from './ui.tsx'

export function Layout() {
  const { membro } = useMembroAtual()
  const contas = useTodasContas()
  const [novo, setNovo] = useState<{ tipo?: TipoNovo } | null>(null)
  useTempoReal(Boolean(membro))

  const abas = abasDoMembro(contas.data ?? [], membro?.id)
  const ordemParaLancar = [...abas.minhas, ...abas.compartilhadas, ...abas.dosOutros]

  return (
    <PessoaProvider>
      <NovoLancamentoContexto.Provider value={(tipo) => setNovo({ tipo })}>
        <div className="flex min-h-dvh flex-col">
          <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
            <div className="mx-auto max-w-3xl px-4">
              <div className="flex h-12 items-center justify-between">
                <span className="font-bold tracking-tight">Contas da Casa</span>
                {membro && (
                  <span className="flex items-center gap-1.5 text-sm text-stone-600">
                    <Bolinha cor={membro.cor} />
                    {membro.nome}
                  </span>
                )}
              </div>
              <div className="pb-2">
                <SeletorMes />
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 pb-[calc(7rem+env(safe-area-inset-bottom))]">
            <Outlet />
          </main>

          <BarraDeBaixo onNovo={() => setNovo({})} />

          <NovoLancamento
            aberto={novo !== null}
            onFechar={() => setNovo(null)}
            contas={ordemParaLancar}
            tipo={novo?.tipo}
          />
        </div>
      </NovoLancamentoContexto.Provider>
    </PessoaProvider>
  )
}

function BarraDeBaixo({ onNovo }: { onNovo: () => void }) {
  const { pathname } = useLocation()
  const emAnalises = pathname.startsWith('/graficos') || pathname.startsWith('/metas')
  const emMais = ['/mais', '/fixas', '/configuracoes', '/conta/'].some((p) => pathname.startsWith(p))

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto grid h-16 max-w-3xl grid-cols-5 items-center px-2">
        <ItemBarra para="/" fim rotulo="Início" icone={<IconeCasa />} />
        <ItemBarra para="/transacoes" rotulo="Transações" icone={<IconeLista />} />
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onNovo}
            aria-label="Novo lançamento"
            className="-mt-6 flex size-14 items-center justify-center rounded-full bg-marca-600 text-3xl leading-none text-white shadow-lg ring-4 ring-white active:scale-95"
          >
            +
          </button>
        </div>
        <ItemBarra para="/graficos" rotulo="Análises" icone={<IconeGrafico />} ativo={emAnalises} />
        <ItemBarra para="/mais" rotulo="Mais" icone={<IconeMais />} ativo={emMais} />
      </div>
    </nav>
  )
}

function ItemBarra({
  para,
  rotulo,
  icone,
  fim,
  ativo,
}: {
  para: string
  rotulo: string
  icone: ReactNode
  fim?: boolean
  /** Força o estado ativo (abas com várias rotas) */
  ativo?: boolean
}) {
  return (
    <NavLink
      to={para}
      end={fim}
      className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium ${
          (ativo ?? isActive) ? 'text-marca-700' : 'text-stone-500'
        }`
      }
    >
      <span aria-hidden className="size-6">
        {icone}
      </span>
      {rotulo}
    </NavLink>
  )
}

const svg = (d: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {d}
  </svg>
)
const IconeCasa = () => svg(<path d="M3 11 12 4l9 7v8a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />)
const IconeLista = () => svg(<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />)
const IconeGrafico = () => svg(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />)
const IconeMais = () =>
  svg(
    <>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </>,
  )
