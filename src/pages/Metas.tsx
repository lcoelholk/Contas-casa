import { useState, type FormEvent, type ReactNode } from 'react'
import { useCompetencia } from '../hooks/useCompetencia.tsx'
import { useMembroAtual, useMembros } from '../hooks/useDados.ts'
import { useCategorias, useLancamentos } from '../hooks/useLancamentos.ts'
import {
  useArquivarMeta,
  useExcluirAporte,
  useExcluirMeta,
  useExcluirOrcamento,
  useMetas,
  useNovoAporte,
  useOrcamentos,
  useSalvarMeta,
  useSalvarOrcamento,
} from '../hooks/useAnalises.ts'
import { mensagemDeErro } from '../hooks/useConfiguracoes.ts'
import { progressoMeta, situacoesDoMes, type StatusOrcamento } from '../lib/analises.ts'
import { centavosParaCampo, formatarCentavos, paraCentavos } from '../lib/dinheiro.ts'
import {
  competenciaAtual,
  competenciaDe,
  formatarDiaMes,
  hoje,
  nomeCurtoDoMes,
  nomeDaCompetencia,
} from '../lib/datas.ts'
import { CORES } from '../lib/contas.ts'
import { Aviso, Bolinha, Carregando } from '../components/ui.tsx'
import { Folha } from '../components/Folha.tsx'
import { Medidor } from '../components/graficos.tsx'
import { AbasAnalises } from '../components/AbasAnalises.tsx'
import {
  BotoesFormulario,
  Campo,
  CampoValor,
  ErroFormulario,
  Segmentado,
  SeletorCor,
  classeInput,
} from '../components/campos.tsx'
import type { Categoria, Membro, Meta, MetaAporte, Orcamento } from '../types/banco.ts'

export default function Metas() {
  const membros = useMembros()
  const categorias = useCategorias()
  if (membros.isPending || categorias.isPending) return <Carregando />
  return (
    <div className="flex flex-col gap-4 pb-6">
      <AbasAnalises />
      <h1 className="text-lg font-semibold">Metas e limites</h1>
      <MetasDeEconomia membros={membros.data ?? []} />
      <Orcamentos membros={membros.data ?? []} categorias={categorias.data ?? []} />
    </div>
  )
}

function Bloco({
  titulo,
  subtitulo,
  children,
  acao,
}: {
  titulo: string
  subtitulo?: ReactNode
  children: ReactNode
  acao?: { texto: string; onClick: () => void }
}) {
  return (
    <section aria-label={titulo} className="rounded-2xl border border-stone-200 bg-superficie p-4 shadow-sm">
      <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">{titulo}</h2>
      {subtitulo && <p className="mt-0.5 text-xs text-stone-500">{subtitulo}</p>}
      <div className="mt-3">{children}</div>
      {acao && (
        <button
          type="button"
          onClick={acao.onClick}
          className="mt-3 flex h-10 w-full items-center justify-center rounded-xl border border-dashed border-stone-300 text-sm font-semibold text-marca-700 hover:bg-marca-50"
        >
          + {acao.texto}
        </button>
      )}
    </section>
  )
}

const deQuem = (membros: Membro[], id: string | null) =>
  id === null ? 'Os dois' : (membros.find((m) => m.id === id)?.nome ?? '?')

// =============================================================================
// Metas de economia
// =============================================================================

function MetasDeEconomia({ membros }: { membros: Membro[] }) {
  const metas = useMetas()
  const [editando, setEditando] = useState<{ meta?: Meta } | null>(null)
  const [guardando, setGuardando] = useState<Meta | null>(null)
  const mesAtual = competenciaAtual()

  if (metas.isPending) return <Carregando />
  if (metas.isError) return <Aviso titulo="Não foi possível carregar as metas">{metas.error.message}</Aviso>

  const { metas: lista, aportes } = metas.data
  const ativas = lista.filter((m) => !m.arquivada)
  const arquivadas = lista.filter((m) => m.arquivada)
  const aportesDe = (id: string) => aportes.filter((a) => a.meta_id === id)

  return (
    <Bloco
      titulo="Metas de economia"
      subtitulo="Junte dinheiro para um objetivo: viagem, reserva, carro..."
      acao={{ texto: 'Nova meta', onClick: () => setEditando({}) }}
    >
      {ativas.length === 0 ? (
        <p className="text-sm text-stone-500">Nenhuma meta ainda.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {ativas.map((meta) => (
            <CartaoMeta
              key={meta.id}
              meta={meta}
              aportes={aportesDe(meta.id)}
              membros={membros}
              mesAtual={mesAtual}
              onAbrir={() => setEditando({ meta })}
              onGuardar={() => setGuardando(meta)}
            />
          ))}
        </ul>
      )}

      {arquivadas.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer py-1 font-medium text-stone-600">Arquivadas ({arquivadas.length})</summary>
          <ul className="divide-y divide-stone-100">
            {arquivadas.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setEditando({ meta: m })}
                  className="flex w-full items-center gap-3 py-2.5 text-left text-stone-600"
                >
                  <Bolinha cor={m.cor} />
                  <span className="flex-1 truncate">{m.nome}</span>
                  <span className="tabular-nums">
                    {formatarCentavos(aportesDe(m.id).reduce((s, a) => s + a.valor_centavos, 0))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Folha
        aberta={editando !== null}
        onFechar={() => setEditando(null)}
        titulo={editando?.meta ? editando.meta.nome : 'Nova meta'}
      >
        {editando && (
          <FormMeta
            meta={editando.meta}
            aportes={editando.meta ? aportesDe(editando.meta.id) : []}
            membros={membros}
            onFechar={() => setEditando(null)}
          />
        )}
      </Folha>
      <Folha
        aberta={guardando !== null}
        onFechar={() => setGuardando(null)}
        titulo={`Guardar em ${guardando?.nome ?? ''}`}
      >
        {guardando && <FormAporte meta={guardando} membros={membros} onFechar={() => setGuardando(null)} />}
      </Folha>
    </Bloco>
  )
}

function CartaoMeta({
  meta,
  aportes,
  membros,
  mesAtual,
  onAbrir,
  onGuardar,
}: {
  meta: Meta
  aportes: MetaAporte[]
  membros: Membro[]
  mesAtual: string
  onAbrir: () => void
  onGuardar: () => void
}) {
  const p = progressoMeta(
    meta.valor_alvo_centavos,
    aportes.map((a) => a.valor_centavos),
    meta.prazo,
    mesAtual,
  )
  const cor = meta.cor ?? '#0d9488'
  const doMes = aportes.filter((a) => competenciaDe(a.data) === mesAtual).reduce((s, a) => s + a.valor_centavos, 0)

  return (
    <li className="rounded-2xl border border-stone-200 p-3">
      <button type="button" onClick={onAbrir} className="block w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold">
              <Bolinha cor={cor} />
              <span className="truncate">{meta.nome}</span>
            </p>
            <p className="text-xs text-stone-500">
              {deQuem(membros, meta.membro_id)}
              {meta.prazo && ` · até ${nomeCurtoDoMes(meta.prazo, true)}`}
            </p>
          </div>
          <p className="shrink-0 text-right">
            <span className="block text-lg font-semibold">{p.percentual}%</span>
          </p>
        </div>
        <div className="mt-2">
          <Medidor percentual={p.percentual} cor={cor} rotulo={`Progresso de ${meta.nome}`} />
        </div>
        <p className="mt-2 text-sm">
          <span className="font-semibold tabular-nums">{formatarCentavos(p.guardado)}</span>
          <span className="text-stone-500"> de {formatarCentavos(meta.valor_alvo_centavos)}</span>
        </p>
        <p className="mt-0.5 text-xs text-stone-600">
          {p.concluida ? (
            <span className="font-medium text-emerald-700">✓ Meta atingida!</span>
          ) : p.atrasada ? (
            <span className="font-medium text-red-700">⚠ Prazo passou · faltam {formatarCentavos(p.falta)}</span>
          ) : p.porMes !== null ? (
            <>
              Faltam {formatarCentavos(p.falta)} · guardar{' '}
              <span className="font-semibold text-stone-900">{formatarCentavos(p.porMes)}/mês</span> por{' '}
              {p.mesesRestantes} {p.mesesRestantes === 1 ? 'mês' : 'meses'}
              {doMes > 0 && ` · este mês: ${formatarCentavos(doMes)}`}
            </>
          ) : (
            <>Faltam {formatarCentavos(p.falta)}</>
          )}
        </p>
      </button>
      {!p.concluida && (
        <button
          type="button"
          onClick={onGuardar}
          className="mt-3 h-10 w-full rounded-xl bg-marca-50 text-sm font-semibold text-marca-700 hover:bg-marca-100"
        >
          + Guardar dinheiro
        </button>
      )}
    </li>
  )
}

function FormMeta({
  meta,
  aportes,
  membros,
  onFechar,
}: {
  meta?: Meta
  aportes: MetaAporte[]
  membros: Membro[]
  onFechar: () => void
}) {
  const salvar = useSalvarMeta()
  const arquivar = useArquivarMeta()
  const excluir = useExcluirMeta()
  const excluirAporte = useExcluirAporte()
  const [nome, setNome] = useState(meta?.nome ?? '')
  const [alvo, setAlvo] = useState(meta ? centavosParaCampo(meta.valor_alvo_centavos) : '')
  const [membroId, setMembroId] = useState(meta?.membro_id ?? 'casal')
  const [prazo, setPrazo] = useState(meta?.prazo?.slice(0, 7) ?? '')
  const [cor, setCor] = useState(meta?.cor ?? CORES[2])
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)

  async function aoSalvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    const centavos = paraCentavos(alvo)
    if (!nome.trim()) return setErro('Dê um nome para a meta.')
    if (centavos === null || centavos <= 0) return setErro('Informe quanto quer juntar.')
    try {
      await salvar.mutateAsync({
        id: meta?.id,
        nome: nome.trim(),
        valor_alvo_centavos: centavos,
        membro_id: membroId === 'casal' ? null : membroId,
        prazo: prazo ? `${prazo}-01` : null,
        cor,
      })
      onFechar()
    } catch (err) {
      setErro(`Não foi possível salvar: ${mensagemDeErro(err)}`)
    }
  }

  async function aoExcluir() {
    if (!meta) return
    if (!confirmando) return setConfirmando(true)
    try {
      await excluir.mutateAsync(meta.id)
      onFechar()
    } catch (err) {
      setErro(`Não foi possível excluir: ${mensagemDeErro(err)}`)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={aoSalvar} className="flex flex-col gap-4" noValidate>
        <Campo rotulo="Nome">
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Viagem de férias"
            className={classeInput}
            autoFocus={!meta}
          />
        </Campo>
        <Campo rotulo="Quanto quer juntar">
          <CampoValor valor={alvo} onChange={setAlvo} ariaLabel="Valor da meta" />
        </Campo>
        <Campo rotulo="De quem é a meta">
          <Segmentado
            rotulo="De quem é a meta"
            valor={membroId}
            onChange={setMembroId}
            opcoes={[{ valor: 'casal', texto: 'Dos dois' }, ...membros.map((m) => ({ valor: m.id, texto: m.nome }))]}
          />
        </Campo>
        <Campo rotulo="Até quando (opcional)" dica="Com prazo, o app calcula quanto guardar por mês.">
          <input type="month" value={prazo} onChange={(e) => setPrazo(e.target.value)} className={classeInput} />
        </Campo>
        <Campo rotulo="Cor">
          <SeletorCor cores={CORES} valor={cor} onChange={setCor} />
        </Campo>
        <ErroFormulario mensagem={erro} />
        <BotoesFormulario salvando={salvar.isPending} textoSalvar={meta ? 'Salvar' : 'Criar meta'} />
      </form>

      {meta && (
        <>
          <div>
            <h3 className="text-sm font-semibold text-stone-700">Histórico</h3>
            {aportes.length === 0 ? (
              <p className="mt-1 text-sm text-stone-500">Nada guardado ainda.</p>
            ) : (
              <ul className="mt-1 divide-y divide-stone-100">
                {[...aportes].reverse().map((a) => (
                  <li key={a.id} className="flex items-center gap-2 py-2 text-sm">
                    <span className="w-12 shrink-0 text-xs text-stone-500 tabular-nums">{formatarDiaMes(a.data)}</span>
                    <span className="flex-1 truncate text-stone-600">
                      {deQuem(membros, a.membro_id)}
                      {a.observacao ? ` · ${a.observacao}` : ''}
                    </span>
                    <span className={`font-semibold tabular-nums ${a.valor_centavos < 0 ? 'text-red-700' : ''}`}>
                      {a.valor_centavos > 0 ? '+' : ''}
                      {formatarCentavos(a.valor_centavos)}
                    </span>
                    <button
                      type="button"
                      aria-label="Apagar este registro"
                      onClick={() => excluirAporte.mutate(a.id)}
                      className="rounded-lg px-2 py-1 text-stone-500 hover:bg-stone-100 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-2 border-t border-stone-100 pt-3">
            <button
              type="button"
              onClick={async () => {
                await arquivar.mutateAsync({ id: meta.id, arquivada: !meta.arquivada })
                onFechar()
              }}
              className="h-11 rounded-xl font-medium text-stone-700 hover:bg-stone-100"
            >
              {meta.arquivada ? 'Desarquivar' : 'Arquivar meta'}
            </button>
            <button
              type="button"
              onClick={aoExcluir}
              disabled={excluir.isPending}
              className={`h-11 rounded-xl font-medium disabled:opacity-50 ${
                confirmando ? 'bg-red-600 text-white' : 'text-red-700 hover:bg-red-50'
              }`}
            >
              {confirmando ? 'Toque de novo para excluir (apaga o histórico)' : 'Excluir meta'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function FormAporte({ meta, membros, onFechar }: { meta: Meta; membros: Membro[]; onFechar: () => void }) {
  const { membro: eu } = useMembroAtual()
  const novo = useNovoAporte()
  const [tipo, setTipo] = useState<'guardar' | 'retirar'>('guardar')
  const [valor, setValor] = useState('')
  const [membroId, setMembroId] = useState(meta.membro_id ?? eu?.id ?? membros[0]?.id ?? '')
  const [data, setData] = useState(hoje())
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    const centavos = paraCentavos(valor)
    if (centavos === null || centavos <= 0) return setErro('Informe um valor maior que zero.')
    if (!data) return setErro('Informe a data.')
    try {
      await novo.mutateAsync({
        meta_id: meta.id,
        membro_id: membroId,
        valor_centavos: tipo === 'guardar' ? centavos : -centavos,
        data,
        observacao: observacao.trim() || null,
      })
      onFechar()
    } catch (err) {
      setErro(`Não foi possível salvar: ${mensagemDeErro(err)}`)
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4" noValidate>
      <Segmentado
        rotulo="Tipo"
        valor={tipo}
        onChange={setTipo}
        opcoes={[
          { valor: 'guardar', texto: 'Guardar' },
          { valor: 'retirar', texto: 'Retirar' },
        ]}
      />
      <Campo rotulo="Valor">
        <CampoValor valor={valor} onChange={setValor} ariaLabel="Valor" autoFocus />
      </Campo>
      {meta.membro_id === null && (
        <Campo rotulo="Quem">
          <Segmentado
            rotulo="Quem"
            valor={membroId}
            onChange={setMembroId}
            opcoes={membros.map((m) => ({ valor: m.id, texto: m.nome }))}
          />
        </Campo>
      )}
      <Campo rotulo="Data">
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={classeInput} />
      </Campo>
      <Campo rotulo="Observação (opcional)">
        <input
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Ex.: 13º salário"
          className={classeInput}
        />
      </Campo>
      <ErroFormulario mensagem={erro} />
      <BotoesFormulario salvando={novo.isPending} textoSalvar={tipo === 'guardar' ? 'Guardar' : 'Retirar'} />
    </form>
  )
}

// =============================================================================
// Orçamento por categoria
// =============================================================================

const ESTILO_STATUS: Record<StatusOrcamento, { cor: string; icone: string; texto: string; classe: string }> = {
  ok: { cor: '#0ca30c', icone: '✓', texto: 'Dentro do limite', classe: 'text-emerald-700' },
  atencao: { cor: '#fab219', icone: '!', texto: 'Perto do limite', classe: 'text-amber-700' },
  estourou: { cor: '#d03b3b', icone: '⚠', texto: 'Passou do limite', classe: 'text-red-700' },
}

function Orcamentos({ membros, categorias }: { membros: Membro[]; categorias: Categoria[] }) {
  const { competencia } = useCompetencia()
  const orcamentos = useOrcamentos()
  const lancamentos = useLancamentos(competencia)
  const [editando, setEditando] = useState<{ orcamento?: Orcamento } | null>(null)

  if (orcamentos.isPending || lancamentos.isPending) return <Carregando />
  if (orcamentos.isError) {
    return <Aviso titulo="Não foi possível carregar os limites">{orcamentos.error.message}</Aviso>
  }

  const linhas = situacoesDoMes(orcamentos.data, lancamentos.data ?? [], competencia)
  const nomeCategoria = (id: string) => {
    const c = categorias.find((x) => x.id === id)
    return c ? `${c.icone ? `${c.icone} ` : ''}${c.nome}` : 'Categoria'
  }

  return (
    <Bloco
      titulo="Limite de gastos"
      subtitulo={
        <>
          Quanto pode gastar por mês em cada categoria ·{' '}
          <span className="lowercase">{nomeDaCompetencia(competencia)}</span>
        </>
      }
      acao={{ texto: 'Novo limite', onClick: () => setEditando({}) }}
    >
      {linhas.length === 0 ? (
        <p className="text-sm text-stone-500">
          Nenhum limite ainda. Ex.: Mercado até R$ 1.500 por mês, Alimentação fora até R$ 400.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {linhas.map(({ orcamento: o, gasto, situacao }) => {
            const estilo = ESTILO_STATUS[situacao.status]
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => setEditando({ orcamento: o })}
                  className="w-full rounded-xl px-1 py-2 text-left hover:bg-stone-50"
                >
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-medium">{nomeCategoria(o.categoria_id)}</span>
                    <span className="shrink-0 text-xs text-stone-500">{deQuem(membros, o.membro_id)}</span>
                  </div>
                  <div className="mt-1.5">
                    <Medidor
                      percentual={situacao.percentual}
                      cor={estilo.cor}
                      rotulo={`${nomeCategoria(o.categoria_id)}: ${situacao.percentual}% do limite`}
                    />
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-2 text-xs">
                    <span className={estilo.classe}>
                      <span aria-hidden>{estilo.icone} </span>
                      {estilo.texto} · {situacao.percentual}%
                    </span>
                    <span className="shrink-0 text-stone-600 tabular-nums">
                      <span className="font-semibold text-stone-900">{formatarCentavos(gasto)}</span> de{' '}
                      {formatarCentavos(o.valor_centavos)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {situacao.restante >= 0
                      ? `Pode gastar mais ${formatarCentavos(situacao.restante)} este mês`
                      : `Passou ${formatarCentavos(-situacao.restante)} do limite`}
                  </p>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <Folha
        aberta={editando !== null}
        onFechar={() => setEditando(null)}
        titulo={editando?.orcamento ? 'Editar limite' : 'Novo limite'}
      >
        {editando && (
          <FormOrcamento
            orcamento={editando.orcamento}
            existentes={orcamentos.data}
            membros={membros}
            categorias={categorias}
            onFechar={() => setEditando(null)}
          />
        )}
      </Folha>
    </Bloco>
  )
}

function FormOrcamento({
  orcamento,
  existentes,
  membros,
  categorias,
  onFechar,
}: {
  orcamento?: Orcamento
  existentes: Orcamento[]
  membros: Membro[]
  categorias: Categoria[]
  onFechar: () => void
}) {
  const salvar = useSalvarOrcamento()
  const excluir = useExcluirOrcamento()
  const [categoriaId, setCategoriaId] = useState(orcamento?.categoria_id ?? '')
  const [membroId, setMembroId] = useState(orcamento?.membro_id ?? 'casal')
  const [valor, setValor] = useState(orcamento ? centavosParaCampo(orcamento.valor_centavos) : '')
  const [erro, setErro] = useState<string | null>(null)

  const opcoes = categorias.filter((c) => c.tipo === 'saida' && (!c.arquivada || c.id === categoriaId))

  async function aoSalvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    const centavos = paraCentavos(valor)
    const quem = membroId === 'casal' ? null : membroId
    if (!categoriaId) return setErro('Escolha a categoria.')
    if (centavos === null || centavos <= 0) return setErro('Informe o limite por mês.')
    if (existentes.some((o) => o.id !== orcamento?.id && o.categoria_id === categoriaId && o.membro_id === quem)) {
      return setErro('Já existe um limite para essa categoria e pessoa.')
    }
    try {
      await salvar.mutateAsync({
        id: orcamento?.id,
        categoria_id: categoriaId,
        membro_id: quem,
        valor_centavos: centavos,
      })
      onFechar()
    } catch (err) {
      setErro(`Não foi possível salvar: ${mensagemDeErro(err)}`)
    }
  }

  return (
    <form onSubmit={aoSalvar} className="flex flex-col gap-4" noValidate>
      <Campo rotulo="Categoria">
        <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={classeInput}>
          <option value="">Escolha…</option>
          {opcoes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icone ? `${c.icone} ` : ''}
              {c.nome}
            </option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="De quem" dica="“Os dois” soma os gastos de vocês dois nessa categoria.">
        <Segmentado
          rotulo="De quem"
          valor={membroId}
          onChange={setMembroId}
          opcoes={[{ valor: 'casal', texto: 'Os dois' }, ...membros.map((m) => ({ valor: m.id, texto: m.nome }))]}
        />
      </Campo>
      <Campo rotulo="Limite por mês">
        <CampoValor valor={valor} onChange={setValor} ariaLabel="Limite por mês" />
      </Campo>
      <ErroFormulario mensagem={erro} />
      <BotoesFormulario
        salvando={salvar.isPending}
        textoSalvar={orcamento ? 'Salvar' : 'Criar limite'}
        excluindo={excluir.isPending}
        onExcluir={
          orcamento
            ? async () => {
                await excluir.mutateAsync(orcamento.id)
                onFechar()
              }
            : undefined
        }
      />
    </form>
  )
}
