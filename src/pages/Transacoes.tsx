import { useState, type ReactNode } from 'react'
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
import { NovoLancamento } from '../components/NovoLancamento.tsx'
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

/** Todas as transações do período, com busca e filtros */
export default function Transacoes() {
  const { competencia } = useCompetencia()
  const contas = useTodasContas()
  const membros = useMembros()
  const categorias = useCategorias()
  const [meses, setMeses] = useState(1)
  const [filtro, setFiltro] = useState(FILTRO_INICIAL)
  const [mostrando, setMostrando] = useState(POR_PAGINA)
  const [nova, setNova] = useState(false)

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
  const filtradas = filtrarTransacoes(dados.data ?? [], filtro)
  const t = calcularTotais(filtradas)
  const algumFiltro = JSON.stringify(filtro) !== JSON.stringify({ ...FILTRO_INICIAL, ordem: filtro.ordem })

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

      <div className="grid grid-cols-2 gap-2">
        <Seletor rotulo="Período" valor={String(meses)} onChange={(v) => setMeses(Number(v))}>
          <option value="1">Mês do seletor</option>
          <option value="3">Últimos 3 meses</option>
          <option value="6">Últimos 6 meses</option>
          <option value="12">Últimos 12 meses</option>
        </Seletor>
        <Seletor rotulo="Ordem" valor={filtro.ordem} onChange={(v) => mudar({ ordem: v as FiltroTransacoes['ordem'] })}>
          <option value="recentes">Mais recentes</option>
          <option value="antigas">Mais antigas</option>
          <option value="maior">Maior valor</option>
          <option value="menor">Menor valor</option>
        </Seletor>
        <Seletor rotulo="Pessoa" valor={filtro.membroId ?? ''} onChange={(v) => mudar({ membroId: v || null })}>
          <option value="">Os dois</option>
          {listaMembros.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </Seletor>
        <Seletor rotulo="Conta" valor={filtro.contaId ?? ''} onChange={(v) => mudar({ contaId: v || null })}>
          <option value="">Todas as contas</option>
          {listaContas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
              {c.arquivada ? ' (arquivada)' : ''}
            </option>
          ))}
        </Seletor>
        <Seletor rotulo="Tipo" valor={filtro.tipo} onChange={(v) => mudar({ tipo: v as FiltroTransacoes['tipo'] })}>
          <option value="todos">Todos os tipos</option>
          <option value="saida">Só gastos</option>
          <option value="entrada">Só entradas</option>
        </Seletor>
        <Seletor
          rotulo="Situação"
          valor={filtro.status}
          onChange={(v) => mudar({ status: v as FiltroTransacoes['status'] })}
        >
          <option value="todos">Pagos ou não</option>
          <option value="pago">Só pagos</option>
          <option value="pendente">Só pendentes</option>
        </Seletor>
        <div className="col-span-2">
          <Seletor
            rotulo="Categoria"
            valor={filtro.categoriaId ?? ''}
            onChange={(v) => mudar({ categoriaId: v || null })}
          >
            <option value="">Todas as categorias</option>
            <option value="sem">Sem categoria</option>
            {listaCategorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icone ? `${c.icone} ` : ''}
                {c.nome} ({c.tipo === 'saida' ? 'gasto' : 'entrada'})
              </option>
            ))}
          </Seletor>
        </div>
      </div>

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
          {algumFiltro && (
            <button
              type="button"
              onClick={() => mudar({ ...FILTRO_INICIAL, ordem: filtro.ordem })}
              className="shrink-0 rounded-xl px-3 text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              Limpar
            </button>
          )}
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

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-3xl justify-end px-4">
          <button
            onClick={() => setNova(true)}
            className="pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-marca-600 px-5 font-semibold text-white shadow-lg active:scale-[0.98]"
          >
            <span aria-hidden className="text-xl leading-none">
              +
            </span>
            Nova transação
          </button>
        </div>
      </div>
      <NovoLancamento aberto={nova} onFechar={() => setNova(false)} contas={listaContas.filter((c) => !c.arquivada)} />
    </div>
  )
}

function Seletor({
  rotulo,
  valor,
  onChange,
  children,
}: {
  rotulo: string
  valor: string
  onChange: (v: string) => void
  children: ReactNode
}) {
  return (
    <select
      aria-label={rotulo}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className={`${classeInput} h-11 text-sm`}
    >
      {children}
    </select>
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
