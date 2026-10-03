import { Bolinha } from './ui.tsx'
import { formatarCentavos } from '../lib/dinheiro.ts'
import { formatarDiaMes, type DataISO } from '../lib/datas.ts'
import { statusVencimento, type Totais } from '../lib/totais.ts'
import type { Categoria, Lancamento, Membro } from '../types/banco.ts'

/** Botão redondo de pago / não pago */
export function CheckPago({
  pago,
  onClick,
  rotulo,
  tamanho = 'normal',
}: {
  pago: boolean
  onClick: () => void
  rotulo: string
  tamanho?: 'normal' | 'pequeno'
}) {
  const medida = tamanho === 'pequeno' ? 'size-6' : 'size-7'
  return (
    <button
      type="button"
      onClick={onClick}
      role="checkbox"
      aria-checked={pago}
      aria-label={rotulo}
      className={`flex ${medida} shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
        pago ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-stone-300 bg-superficie text-transparent hover:border-emerald-500'
      }`}
    >
      <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

function TextoVencimento({ l, hoje }: { l: Pick<Lancamento, 'tipo' | 'pago' | 'vencimento'>; hoje: DataISO }) {
  if (!l.vencimento) return null
  const status = statusVencimento(l, hoje)
  const dia = formatarDiaMes(l.vencimento)
  const estilos: Record<string, [string, string]> = {
    atrasado: ['text-red-700 font-medium', `venceu ${dia}`],
    hoje: ['text-amber-700 font-medium', 'vence hoje'],
    'em-breve': ['text-amber-700', `vence ${dia}`],
    pago: ['text-stone-500', `venc. ${dia}`],
    normal: ['text-stone-500', l.tipo === 'entrada' ? `previsto ${dia}` : `vence ${dia}`],
  }
  const [classe, texto] = estilos[status] ?? estilos.normal
  return <span className={classe}>{texto}</span>
}

/** Linha de detalhes separados por " · ", que quebra como texto normal */
function Detalhes({ partes }: { partes: React.ReactNode[] }) {
  const visiveis = partes.filter(Boolean)
  if (visiveis.length === 0) return null
  return (
    <span className="text-xs text-stone-500">
      {visiveis.map((p, i) => (
        <span key={i}>
          {i > 0 && <span aria-hidden> · </span>}
          {p}
        </span>
      ))}
    </span>
  )
}

/** Uma linha de lançamento (pessoal, ou a parte de uma pessoa num gasto dividido) */
export function ItemLancamento({
  lancamento: l,
  categoria,
  hoje,
  onAlternarPago,
  onAbrir,
  selo,
}: {
  lancamento: Lancamento
  categoria?: Categoria
  hoje: DataISO
  onAlternarPago: () => void
  onAbrir: () => void
  selo?: string
}) {
  const entrada = l.tipo === 'entrada'
  return (
    <li className="flex items-center gap-3 py-3">
      <CheckPago
        pago={l.pago}
        onClick={onAlternarPago}
        rotulo={`${l.descricao}: ${entrada ? (l.pago ? 'recebido' : 'marcar como recebido') : l.pago ? 'pago' : 'marcar como pago'}`}
      />
      <button type="button" onClick={onAbrir} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={`truncate font-medium ${l.pago && !entrada ? 'text-stone-500' : ''}`}>{l.descricao}</span>
          <Detalhes
            partes={[
              categoria && `${categoria.icone ?? ''} ${categoria.nome}`.trim(),
              selo,
              l.vencimento ? <TextoVencimento key="v" l={l} hoje={hoje} /> : null,
            ]}
          />
        </span>
        <span
          className={`shrink-0 font-semibold tabular-nums ${
            entrada ? 'text-emerald-700' : l.pago ? 'text-stone-500' : ''
          }`}
        >
          {entrada ? '+' : ''}
          {formatarCentavos(l.valor_centavos)}
        </span>
      </button>
    </li>
  )
}

/** Um gasto dividido na aba compartilhada, com a parte de cada membro */
export function ItemGrupo({
  linhas,
  total,
  membros,
  categoria,
  hoje,
  onAlternarPago,
  onAbrir,
  selo,
}: {
  linhas: Lancamento[]
  total: number
  membros: Membro[]
  categoria?: Categoria
  hoje: DataISO
  onAlternarPago: (l: Lancamento) => void
  onAbrir: () => void
  selo?: string
}) {
  const base = linhas[0]
  const todosPagos = linhas.every((l) => l.pago)
  return (
    <li className="py-3">
      <button type="button" onClick={onAbrir} className="flex w-full items-start gap-3 text-left">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={`truncate font-medium ${todosPagos ? 'text-stone-500' : ''}`}>{base.descricao}</span>
          <Detalhes
            partes={[
              categoria && `${categoria.icone ?? ''} ${categoria.nome}`.trim(),
              selo,
              base.vencimento ? <TextoVencimento key="v" l={{ ...base, pago: todosPagos }} hoje={hoje} /> : null,
            ]}
          />
        </span>
        <span className={`shrink-0 font-semibold tabular-nums ${todosPagos ? 'text-stone-500' : ''}`}>
          {formatarCentavos(total)}
        </span>
      </button>
      <ul className="mt-2 flex flex-col gap-1.5">
        {membros
          .map((m) => ({ m, l: linhas.find((x) => x.membro_id === m.id) }))
          .filter((x) => x.l)
          .map(({ m, l }) => (
            <li key={m.id} className="flex items-center gap-2 rounded-lg bg-stone-50 px-2 py-1.5 text-sm">
              <CheckPago
                tamanho="pequeno"
                pago={l!.pago}
                onClick={() => onAlternarPago(l!)}
                rotulo={`Parte de ${m.nome} em ${base.descricao}: ${l!.pago ? 'paga' : 'marcar como paga'}`}
              />
              <Bolinha cor={m.cor} />
              <span className="flex-1">{m.nome}</span>
              <span className={`tabular-nums ${l!.pago ? 'text-stone-500' : ''}`}>
                {formatarCentavos(l!.valor_centavos)}
              </span>
            </li>
          ))}
      </ul>
    </li>
  )
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-xs text-stone-500">{rotulo}</span>
      <span className={`text-sm font-semibold tabular-nums sm:text-base ${destaque ?? ''}`}>{formatarCentavos(valor)}</span>
    </div>
  )
}

/** Números do mês de uma pessoa */
export function PainelTotais({ totais }: { totais: Totais }) {
  return (
    <section aria-label="Totais do mês" className="rounded-2xl border border-stone-200 bg-superficie p-4 shadow-sm">
      <div className="grid grid-cols-3 gap-2">
        <Numero rotulo="A pagar" valor={totais.saidas} />
        <Numero rotulo="Pago" valor={totais.pago} destaque="text-emerald-700" />
        <Numero rotulo="Pendente" valor={totais.pendente} destaque={totais.pendente > 0 ? 'text-amber-700' : ''} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-stone-100 pt-3">
        <Numero rotulo="Entradas" valor={totais.entradas} destaque="text-emerald-700" />
        <Numero
          rotulo="Saldo"
          valor={totais.saldo}
          destaque={totais.saldo < 0 ? 'text-red-700' : ''}
        />
      </div>
    </section>
  )
}

/** Números do mês de uma conta compartilhada: total e parte de cada um */
export function PainelTotaisCompartilhada({
  total,
  pendente,
  porMembro,
}: {
  total: number
  pendente: number
  porMembro: { membro: Membro; valor: number }[]
}) {
  return (
    <section aria-label="Totais do mês" className="rounded-2xl border border-stone-200 bg-superficie p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-2">
        <Numero rotulo="Total do mês" valor={total} />
        <Numero rotulo="Pendente" valor={pendente} destaque={pendente > 0 ? 'text-amber-700' : ''} />
      </div>
      <div className="mt-3 flex flex-col gap-1.5 border-t border-stone-100 pt-3">
        {porMembro.map(({ membro, valor }) => (
          <div key={membro.id} className="flex items-center gap-2 text-sm">
            <Bolinha cor={membro.cor} />
            <span className="flex-1">{membro.nome}</span>
            <span className="font-medium tabular-nums">{formatarCentavos(valor)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

/** Botão fixo no canto para adicionar */
export function BotaoAdicionar({ texto, onClick }: { texto: string; onClick: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20">
      <div className="mx-auto flex max-w-3xl justify-end px-4">
        <button
          onClick={onClick}
          className="pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-marca-600 px-5 font-semibold text-white shadow-lg active:scale-[0.98]"
        >
          <span aria-hidden className="text-xl leading-none">+</span>
          {texto}
        </button>
      </div>
    </div>
  )
}
