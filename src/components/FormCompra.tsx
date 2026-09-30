import { useMemo, useState, type FormEvent } from 'react'
import { Folha } from './Folha.tsx'
import { BotoesFormulario, Caixa, Campo, CampoValor, ErroFormulario, SeletorCategoria, classeInput } from './campos.tsx'
import { EditorDivisao, useEditorDivisao } from './EditorDivisao.tsx'
import { Carregando } from './ui.tsx'
import { useCategorias } from '../hooks/useLancamentos.ts'
import { useAlterarCompra, useCompras, useCriarCompra, useExcluirCompra, useQuitarCompra } from '../hooks/useCompras.ts'
import { centavosParaCampo, formatarCentavos, paraCentavos } from '../lib/dinheiro.ts'
import { nomeDaCompetencia, type Competencia } from '../lib/datas.ts'
import { parcelaSugerida, resumoCompra } from '../lib/compras.ts'
import type { Partes } from '../lib/divisao.ts'
import type { CompraDivisao, CompraParcelada, Conta, LinhaDeCompra, Membro } from '../types/banco.ts'

const DIAS = Array.from({ length: 31 }, (_, i) => i + 1)
const primeiroNome = (competencia: Competencia) => nomeDaCompetencia(competencia).split(' ')[0]

/** Cadastrar ou editar uma compra parcelada (geladeira em 12x...) */
export function FormCompra({
  aberto,
  onFechar,
  conta,
  membros,
  competencia,
  compraId,
}: {
  aberto: boolean
  onFechar: () => void
  conta: Conta
  membros: Membro[]
  competencia: Competencia
  compraId?: string
}) {
  return (
    <Folha aberta={aberto} onFechar={onFechar} titulo={compraId ? 'Compra parcelada' : `Nova compra parcelada · ${conta.nome}`}>
      {aberto && (
        <Conteudo onFechar={onFechar} conta={conta} membros={membros} competencia={competencia} compraId={compraId} />
      )}
    </Folha>
  )
}

function Conteudo({
  onFechar,
  conta,
  membros,
  competencia,
  compraId,
}: {
  onFechar: () => void
  conta: Conta
  membros: Membro[]
  competencia: Competencia
  compraId?: string
}) {
  const compras = useCompras()
  const membrosDaConta = useMemo(
    () => (conta.tipo === 'pessoal' ? membros.filter((m) => m.id === conta.dono_id) : membros),
    [conta, membros],
  )

  if (compraId && compras.isPending) return <Carregando />
  if (compras.isError) {
    return (
      <ErroFormulario
        mensagem={`Não foi possível carregar as compras: ${compras.error.message}. Confira se a migration 0005 foi rodada no Supabase.`}
      />
    )
  }
  if (!compraId) return <NovaCompra conta={conta} membros={membrosDaConta} competencia={competencia} onFechar={onFechar} />

  const compra = compras.data?.compras.find((c) => c.id === compraId)
  if (!compra) return <ErroFormulario mensagem="Compra não encontrada." />
  return (
    <EditarCompra
      compra={compra}
      divisoes={compras.data!.divisoes.filter((d) => d.compra_id === compraId)}
      linhas={compras.data!.linhas.filter((l) => l.compra_id === compraId)}
      membros={membrosDaConta}
      competencia={competencia}
      onFechar={onFechar}
    />
  )
}

function NovaCompra({
  conta,
  membros,
  competencia,
  onFechar,
}: {
  conta: Conta
  membros: Membro[]
  competencia: Competencia
  onFechar: () => void
}) {
  const categorias = useCategorias()
  const criar = useCriarCompra()
  const divisao = useEditorDivisao(membros)

  const [descricao, setDescricao] = useState('')
  const [totalTexto, setTotalTexto] = useState('')
  const [parcelasTexto, setParcelasTexto] = useState('')
  const [mensalEditado, setMensalEditado] = useState(false)
  const [primeira, setPrimeira] = useState(competencia.slice(0, 7))
  const [categoriaId, setCategoriaId] = useState('')
  const [dia, setDia] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const total = paraCentavos(totalTexto) ?? 0
  const parcelas = Number(parcelasTexto) || 0

  /** Enquanto a pessoa não mexe no valor da parcela, ele acompanha total ÷ parcelas */
  function sugerir(novoTotal: number, novasParcelas: number) {
    if (mensalEditado) return
    const sugerida = parcelaSugerida(novoTotal, novasParcelas)
    divisao.aoMudarTotal(sugerida ? centavosParaCampo(sugerida) : '')
  }

  const pagoAoTodo = divisao.total * parcelas
  const diferenca = pagoAoTodo - total

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!descricao.trim()) return setErro('Escreva uma descrição.')
    if (total <= 0) return setErro('Informe o valor da compra.')
    if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 120) return setErro('Informe de 1 a 120 parcelas.')
    if (!/^\d{4}-\d{2}$/.test(primeira)) return setErro('Escolha o mês da primeira parcela.')
    const problema = divisao.validar()
    if (problema) return setErro(problema === 'Informe o valor.' ? 'Informe o valor da parcela.' : problema)
    try {
      await criar.mutateAsync({
        conta_id: conta.id,
        descricao: descricao.trim(),
        categoria_id: categoriaId || null,
        dia_vencimento: dia ? Number(dia) : null,
        partes: divisao.partes,
        valor_total: total,
        parcelas,
        primeira: `${primeira}-01`,
      })
      onFechar()
    } catch (err) {
      setErro(`Não foi possível salvar: ${(err as Error).message}`)
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4" noValidate>
      <Campo rotulo="Descrição">
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder={conta.tipo === 'pessoal' ? 'Ex.: Celular' : 'Ex.: Geladeira'}
          className={classeInput}
          autoFocus
        />
      </Campo>

      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Campo rotulo="Valor da compra">
          <CampoValor
            valor={totalTexto}
            ariaLabel="Valor da compra"
            onChange={(t) => {
              setTotalTexto(t)
              sugerir(paraCentavos(t) ?? 0, parcelas)
            }}
          />
        </Campo>
        <Campo rotulo="Parcelas">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={120}
            placeholder="12"
            aria-label="Número de parcelas"
            value={parcelasTexto}
            onChange={(e) => {
              setParcelasTexto(e.target.value)
              sugerir(total, Number(e.target.value) || 0)
            }}
            className={classeInput}
          />
        </Campo>
      </div>

      <Campo rotulo={membros.length > 1 ? 'Valor da parcela (total do mês)' : 'Valor da parcela'}>
        <CampoValor
          valor={divisao.valorTexto}
          ariaLabel="Valor da parcela"
          onChange={(t) => {
            setMensalEditado(true)
            divisao.aoMudarTotal(t)
          }}
        />
      </Campo>

      <EditorDivisao estado={divisao} rotulo="Quem paga quanto por mês" />

      {total > 0 && parcelas > 0 && divisao.total > 0 && diferenca !== 0 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Em {parcelas}x de {formatarCentavos(divisao.total)}, vocês pagam {formatarCentavos(pagoAoTodo)} ao todo:{' '}
          {formatarCentavos(Math.abs(diferenca))} {diferenca > 0 ? 'a mais' : 'a menos'} que o valor da compra
          {diferenca > 0 ? ' (juros?)' : ''}.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="1ª parcela em">
          <input
            type="month"
            value={primeira}
            onChange={(e) => setPrimeira(e.target.value)}
            className={classeInput}
            aria-label="Mês da primeira parcela"
          />
        </Campo>
        <Campo rotulo="Vencimento">
          <select value={dia} onChange={(e) => setDia(e.target.value)} className={classeInput} aria-label="Dia">
            <option value="">Sem dia</option>
            {DIAS.map((d) => (
              <option key={d} value={d}>
                Dia {d}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo rotulo="Categoria">
        <SeletorCategoria categorias={categorias.data ?? []} tipo="saida" valor={categoriaId} onChange={setCategoriaId} />
      </Campo>

      <ErroFormulario mensagem={erro} />
      <BotoesFormulario salvando={criar.isPending} textoSalvar="Cadastrar compra" />
    </form>
  )
}

function EditarCompra({
  compra,
  divisoes,
  linhas,
  membros,
  competencia,
  onFechar,
}: {
  compra: CompraParcelada
  divisoes: CompraDivisao[]
  linhas: LinhaDeCompra[]
  membros: Membro[]
  competencia: Competencia
  onFechar: () => void
}) {
  const categorias = useCategorias()
  const alterar = useAlterarCompra()
  const quitar = useQuitarCompra()
  const excluir = useExcluirCompra()

  const inicial = useMemo(() => {
    const partes: Partes = Object.fromEntries(
      membros.map((m) => [m.id, divisoes.find((d) => d.membro_id === m.id)?.valor_mensal_centavos ?? 0]),
    )
    return { total: Object.values(partes).reduce((a, b) => a + b, 0), partes }
  }, [divisoes, membros])

  const divisao = useEditorDivisao(membros, inicial)
  const [descricao, setDescricao] = useState(compra.descricao)
  const [categoriaId, setCategoriaId] = useState(compra.categoria_id ?? '')
  const [dia, setDia] = useState(compra.dia_vencimento ? String(compra.dia_vencimento) : '')
  const [lancarSaldo, setLancarSaldo] = useState(true)
  const [confirmando, setConfirmando] = useState<'quitar' | 'excluir' | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const r = resumoCompra(
    compra,
    divisoes.map((d) => d.valor_mensal_centavos),
    linhas,
    competencia,
  )
  const mes = primeiroNome(competencia)
  const podeQuitar = !r.quitada && r.parcelaDoMes >= 1 && r.parcelaDoMes < r.numParcelas

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!descricao.trim()) return setErro('Escreva uma descrição.')
    const problema = divisao.validar()
    if (problema) return setErro(problema === 'Informe o valor.' ? 'Informe o valor da parcela.' : problema)
    try {
      await alterar.mutateAsync({
        id: compra.id,
        desde: competencia,
        descricao: descricao.trim(),
        categoria_id: categoriaId || null,
        dia_vencimento: dia ? Number(dia) : null,
        partes: divisao.partes,
      })
      onFechar()
    } catch (err) {
      setErro(`Não foi possível salvar: ${(err as Error).message}`)
    }
  }

  async function aoQuitar() {
    if (confirmando !== 'quitar') return setConfirmando('quitar')
    try {
      await quitar.mutateAsync({ id: compra.id, mes: competencia, lancarSaldo })
      onFechar()
    } catch (err) {
      setErro((err as Error).message)
      setConfirmando(null)
    }
  }

  async function aoExcluir() {
    if (confirmando !== 'excluir') return setConfirmando('excluir')
    try {
      await excluir.mutateAsync(compra.id)
      onFechar()
    } catch (err) {
      setErro((err as Error).message)
      setConfirmando(null)
    }
  }

  const progresso = r.previsto > 0 ? Math.min(100, Math.round((r.pago / r.previsto) * 100)) : 0

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4" noValidate>
      <section aria-label="Progresso da compra" className="rounded-xl bg-stone-50 p-3 text-sm">
        <div className="flex items-baseline justify-between">
          <span className="font-medium">
            {formatarCentavos(compra.valor_total_centavos)} em {compra.num_parcelas}x
          </span>
          <span className="text-stone-500">
            {r.quitada
              ? `quitada em ${primeiroNome(compra.quitada_em!)}`
              : r.parcelaDoMes >= 1 && r.parcelaDoMes <= r.numParcelas
                ? `parcela ${r.parcelaDoMes}/${r.numParcelas}`
                : `começa em ${primeiroNome(compra.primeira_competencia)}`}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200" aria-hidden>
          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${progresso}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-stone-600">
          <span>Pago: {formatarCentavos(r.pago)}</span>
          <span>Falta: {formatarCentavos(r.restante)}</span>
        </div>
      </section>

      <Campo rotulo="Descrição">
        <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className={classeInput} />
      </Campo>

      <Campo rotulo={membros.length > 1 ? 'Valor da parcela (total do mês)' : 'Valor da parcela'}>
        <CampoValor valor={divisao.valorTexto} onChange={divisao.aoMudarTotal} ariaLabel="Valor da parcela" />
      </Campo>

      <EditorDivisao estado={divisao} rotulo="Quem paga quanto por mês" />

      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Vencimento">
          <select value={dia} onChange={(e) => setDia(e.target.value)} className={classeInput} aria-label="Dia">
            <option value="">Sem dia</option>
            {DIAS.map((d) => (
              <option key={d} value={d}>
                Dia {d}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Categoria">
          <SeletorCategoria categorias={categorias.data ?? []} tipo="saida" valor={categoriaId} onChange={setCategoriaId} />
        </Campo>
      </div>

      <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600">
        As mudanças valem de <strong>{mes}</strong> em diante. Parcelas pagas e meses anteriores não mudam.
      </p>

      <ErroFormulario mensagem={erro} />
      <BotoesFormulario salvando={alterar.isPending} textoSalvar="Salvar" />

      <div className="flex flex-col gap-1 border-t border-stone-100 pt-3">
        {podeQuitar && (
          <>
            <Caixa marcado={lancarSaldo} onChange={setLancarSaldo}>
              Lançar em {mes} o que falta ({formatarCentavos(r.saldoDepoisDoMes)})
            </Caixa>
            <button
              type="button"
              onClick={aoQuitar}
              disabled={quitar.isPending}
              className={`h-11 rounded-xl font-medium ${
                confirmando === 'quitar' ? 'bg-amber-600 text-white' : 'text-amber-800 hover:bg-amber-50'
              }`}
            >
              {confirmando === 'quitar' ? `Toque de novo para quitar em ${mes}` : `Quitar em ${mes}`}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={aoExcluir}
          disabled={excluir.isPending}
          className={`h-11 rounded-xl font-medium ${
            confirmando === 'excluir' ? 'bg-red-600 text-white' : 'text-red-700 hover:bg-red-50'
          }`}
        >
          {confirmando === 'excluir' ? 'Toque de novo para excluir todas as parcelas' : 'Excluir compra'}
        </button>
      </div>
    </form>
  )
}
