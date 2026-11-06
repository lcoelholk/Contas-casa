import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useMatch } from 'react-router-dom'
import { useMembroAtual, useTodasContas } from '../hooks/useDados.ts'
import { useTempoReal } from '../hooks/useTempoReal.ts'
import { useArrastarMes } from '../hooks/useArrastarMes.ts'
import { PessoaProvider } from '../hooks/usePessoa.tsx'
import { NovoLancamentoContexto } from '../hooks/useNovoLancamento.tsx'
import { abasDoMembro } from '../lib/contas.ts'
import { SeletorMes } from './SeletorMes.tsx'
import { NovoLancamento, type TipoNovo } from './NovoLancamento.tsx'
import { Bolinha } from './ui.tsx'
import type { Conta } from '../types/banco.ts'

export function Layout() {
  const { membro } = useMembroAtual()
  const contas = useTodasContas()
  const [novo, setNovo] = useState<{ tipo?: TipoNovo } | null>(null)
  useTempoReal(Boolean(membro))
  const arrastar = useArrastarMes()

  const abas = abasDoMembro(contas.data ?? [], membro?.id)
  // O + já sabe onde você está: dentro de uma aba começa nela; em Contas fixas, em "todo mês"
  const naConta = useMatch('/conta/:id')?.params.id
  const contaAberta = (contas.data ?? []).find((c) => c.id === naConta && !c.arquivada)
  const emFixas = useMatch('/fixas') !== null
  const ordemParaLancar = [...abas.minhas, ...abas.compartilhadas, ...abas.dosOutros]

  return (
    <PessoaProvider>
      <NovoLancamentoContexto.Provider value={(tipo) => setNovo({ tipo })}>
        <div className="flex min-h-dvh flex-col">
          <header className="sticky top-0 z-10 bg-fundo/90 pt-[env(safe-area-inset-top)] backdrop-blur">
            <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-2 px-2">
              <SeletorMes />
              {membro && (
                <span className="flex shrink-0 items-center gap-1.5 pr-2 text-sm text-stone-600">
                  <Bolinha cor={membro.cor} />
                  {membro.nome}
                </span>
              )}
            </div>
          </header>

          <main {...arrastar} className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 pb-[calc(7rem+env(safe-area-inset-bottom))]">
            <Outlet />
          </main>

          <BarraDeBaixo
            casa={abas.compartilhadas[0]}
            onNovo={() => setNovo({ tipo: emFixas ? 'fixa' : undefined })}
          />

          <NovoLancamento
            aberto={novo !== null}
            onFechar={() => setNovo(null)}
            contas={ordemParaLancar}
            tipo={novo?.tipo}
            contaInicial={contaAberta}
          />
        </div>
      </NovoLancamentoContexto.Provider>
    </PessoaProvider>
  )
}

function BarraDeBaixo({ casa, onNovo }: { casa?: Conta; onNovo: () => void }) {
  const { pathname } = useLocation()
  const paraCasa = casa ? `/conta/${casa.id}` : '/mais'
  const emCasa = Boolean(casa) && pathname === paraCasa
  const emAnalises = pathname.startsWith('/graficos') || pathname.startsWith('/metas')
  const emMais =
    !emCasa && ['/mais', '/transacoes', '/fixas', '/configuracoes', '/atalho', '/importar', '/conta/'].some((p) => pathname.startsWith(p))

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-100 bg-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto grid h-16 max-w-3xl grid-cols-5 items-center px-2">
        <ItemBarra para="/" fim rotulo="Início" icone={<IconeCasa />} />
        <ItemBarra para={paraCasa} rotulo={casa?.nome ?? 'Casa'} icone={<IconeSofa />} ativo={emCasa} />
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onNovo}
            aria-label="Novo lançamento"
            className="-mt-6 flex size-14 items-center justify-center rounded-full bg-destaque text-3xl leading-none text-white shadow-lg ring-4 ring-superficie active:scale-95"
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
        `flex flex-col items-center gap-0.5 py-1 text-xs font-medium ${
          (ativo ?? isActive) ? 'text-marca-700' : 'text-stone-500'
        }`
      }
    >
      <span aria-hidden className="size-6">
        {icone}
      </span>
      <span className="max-w-full truncate px-1">{rotulo}</span>
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
const IconeSofa = () =>
  svg(<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM6 18v2M18 18v2" />)
const IconeGrafico = () => svg(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />)
const IconeMais = () =>
  svg(
    <>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </>,
  )
