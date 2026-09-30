import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCompetencia } from '../hooks/useCompetencia.tsx'
import { useContas, useMembros } from '../hooks/useDados.ts'
import { useAlertas, useCategorias, useLancamentos, useMarcarPago } from '../hooks/useLancamentos.ts'
import { formatarDiaMes, hoje, nomeDaCompetencia } from '../lib/datas.ts'
import { formatarCentavos } from '../lib/dinheiro.ts'
import { calcularTotais } from '../lib/totais.ts'
import { gastosPorCategoria, separarAlertas } from '../lib/resumo.ts'
import { Aviso, Bolinha, Carregando } from '../components/ui.tsx'
import { CheckPago } from '../components/lancamentos.tsx'
import { Segmentado } from '../components/campos.tsx'
import type { Conta, Lancamento, Membro } from '../types/banco.ts'

export default function Resumo() {
  const { competencia } = useCompetencia()
  const membros = useMembros()
  const contas = useContas()
  const lancamentos = useLancamentos(competencia)
  const categorias = useCategorias()

  if (membros.isPending || contas.isPending || lancamentos.isPending) return <Carregando />
  if (lancamentos.isError) {
    return <Aviso titulo="Não foi possível carregar os lançamentos">{lancamentos.error.message}</Aviso>
  }

  const todos = lancamentos.data ?? []
  const listaMembros = membros.data ?? []
  const listaContas = contas.data ?? []
  const compartilhadas = listaContas.filter((c) => c.tipo === 'compartilhada')
  const pessoalDe = (membroId: string) => listaContas.find((c) => c.tipo === 'pessoal' && c.dono_id === membroId)

  return (
    <div className="flex flex-col gap-4">
      <Alertas membros={listaMembros} contas={listaContas} />

      <h1 className="mt-2 text-lg font-semibold">
        Resumo de <span className="lowercase">{nomeDaCompetencia(competencia)}</span>
      </h1>

      <div className="grid gap-3 sm:grid-cols-2">
        {listaMembros.map((m) => {
          const conta = pessoalDe(m.id)
          const t = calcularTotais(todos.filter((l) => l.membro_id === m.id))
          return (
            <Card key={m.id} titulo={m.nome} cor={m.cor} para={conta ? `/conta/${conta.id}` : undefined}>
              {t.saidas === 0 && t.entradas === 0 ? (
                <Vazio />
              ) : (
                <>
                  <Linha rotulo="A pagar no mês" valor={t.saidas} forte />
                  <Linha rotulo="Pago" valor={t.pago} />
                  <Linha rotulo="Pendente" valor={t.pendente} destaque={t.pendente > 0 ? 'text-amber-700' : ''} />
                  <div className="my-1 border-t border-stone-100" />
                  <Linha rotulo="Entradas" valor={t.entradas} />
                  <Linha rotulo="Saldo" valor={t.saldo} forte destaque={t.saldo < 0 ? 'text-red-700' : ''} />
                </>
              )}
            </Card>
          )
        })}

        {compartilhadas.map((c) => {
          const daConta = todos.filter((l) => l.conta_id === c.id)
          const t = calcularTotais(daConta)
          return (
            <Card key={c.id} titulo={c.nome} cor={c.cor} para={`/conta/${c.id}`}>
              {t.saidas === 0 ? (
                <Vazio />
              ) : (
                <>
                  <Linha rotulo="Total do mês" valor={t.saidas} forte />
                  <Linha rotulo="Pendente" valor={t.pendente} destaque={t.pendente > 0 ? 'text-amber-700' : ''} />
                  <div className="my-1 border-t border-stone-100" />
                  {listaMembros.map((m) => (
                    <Linha
                      key={m.id}
                      rotulo={`Parte de ${m.nome}`}
                      valor={calcularTotais(daConta.filter((l) => l.membro_id === m.id)).saidas}
                    />
                  ))}
                </>
              )}
            </Card>
          )
        })}
      </div>

      <GastosPorCategoria lancamentos={todos} membros={listaMembros} categorias={categorias.data ?? []} />
    </div>
  )
}

/** Atrasados e o que vence nos próximos 7 dias (a partir de hoje, de qualquer mês) */
function Alertas({ membros, contas }: { membros: Membro[]; contas: Conta[] }) {
  const alertas = useAlertas()
  const marcarPago = useMarcarPago()
  const { irPara } = useCompetencia()
  const navigate = useNavigate()
  const dataHoje = hoje()

  if (alertas.isPending) return null
  if (alertas.isError) return <Aviso titulo="Não foi possível carregar os vencimentos">{alertas.error.message}</Aviso>

  const { atrasados, proximos } = separarAlertas(alertas.data ?? [], dataHoje)
  const abrir = (l: Lancamento) => {
    irPara(l.competencia)
    navigate(`/conta/${l.conta_id}`)
  }
  const item = (l: Lancamento, atrasado: boolean) => {
    const membro = membros.find((m) => m.id === l.membro_id)
    const conta = contas.find((c) => c.id === l.conta_id)
    const dias = l.vencimento === dataHoje ? 'vence hoje' : `${atrasado ? 'venceu' : 'vence'} ${formatarDiaMes(l.vencimento!)}`
    return (
      <li key={l.id} className="flex items-center gap-3 py-2.5">
        <CheckPago
          pago={false}
          onClick={() => marcarPago.mutate({ id: l.id, pago: true })}
          rotulo={`${l.descricao} de ${membro?.nome ?? ''}: marcar como pago`}
        />
        <button type="button" onClick={() => abrir(l)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">{l.descricao}</span>
            <span className="text-xs text-stone-500">
              <Bolinha cor={membro?.cor ?? null} className="mr-1 size-2 align-middle" />
              {membro?.nome}
              {conta && conta.tipo === 'compartilhada' ? ` · ${conta.nome}` : ''}
              {' · '}
              <span className={atrasado ? 'font-medium text-red-700' : l.vencimento === dataHoje ? 'font-medium text-amber-700' : ''}>
                {dias}
              </span>
            </span>
          </span>
          <span className="shrink-0 font-semibold tabular-nums">{formatarCentavos(l.valor_centavos)}</span>
        </button>
      </li>
    )
  }

  if (atrasados.length === 0 && proximos.length === 0) {
    return (
      <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <span aria-hidden>✓ </span>Nada atrasado nem vencendo nos próximos 7 dias.
      </p>
    )
  }

  return (
    <>
      {atrasados.length > 0 && (
        <Bloco titulo={`Atrasados (${atrasados.length})`} tom="vermelho">
          {atrasados.map((l) => item(l, true))}
        </Bloco>
      )}
      {proximos.length > 0 && (
        <Bloco titulo="Vence nos próximos 7 dias" tom="neutro">
          {proximos.map((l) => item(l, false))}
        </Bloco>
      )}
    </>
  )
}

function Bloco({ titulo, tom, children }: { titulo: string; tom: 'vermelho' | 'neutro'; children: ReactNode }) {
  return (
    <section
      aria-label={titulo}
      className={`rounded-2xl border px-4 pt-3 pb-1 shadow-sm ${
        tom === 'vermelho' ? 'border-red-200 bg-red-50/60' : 'border-stone-200 bg-white'
      }`}
    >
      <h2
        className={`text-sm font-semibold tracking-wide uppercase ${tom === 'vermelho' ? 'text-red-800' : 'text-stone-500'}`}
      >
        {titulo}
      </h2>
      <ul className="divide-y divide-stone-100">{children}</ul>
    </section>
  )
}

/** Barras horizontais: quanto foi gasto em cada categoria no mês */
function GastosPorCategoria({
  lancamentos,
  membros,
  categorias,
}: {
  lancamentos: Lancamento[]
  membros: Membro[]
  categorias: { id: string; nome: string; icone: string | null }[]
}) {
  const [filtro, setFiltro] = useState('todos')
  const filtrados = filtro === 'todos' ? lancamentos : lancamentos.filter((l) => l.membro_id === filtro)
  const linhas = gastosPorCategoria(filtrados, categorias)
  const maior = linhas[0]?.total ?? 0

  return (
    <section aria-label="Gastos por categoria" className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">Gastos por categoria</h2>
      <div className="mt-3">
        <Segmentado
          rotulo="Filtrar por pessoa"
          valor={filtro}
          onChange={setFiltro}
          opcoes={[{ valor: 'todos', texto: 'Todos' }, ...membros.map((m) => ({ valor: m.id, texto: m.nome }))]}
        />
      </div>
      {linhas.length === 0 ? (
        <p className="mt-3 text-sm text-stone-500">Nenhum gasto neste mês.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {linhas.map((c) => (
            <li key={c.chave}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate">
                  {c.icone ? `${c.icone} ` : ''}
                  {c.nome}
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold">{formatarCentavos(c.total)}</span>
                  <span className="ml-1.5 text-xs text-stone-500">{c.percentual}%</span>
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-stone-100" aria-hidden>
                <div
                  className="h-full rounded-full bg-marca-600"
                  style={{ width: `${maior > 0 ? Math.max(2, (c.total / maior) * 100) : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Vazio() {
  return <p className="text-sm text-stone-500">Nenhum lançamento neste mês.</p>
}

function Linha({
  rotulo,
  valor,
  destaque = '',
  forte,
}: {
  rotulo: string
  valor: number
  destaque?: string
  forte?: boolean
}) {
  return (
    <div className={`flex items-baseline justify-between text-sm ${forte ? '' : 'text-stone-600'}`}>
      <span>{rotulo}</span>
      <span className={`tabular-nums ${forte ? 'font-semibold' : ''} ${destaque}`}>{formatarCentavos(valor)}</span>
    </div>
  )
}

function Card({
  titulo,
  cor,
  para,
  children,
}: {
  titulo: string
  cor: string | null
  para?: string
  children: ReactNode
}) {
  const conteudo = (
    <>
      <div className="mb-3 flex items-center gap-2">
        <Bolinha cor={cor} />
        <span className="font-semibold">{titulo}</span>
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </>
  )
  const classe =
    'block rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition-colors hover:border-stone-300'
  return para ? (
    <Link to={para} className={classe} aria-label={`Resumo de ${titulo}`}>
      {conteudo}
    </Link>
  ) : (
    <div className={classe}>{conteudo}</div>
  )
}
