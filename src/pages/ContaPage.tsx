import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useCompetencia } from '../hooks/useCompetencia.tsx'
import { useContas, useMembroAtual, useMembros } from '../hooks/useDados.ts'
import { useAlternarPago, useCategorias, useLancamentos } from '../hooks/useLancamentos.ts'
import { formatarCentavos, somar } from '../lib/dinheiro.ts'
import { hoje, nomeDaCompetencia } from '../lib/datas.ts'
import { agruparPorGrupo, calcularTotais, ordenarLancamentos } from '../lib/totais.ts'
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
  children,
}: {
  titulo: string
  subtotal?: number
  vazio: string
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
    </section>
  )
}

const categoriaDe = (categorias: Categoria[], id: string | null) => categorias.find((c) => c.id === id)

type Edicao =
  | { tipo: 'novo' }
  | { tipo: 'pessoal'; lancamento: Lancamento }
  | { tipo: 'compartilhado'; conta: Conta; grupo: Lancamento[] }

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
  const totalDoGrupo = (grupoId: string | null) =>
    grupoId ? somar(lancamentos.filter((l) => l.grupo_id === grupoId).map((l) => l.valor_centavos)) : 0

  const abrirParte = (l: Lancamento, c: Conta) => {
    const grupo = l.grupo_id ? lancamentos.filter((x) => x.grupo_id === l.grupo_id) : [l]
    setEdicao({ tipo: 'compartilhado', conta: c, grupo })
  }

  return (
    <div className="flex flex-col gap-4 pb-20">
      <Cabecalho conta={conta} subtitulo={`Conta pessoal de ${dono.nome}`} />
      <PainelTotais totais={totais} />

      <Secao
        titulo="Pessoal"
        subtotal={calcularTotais(pessoais).saidas}
        vazio="Nenhum gasto ou entrada neste mês."
      >
        {pessoais.map((l) => (
          <ItemLancamento
            key={l.id}
            lancamento={l}
            categoria={categoriaDe(categorias, l.categoria_id)}
            hoje={dataHoje}
            onAlternarPago={() => alternarPago.mutate({ id: l.id, pago: !l.pago })}
            onAbrir={() => setEdicao({ tipo: 'pessoal', lancamento: l })}
          />
        ))}
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
            {partes.map((l) => {
              const total = totalDoGrupo(l.grupo_id)
              return (
                <ItemLancamento
                  key={l.id}
                  lancamento={l}
                  categoria={categoriaDe(categorias, l.categoria_id)}
                  hoje={dataHoje}
                  selo={total > l.valor_centavos ? `parte de ${formatarCentavos(total)}` : undefined}
                  onAlternarPago={() => alternarPago.mutate({ id: l.id, pago: !l.pago })}
                  onAbrir={() => abrirParte(l, c)}
                />
              )
            })}
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
      {edicao?.tipo === 'compartilhado' && (
        <FormGastoCompartilhado
          aberto
          onFechar={() => setEdicao(null)}
          conta={edicao.conta}
          membros={membros}
          competencia={competencia}
          criadoPor={eu?.id}
          grupo={edicao.grupo}
        />
      )}
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
  const avulsos = agruparPorGrupo(ordenarLancamentos(daConta.filter((l) => l.origem === 'avulso')))
  const porMembro = membros.map((m) => ({
    membro: m,
    valor: calcularTotais(daConta.filter((l) => l.membro_id === m.id)).saidas,
  }))

  return (
    <div className="flex flex-col gap-4 pb-20">
      <Cabecalho conta={conta} subtitulo={`Dividida entre ${membros.map((m) => m.nome).join(' e ')}`} />
      <PainelTotaisCompartilhada total={totais.saidas} pendente={totais.pendente} porMembro={porMembro} />

      <Secao titulo="Contas do mês" vazio="Contas que se repetem todo mês (aluguel, luz...) chegam na etapa 5." />
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
            onAlternarPago={(l) => alternarPago.mutate({ id: l.id, pago: !l.pago })}
            onAbrir={() => setEdicao({ tipo: 'compartilhado', conta, grupo: g.linhas })}
          />
        ))}
      </Secao>

      <BotaoAdicionar texto={`Gasto em ${conta.nome}`} onClick={() => setEdicao({ tipo: 'novo' })} />

      {edicao && edicao.tipo !== 'pessoal' && (
        <FormGastoCompartilhado
          aberto
          onFechar={() => setEdicao(null)}
          conta={conta}
          membros={membros}
          competencia={competencia}
          criadoPor={eu?.id}
          grupo={edicao.tipo === 'compartilhado' ? edicao.grupo : undefined}
        />
      )}
    </div>
  )
}
