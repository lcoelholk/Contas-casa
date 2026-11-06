import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/supabase.ts";
import {
  useMembroAtual,
  useMembros,
  useTodasContas,
} from "../hooks/useDados.ts";
import {
  useCriarGastoCompartilhado,
  useCriarLancamentoPessoal,
} from "../hooks/useLancamentos.ts";
import { mensagemDeErro } from "../hooks/useConfiguracoes.ts";
import { abasDoMembro } from "../lib/contas.ts";
import { competenciaAtual } from "../lib/datas.ts";
import {
  dividirIgual,
  formatarCentavos,
  paraCentavos,
} from "../lib/dinheiro.ts";
import { CampoValor, Segmentado, classeInput } from "../components/campos.tsx";

/**
 * Gasto rápido (#/rapido): o atalho do iPhone abre direto aqui.
 * Valor, o quê e onde (sua aba ou a primeira compartilhada, dividido igual). Entra já pago, no mês atual,
 * com a categoria adivinhada pela descrição.
 */
export default function Rapido() {
  const { membro: eu } = useMembroAtual();
  const membros = useMembros();
  const contas = useTodasContas();
  const { principal, compartilhadas } = abasDoMembro(contas.data ?? [], eu?.id);
  const casa = compartilhadas[0];
  const criarPessoal = useCriarLancamentoPessoal(eu?.id);
  const criarDividido = useCriarGastoCompartilhado(eu?.id);

  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [onde, setOnde] = useState<"meu" | "casa">("meu");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const centavos = paraCentavos(valor);
    if (!centavos || centavos <= 0) return setErro("Digite quanto foi.");
    if (!eu || !principal) return setErro("Não achei a sua aba.");
    const texto = descricao.trim() || "Gasto rápido";
    setErro(null);
    setSalvando(true);
    try {
      // A mesma adivinhação de categoria do atalho e da importação (padaria → Mercado)
      const cat = await db().rpc("categoria_do_texto", { p_texto: texto });
      const comum = {
        descricao: texto,
        categoria_id: (cat.data as string | null) ?? null,
        vencimento: null,
        observacao: null,
        competencia: competenciaAtual(),
      };
      if (onde === "casa" && casa) {
        // Divide igual; o centavo que sobra fica com quem lançou
        const lista = [
          eu,
          ...(membros.data ?? []).filter((m) => m.id !== eu.id),
        ];
        const partes = dividirIgual(centavos, lista.length);
        await criarDividido.mutateAsync({
          ...comum,
          conta_id: casa.id,
          partes: Object.fromEntries(lista.map((m, i) => [m.id, partes[i]])),
          pagos: [eu.id],
        });
      } else {
        await criarPessoal.mutateAsync({
          ...comum,
          conta_id: principal.id,
          membro_id: eu.id,
          tipo: "saida",
          valor_centavos: centavos,
          pago: true,
        });
      }
      setFeito(
        `${formatarCentavos(centavos)} · ${texto}${onde === "casa" && casa ? ` (${casa.nome}, dividido)` : ""}`,
      );
      setValor("");
      setDescricao("");
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setSalvando(false);
    }
  }

  if (feito) {
    return (
      <div className="flex flex-col items-center gap-4 pt-10 text-center">
        <span
          aria-hidden
          className="flex size-16 items-center justify-center rounded-full bg-emerald-50 text-3xl text-emerald-700"
        >
          ✓
        </span>
        <div>
          <p className="text-lg font-semibold">Lançado</p>
          <p className="text-stone-600">{feito}</p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={() => setFeito(null)}
            className="h-12 rounded-xl bg-marca-600 font-semibold text-white"
          >
            Lançar outro
          </button>
          <Link
            to="/"
            className="flex h-12 items-center justify-center rounded-xl font-medium text-stone-700 hover:bg-stone-100"
          >
            Ir para o Início
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Gasto rápido</h1>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-stone-700">Quanto?</span>
        <CampoValor
          valor={valor}
          onChange={setValor}
          ariaLabel="Quanto foi"
          autoFocus
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-stone-700">Com o quê?</span>
        <input
          type="text"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Padaria, uber, ifood…"
          enterKeyHint="done"
          className={classeInput}
        />
      </label>
      {casa && (
        <Segmentado
          rotulo="Onde?"
          valor={onde}
          onChange={setOnde}
          opcoes={[
            { valor: "meu", texto: "Só meu" },
            { valor: "casa", texto: `${casa.nome} (meio a meio)` },
          ]}
        />
      )}
      {erro && <p className="text-sm text-red-700">{erro}</p>}
      <button
        type="submit"
        disabled={salvando}
        className="h-12 rounded-xl bg-marca-600 font-semibold text-white disabled:opacity-50"
      >
        {salvando ? "Salvando…" : "Salvar"}
      </button>
      <p className="text-center text-xs text-stone-500">
        Entra como pago, hoje. A categoria vem da descrição.
      </p>
    </form>
  );
}
