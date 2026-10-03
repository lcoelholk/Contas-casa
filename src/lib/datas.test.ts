import { describe, expect, it } from 'vitest'
import {
  competenciaAtual,
  listaDeMeses,
  nomeCurtoDoMes,
  competenciaDe,
  diasEntre,
  formatarDiaMes,
  hoje,
  mesesEntre,
  nomeDaCompetencia,
  numeroDaParcela,
  somarMeses,
  ultimoDiaDoMes,
  vencimentoNoMes,
} from './datas.ts'

describe('hoje / competenciaAtual (fuso de São Paulo)', () => {
  it('23h de 31/10 em São Paulo ainda é outubro (já é 1º/11 em UTC)', () => {
    const agora = new Date('2026-11-01T02:00:00Z') // 23:00 do dia 31/10 em SP
    expect(hoje(agora)).toBe('2026-10-31')
    expect(competenciaAtual(agora)).toBe('2026-10-01')
  })

  it('meio-dia em São Paulo', () => {
    const agora = new Date('2026-09-30T15:00:00Z')
    expect(hoje(agora)).toBe('2026-09-30')
  })
})

describe('competenciaDe', () => {
  it('leva para o dia 1', () => {
    expect(competenciaDe('2026-10-15')).toBe('2026-10-01')
  })

  it('rejeita data inválida', () => {
    expect(() => competenciaDe('15/10/2026')).toThrow()
  })
})

describe('somarMeses / mesesEntre', () => {
  it('atravessa a virada do ano', () => {
    expect(somarMeses('2026-11-01', 3)).toBe('2027-02-01')
    expect(somarMeses('2027-01-01', -1)).toBe('2026-12-01')
    expect(somarMeses('2026-10-01', 12)).toBe('2027-10-01')
  })

  it('conta meses entre competências', () => {
    expect(mesesEntre('2026-10-01', '2027-01-01')).toBe(3)
    expect(mesesEntre('2026-10-01', '2026-10-01')).toBe(0)
    expect(mesesEntre('2026-10-01', '2026-08-01')).toBe(-2)
  })
})

describe('vencimentoNoMes', () => {
  it('usa o dia pedido quando existe', () => {
    expect(vencimentoNoMes('2026-10-01', 10)).toBe('2026-10-10')
  })

  it('usa o último dia em mês curto', () => {
    expect(vencimentoNoMes('2026-04-01', 31)).toBe('2026-04-30')
    expect(vencimentoNoMes('2027-02-01', 30)).toBe('2027-02-28')
    expect(vencimentoNoMes('2028-02-01', 31)).toBe('2028-02-29') // bissexto
  })

  it('último dia do mês', () => {
    expect(ultimoDiaDoMes(2026, 2)).toBe(28)
    expect(ultimoDiaDoMes(2026, 12)).toBe(31)
  })
})

describe('numeroDaParcela', () => {
  it('geladeira em 12x começando em outubro', () => {
    expect(numeroDaParcela('2026-10-01', '2026-10-01')).toBe(1)
    expect(numeroDaParcela('2026-10-01', '2027-09-01')).toBe(12)
    expect(numeroDaParcela('2026-10-01', '2026-09-01')).toBe(0) // antes de começar
  })
})

describe('formatação', () => {
  it('nome do mês em português', () => {
    expect(nomeDaCompetencia('2026-10-01')).toBe('outubro de 2026')
    expect(nomeDaCompetencia('2027-01-01')).toBe('janeiro de 2027')
  })

  it('dia/mês', () => {
    expect(formatarDiaMes('2026-10-05')).toBe('05/10')
  })

  it('dias entre datas', () => {
    expect(diasEntre('2026-09-30', '2026-10-05')).toBe(5)
    expect(diasEntre('2026-10-05', '2026-09-30')).toBe(-5)
  })
})

describe('listaDeMeses e nomeCurtoDoMes', () => {
  it('lista os meses inclusive, virando o ano', () => {
    expect(listaDeMeses('2026-11-01', '2027-02-01')).toEqual(['2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01'])
    expect(listaDeMeses('2026-11-01', '2026-10-01')).toEqual([])
  })

  it('nome curto', () => {
    expect(nomeCurtoDoMes('2026-10-01')).toBe('out')
    expect(nomeCurtoDoMes('2027-01-01', true)).toBe('jan/27')
  })
})
