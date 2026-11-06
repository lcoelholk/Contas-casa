import { describe, expect, it } from 'vitest'
import { decodificar, dividirCsv, lerExtrato, limparDescricao, marcadaPorPadrao } from './importar.ts'

const OFX_CONTA = `OFXHEADER:100
DATA:OFXSGML
<OFX>
<SIGNONMSGSRSV1><SONRS><FI><ORG>Banco Inter</ORG></FI></SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261105120000[-3:BRT]
<TRNAMT>-23.90
<FITID>abc1
<MEMO>PADARIA  DO ZE
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261101
<TRNAMT>5000.00
<FITID>abc2
<MEMO>Salário empresa
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`

describe('lerExtrato: OFX', () => {
  it('lê data, valor com sinal, descrição e identificador', () => {
    const e = lerExtrato(OFX_CONTA)!
    expect(e.formato).toBe('OFX · Banco Inter')
    expect(e.origem).toBe('conta')
    expect(e.linhas).toEqual([
      { data: '2026-11-05', descricao: 'Padaria do Ze', centavos: -2390, idExterno: 'ofx:abc1' },
      { data: '2026-11-01', descricao: 'Salário empresa', centavos: 500000, idExterno: 'ofx:abc2' },
    ])
  })

  it('reconhece fatura de cartão e valor com vírgula', () => {
    const e = lerExtrato(
      `<OFX><CREDITCARDMSGSRSV1><CCSTMTRS><BANKTRANLIST><STMTTRN><DTPOSTED>20261003<TRNAMT>-1.234,56<FITID>x<MEMO>Loja</STMTTRN></BANKTRANLIST></CCSTMTRS></CREDITCARDMSGSRSV1></OFX>`,
    )!
    expect(e.origem).toBe('cartao')
    expect(e.linhas[0].centavos).toBe(-123456)
  })
})

describe('lerExtrato: CSV', () => {
  it('Nubank cartão: compras positivas viram saída', () => {
    const e = lerExtrato('date,title,amount\n2026-11-03,Uber *Trip,15.90\n2026-11-04,Pagamento recebido,-500.00\n')!
    expect(e.formato).toBe('CSV · Nubank cartão')
    expect(e.origem).toBe('cartao')
    expect(e.linhas.map((l) => l.centavos)).toEqual([-1590, 50000])
  })

  it('Nubank conta: identificador vira a chave contra duplicar', () => {
    const e = lerExtrato(
      'Data,Valor,Identificador,Descrição\n05/11/2026,-45.00,6789-aa,"Transferência enviada pelo Pix - Fulano"\n',
    )!
    expect(e.linhas[0]).toEqual({
      data: '2026-11-05',
      descricao: 'Transferência enviada pelo Pix - Fulano',
      centavos: -4500,
      idExterno: 'csv:6789-aa',
    })
  })

  it('Inter: ponto e vírgula, vírgula decimal e saldo ignorado', () => {
    const e = lerExtrato(
      'Extrato Conta Corrente\nData Lançamento;Histórico;Descrição;Valor;Saldo\n06/11/2026;Pix enviado;Mercado Bom;-1.120,30;2.000,00\n',
    )!
    expect(e.linhas[0]).toMatchObject({ data: '2026-11-06', descricao: 'Mercado Bom', centavos: -112030 })
  })

  it('compras iguais no mesmo dia ganham identificadores diferentes', () => {
    const e = lerExtrato('date,title,amount\n2026-11-03,Café,5.00\n2026-11-03,Café,5.00\n')!
    expect(e.linhas[0].idExterno).not.toBe(e.linhas[1].idExterno)
    // e o mesmo arquivo gera sempre os mesmos
    expect(lerExtrato('date,title,amount\n2026-11-03,Café,5.00\n2026-11-03,Café,5.00\n')!.linhas[1].idExterno).toBe(
      e.linhas[1].idExterno,
    )
  })

  it('arquivo sem data ou valor não é reconhecido', () => {
    expect(lerExtrato('nome;idade\nana;3\n')).toBeNull()
  })
})

describe('auxiliares', () => {
  it('divide CSV respeitando aspas', () => {
    expect(dividirCsv('a;"b; c";"d ""e"""', ';')).toEqual(['a', 'b; c', 'd "e"'])
  })
  it('arruma descrição toda em maiúsculas', () => {
    expect(limparDescricao('SUPERMERCADO   DA ESQUINA')).toBe('Supermercado da Esquina')
    expect(limparDescricao('iFood *Pedido')).toBe('iFood *Pedido')
  })
  it('lê arquivo em Windows-1252', () => {
    const bytes = new Uint8Array([0x53, 0x61, 0x6c, 0xe1, 0x72, 0x69, 0x6f]) // "Salário" em latin1
    expect(decodificar(bytes.buffer)).toBe('Salário')
  })
  it('no cartão, créditos começam desmarcados', () => {
    const l = { data: '2026-11-01', descricao: 'x', centavos: 100, idExterno: 'a' }
    expect(marcadaPorPadrao(l, 'cartao')).toBe(false)
    expect(marcadaPorPadrao(l, 'conta')).toBe(true)
  })
})
