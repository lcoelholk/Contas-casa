import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.tsx'
import { useMembroAtual, useMembros, useTodasContas } from '../hooks/useDados.ts'
import { abasDoMembro } from '../lib/contas.ts'
import { Bolinha } from '../components/ui.tsx'
import { FormConta } from '../components/FormConta.tsx'
import type { Conta } from '../types/banco.ts'

/** Tudo o que não está na barra de baixo: abas, contas fixas, ajustes, sair */
export default function Mais() {
  const { sair } = useAuth()
  const { membro: eu } = useMembroAtual()
  const contas = useTodasContas()
  const membros = useMembros()
  const navigate = useNavigate()
  const [criando, setCriando] = useState(false)
  const lista = contas.data ?? []
  const { minhas, compartilhadas, dosOutros } = abasDoMembro(lista, eu?.id)
  const nomeDono = (c: Conta) => membros.data?.find((m) => m.id === c.dono_id)?.nome ?? ''

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Mais</h1>

      <Grupo titulo="Suas contas">
        {minhas.map((c, i) => (
          <ItemConta key={c.id} conta={c} detalhe={i === 0 ? 'Tudo seu no mês, com a sua parte da casa' : 'Pessoal'} />
        ))}
        {compartilhadas.map((c) => (
          <ItemConta key={c.id} conta={c} detalhe="Dividida entre vocês" />
        ))}
      </Grupo>

      <Grupo titulo="Organizar">
        <ItemLink
          para="/fixas"
          icone="🔁"
          titulo="Contas fixas"
          detalhe="Aluguel, academia, salário: o que se repete todo mês"
        />
        <ItemBotao
          icone="➕"
          titulo="Nova conta (aba)"
          detalhe="Viagem, Pet, Carro..."
          onClick={() => setCriando(true)}
        />
        <ItemLink para="/configuracoes" icone="⚙️" titulo="Ajustes" detalhe="Abas, categorias, nomes e cores" />
      </Grupo>

      {dosOutros.length > 0 && (
        <Grupo titulo="Do outro">
          {dosOutros.map((c) => (
            <ItemConta key={c.id} conta={c} detalhe={`Contas de ${nomeDono(c)}`} />
          ))}
        </Grupo>
      )}

      <button
        type="button"
        onClick={sair}
        className="h-12 rounded-2xl border border-stone-200 bg-white font-medium text-red-700 shadow-sm hover:bg-red-50"
      >
        Sair{eu ? ` (${eu.nome})` : ''}
      </button>

      <FormConta
        aberto={criando}
        onFechar={() => setCriando(false)}
        membros={membros.data ?? []}
        contas={lista}
        onCriada={(id) => navigate(`/conta/${id}`)}
      />
    </div>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="rounded-2xl border border-stone-200 bg-white px-4 pt-3 pb-1 shadow-sm">
      <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">{titulo}</h2>
      <ul className="divide-y divide-stone-100">{children}</ul>
    </section>
  )
}

const classeItem = 'flex w-full items-center gap-3 py-3 text-left'

function Conteudo({ icone, titulo, detalhe }: { icone: ReactNode; titulo: string; detalhe: string }) {
  return (
    <>
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-lg">
        {icone}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{titulo}</span>
        <span className="truncate text-xs text-stone-500">{detalhe}</span>
      </span>
      <span aria-hidden className="text-stone-400">
        ›
      </span>
    </>
  )
}

function ItemConta({ conta, detalhe }: { conta: Conta; detalhe: string }) {
  return (
    <li>
      <Link to={`/conta/${conta.id}`} className={classeItem}>
        <Conteudo icone={<Bolinha cor={conta.cor} className="size-3" />} titulo={conta.nome} detalhe={detalhe} />
      </Link>
    </li>
  )
}

function ItemLink({ para, icone, titulo, detalhe }: { para: string; icone: string; titulo: string; detalhe: string }) {
  return (
    <li>
      <Link to={para} className={classeItem}>
        <Conteudo icone={icone} titulo={titulo} detalhe={detalhe} />
      </Link>
    </li>
  )
}

function ItemBotao({
  icone,
  titulo,
  detalhe,
  onClick,
}: {
  icone: string
  titulo: string
  detalhe: string
  onClick: () => void
}) {
  return (
    <li>
      <button type="button" onClick={onClick} className={classeItem}>
        <Conteudo icone={icone} titulo={titulo} detalhe={detalhe} />
      </button>
    </li>
  )
}
