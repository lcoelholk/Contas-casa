import { useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../lib/supabase.ts'
import { useMembroAtual, useTodasContas } from '../hooks/useDados.ts'
import { mensagemDeErro } from '../hooks/useConfiguracoes.ts'
import { abasDoMembro } from '../lib/contas.ts'
import { decodificar, lerExtrato, marcadaPorPadrao, type Extrato, type Origem } from '../lib/importar.ts'
import { formatarCentavos } from '../lib/dinheiro.ts'
import { formatarDiaMes } from '../lib/datas.ts'
import { Segmentado, classeInput } from '../components/campos.tsx'

type Resultado = { novos: number; repetidos: number; ignorados: number }

/**
 * Importar extrato: escolhe o arquivo OFX/CSV baixado do banco, confere a lista,
 * desmarca o que não quer e lança tudo de uma vez (sem duplicar o que já entrou).
 */
export default function Importar() {
  const { membro: eu } = useMembroAtual()
  const contas = useTodasContas()
  const qc = useQueryClient()
  const { minhas, compartilhadas } = abasDoMembro(contas.data ?? [], eu?.id)
  const abas = [...minhas, ...compartilhadas]

  const [extrato, setExtrato] = useState<Extrato | null>(null)
  const [origem, setOrigem] = useState<Origem>('conta')
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set())
  const [contaId, setContaId] = useState('')
  const [erroArquivo, setErroArquivo] = useState<string | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const destino = abas.find((c) => c.id === (contaId || abas[0]?.id))

  const importar = useMutation({
    mutationFn: async () => {
      const itens = extrato!.linhas
        .filter((l) => marcadas.has(l.idExterno))
        .map((l) => ({ data: l.data, descricao: l.descricao, centavos: l.centavos, id: l.idExterno }))
      const { data, error } = await db().rpc('importar_lancamentos', { p_conta: destino!.id, p_itens: itens })
      if (error) throw error
      return data as Resultado
    },
    onSuccess: (r) => {
      setResultado(r)
      qc.invalidateQueries({ queryKey: ['lancamentos'] })
    },
  })

  async function escolherArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    setResultado(null)
    importar.reset()
    const lido = lerExtrato(decodificar(await arquivo.arrayBuffer()))
    if (!lido) {
      setExtrato(null)
      setErroArquivo('Não reconheci este arquivo. Baixe o extrato em OFX (ou CSV) no app ou site do banco.')
      return
    }
    setErroArquivo(null)
    setExtrato(lido)
    mudarOrigem(lido.origem, lido)
  }

  function mudarOrigem(o: Origem, e = extrato) {
    setOrigem(o)
    if (e) setMarcadas(new Set(e.linhas.filter((l) => marcadaPorPadrao(l, o)).map((l) => l.idExterno)))
  }

  const alternar = (id: string) =>
    setMarcadas((m) => {
      const n = new Set(m)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const escolhidas = extrato?.linhas.filter((l) => marcadas.has(l.idExterno)) ?? []
  const gastos = escolhidas.filter((l) => l.centavos < 0).reduce((s, l) => s - l.centavos, 0)
  const entradas = escolhidas.filter((l) => l.centavos > 0).reduce((s, l) => s + l.centavos, 0)
  const compartilhada = destino?.tipo === 'compartilhada'

  return (
    <div className="flex flex-col gap-5 pb-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar extrato</h1>
        <p className="text-sm text-stone-600">
          Baixe o extrato ou a fatura no app do banco e escolha o arquivo aqui. Ele é lido no seu celular: nada vai
          para o banco de dados até você confirmar.
        </p>
      </div>

      <label className="flex min-h-14 cursor-pointer items-center justify-center rounded-2xl bg-destaque px-4 font-semibold text-white has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-marca-600">
        {extrato ? 'Escolher outro arquivo' : 'Escolher arquivo (OFX ou CSV)'}
        <input type="file" accept=".ofx,.csv,.txt,.qfx" onChange={escolherArquivo} className="sr-only" />
      </label>
      {erroArquivo && <p className="text-sm text-red-700">{erroArquivo}</p>}

      {!extrato && <ComoBaixar />}

      {extrato && (
        <>
          <section className="flex flex-col gap-4 rounded-2xl bg-superficie p-4">
            <p className="text-sm text-stone-500">
              {extrato.formato} · {extrato.linhas.length} linhas
            </p>
            <Segmentado
              rotulo="Esse arquivo é"
              valor={origem}
              onChange={(o) => mudarOrigem(o)}
              opcoes={[
                { valor: 'conta', texto: 'Extrato da conta' },
                { valor: 'cartao', texto: 'Fatura do cartão' },
              ]}
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-stone-700">Lançar em</span>
              <select
                value={destino?.id ?? ''}
                onChange={(e) => setContaId(e.target.value)}
                className={classeInput}
              >
                {abas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                    {c.tipo === 'compartilhada' ? ' (dividido igual)' : ''}
                  </option>
                ))}
              </select>
              {compartilhada && (
                <span className="text-xs text-stone-500">
                  Cada gasto é dividido igual: a sua parte entra paga e a do outro a pagar. Entradas ficam de fora.
                </span>
              )}
            </label>
          </section>

          <section aria-label="Linhas do extrato" className="rounded-2xl bg-superficie">
            <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-1">
              <h2 className="text-sm font-semibold text-stone-500">
                {escolhidas.length} de {extrato.linhas.length} marcadas
              </h2>
              <button
                type="button"
                onClick={() =>
                  setMarcadas(
                    escolhidas.length === extrato.linhas.length
                      ? new Set()
                      : new Set(extrato.linhas.map((l) => l.idExterno)),
                  )
                }
                className="-mr-2 min-h-11 rounded-lg px-2 text-sm font-semibold text-marca-700 hover:bg-marca-50"
              >
                {escolhidas.length === extrato.linhas.length ? 'Desmarcar todas' : 'Marcar todas'}
              </button>
            </div>
            <ul className="divide-y divide-stone-100">
              {extrato.linhas.map((l) => {
                const entrada = l.centavos > 0
                const ligada = marcadas.has(l.idExterno)
                return (
                  <li key={l.idExterno}>
                    <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2">
                      <input
                        type="checkbox"
                        checked={ligada}
                        onChange={() => alternar(l.idExterno)}
                        className="size-5 shrink-0 rounded accent-marca-600"
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className={`truncate font-medium ${ligada ? '' : 'text-stone-500'}`}>{l.descricao}</span>
                        <span className="text-xs text-stone-500">
                          {formatarDiaMes(l.data)}
                          {entrada ? (origem === 'cartao' ? ' · crédito (pagamento ou estorno)' : ' · entrada') : ''}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 font-semibold whitespace-nowrap tabular-nums ${
                          !ligada ? 'text-stone-500 line-through' : entrada ? 'text-emerald-700' : ''
                        }`}
                      >
                        {entrada ? '+' : ''}
                        {formatarCentavos(Math.abs(l.centavos))}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </section>

          <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] flex flex-col gap-2 rounded-2xl bg-superficie p-3 shadow-lg">
            {resultado ? (
              <div className="flex flex-col gap-2 text-sm">
                <p className="font-semibold text-emerald-700">
                  {resultado.novos === 1 ? '1 lançamento importado' : `${resultado.novos} lançamentos importados`}
                </p>
                {resultado.repetidos > 0 && (
                  <p className="text-stone-600">
                    {resultado.repetidos === 1
                      ? '1 já estava no app e ficou como estava.'
                      : `${resultado.repetidos} já estavam no app e ficaram como estavam.`}
                  </p>
                )}
                {resultado.ignorados > 0 && (
                  <p className="text-stone-600">
                    {resultado.ignorados === 1 ? '1 entrada ficou' : `${resultado.ignorados} entradas ficaram`} de fora
                    (aba dividida).
                  </p>
                )}
                {destino && (
                  <Link to={`/conta/${destino.id}`} className="min-h-11 py-2 font-semibold text-marca-700">
                    Ver em {destino.nome} ›
                  </Link>
                )}
              </div>
            ) : (
              <>
                <p className="text-center text-sm text-stone-600">
                  Gastos <span className="font-semibold whitespace-nowrap tabular-nums">{formatarCentavos(gastos)}</span>
                  {entradas > 0 && !compartilhada && (
                    <>
                      {' · '}Entradas{' '}
                      <span className="font-semibold whitespace-nowrap tabular-nums">{formatarCentavos(entradas)}</span>
                    </>
                  )}
                </p>
                <button
                  type="button"
                  disabled={escolhidas.length === 0 || !destino || importar.isPending}
                  onClick={() => importar.mutate()}
                  className="h-12 rounded-xl bg-marca-600 font-semibold text-white disabled:opacity-50"
                >
                  {importar.isPending
                    ? 'Importando…'
                    : `Importar ${escolhidas.length === 1 ? '1 lançamento' : `${escolhidas.length} lançamentos`}`}
                </button>
                {importar.isError && <p className="text-sm text-red-700">{mensagemDeErro(importar.error)}</p>}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ComoBaixar() {
  return (
    <section className="rounded-2xl bg-superficie p-4 text-sm text-stone-700">
      <h2 className="font-semibold text-stone-900">Como baixar o arquivo</h2>
      <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5">
        <li>
          <b>Nubank:</b> no app, abra o extrato da conta ou a fatura do cartão e procure a opção de exportar
          (o Nubank manda o arquivo por e-mail ou abre para salvar).
        </li>
        <li>
          <b>Inter:</b> no app ou no site, em Extrato, use Exportar e escolha OFX.
        </li>
        <li>
          <b>Itaú, Bradesco, BB e Santander:</b> pelo site do banco (internet banking), em Extrato ou Fatura, salve em
          OFX ou “Money”.
        </li>
      </ul>
      <p className="mt-3 text-stone-500">
        Prefira OFX quando tiver: ele traz o código de cada lançamento, e importar de novo nunca duplica.
      </p>
    </section>
  )
}
