import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useCompetencia } from '../hooks/useCompetencia.tsx'
import { useContas, useMembroAtual, useMembros } from '../hooks/useDados.ts'
import { useAlternarPago, useCategorias, useLancamentos } from '../hooks/useLancamentos.ts'
import { formatarCentavos, somar } from '../lib/dinheiro.ts'
import { hoje, nomeDaCompetencia } from '../lib/datas.ts'
import { agruparPorGrupo, agruparPorRecorrente, calcularTotais, ordenarLancamentos } from '../lib/totais.ts'
import { Aviso, Bolinha, Carregando } from '../components/ui.tsx'
import {
  BotaoAdicionar,
  ItemGrupo,
  ItemLancamento,
  PainelTotais,
  PainelTotaisCompartilhada,
} from '../components/lancamentos.tsx'
import { FormLancamentoPessoal } from '../components/FormLancamentoPessoal.tsx'
import { FormGastoCompartilhado } from '../components/FormGastoCompartilhado.tsx'
import { FormRecorrente } from '../components/FormRecorrente.tsx'
import type { Categoria, Conta, Lancamento, Membro } from '../types/banco.ts'

/** Página de uma aba: pessoal (Lucas / Emillia) ou compartilhada (Casa...) */
export default function ContaPage() {
  const { id } = useParams()
  const { competencia } = useCompetencia()
  const contas = useContas()
  const membros = useMembros()
  const lancamentos = useLancamentos(competencia)
  const categorias = useCategorias()

  if (contas.isPending || membros.isPending || lancamentos.isPending) return <Carregando />
  if (lancamentos.isError) {
    return <Aviso titulo="Não foi possível carregar os lançamentos">{lancamentos.error.message}</Aviso>
  }

  const conta = contas.data?.find((c) => c.id === id)
  if (!conta) return <Aviso titulo="Conta não encontrada">Ela pode ter sido arquivada.</Aviso>

  const listaMembros = membros.data ?? []
  const dados = {
    conta,
    contas: contas.data ?? [],
    membros: listaMembros,
    lancamentos: lancamentos.data ?? [],
    categorias: categorias.data ?? [],
  }

  if (conta.tipo === 'pessoal') {
    const dono = listaMembros.find((m) => m.id === conta.dono_id)
    if (!dono) return <Aviso titulo="Esta conta está sem dono" />
    return <PaginaPessoal {...dados} dono={dono} />
  }
  return <PaginaCompartilhada {...dados} />
}

type Dados = {
  conta: Conta
  contas: Conta[]
  membros: Membro[]
  lancamentos: Lancamento[]
  categorias: Categoria[]
}

function Cabecalho({ conta, subtitulo }: { conta: Conta; subtitulo: string }) {
  const { competencia } = useCompetencia()
  return (
    <div>
      <h1 className="flex items-center gap-2 text-lg font-semibold">
        <Bolinha cor={conta.cor} className="size-3" />
        {conta.nome}
      </h1>
      <p className="text-sm text-stone-500">
        {subtitulo} · <span className="lowercase">{nomeDaCompetencia(competencia)}</span>
      </p>
    </div>
  )
}

function Secao({
  titulo,
  subtotal,
  vazio,
  acao,
  children,
}: {
  titulo: string
  subtotal?: number
  vazio: string
  acao?: { texto: string; onClick: () => void }
  children?: ReactNode
}) {
  const temConteudo = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <section className="rounded-2xl border border-stone-200 bg-white px-4 pt-4 pb-1 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">{titulo}</h2>
        {subtotal !== undefined && subtotal > 0 && (
          <span className="text-sm font-medium text-stone-500 tabular-nums">{formatarCentavos(subtotal)}</span>
        )}
      </div>
      {temConteudo ? (
        <ul className="divide-y divide-stone-100">{children}</ul>
      ) : (
        <p className="pt-3 pb-3 text-sm text-stone-500">{vazio}</p>
      )}
      {acao && (
        <button
          type="button"
          onClick={acao.onClick}
          className="mb-3 flex h-10 w-full items-center justify-center rounded-xl border border-dashed border-stone-300 text-sm font-semibold text-marca-700 hover:bg-marca-50"
        >
          + {acao.texto}
        </button>
      )}
    </section>
  )
}

const categoriaDe = (categorias: Categoria[], id: string | null) => categorias.find((c) => c.id === id)

/** Texto curto de origem para mostrar junto do lançamento */
function seloDe(l: Lancamento, totalDoGrupo: number): string | undefined {
  const partes: string[] = []
  if (l.origem === 'recorrente') partes.push(l.editado_manualmente ? 'fixa · valor do mês' : 'todo mês')
  if (totalDoGrupo > l.valor_centavos) partes.push(`parte de ${formatarCentavos(totalDoGrupo)}`)
  return partes.length ? partes.join(' · ') : undefined
}

type Edicao =
  | { tipo: 'novo' }
  | { tipo: 'pessoal'; lancamento: Lancamento }
  | { tipo: 'compartilhado'; conta: Conta; grupo: Lancamento[] }
  | { tipo: 'recorrente'; conta: Conta; recorrenteId?: string }

/** Abre o formulário certo para um lançamento, conforme a origem dele */
function edicaoPara(l: Lancamento, conta: Conta, todos: Lancamento[]): Edicao {
  if (l.origem === 'recorrente' && l.recorrente_id) return { tipo: 'recorrente', conta, recorrenteId: l.recorrente_id }
  if (conta.tipo === 'pessoal') return { tipo: 'pessoal', lancamento: l }
  const grupo = l.grupo_id ? todos.filter((x) => x.grupo_id === l.grupo_id) : [l]
  return { tipo: 'compartilhado', conta, grupo }
}

function Formularios({
  edicao,
  fechar,
  membros,
  criadoPor,
}: {
  edicao: Edicao | null
  fechar: () => void
  membros: Membro[]
  criadoPor: string | undefined
}) {
  const { competencia } = useCompetencia()
  if (!edicao) return null
  if (edicao.tipo === 'recorrente') {
    return (
      <FormRecorrente
        aberto
        onFechar={fechar}
        conta={edicao.conta}
        membros={membros}
        competencia={competencia}
        recorrenteId={edicao.recorrenteId}
      />
    )
  }
  if (edicao.tipo === 'compartilhado') {
    return (
      <FormGastoCompartilhado
        aberto
        onFechar={fechar}
        conta={edicao.conta}
        membros={membros}
        competencia={competencia}
        criadoPor={criadoPor}
        grupo={edicao.grupo}
      />
    )
  }
  return null
}

function PaginaPessoal({ conta, contas, membros, lancamentos, categorias, dono }: Dados & { dono: Membro }) {
  const { competencia } = useCompetencia()
  const { membro: eu } = useMembroAtual()
  const alternarPago = useAlternarPago(competencia)
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const dataHoje = hoje()

  const meus = lancamentos.filter((l) => l.membro_id === dono.id)
  const totais = calcularTotais(meus)
  const pessoais = ordenarLancamentos(meus.filter((l) => l.conta_id === conta.id))
  const compartilhadas = contas.filter((c) => c.tipo === 'compartilhada')
  const totalDoGrupo = (l: Lancamento) => {
    if (l.grupo_id) return somar(lancamentos.filter((x) => x.grupo_id === l.grupo_id).map((x) => x.valor_centavos))
    if (l.recorrente_id) {
      return somar(lancamentos.filter((x) => x.recorrente_id === l.recorrente_id).map((x) => x.valor_centavos))
    }
    return l.valor_centavos
  }

  const item = (l: Lancamento, c: Conta) => (
    <ItemLancamento
      key={l.id}
      lancamento={l}
      categoria={categoriaDe(categorias, l.categoria_id)}
      hoje={dataHoje}
      selo={seloDe(l, totalDoGrupo(l))}
      onAlternarPago={() => alternarPago.mutate({ id: l.id, pago: !l.pago })}
      onAbrir={() => setEdicao(edicaoPara(l, c, lancamentos))}
    />
  )

  return (
    <div className="flex flex-col gap-4 pb-20">
      <Cabecalho conta={conta} subtitulo={`Conta pessoal de ${dono.nome}`} />
      <PainelTotais totais={totais} />

      <Secao
        titulo="Pessoal"
        subtotal={calcularTotais(pessoais).saidas}
        vazio="Nenhum gasto ou entrada neste mês."
        acao={{ texto: 'Nova conta fixa', onClick: () => setEdicao({ tipo: 'recorrente', conta }) }}
      >
        {pessoais.map((l) => item(l, conta))}
      </Secao>

      {compartilhadas.map((c) => {
        const partes = ordenarLancamentos(meus.filter((l) => l.conta_id === c.id))
        return (
          <Secao
            key={c.id}
            titulo={`Parte em ${c.nome}`}
            subtotal={calcularTotais(partes).saidas}
            vazio={`Nada de ${c.nome} para ${dono.nome} neste mês.`}
          >
            {partes.map((l) => item(l, c))}
          </Secao>
        )
      })}

      <BotaoAdicionar texto="Gasto ou entrada" onClick={() => setEdicao({ tipo: 'novo' })} />

      <FormLancamentoPessoal
        aberto={edicao?.tipo === 'novo' || edicao?.tipo === 'pessoal'}
        onFechar={() => setEdicao(null)}
        conta={conta}
        dono={dono}
        competencia={competencia}
        criadoPor={eu?.id}
        lancamento={edicao?.tipo === 'pessoal' ? edicao.lancamento : undefined}
      />
      <Formularios edicao={edicao} fechar={() => setEdicao(null)} membros={membros} criadoPor={eu?.id} />
    </div>
  )
}

function PaginaCompartilhada({ conta, membros, lancamentos, categorias }: Dados) {
  const { competencia } = useCompetencia()
  const { membro: eu } = useMembroAtual()
  const alternarPago = useAlternarPago(competencia)
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const dataHoje = hoje()

  const daConta = lancamentos.filter((l) => l.conta_id === conta.id)
  const totais = calcularTotais(daConta)
  const fixas = agruparPorRecorrente(ordenarLancamentos(daConta.filter((l) => l.origem === 'recorrente')))
  const avulsos = agruparPorGrupo(ordenarLancamentos(daConta.filter((l) => l.origem === 'avulso')))
  const porMembro = membros.map((m) => ({
    membro: m,
    valor: calcularTotais(daConta.filter((l) => l.membro_id === m.id)).saidas,
  }))
  const pagar = (l: Lancamento) => alternarPago.mutate({ id: l.id, pago: !l.pago })

  return (
    <div className="flex flex-col gap-4 pb-20">
      <Cabecalho conta={conta} subtitulo={`Dividida entre ${membros.map((m) => m.nome).join(' e ')}`} />
      <PainelTotaisCompartilhada total={totais.saidas} pendente={totais.pendente} porMembro={porMembro} />

      <Secao
        titulo="Contas fixas"
        subtotal={somar(fixas.map((g) => g.total))}
        vazio="Nenhuma conta fixa neste mês. Cadastre aluguel, luz, internet..."
        acao={{ texto: 'Nova conta fixa', onClick: () => setEdicao({ tipo: 'recorrente', conta }) }}
      >
        {fixas.map((g) => (
          <ItemGrupo
            key={g.chave}
            linhas={g.linhas}
            total={g.total}
            membros={membros}
            categoria={categoriaDe(categorias, g.linhas[0].categoria_id)}
            hoje={dataHoje}
            selo={g.linhas.some((l) => l.editado_manualmente) ? 'valor só deste mês' : 'todo mês'}
            onAlternarPago={pagar}
            onAbrir={() => setEdicao({ tipo: 'recorrente', conta, recorrenteId: g.linhas[0].recorrente_id ?? undefined })}
          />
        ))}
      </Secao>

      <Secao titulo="Compras parceladas" vazio="Compras parceladas (ex.: geladeira em 12x) chegam na etapa 6." />

      <Secao
        titulo="Gastos avulsos"
        subtotal={somar(avulsos.map((g) => g.total))}
        vazio="Nenhum gasto avulso neste mês."
      >
        {avulsos.map((g) => (
          <ItemGrupo
            key={g.chave}
            linhas={g.linhas}
            total={g.total}
            membros={membros}
            categoria={categoriaDe(categorias, g.linhas[0].categoria_id)}
            hoje={dataHoje}
            onAlternarPago={pagar}
            onAbrir={() => setEdicao({ tipo: 'compartilhado', conta, grupo: g.linhas })}
          />
        ))}
      </Secao>

      <BotaoAdicionar texto={`Gasto em ${conta.nome}`} onClick={() => setEdicao({ tipo: 'novo' })} />

      {edicao?.tipo === 'novo' && (
        <FormGastoCompartilhado
          aberto
          onFechar={() => setEdicao(null)}
          conta={conta}
          membros={membros}
          competencia={competencia}
          criadoPor={eu?.id}
        />
      )}
      <Formularios edicao={edicao} fechar={() => setEdicao(null)} membros={membros} criadoPor={eu?.id} />
    </div>
  )
}
