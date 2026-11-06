import type { ReactNode } from "react";
import { formatarCentavos } from "../lib/dinheiro.ts";
import type { Totais } from "../lib/totais.ts";

/**
 * O bloco do topo (Início e abas): "Falta pagar" grande, a barra do quanto já foi pago
 * e, numa linha só, entradas e saldo. É o único lugar com cor forte na tela.
 */
export function Destaque({
  totais: t,
  topo,
  semSaldo,
  children,
}: {
  totais: Totais;
  /** Contas compartilhadas não têm entradas: esconde a linha de entradas e saldo */
  semSaldo?: boolean;
  /** Linha de cima: de quem é o mês, link para as contas... */
  topo?: ReactNode;
  /** Embaixo da barra (ex.: comparação com o mês passado) */
  children?: ReactNode;
}) {
  const percentual = t.saidas > 0 ? Math.round((t.pago * 100) / t.saidas) : 0;
  const vazio = t.saidas === 0 && t.entradas === 0;
  return (
    <section
      aria-label="Resumo do mês"
      className="rounded-3xl bg-destaque p-5 text-white"
    >
      {topo && (
        <div className="-mt-2 mb-2 flex items-center justify-between gap-2">
          {topo}
        </div>
      )}
      {vazio ? (
        <p className="text-white/80">
          Nada lançado neste mês ainda. Use o + para começar.
        </p>
      ) : (
        <>
          <p className="text-sm text-white/80">
            {t.pendente > 0 ? "Falta pagar" : "Tudo pago"}
          </p>
          <p className="text-4xl font-bold tracking-tight whitespace-nowrap tabular-nums">
            {formatarCentavos(t.pendente)}
          </p>
          {t.saidas > 0 && (
            <>
              <div
                role="progressbar"
                aria-valuenow={percentual}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Quanto do mês já foi pago"
                className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/25"
              >
                <div
                  className="h-full rounded-full bg-white"
                  style={{ width: `${percentual}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-white/80">
                <span className="font-semibold whitespace-nowrap text-white tabular-nums">
                  {formatarCentavos(t.pago)}
                </span>{" "}
                de{" "}
                <span className="whitespace-nowrap tabular-nums">
                  {formatarCentavos(t.saidas)}
                </span>{" "}
                já pago
              </p>
            </>
          )}
          {!semSaldo && (
            <p className="mt-1 text-sm text-white/80">
              Entradas{" "}
              <span className="whitespace-nowrap tabular-nums">
                {formatarCentavos(t.entradas)}
              </span>
              {" · "}Saldo{" "}
              <span className="font-semibold whitespace-nowrap text-white tabular-nums">
                {formatarCentavos(t.saldo)}
              </span>
            </p>
          )}
          {children}
        </>
      )}
    </section>
  );
}
