import { useState, type ReactNode } from "react";
import { useMembroAtual } from "../hooks/useDados.ts";
import { useAtalho, useGerarCodigoAtalho } from "../hooks/useAtalho.ts";
import { chavePublica, enderecoGastoRapido } from "../lib/supabase.ts";
import { mensagemDeErro } from "../hooks/useConfiguracoes.ts";

/** A tela de gasto rápido do app (#/rapido), no endereço em que o app está publicado */
const enderecoTelaRapida = `${window.location.origin}${window.location.pathname}#/rapido`;

/**
 * Gasto rápido pelo iPhone. Jeito fácil: o toque atrás abre a tela #/rapido (atalho de uma ação só).
 * Jeito avançado: o atalho pergunta valor e descrição e chama lancar_rapido com um código, sem abrir nada.
 */
export default function Atalho() {
  const { membro } = useMembroAtual();
  const atalho = useAtalho(membro?.id);
  const gerar = useGerarCodigoAtalho();
  const [codigo, setCodigo] = useState<string | null>(null);
  const [confirmandoTroca, setConfirmandoTroca] = useState(false);
  const existe = Boolean(atalho.data);

  async function criar() {
    setConfirmandoTroca(false);
    setCodigo(await gerar.mutateAsync());
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Gasto rápido no iPhone
        </h1>
        <p className="text-sm text-stone-600">
          Toque duas vezes atrás do celular e já cai na tela de lançar: valor, o
          quê e salvar.
        </p>
      </div>

      <Passo numero={1} titulo="Crie o atalho (uma ação só)">
        <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm text-stone-700 marker:font-semibold marker:text-stone-500">
          <li>
            Abra o app <b>Atalhos</b>, toque em <b>+</b> e dê o nome{" "}
            <b>Gasto rápido</b>.
          </li>
          <li>
            <div className="flex flex-col gap-2">
              <span>
                Toque em <b>Adicionar Ação</b>, procure <b>Abrir URLs</b> e cole
                este endereço:
              </span>
              <Copiavel rotulo="Endereço" valor={enderecoTelaRapida} />
            </div>
          </li>
          <li>Toque em OK. Pronto, é só isso.</li>
        </ol>
      </Passo>

      <Passo numero={2} titulo="Ligue o toque atrás do celular">
        <p className="text-sm text-stone-700">
          No iPhone:{" "}
          <b>Ajustes → Acessibilidade → Toque → Tocar Atrás → Toque Duplo</b> e
          escolha <b>Gasto rápido</b>.
        </p>
      </Passo>

      <Passo numero={3} titulo="Entre uma vez no Safari">
        <p className="text-sm text-stone-700">
          O atalho abre o endereço no Safari, que tem um login separado do app
          da tela inicial. Toque duas vezes atrás do celular agora e, se pedir,
          entre com seu e-mail e senha. Depois disso fica salvo.
        </p>
      </Passo>

      <details className="rounded-2xl bg-superficie p-4 text-sm text-stone-700 [&_summary]:min-h-11">
        <summary className="flex cursor-pointer items-center font-semibold text-stone-900">
          Jeito avançado: lançar sem abrir nada
        </summary>
        <p className="mt-2 text-stone-600">
          O atalho pergunta o valor e o que foi, e manda direto para o banco de
          dados, sem abrir o Safari. Dá mais trabalho para montar.
        </p>
        <div className="mt-4 flex flex-col gap-4">
          <Passo numero={1} titulo="Seu código">
            {codigo ? (
              <>
                <Copiavel rotulo="Código" valor={codigo} />
                <p className="text-sm text-amber-800">
                  Ele só aparece agora. Cole no atalho (passo 2) e não mande
                  para ninguém: quem tiver o código lança gastos em seu nome.
                  Perdeu o celular? Volte aqui e troque o código.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-stone-600">
                  {atalho.isPending
                    ? "Conferindo…"
                    : existe
                      ? `Você já tem um código${atalho.data?.usado_em ? `, usado pela última vez em ${new Date(atalho.data.usado_em).toLocaleDateString("pt-BR")}` : ", ainda não usado"}. Para ver de novo, troque por um novo (o antigo para de funcionar).`
                      : "Crie o código que o atalho usa para lançar em seu nome."}
                </p>
                {existe && !confirmandoTroca ? (
                  <button
                    type="button"
                    onClick={() => setConfirmandoTroca(true)}
                    className={classeBotaoSecundario}
                  >
                    Trocar o código
                  </button>
                ) : (
                  <>
                    {confirmandoTroca && (
                      <p className="text-sm font-medium text-amber-800">
                        O atalho que já está no celular para de funcionar até
                        você colar o código novo nele.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={criar}
                      disabled={gerar.isPending}
                      className={classeBotao}
                    >
                      {gerar.isPending
                        ? "Criando…"
                        : existe
                          ? "Trocar mesmo"
                          : "Criar código"}
                    </button>
                  </>
                )}
                {gerar.isError && (
                  <p className="text-sm text-red-700">
                    {mensagemDeErro(gerar.error)}
                  </p>
                )}
              </>
            )}
          </Passo>

          <Passo numero={2} titulo="Monte o atalho no app Atalhos">
            <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm text-stone-700 marker:font-semibold marker:text-stone-500">
              <li>
                Abra o app <b>Atalhos</b>, toque em <b>+</b> e dê o nome{" "}
                <b>Gasto rápido</b>.
              </li>
              <li>
                Adicione <b>Pedir Entrada</b>: tipo <b>Número</b>, pergunta
                “Quanto?”.
              </li>
              <li>
                Adicione outra <b>Pedir Entrada</b>: tipo <b>Texto</b>, pergunta
                “Com o quê?”.
              </li>
              <li>
                Adicione <b>Lista</b> com dois itens: <b>Meu</b> e <b>Casa</b>.
                Depois, <b>Escolher da Lista</b>, com a pergunta “Onde?”.
              </li>
              <li>
                <div className="flex flex-col gap-2">
                  <span>
                    Adicione <b>Obter Conteúdo do URL</b> e cole este endereço:
                  </span>
                  <Copiavel rotulo="Endereço" valor={enderecoGastoRapido} />
                  <span>
                    Toque em <b>Mostrar Mais</b>. Método: <b>POST</b>. Em{" "}
                    <b>Cabeçalhos</b>, adicione um com a chave <b>apikey</b> e
                    este valor:
                  </span>
                  <Copiavel rotulo="apikey" valor={chavePublica} />
                  <span>
                    Em <b>Corpo da Solicitação</b>, escolha <b>JSON</b> e
                    adicione quatro campos de <b>Texto</b>:
                  </span>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 rounded-xl bg-stone-50 p-3">
                    <Campo nome="p_token" valor="o seu código (passo 1)" />
                    <Campo
                      nome="p_valor"
                      valor="Entrada Fornecida do “Quanto?”"
                    />
                    <Campo
                      nome="p_descricao"
                      valor="Entrada Fornecida do “Com o quê?”"
                    />
                    <Campo nome="p_onde" valor="Item Escolhido" />
                  </dl>
                </div>
              </li>
              <li>
                Adicione <b>Mostrar Notificação</b> com o <b>Conteúdo do URL</b>
                . Ela confirma o que foi lançado.
              </li>
            </ol>
          </Passo>

          <Passo numero={3} titulo="Ligue o toque atrás do celular">
            <p className="text-sm text-stone-700">
              No iPhone:{" "}
              <b>
                Ajustes → Acessibilidade → Toque → Tocar Atrás → Toque Duplo
              </b>{" "}
              e escolha <b>Gasto rápido</b>.
            </p>
          </Passo>
        </div>
      </details>

      <section className="rounded-2xl bg-marca-50 p-4 text-sm text-marca-900">
        <h2 className="font-semibold">Bom saber</h2>
        <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
          <li>
            A categoria vem da descrição: padaria vira Mercado, uber vira
            Transporte, ifood vira Alimentação fora.
          </li>
          <li>
            “Casa” divide meio a meio: a sua parte entra paga e a do outro fica
            a pagar.
          </li>
          <li>Também funciona pela Siri: “E aí Siri, gasto rápido”.</li>
          <li>
            Para corrigir um gasto lançado assim, é só abrir o app e editar.
          </li>
        </ul>
      </section>
    </div>
  );
}

const classeBotao =
  "h-12 w-full rounded-xl bg-marca-600 font-semibold text-white disabled:opacity-50";
const classeBotaoSecundario =
  "h-11 w-full rounded-xl border border-stone-200 font-medium text-stone-700 hover:bg-stone-50";

function Passo({
  numero,
  titulo,
  children,
}: {
  numero: number;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-superficie p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-marca-600 text-sm text-white"
        >
          {numero}
        </span>
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Campo({ nome, valor }: { nome: string; valor: string }) {
  return (
    <>
      <dt className="font-mono text-xs leading-5 font-semibold text-stone-800">
        {nome}
      </dt>
      <dd className="text-xs leading-5 text-stone-600">{valor}</dd>
    </>
  );
}

/** Um valor longo (código, endereço) com botão de copiar */
function Copiavel({ rotulo, valor }: { rotulo: string; valor: string }) {
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }
  return (
    <div className="flex items-stretch gap-2 rounded-xl border border-stone-200 bg-stone-50 p-1 pl-3">
      <div className="flex min-w-0 flex-1 flex-col justify-center py-1">
        <span className="text-[11px] font-semibold tracking-wide text-stone-500 uppercase">
          {rotulo}
        </span>
        <code className="font-mono text-xs break-all text-stone-800 select-all">
          {valor}
        </code>
      </div>
      <button
        type="button"
        onClick={copiar}
        aria-label={`Copiar ${rotulo}`}
        className="min-h-11 shrink-0 rounded-lg bg-superficie px-3 text-sm font-semibold text-marca-700 shadow-sm"
      >
        {copiado ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}
