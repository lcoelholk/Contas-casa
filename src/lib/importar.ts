/**
 * Leitura de extratos do banco (OFX e CSV) para importar no app.
 * Tudo roda no celular: o arquivo não sai do aparelho, só os lançamentos escolhidos vão para o banco de dados.
 */
import { paraCentavos } from './dinheiro.ts'
import type { DataISO } from './datas.ts'

export type Origem = 'conta' | 'cartao'

export type LinhaExtrato = {
  data: DataISO
  descricao: string
  /** Negativo = dinheiro saindo (compra, pagamento); positivo = entrando */
  centavos: number
  /** Identifica a linha para não importar duas vezes */
  idExterno: string
}

export type Extrato = {
  formato: string
  /** Palpite de onde veio: fatura de cartão ou conta corrente */
  origem: Origem
  linhas: LinhaExtrato[]
}

/** Lê o arquivo como texto: tenta UTF-8 e, se não der, Windows-1252 (comum em OFX de banco brasileiro) */
export function decodificar(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

/** Descobre o formato pelo conteúdo e lê as linhas. null = não reconheceu. */
export function lerExtrato(texto: string): Extrato | null {
  if (/<OFX>/i.test(texto) || /OFXHEADER/i.test(texto)) return lerOfx(texto)
  return lerCsv(texto)
}

// ----------------------------------------------------------------- OFX

/** OFX (todos os bancos): blocos <STMTTRN> com data, valor, identificador e descrição */
export function lerOfx(texto: string): Extrato | null {
  const blocos = texto.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi) ?? []
  const campo = (bloco: string, nome: string) =>
    bloco.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, 'i'))?.[1].trim() ?? ''
  const linhas: LinhaExtrato[] = []
  for (const b of blocos) {
    const data = dataOfx(campo(b, 'DTPOSTED'))
    const centavos = valor(campo(b, 'TRNAMT'))
    if (!data || centavos === null || centavos === 0) continue
    const descricao = limparDescricao(campo(b, 'MEMO') || campo(b, 'NAME') || 'Sem descrição')
    const fitid = campo(b, 'FITID')
    linhas.push({ data, descricao, centavos, idExterno: fitid ? `ofx:${fitid}` : '' })
  }
  if (linhas.length === 0) return null
  completarIds(linhas)
  const banco = texto.match(/<ORG>([^<\r\n]*)/i)?.[1].trim()
  return {
    formato: `OFX${banco ? ` · ${banco}` : ''}`,
    origem: /<CREDITCARDMSGSRSV1>|<CCSTMTRS>/i.test(texto) ? 'cartao' : 'conta',
    linhas,
  }
}

/** "20261105120000[-3:BRT]" → "2026-11-05" */
function dataOfx(t: string): DataISO | null {
  const m = t.match(/^(\d{4})(\d{2})(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

// ----------------------------------------------------------------- CSV

/**
 * CSV de qualquer banco: acha o cabeçalho (coluna de data, descrição e valor) e lê as linhas.
 * Nubank cartão ("date,title,amount") vem com compras positivas: o sinal é invertido.
 */
export function lerCsv(texto: string): Extrato | null {
  const linhasTexto = texto.split(/\r?\n/).filter((l) => l.trim() !== '')
  const iCabecalho = linhasTexto.findIndex((l) => /\b(data|date)\b/i.test(semAcento(l)))
  if (iCabecalho < 0) return null
  const cab = linhasTexto[iCabecalho]
  const sep = (cab.match(/;/g) ?? []).length > (cab.match(/,/g) ?? []).length ? ';' : ','
  const nomes = dividirCsv(cab, sep).map((n) => semAcento(n).toLowerCase().trim())

  const achar = (re: RegExp, evitar?: RegExp) => nomes.findIndex((n) => re.test(n) && !(evitar && evitar.test(n)))
  const iData = achar(/^(data|date)/)
  const iValor = achar(/valor|amount|quantia/, /saldo/)
  let iDesc = achar(/descri/)
  if (iDesc < 0) iDesc = achar(/title|histor|estabelecimento|lancamento|memo/, /data/)
  const iId = achar(/identificador|^id$/)
  if (iData < 0 || iValor < 0 || iDesc < 0) return null

  const ehNubankCartao = nomes.includes('title') && nomes.includes('amount')
  const linhas: LinhaExtrato[] = []
  for (const bruta of linhasTexto.slice(iCabecalho + 1)) {
    const cols = dividirCsv(bruta, sep)
    const data = dataCsv(cols[iData] ?? '')
    const v = valor(cols[iValor] ?? '')
    if (!data || v === null || v === 0) continue
    const id = iId >= 0 ? (cols[iId] ?? '').trim() : ''
    linhas.push({
      data,
      descricao: limparDescricao(cols[iDesc] || 'Sem descrição'),
      centavos: ehNubankCartao ? -v : v,
      idExterno: id ? `csv:${id}` : '',
    })
  }
  if (linhas.length === 0) return null
  completarIds(linhas)
  return {
    formato: ehNubankCartao ? 'CSV · Nubank cartão' : 'CSV',
    origem: ehNubankCartao ? 'cartao' : 'conta',
    linhas,
  }
}

/** Divide uma linha de CSV respeitando aspas ("Padaria, centro";-12,50) */
export function dividirCsv(linha: string, sep: string): string[] {
  const cols: string[] = []
  let atual = ''
  let aspas = false
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i]
    if (c === '"') {
      if (aspas && linha[i + 1] === '"') {
        atual += '"'
        i++
      } else aspas = !aspas
    } else if (c === sep && !aspas) {
      cols.push(atual)
      atual = ''
    } else atual += c
  }
  cols.push(atual)
  return cols.map((c) => c.trim())
}

/** "05/11/2026" ou "2026-11-05" → "2026-11-05" */
function dataCsv(t: string): DataISO | null {
  const s = t.trim()
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

// ----------------------------------------------------------------- comum

/** Valor do extrato em centavos, com sinal: "-12,50", "R$ 1.234,56", "12,50-", "+3.5" */
function valor(t: string): number | null {
  let s = t.replace(/\s/g, '').replace(/^\+/, '')
  if (/-$/.test(s)) s = '-' + s.slice(0, -1)
  s = s.replace(/^(-?)R\$/i, '$1')
  return paraCentavos(s)
}

function semAcento(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Tira espaços repetidos e deixa "PADARIA  DO ZE" como "Padaria do Ze" */
export function limparDescricao(t: string): string {
  const s = t.replace(/\s+/g, ' ').trim()
  if (s !== s.toUpperCase()) return s.slice(0, 200)
  const pequenas = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em'])
  return s
    .toLowerCase()
    .split(' ')
    .map((p, i) => (i > 0 && pequenas.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ')
    .slice(0, 200)
}

/**
 * Linhas sem identificador do banco ganham um a partir de data, valor e descrição
 * (com um contador para compras iguais no mesmo dia), sempre igual para o mesmo arquivo.
 */
function completarIds(linhas: LinhaExtrato[]) {
  const vistos = new Map<string, number>()
  for (const l of linhas) {
    if (l.idExterno) continue
    const base = `${l.data}|${l.centavos}|${l.descricao.toLowerCase()}`
    const n = (vistos.get(base) ?? 0) + 1
    vistos.set(base, n)
    l.idExterno = `gerado:${base}|${n}`
  }
}

/**
 * Já vem marcada para importar? No cartão, créditos (pagamento da fatura, estorno) ficam de fora;
 * na conta, entra tudo.
 */
export function marcadaPorPadrao(l: LinhaExtrato, origem: Origem): boolean {
  return origem === 'conta' || l.centavos < 0
}
