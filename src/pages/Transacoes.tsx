import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCompetencia } from '../hooks/useCompetencia.tsx'
import { useMembros, useTodasContas } from '../hooks/useDados.ts'
import { useCategorias, useMarcarPago } from '../hooks/useLancamentos.ts'
import { useLancamentosPeriodo } from '../hooks/useAnalises.ts'
import { dataDoLancamento, filtrarTransacoes, type FiltroTransacoes } from '../lib/visaoGeral.ts'
import { calcularTotais } from '../lib/totais.ts'
import { formatarCentavos } from '../lib/dinheiro.ts'
import { formatarData, nomeCurtoDoMes, nomeDaCompetencia, somarMeses } from '../lib/datas.ts'
import { Aviso, Bolinha, Carregando } from '../components/ui.tsx'
import { CheckPago } from '../components/lancamentos.tsx'
import { classeInput } from '../components/campos.tsx'
import { BarraFiltros, EscolhaFiltro, type FiltroAtivo } from '../components/Filtros.tsx'
import { usePessoa } from '../hooks/usePessoa.tsx'
import type { Conta, Lancamento } from '../types/banco.ts'

const POR_PAGINA = 20

const FILTRO_INICIAL: FiltroTransacoes = {
  busca: '',
  contaId: null,
  membroId: null,
  tipo: 'todos',
  categoriaId: null,
  status: 'todos',
  ordem: 'recentes',
}

const PERIODOS = [
  { valor: '1', texto: 'Mês do seletor' },
  { valor: '3', texto: 'Últimos 3 meses' },
  { valor: '6', texto: 'Últimos 6 meses' },
  { valor: '12', texto: 'Últimos 12 meses' },
]
const ORDENS = [
  { valor: 'recentes', texto: 'Mais recentes' },
  { valor: 'antigas', texto: 'Mais antigas' },
  { valor: 'maior', texto: 'Maior valor' },
  { valor: 'menor', texto: 'Menor valor' },
]
const TIPOS: { valor: FiltroTransacoes['tipo']; texto: string }[] = [
  { valor: 'todos', texto: 'Gastos e entradas' },
  { valor: 'saida', texto: 'Só gastos' },
  { valor: 'entrada', texto: 'Só entradas' },
]
const SITUACOES: { valor: FiltroTransacoes['status']; texto: string }[] = [
  { valor: 'todos', texto: 'Pagos e pendentes' },
  { valor: 'pago', texto: 'Só pagos' },
  { valor: 'pendente', texto: 'Só pendentes' },
]

/** Todas as transações do período, com busca e filtros */
export default function Transacoes() {
  const { competencia } = useCompetencia()
  const contas = useTodasContas()
  const membros = useMembros()
  const categorias = useCategorias()
  const [meses, setMeses] = useState(1)
  const [filtro, setFiltro] = useState(FILTRO_INICIAL)
  const [mostrando, setMostrando] = useState(POR_PAGINA)
  const { pessoa, setPessoa } = usePessoa()

  const de = somarMeses(competencia, -(meses - 1))
  const dados = useLancamentosPeriodo(de, competencia)

  const mudar = (parcial: Partial<FiltroTransacoes>) => {
    setFiltro((f) => ({ ...f, ...parcial }))
    setMostrando(POR_PAGINA)
  }

  if (dados.isPending || contas.isPending || membros.isPending) return <Carregando />
  if (dados.isError) return <Aviso titulo="Não foi possível carregar as transações">{dados.error.message}</Aviso>

  const listaContas = contas.data ?? []
  const listaMembros = membros.data ?? []
  const listaCategorias = categorias.data ?? []
  const filtradas = filtrarTransacoes(dados.data ?? [], { ...filtro, membroId: pessoa === 'todos' ? null : pessoa })
  const t = calcularTotais(filtradas)
  const limparTudo = () => {
    mudar({ ...FILTRO_INICIAL, busca: filtro.busca, ordem: filtro.ordem })
    setMeses(1)
    setPessoa('todos')
  }
  const texto = <T extends string>(opcoes: { valor: T; texto: string }[], v: T) => opcoes.find((o) => o.valor === v)?.texto ?? ''
  const ativos: FiltroAtivo[] = [
    meses !== 1 && { chave: 'periodo', texto: texto(PERIODOS, String(meses)), onRemover: () => setMeses(1) },
    pessoa !== 'todos' && {
      chave: 'pessoa',
      texto: listaMembros.find((m) => m.id === pessoa)?.nome ?? 'Pessoa',
      onRemover: () => setPessoa('todos'),
    },
    filtro.contaId && {
      chave: 'conta',
      texto: listaContas.find((c) => c.id === filtro.contaId)?.nome ?? 'Conta',
      onRemover: () => mudar({ contaId: null }),
    },
    filtro.tipo !== 'todos' && { chave: 'tipo', texto: texto(TIPOS, filtro.tipo), onRemover: () => mudar({ tipo: 'todos' }) },
    filtro.status !== 'todos' && {
      chave: 'status',
      texto: texto(SITUACOES, filtro.status),
      onRemover: () => mudar({ status: 'todos' }),
    },
    filtro.categoriaId && {
      chave: 'categoria',
      texto:
        filtro.categoriaId === 'sem'
          ? 'Sem categoria'
          : (listaCategorias.find((c) => c.id === filtro.categoriaId)?.nome ?? 'Categoria'),
      onRemover: () => mudar({ categoriaId: null }),
    },
  ].filter((f): f is FiltroAtivo => Boolean(f))

  return (
    <div className="flex flex-col gap-4 pb-20">
      <div>
        <h1 className="text-lg font-semibold">Transações</h1>
        <p className="text-sm text-stone-500">
          {meses === 1 ? (
            <span className="lowercase">{nomeDaCompetencia(competencia)}</span>
          ) : (
            `${nomeCurtoDoMes(de, true)} a ${nomeCurtoDoMes(competencia, true)}`
          )}
        </p>
      </div>

      <BarraFiltros
        ativos={ativos}
        onLimpar={limparTudo}
        ordenar={{
          valor: filtro.ordem,
          onChange: (v) => mudar({ ordem: v as FiltroTransacoes['ordem'] }),
          opcoes: ORDENS,
        }}
        painel={
          <>
            <EscolhaFiltro
              rotulo="Período"
              valor={String(meses)}
              onChange={(v) => setMeses(Number(v))}
              opcoes={PERIODOS}
            />
            <EscolhaFiltro
              rotulo="Pessoa"
              valor={pessoa}
              onChange={(v) => {
                setPessoa(v)
                setMostrando(POR_PAGINA)
              }}
              opcoes={[{ valor: 'todos', texto: 'Os dois' }, ...listaMembros.map((m) => ({ valor: m.id, texto: m.nome }))]}
            />
            <EscolhaFiltro
              rotulo="Conta"
              valor={filtro.contaId ?? ''}
              onChange={(v) => mudar({ contaId: v || null })}
              opcoes={[
                { valor: '', texto: 'Todas' },
                ...listaContas.map((c) => ({ valor: c.id, texto: c.nome + (c.arquivada ? ' (arquivada)' : '') })),
              ]}
            />
            <EscolhaFiltro
              rotulo="Tipo"
              valor={filtro.tipo}
              onChange={(v) => mudar({ tipo: v })}
              opcoes={TIPOS}
            />
            <EscolhaFiltro
              rotulo="Situação"
              valor={filtro.status}
              onChange={(v) => mudar({ status: v })}
              opcoes={SITUACOES}
            />
            <EscolhaFiltro
              rotulo="Categoria"
              valor={filtro.categoriaId ?? ''}
              onChange={(v) => mudar({ categoriaId: v || null })}
              opcoes={[
                { valor: '', texto: 'Todas' },
                { valor: 'sem', texto: 'Sem categoria' },
                ...listaCategorias
                  .filter((c) => !c.arquivada || c.id === filtro.categoriaId)
                  .map((c) => ({ valor: c.id, texto: `${c.icone ? `${c.icone} ` : ''}${c.nome}` })),
              ]}
            />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2">
        <Numero rotulo="Transações" valor={String(filtradas.length)} icone="#" />
        <Numero rotulo="Gastos" valor={formatarCentavos(t.saidas)} icone="↘" tom="text-red-700" />
        <Numero rotulo="Entradas" valor={formatarCentavos(t.entradas)} icone="↗" tom="text-emerald-700" />
        <Numero
          rotulo="Saldo"
          valor={formatarCentavos(t.saldo)}
          icone="="
          tom={t.saldo < 0 ? 'text-red-700' : 'text-emerald-700'}
        />
      </div>

      <section aria-label="Lista de transações" className="rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="flex gap-2 border-b border-stone-100 p-3">
          <input
            type="search"
            value={filtro.busca}
            onChange={(e) => mudar({ busca: e.target.value })}
            placeholder="Buscar transações…"
            aria-label="Buscar transações"
            className={`${classeInput} h-11`}
          />
        </div>
        {filtradas.length === 0 ? (
          <p className="p-4 text-sm text-stone-500">Nenhuma transação encontrada.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {filtradas.slice(0, mostrando).map((l) => (
              <LinhaTransacao
                key={l.id}
                lancamento={l}
                conta={listaContas.find((c) => c.id === l.conta_id)}
                categoria={listaCategorias.find((c) => c.id === l.categoria_id)}
                membro={listaMembros.find((m) => m.id === l.membro_id)}
              />
            ))}
          </ul>
        )}
        <div className="flex items-center justify-between gap-2 border-t border-stone-100 p-3 text-sm text-stone-500">
          <span>
            Mostrando {Math.min(mostrando, filtradas.length)} de {filtradas.length}
          </span>
          {mostrando < filtradas.length && (
            <button
              type="button"
              onClick={() => setMostrando((n) => n + POR_PAGINA)}
              className="rounded-xl px-3 py-2 font-semibold text-marca-700 hover:bg-marca-50"
            >
              Mostrar mais
            </button>
          )}
        </div>
      </section>

    </div>
  )
}

function Numero({ rotulo, valor, icone, tom }: { rotulo: string; valor: string; icone: string; tom?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
      <span aria-hidden className={`w-4 text-center text-lg ${tom ?? 'text-stone-500'}`}>
        {icone}
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-stone-500">{rotulo}</span>
        <span className={`block text-[15px] font-semibold tracking-tight break-words ${tom ?? ''}`}>{valor}</span>
      </span>
    </div>
  )
}

function LinhaTransacao({
  lancamento: l,
  conta,
  categoria,
  membro,
}: {
  lancamento: Lancamento
  conta?: Conta
  categoria?: { nome: string; icone: string | null }
  membro?: { nome: string; cor: string | null }
}) {
  const marcarPago = useMarcarPago()
  const { irPara } = useCompetencia()
  const navigate = useNavigate()
  const entrada = l.tipo === 'entrada'

  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <CheckPago
        pago={l.pago}
        onClick={() => marcarPago.mutate({ id: l.id, pago: !l.pago })}
        rotulo={`${l.descricao}: ${l.pago ? 'desmarcar pago' : 'marcar como pago'}`}
      />
      <button
        type="button"
        onClick={() => {
          irPara(l.competencia)
          navigate(`/conta/${l.conta_id}`)
        }}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={`truncate text-sm font-medium ${l.pago ? 'text-stone-500' : ''}`}>{l.descricao}</span>
          <span className="flex flex-wrap items-center gap-1 text-[11px]">
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-700">
              {categoria ? `${categoria.icone ?? ''} ${categoria.nome}` : 'Sem categoria'}
            </span>
            {conta && (
              <span className="flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-stone-700">
                <Bolinha cor={conta.cor} className="size-2" />
                {conta.nome}
              </span>
            )}
            {conta?.tipo === 'compartilhada' && membro && (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-700">parte de {membro.nome}</span>
            )}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className={`text-sm font-semibold tabular-nums ${entrada ? 'text-emerald-700' : ''}`}>
            {entrada ? '+' : ''}
            {formatarCentavos(l.valor_centavos)}
          </span>
          <span className="text-xs text-stone-500 tabular-nums">{formatarData(dataDoLancamento(l))}</span>
        </span>
      </button>
    </li>
  )
}
