import { useState, type FormEvent, type ReactNode } from 'react'
import { useTodasContas, useMembros } from '../hooks/useDados.ts'
import { useCategorias } from '../hooks/useLancamentos.ts'
import {
  mensagemDeErro,
  useArquivarCategoria,
  useEditarMembro,
  useReordenarContas,
  useSalvarCategoria,
} from '../hooks/useConfiguracoes.ts'
import { CORES, moverConta } from '../lib/contas.ts'
import { Aviso, Bolinha, Carregando } from '../components/ui.tsx'
import { Folha } from '../components/Folha.tsx'
import { FormConta } from '../components/FormConta.tsx'
import { BotoesFormulario, Campo, ErroFormulario, Segmentado, SeletorCor, classeInput } from '../components/campos.tsx'
import type { Categoria, Conta, Membro, TipoMovimento } from '../types/banco.ts'
import { lerPreferencia, salvarPreferencia, type PreferenciaTema } from '../lib/tema.ts'

export default function Configuracoes() {
  const contas = useTodasContas()
  const membros = useMembros()
  const categorias = useCategorias()

  if (contas.isPending || membros.isPending || categorias.isPending) return <Carregando />
  if (contas.isError) return <Aviso titulo="Não foi possível carregar as contas">{contas.error.message}</Aviso>

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Ajustes</h1>
      <SecaoAparencia />
      <SecaoContas contas={contas.data ?? []} membros={membros.data ?? []} />
      <SecaoPessoas membros={membros.data ?? []} />
      <SecaoCategorias categorias={categorias.data ?? []} />
    </div>
  )
}

function Bloco({ titulo, children, acao }: { titulo: string; children: ReactNode; acao?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-superficie px-4 pt-4 pb-3 shadow-sm">
      <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">{titulo}</h2>
      {children}
      {acao}
    </section>
  )
}

function BotaoNovo({ texto, onClick }: { texto: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2 flex h-10 w-full items-center justify-center rounded-xl border border-dashed border-stone-300 text-sm font-semibold text-marca-700 hover:bg-marca-50"
    >
      + {texto}
    </button>
  )
}

const classeSeta =
  'flex size-10 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-transparent'

// --- Aparência ---

function SecaoAparencia() {
  const [tema, setTema] = useState<PreferenciaTema>(lerPreferencia)
  return (
    <Bloco titulo="Aparência">
      <div className="mt-3 flex flex-col gap-2">
        <Segmentado
          rotulo="Tema"
          valor={tema}
          onChange={(t) => {
            setTema(t)
            salvarPreferencia(t)
          }}
          opcoes={[
            { valor: 'automatico', texto: 'Automático' },
            { valor: 'claro', texto: 'Claro' },
            { valor: 'escuro', texto: 'Escuro' },
          ]}
        />
        <p className="text-sm text-stone-600">
          {tema === 'automatico'
            ? 'Segue o tema do celular: escuro quando ele estiver escuro, claro quando estiver claro.'
            : `Sempre ${tema}, mesmo se o celular mudar. Vale só neste aparelho.`}
        </p>
      </div>
    </Bloco>
  )
}

// --- Abas ---

function SecaoContas({ contas, membros }: { contas: Conta[]; membros: Membro[] }) {
  const reordenar = useReordenarContas()
  const [edicao, setEdicao] = useState<{ conta?: Conta } | null>(null)
  const ativas = contas.filter((c) => !c.arquivada)
  const arquivadas = contas.filter((c) => c.arquivada)
  const descricao = (c: Conta) =>
    c.tipo === 'compartilhada' ? 'Compartilhada' : `Pessoal · ${membros.find((m) => m.id === c.dono_id)?.nome ?? '?'}`

  return (
    <Bloco titulo="Contas (abas)" acao={<BotaoNovo texto="Nova conta" onClick={() => setEdicao({})} />}>
      <ul className="mt-1 divide-y divide-stone-100">
        {ativas.map((c, i) => (
          <li key={c.id} className="flex items-center gap-1 py-1.5">
            <button
              type="button"
              onClick={() => setEdicao({ conta: c })}
              className="flex min-w-0 flex-1 items-center gap-3 py-1.5 text-left"
            >
              <Bolinha cor={c.cor} className="size-3" />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{c.nome}</span>
                <span className="text-xs text-stone-500">{descricao(c)}</span>
              </span>
            </button>
            <button
              type="button"
              aria-label={`Subir ${c.nome}`}
              disabled={i === 0 || reordenar.isPending}
              onClick={() => reordenar.mutate(moverConta(ativas, c.id, -1))}
              className={classeSeta}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`Descer ${c.nome}`}
              disabled={i === ativas.length - 1 || reordenar.isPending}
              onClick={() => reordenar.mutate(moverConta(ativas, c.id, 1))}
              className={classeSeta}
            >
              ↓
            </button>
          </li>
        ))}
      </ul>
      {reordenar.isError && (
        <ErroFormulario mensagem={`Não foi possível reordenar: ${mensagemDeErro(reordenar.error)}`} />
      )}

      {arquivadas.length > 0 && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer py-2 font-medium text-stone-600">Arquivadas ({arquivadas.length})</summary>
          <ul className="divide-y divide-stone-100">
            {arquivadas.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setEdicao({ conta: c })}
                  className="flex w-full items-center gap-3 py-2.5 text-left text-stone-600"
                >
                  <Bolinha cor={c.cor} />
                  <span className="flex-1 truncate">{c.nome}</span>
                  <span className="text-xs">{descricao(c)}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <FormConta
        aberto={edicao !== null}
        onFechar={() => setEdicao(null)}
        membros={membros}
        contas={contas}
        conta={edicao?.conta}
      />
    </Bloco>
  )
}

// --- Pessoas ---

function SecaoPessoas({ membros }: { membros: Membro[] }) {
  const [editando, setEditando] = useState<Membro | null>(null)
  return (
    <Bloco titulo="Pessoas">
      <ul className="mt-1 divide-y divide-stone-100">
        {membros.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => setEditando(m)}
              className="flex w-full items-center gap-3 py-3 text-left"
            >
              <Bolinha cor={m.cor} className="size-3" />
              <span className="flex-1 font-medium">{m.nome}</span>
              <span className="text-sm text-marca-700">Editar</span>
            </button>
          </li>
        ))}
      </ul>
      <Folha aberta={editando !== null} onFechar={() => setEditando(null)} titulo="Editar pessoa">
        {editando && <FormMembro membro={editando} onFechar={() => setEditando(null)} />}
      </Folha>
    </Bloco>
  )
}

function FormMembro({ membro, onFechar }: { membro: Membro; onFechar: () => void }) {
  const editar = useEditarMembro()
  const [nome, setNome] = useState(membro.nome)
  const [cor, setCor] = useState(membro.cor ?? CORES[0])
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!nome.trim()) return setErro('Escreva o nome.')
    try {
      await editar.mutateAsync({ id: membro.id, nome: nome.trim(), cor })
      onFechar()
    } catch (err) {
      setErro(`Não foi possível salvar: ${mensagemDeErro(err)}`)
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4" noValidate>
      <Campo rotulo="Nome" dica="O nome da aba pessoal é separado: mude em Contas, se quiser.">
        <input value={nome} onChange={(e) => setNome(e.target.value)} className={classeInput} />
      </Campo>
      <Campo rotulo="Cor">
        <SeletorCor cores={CORES} valor={cor} onChange={setCor} />
      </Campo>
      <ErroFormulario mensagem={erro} />
      <BotoesFormulario salvando={editar.isPending} />
    </form>
  )
}

// --- Categorias ---

function SecaoCategorias({ categorias }: { categorias: Categoria[] }) {
  const [tipo, setTipo] = useState<TipoMovimento>('saida')
  const [edicao, setEdicao] = useState<{ categoria?: Categoria } | null>(null)
  const doTipo = categorias.filter((c) => c.tipo === tipo)
  const ativas = doTipo.filter((c) => !c.arquivada)
  const arquivadas = doTipo.filter((c) => c.arquivada)

  return (
    <Bloco titulo="Categorias" acao={<BotaoNovo texto="Nova categoria" onClick={() => setEdicao({})} />}>
      <div className="mt-3">
        <Segmentado
          rotulo="Tipo de categoria"
          valor={tipo}
          onChange={setTipo}
          opcoes={[
            { valor: 'saida', texto: 'Gastos' },
            { valor: 'entrada', texto: 'Entradas' },
          ]}
        />
      </div>
      <ul className="mt-1 divide-y divide-stone-100">
        {ativas.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => setEdicao({ categoria: c })}
              className="flex w-full items-center gap-3 py-2.5 text-left"
            >
              <span aria-hidden className="w-6 text-center">
                {c.icone}
              </span>
              <span className="flex-1">{c.nome}</span>
            </button>
          </li>
        ))}
      </ul>
      {arquivadas.length > 0 && (
        <details className="mt-1 text-sm">
          <summary className="cursor-pointer py-2 font-medium text-stone-600">Arquivadas ({arquivadas.length})</summary>
          <ul className="divide-y divide-stone-100">
            {arquivadas.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setEdicao({ categoria: c })}
                  className="flex w-full items-center gap-3 py-2.5 text-left text-stone-600"
                >
                  <span aria-hidden className="w-6 text-center">
                    {c.icone}
                  </span>
                  <span className="flex-1">{c.nome}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <Folha
        aberta={edicao !== null}
        onFechar={() => setEdicao(null)}
        titulo={edicao?.categoria ? 'Editar categoria' : 'Nova categoria'}
      >
        {edicao && <FormCategoria categoria={edicao.categoria} tipo={tipo} onFechar={() => setEdicao(null)} />}
      </Folha>
    </Bloco>
  )
}

function FormCategoria({
  categoria,
  tipo,
  onFechar,
}: {
  categoria?: Categoria
  tipo: TipoMovimento
  onFechar: () => void
}) {
  const salvarCategoria = useSalvarCategoria()
  const arquivar = useArquivarCategoria()
  const [nome, setNome] = useState(categoria?.nome ?? '')
  const [icone, setIcone] = useState(categoria?.icone ?? '')
  const [erro, setErro] = useState<string | null>(null)

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    if (!nome.trim()) return setErro('Escreva o nome.')
    try {
      await salvarCategoria.mutateAsync({
        id: categoria?.id,
        nome: nome.trim(),
        icone: icone.trim() || null,
        tipo: categoria?.tipo ?? tipo,
      })
      onFechar()
    } catch (err) {
      setErro(`Não foi possível salvar: ${mensagemDeErro(err)}`)
    }
  }

  async function alternarArquivo() {
    if (!categoria) return
    try {
      await arquivar.mutateAsync({ id: categoria.id, arquivada: !categoria.arquivada })
      onFechar()
    } catch (err) {
      setErro(`Não foi possível ${categoria.arquivada ? 'desarquivar' : 'arquivar'}: ${mensagemDeErro(err)}`)
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-stone-600">
        Categoria de {(categoria?.tipo ?? tipo) === 'saida' ? 'gasto' : 'entrada'}
      </p>
      <div className="flex gap-3">
        <div className="w-20 shrink-0">
          <Campo rotulo="Ícone">
            <input
              value={icone}
              onChange={(e) => setIcone(e.target.value)}
              placeholder="🙂"
              maxLength={8}
              className={`${classeInput} text-center`}
            />
          </Campo>
        </div>
        <div className="flex-1">
          <Campo rotulo="Nome">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={classeInput}
              autoFocus={!categoria}
            />
          </Campo>
        </div>
      </div>
      <ErroFormulario mensagem={erro} />
      <BotoesFormulario salvando={salvarCategoria.isPending} />
      {categoria && (
        <div className="flex flex-col gap-2 border-t border-stone-100 pt-3">
          {!categoria.arquivada && (
            <p className="text-xs text-stone-500">
              Arquivar tira a categoria das opções. Os lançamentos que já usam continuam com ela.
            </p>
          )}
          <button
            type="button"
            onClick={alternarArquivo}
            disabled={arquivar.isPending}
            className="h-11 rounded-xl font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50"
          >
            {categoria.arquivada ? 'Desarquivar' : 'Arquivar categoria'}
          </button>
        </div>
      )}
    </form>
  )
}
