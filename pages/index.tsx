import {
  Activity,
  Check,
  Copy,
  Loader2,
  Plus,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import Head from 'next/head';
import type { ReactNode } from 'react';
import { FormEvent, useMemo, useState } from 'react';

type CreatedSeller = {
  id: string;
  nome_vendedor: string;
  whatsapp_gestor: string;
  vendedor_url: string | null;
};

export default function HomePage() {
  const [nomeVendedor, setNomeVendedor] = useState('');
  const [whatsappGestor, setWhatsappGestor] = useState('');
  const [createdSeller, setCreatedSeller] = useState<CreatedSeller | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sellerLink = useMemo(() => {
    if (!createdSeller) return '';
    if (createdSeller.vendedor_url) return createdSeller.vendedor_url;
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/vendedor/${createdSeller.id}`;
  }, [createdSeller]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setCopied(false);
    setCreatedSeller(null);
    setError(null);

    try {
      const response = await fetch('/api/vendedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_vendedor: nomeVendedor,
          whatsapp_gestor: whatsappGestor,
        }),
      });
      const data = (await response.json()) as CreatedSeller | { error?: string };

      if (!response.ok) {
        throw new Error(getApiError(data, 'Nao foi possivel criar a conexao.'));
      }

      setCreatedSeller(data as CreatedSeller);
      setNomeVendedor('');
      setWhatsappGestor('');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Nao foi possivel criar a conexao agora.',
      );
    } finally {
      setCreating(false);
    }
  }

  async function copySellerLink() {
    if (!sellerLink) return;

    await navigator.clipboard.writeText(sellerLink);
    setCopied(true);
  }

  return (
    <>
      <Head>
        <title>Kogna Auditor</title>
        <meta
          name="description"
          content="Pareamento WhatsApp e auditoria comercial diaria para vendas educacionais."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="min-h-screen px-4 py-6 text-ink sm:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col justify-between gap-8">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-ink text-paper shadow-panel">
                <Activity className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-black">Kogna Auditor</p>
                <p className="text-xs font-semibold text-graphite/60">Configuracao do gestor</p>
              </div>
            </div>
            <span className="rounded-full border border-moss/20 bg-moss/10 px-3 py-1 text-xs font-black text-moss">
              Online
            </span>
          </header>

          <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-graphite/60">
                Crie o link de pareamento
              </p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[0.98] tracking-normal text-ink sm:text-6xl">
                Conecte vendedores sem pedir nenhum codigo tecnico.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-graphite/75 sm:text-lg">
                Cadastre o vendedor, copie o link gerado e envie para ele escanear o QR Code
                do WhatsApp. O relatorio diario continua indo direto para o gestor.
              </p>
            </div>

            <section className="rounded-[1.75rem] border border-ink/10 bg-white/90 p-5 shadow-panel sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black tracking-normal">
                    Criar nova conexao de vendedor
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-graphite/70">
                    O link de pareamento sera gerado automaticamente.
                  </p>
                </div>
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ink text-paper">
                  <Plus className="h-5 w-5" aria-hidden="true" />
                </div>
              </div>

              <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-black text-ink">Nome do vendedor</span>
                  <input
                    value={nomeVendedor}
                    onChange={(event) => setNomeVendedor(event.target.value)}
                    className="min-h-14 rounded-2xl border border-ink/10 bg-paper px-4 text-base font-semibold text-ink outline-none transition placeholder:text-graphite/35 focus:border-ink/40 focus:bg-white"
                    placeholder="Marcos Silva"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-black text-ink">WhatsApp do gestor</span>
                  <input
                    value={whatsappGestor}
                    onChange={(event) => setWhatsappGestor(maskBrazilPhone(event.target.value))}
                    inputMode="tel"
                    className="min-h-14 rounded-2xl border border-ink/10 bg-paper px-4 text-base font-semibold text-ink outline-none transition placeholder:text-graphite/35 focus:border-ink/40 focus:bg-white"
                    placeholder="11999999999"
                  />
                </label>

                {error && (
                  <p className="rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-sm font-bold text-ember">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-ink px-5 text-base font-black text-paper transition hover:bg-graphite disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {creating ? (
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Plus className="h-5 w-5" aria-hidden="true" />
                  )}
                  Criar conexao
                </button>
              </form>
            </section>
          </section>

          {createdSeller && sellerLink && (
            <section className="rounded-[1.75rem] border border-moss/25 bg-moss/10 p-5 shadow-panel sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-moss px-3 py-1 text-xs font-black text-white">
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Pronto
                  </div>
                  <h2 className="mt-3 text-2xl font-black tracking-normal text-ink">
                    Envie este link para o vendedor conectar o WhatsApp
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-graphite/75">
                    {createdSeller.nome_vendedor} vai abrir direto a tela de QR Code.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={copySellerLink}
                  className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-ink px-5 text-sm font-black text-paper transition hover:bg-graphite"
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  {copied ? 'Link copiado' : 'Copiar link'}
                </button>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-moss/20 bg-white/85 p-4 text-sm font-bold text-ink">
                <span className="break-all">{sellerLink}</span>
              </div>
            </section>
          )}

          <section className="grid gap-3 sm:grid-cols-3">
            <InfoItem
              icon={<Smartphone className="h-5 w-5" aria-hidden="true" />}
              title="QR Code"
              text="O vendedor recebe um link simples."
            />
            <InfoItem
              icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
              title="LGPD"
              text="Mensagens seguem sanitizadas antes da IA."
            />
            <InfoItem
              icon={<Activity className="h-5 w-5" aria-hidden="true" />}
              title="Batch diario"
              text="Relatorio comercial sem dashboard complexo."
            />
          </section>
        </div>
      </main>
    </>
  );
}

function InfoItem({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white/65 p-4">
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-ink text-paper">
        {icon}
      </div>
      <h2 className="text-sm font-black">{title}</h2>
      <p className="mt-1 text-sm leading-5 text-graphite/70">{text}</p>
    </div>
  );
}

function maskBrazilPhone(value: string): string {
  return value.replace(/\D/g, '').slice(0, 13);
}

function getApiError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error?: unknown }).error;
    return typeof error === 'string' && error.trim() ? error : fallback;
  }

  return fallback;
}
