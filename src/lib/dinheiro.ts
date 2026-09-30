/**
 * Dinheiro é sempre guardado e calculado em CENTAVOS (número inteiro).
 * R$ 12,50 → 1250. Nunca fazer contas com reais em ponto flutuante.
 */

const formatadorBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

/** 1250 → "R$ 12,50" */
export function formatarCentavos(centavos: number): string {
  return formatadorBRL.format(centavos / 100)
}

/**
 * Converte o que a pessoa digitou em centavos. Aceita:
 * "12,50" · "1.234,56" · "R$ 12" · "12.5" · "1234" · "-10,00"
 * Retorna null se não for um valor válido.
 */
export function paraCentavos(texto: string): number | null {
  let limpo = texto.replace(/R\$/gi, '').replace(/\s/g, '')
  if (limpo === '') return null

  let negativo = false
  if (limpo.startsWith('-')) {
    negativo = true
    limpo = limpo.slice(1)
  }

  let inteiro: string
  let fracao: string

  if (limpo.includes(',')) {
    // Formato brasileiro: ponto = milhar, vírgula = decimal
    const partes = limpo.split(',')
    if (partes.length !== 2) return null
    inteiro = partes[0].replace(/\./g, '')
    fracao = partes[1]
  } else if (/\.\d{1,2}$/.test(limpo) && (limpo.match(/\./g) ?? []).length === 1) {
    // "12.5" ou "12.50": ponto como decimal
    ;[inteiro, fracao] = limpo.split('.')
  } else {
    // "1.234" ou "1234": pontos são separadores de milhar
    inteiro = limpo.replace(/\./g, '')
    fracao = ''
  }

  if (inteiro === '') inteiro = '0'
  if (!/^\d+$/.test(inteiro) || !/^\d{0,2}$/.test(fracao)) return null

  const centavos = Number(inteiro) * 100 + Number(fracao.padEnd(2, '0'))
  if (!Number.isSafeInteger(centavos)) return null
  return negativo ? -centavos : centavos
}

/** 1250 → "12,50" (para preencher campos de formulário) */
export function centavosParaCampo(centavos: number): string {
  const sinal = centavos < 0 ? '-' : ''
  const abs = Math.abs(centavos)
  const reais = Math.floor(abs / 100)
  const resto = String(abs % 100).padStart(2, '0')
  return `${sinal}${reais},${resto}`
}

/** Soma uma lista de valores em centavos */
export function somar(valores: number[]): number {
  return valores.reduce((total, v) => total + v, 0)
}

/**
 * Divide um total em `partes` iguais, sem perder centavos.
 * O resto vai para as primeiras partes: 1000 em 3 → [334, 333, 333]
 */
export function dividirIgual(totalCentavos: number, partes: number): number[] {
  if (!Number.isInteger(partes) || partes < 1) {
    throw new Error('O número de partes deve ser um inteiro maior que zero')
  }
  const base = Math.trunc(totalCentavos / partes)
  const resto = totalCentavos - base * partes
  return Array.from({ length: partes }, (_, i) => base + (i < resto ? 1 : 0))
}

/**
 * Divide um total por percentuais (ex.: [60, 40]), sem perder centavos.
 * Arredonda cada parte e ajusta a diferença na maior parte.
 */
export function dividirPorPercentual(totalCentavos: number, percentuais: number[]): number[] {
  const soma = percentuais.reduce((a, b) => a + b, 0)
  if (soma <= 0) throw new Error('A soma dos percentuais deve ser maior que zero')

  const partes = percentuais.map((p) => Math.round((totalCentavos * p) / soma))
  const diferenca = totalCentavos - somar(partes)
  if (diferenca !== 0) {
    const maior = partes.indexOf(Math.max(...partes))
    partes[maior] += diferenca
  }
  return partes
}
