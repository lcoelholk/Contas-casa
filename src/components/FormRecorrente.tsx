import { useMemo, useState, type FormEvent } from 'react'
import { Folha } from './Folha.tsx'
import { BotoesFormulario, Campo, CampoValor, ErroFormulario, Segmentado, SeletorCategoria, classeInput } from './campos.tsx'
import { EditorDivisao, useEditorDivisao } from './EditorDivisao.tsx'
import { useCategorias, useLancamentos } from '../hooks/useLancamentos.ts'
import {
  useAlterarRecorrente,
  useCriarRecorrente,
  useEditarMesRecorrente,
  useDefinirFimRecorrente,
  useEncerrarRecorrente,
  useExcluirRecorrente,
  useRecorrentes,
} from '../hooks/useRecorrentes.ts'
import { somar } from '../lib/dinheiro.ts'
import { divisaoVigente, somaPartes, type Partes } from '../lib/divisao.ts'
import { nomeDaCompetencia, type Competencia } from '../lib/datas.ts'
import type { Conta, Lancamento, Membro, Recorrente, RecorrenteDivisao, TipoMovimento } from '../types/banco.ts'
import { Carregando } from './ui.tsx'

/** Criar ou editar uma conta fixa (aluguel, luz, academia, salário...) */
export function FormRecorrente({
  aberto,
  onFechar,
  conta,
  membros,
  competencia,
  recorrenteId,
}: {
  aberto: boolean
  onFechar: () => void
  conta: Conta
  membros: Membro[]
  competencia: Competencia
  /** Conta fixa existente (edição) */
  recorrenteId?: string
}) {
  return (
    <Folha
      aberta={aberto}
      onFechar={onFechar}
      titulo={recorrenteId ? 'Editar conta fixa' : `Nova conta fixa · ${conta.nome}`}
    >
      {aberto && (
        <Conteudo onFechar={onFechar} conta={conta} membros={membros} competencia={competencia} recorrenteId={recorrenteId} />
      )}
    </Folha>
  )
}

function Conteudo({
  onFechar,
  conta,
  membros,
  competencia,
  recorrenteId,
}: {
  onFechar: () => void
  conta: Conta
  membros: Membro[]
  competencia: Competencia
  recorrenteId?: string
}) {
  const recorrentes = useRecorrentes()
  const lancamentos = useLancamentos(competencia)
  const [escopo, setEscopo] = useState<'daqui' | 'mes'>('daqui')

  const membrosDaConta = useMemo(
    () => (conta.tipo === 'pessoal' ? membros.filter((m) => m.id === conta.dono_id) : membros),
    [conta, membros],
  )

  if (recorrenteId && (recorrentes.isPending || lancamentos.isPending)) return <Carregando />
  if (recorrentes.isError) {
    return (
      <ErroFormulario
        mensagem={`Não foi possível carregar as contas fixas: ${recorrentes.error.message}. Confira se a migration 0004 foi rodada no Supabase.`}
      />
    )
  }

  const recorrente = recorrentes.data?.recorrentes.find((r) => r.id === recorrenteId)
  const linhasDoMes = (lancamentos.data ?? []).filter((l) => recorrenteId && l.recorrente_id === recorrenteId)
  const mes = nomeDaCompetencia(competencia)

  return (
    <div className="flex flex-col gap-4">
      {recorrente && linhasDoMes.length > 0 && (
        <Segmentado
          rotulo="O que mudar"
          valor={escopo}
          onChange={setEscopo}
          opcoes={[
            { valor: 'daqui', texto: 'Deste mês em diante' },
            { valor: 'mes', texto: 'Só este mês' },
          ]}
        />
      )}
      {escopo === 'mes' && recorrente ? (
        <CamposSoEsteMes key="mes" linhas={linhasDoMes} membros={membrosDaConta} mes={mes} onFechar={onFechar} />
      ) : (
        <CamposDaquiEmDiante
          key="daqui"
          conta={conta}
          membros={membrosDaConta}
          competencia={competencia}
          recorrente={recorrente}
          divisoes={recorrentes.data?.divisoes ?? []}
          onFechar={onFechar}
        />
      )}
    </div>
  )
}

const DIAS = Array.from({ length: 31 }, (_, i) => i + 1)

function CamposDaquiEmDiante({
  conta,
  membros,
  competencia,
  recorrente,
  divisoes,
  onFechar,
}: {
  conta: Conta
  membros: Membro[]
  competencia: Competencia
  recorrente?: Recorrente
  divisoes: RecorrenteDivisao[]
  onFechar: () => void
}) {
  const categorias = useCategorias()
  const criar = useCriarRecorrente()
  const alterar = useAlterarRecorrente()
  const encerrar = useEncerrarRecorrente()
  const excluir = useExcluirRecorrente()
  const definirFim = useDefinirFimRecorrente()

  const inicial = useMemo(() => {
    if (!recorrente) return undefined
    const vigente = divisaoVigente(divisoes, recorrente.id, competencia)
    const partes: Partes = Object.fromEntries(membros.map((m) => [m.id, vigente[m.id] ?? 0]))
    return { total: somaPartes(partes), partes }
  }, [recorrente, divisoes, competencia, membros])

  const divisao = useEditorDivisao(membros, inicial)
  const [tipo, setTipo] = useState<TipoMovimento>(recorrente?.tipo ?? 'saida')
  const [descricao, setDescricao] = useState(recorrente?.descricao ?? '')
  const [categoriaId, setCategoriaId] = useState(recorrente?.categoria_id ?? '')
  const [dia, setDia] = useState(recorrente?.dia_vencimento ? String(recorrente.dia_vencimento) : '')
  const [temLimite, setTemLimite] = useState<'nao' | 'sim'>(recorrente?.fim ? 'sim' : 'nao')
  // input type="month" usa "AAAA-MM"
  const [ate, setAte] = useState(recorrente?.fim?.slice(0, 7) ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState<'encerrar' | 'excluir' | null>(null)

  const mes = nomeDaCompetencia(competencia)
  const ehEntrada = tipo === 'entrada'

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!descricao.trim()) return setErro('Escreva uma descrição.')
    const problema = divisao.validar()
    if (problema) return setErro(problema)
    const fim = temLimite === 'sim' && ate ? `${ate}-01` : null
    const inicio = recorrente?.inicio ?? competencia
    if (temLimite === 'sim' && !fim) return setErro('Escolha até que mês ela vai.')
    if (fim && fim < inicio) return setErro(`O último mês não pode ser antes do início (${nomeDaCompetencia(inicio)}).`)

    const dados = {
      descricao: descricao.trim(),
      categoria_id: categoriaId || null,
      dia_vencimento: dia ? Number(dia) : null,
      partes: divisao.partes,
    }
    try {
      if (recorrente) {
        await alterar.mutateAsync({ ...dados, id: recorrente.id, desde: competencia })
        if (fim !== recorrente.fim) await definirFim.mutateAsync({ id: recorrente.id, fim })
      } else {
        await criar.mutateAsync({ ...dados, conta_id: conta.id, tipo, inicio: competencia, fim })
      }
      onFechar()
    } catch (err) {
      setErro(`Não foi possível salvar: ${(err as Error).message}`)
    }
  }

  async function aoEncerrar() {
    if (!recorrente) return
    if (confirmando !== 'encerrar') return setConfirmando('encerrar')
    try {
      await encerrar.mutateAsync({ id: recorrente.id, ultimoMes: competencia })
      onFechar()
    } catch (err) {
      setErro((err as Error).message)
    }
  }

  async function aoExcluir() {
    if (!recorrente) return
    if (confirmando !== 'excluir') return setConfirmando('excluir')
    try {
      await excluir.mutateAsync(recorrente.id)
      onFechar()
    } catch (err) {
      setErro((err as Error).message)
      setConfirmando(null)
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4" noValidate>
      {!recorrente && conta.tipo === 'pessoal' && (
        <Segmentado
          rotulo="Tipo"
          valor={tipo}
          onChange={(t) => {
            setTipo(t)
            setCategoriaId('')
          }}
          opcoes={[
            { valor: 'saida', texto: 'Gasto fixo' },
            { valor: 'entrada', texto: 'Entrada fixa' },
          ]}
        />
      )}

      <Campo rotulo="Descrição">
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder={ehEntrada ? 'Ex.: Salário' : conta.tipo === 'pessoal' ? 'Ex.: Academia' : 'Ex.: Aluguel'}
          className={classeInput}
          autoFocus={!recorrente}
        />
      </Campo>

      <Campo rotulo={membros.length > 1 ? 'Valor total por mês' : 'Valor por mês'}>
        <CampoValor valor={divisao.valorTexto} onChange={divisao.aoMudarTotal} ariaLabel="Valor por mês" />
      </Campo>

      <EditorDivisao estado={divisao} rotulo="Quem paga quanto, todo mês" />

      <Campo rotulo="Categoria">
        <SeletorCategoria categorias={categorias.data ?? []} tipo={tipo} valor={categoriaId} onChange={setCategoriaId} />
      </Campo>

      <Campo rotulo={ehEntrada ? 'Dia em que cai' : 'Dia do vencimento'}>
        <select value={dia} onChange={(e) => setDia(e.target.value)} className={classeInput} aria-label="Dia">
          <option value="">Sem dia fixo</option>
          {DIAS.map((d) => (
            <option key={d} value={d}>
              Dia {d}
            </option>
          ))}
        </select>
      </Campo>

      <Campo
        rotulo="Até quando"
        dica={
          temLimite === 'sim'
            ? 'Depois desse mês ela para de aparecer sozinha (ex.: aluguel com contrato).'
            : 'Aparece todo mês até você encerrar (ex.: academia).'
        }
      >
        <Segmentado
          rotulo="Até quando"
          valor={temLimite}
          onChange={setTemLimite}
          opcoes={[
            { valor: 'nao', texto: 'Sem data limite' },
            { valor: 'sim', texto: 'Até um mês' },
          ]}
        />
      </Campo>
      {temLimite === 'sim' && (
        <Campo rotulo="Último mês">
          <input
            type="month"
            value={ate}
            min={(recorrente?.inicio ?? competencia).slice(0, 7)}
            onChange={(e) => setAte(e.target.value)}
            className={classeInput}
            aria-label="Último mês"
          />
        </Campo>
      )}

      <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600">
        {recorrente ? (
          <>
            Vale de <strong className="lowercase">{mes}</strong> em diante. Meses anteriores e partes já pagas não
            mudam.
          </>
        ) : (
          <>
            Começa em <strong className="lowercase">{mes}</strong> e aparece todo mês
            {temLimite === 'sim' && ate ? (
              <>
                {' '}
                até <strong className="lowercase">{nomeDaCompetencia(`${ate}-01`)}</strong>.
              </>
            ) : (
              ' até ser encerrada.'
            )}
          </>
        )}
      </p>

      <ErroFormulario mensagem={erro} />

      <BotoesFormulario salvando={criar.isPending || alterar.isPending || definirFim.isPending} textoSalvar={recorrente ? 'Salvar' : 'Criar conta fixa'} />

      {recorrente && (
        <div className="flex flex-col gap-1 border-t border-stone-100 pt-3">
          <button
            type="button"
            onClick={aoEncerrar}
            disabled={encerrar.isPending}
            className={`h-11 rounded-xl font-medium ${
              confirmando === 'encerrar' ? 'bg-amber-600 text-white' : 'text-amber-800 hover:bg-amber-50'
            }`}
          >
            {confirmando === 'encerrar'
              ? `Toque de novo: ${mes.split(' ')[0]} será o último mês`
              : `Encerrar depois de ${mes.split(' ')[0]}`}
          </button>
          <button
            type="button"
            onClick={aoExcluir}
            disabled={excluir.isPending}
            className={`h-11 rounded-xl font-medium ${
              confirmando === 'excluir' ? 'bg-red-600 text-white' : 'text-red-700 hover:bg-red-50'
            }`}
          >
            {confirmando === 'excluir' ? 'Toque de novo para excluir de todos os meses' : 'Excluir conta fixa'}
          </button>
        </div>
      )}
    </form>
  )
}

function CamposSoEsteMes({
  linhas,
  membros,
  mes,
  onFechar,
}: {
  linhas: Lancamento[]
  membros: Membro[]
  mes: string
  onFechar: () => void
}) {
  const editarMes = useEditarMesRecorrente()
  const inicial = useMemo(() => {
    const partes: Partes = Object.fromEntries(membros.map((m) => [m.id, 0]))
    for (const l of linhas) partes[l.membro_id] = l.valor_centavos
    return { total: somar(linhas.map((l) => l.valor_centavos)), partes }
  }, [linhas, membros])
  const divisao = useEditorDivisao(membros, inicial)
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    const problema = divisao.validar()
    if (problema) return setErro(problema)
    try {
      await editarMes.mutateAsync({ linhas, partes: divisao.partes })
      onFechar()
    } catch (err) {
      setErro(`Não foi possível salvar: ${(err as Error).message}`)
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4" noValidate>
      <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600">
        Muda só <strong className="lowercase">{mes}</strong>, por exemplo quando a conta de luz veio diferente. Os
        outros meses continuam com o valor da conta fixa.
      </p>

      <Campo rotulo={`${linhas[0]?.descricao ?? 'Valor'} em ${mes.split(' ')[0]}`}>
        <CampoValor valor={divisao.valorTexto} onChange={divisao.aoMudarTotal} ariaLabel="Valor deste mês" />
      </Campo>

      <EditorDivisao estado={divisao} />

      <ErroFormulario mensagem={erro} />
      <BotoesFormulario salvando={editarMes.isPending} textoSalvar={`Salvar só ${mes.split(' ')[0]}`} />
    </form>
  )
}
