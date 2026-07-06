import {
  Activity,
  AlertCircle,
  Check,
  Copy,
  FileText,
  Loader2,
  Plus,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import type { ReactNode } from 'react';
import { FormEvent, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { pool } from '../../lib/server/db';
import { getEvolutionConnectionStatus } from '../../lib/server/evolution';

type ConnectionStatus = 'Conectado' | 'Desconectado';

type AdminSeller = {
  id: string;
  nome_vendedor: string;
  whatsapp_gestor: string;
  status_whatsapp: ConnectionStatus;
};

type AdminReport = {
  id: string;
  vendedor_id: string;
  nome_vendedor: string;
  data_referencia: string;
  status: 'pendente' | 'enviado';
  conteudo_analise: string;
  created_at: string;
};

type AdminPageProps = {
  authorized: boolean;
  secret: string;
  publicBaseUrl: string;
  metrics: {
    totalVendedores: number;
    whatsappAtivos: number;
    relatoriosGerados: number;
  };
  vendedores: AdminSeller[];
  relatorios: AdminReport[];
};

type CreatedSeller = {
  id: string;
  nome_vendedor: string;
  whatsapp_gestor: string;
  vendedor_url: string | null;
};

export default function AdminPage({
  authorized,
  secret,
  publicBaseUrl,
  metrics,
  vendedores,
  relatorios,
}: AdminPageProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [nomeVendedor, setNomeVendedor] = useState('');
  const [whatsappGestor, setWhatsappGestor] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdSeller, setCreatedSeller] = useState<CreatedSeller | null>(null);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<AdminReport | null>(relatorios[0] ?? null);

  const selectedReportTitle = useMemo(() => {
    if (!selectedReport) return 'Selecione uma auditoria';
    return `${selectedReport.nome_vendedor} - ${formatDate(selectedReport.data_referencia)}`;
  }, [selectedReport]);

  if (!authorized) {
    return <UnauthorizedState />;
  }

  async function handleCreateSeller(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    setCreatedSeller(null);

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
        throw new Error(getApiError(data, 'Nao foi possivel adicionar o vendedor.'));
      }

      setCreatedSeller(data as CreatedSeller);
      setNomeVendedor('');
      setWhatsappGestor('');
      await router.replace(`/admin?secret=${encodeURIComponent(secret)}`, undefined, {
        scroll: false,
      });
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : 'Nao foi possivel adicionar o vendedor.',
      );
    } finally {
      setCreating(false);
    }
  }

  async function copyToClipboard(value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedValue(value);
    window.setTimeout(() => setCopiedValue(null), 1800);
  }

  function getSellerUrl(id: string) {
    return `${publicBaseUrl.replace(/\/$/, '')}/vendedor/${id}`;
  }

  return (
    <>
      <Head>
        <title>Kogna Auditor | Admin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="min-h-screen px-4 py-6 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-graphite/60">
                Kogna Auditor
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-normal text-ink sm:text-5xl">
                Administracao comercial
              </h1>
            </div>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-ink px-5 text-sm font-black text-paper shadow-panel transition hover:bg-graphite"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Adicionar Vendedor
            </button>
          </header>

          <section className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="Total de Vendedores"
              value={metrics.totalVendedores}
              icon={<Smartphone className="h-5 w-5" aria-hidden="true" />}
            />
            <MetricCard
              label="WhatsApp Ativos"
              value={metrics.whatsappAtivos}
              icon={<Check className="h-5 w-5" aria-hidden="true" />}
            />
            <MetricCard
              label="Relatorios Gerados"
              value={metrics.relatoriosGerados}
              icon={<FileText className="h-5 w-5" aria-hidden="true" />}
            />
          </section>

          {createdSeller && (
            <section className="rounded-[1.75rem] border border-moss/25 bg-moss/10 p-5 shadow-panel">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-moss px-3 py-1 text-xs font-black text-white">
                    <Check className="h-4 w-4" aria-hidden="true" />
                    Vendedor criado
                  </div>
                  <p className="mt-3 text-lg font-black text-ink">
                    Envie este link para {createdSeller.nome_vendedor}
                  </p>
                  <p className="mt-2 break-all text-sm font-bold text-graphite/75">
                    {createdSeller.vendedor_url ?? getSellerUrl(createdSeller.id)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(createdSeller.vendedor_url ?? getSellerUrl(createdSeller.id))
                  }
                  className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-ink px-5 text-sm font-black text-paper transition hover:bg-graphite"
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  {copiedValue === (createdSeller.vendedor_url ?? getSellerUrl(createdSeller.id))
                    ? 'Copiado'
                    : 'Copiar link'}
                </button>
              </div>
            </section>
          )}

          <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-[1.75rem] border border-ink/10 bg-white/90 p-4 shadow-panel sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-black tracking-normal">Conexoes dos vendedores</h2>
                <span className="rounded-full bg-paper px-3 py-1 text-xs font-black text-graphite/70">
                  {vendedores.length} registros
                </span>
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-ink/10">
                <div className="hidden grid-cols-[1.1fr_1fr_0.8fr_0.9fr] bg-ink px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-paper/75 md:grid">
                  <span>Nome do Vendedor</span>
                  <span>WhatsApp do Gestor</span>
                  <span>Status</span>
                  <span>Acoes</span>
                </div>

                <div className="divide-y divide-ink/10 bg-white">
                  {vendedores.length === 0 ? (
                    <div className="p-6 text-sm font-semibold text-graphite/70">
                      Nenhum vendedor cadastrado.
                    </div>
                  ) : (
                    vendedores.map((vendedor) => (
                      <div
                        key={vendedor.id}
                        className="grid gap-3 px-4 py-4 md:grid-cols-[1.1fr_1fr_0.8fr_0.9fr] md:items-center"
                      >
                        <div>
                          <p className="text-sm font-black text-ink">{vendedor.nome_vendedor}</p>
                          <p className="mt-1 text-xs font-semibold text-graphite/55 md:hidden">
                            {vendedor.whatsapp_gestor}
                          </p>
                        </div>
                        <span className="hidden text-sm font-semibold text-graphite/75 md:block">
                          {vendedor.whatsapp_gestor}
                        </span>
                        <StatusBadge status={vendedor.status_whatsapp} />
                        <button
                          type="button"
                          onClick={() => copyToClipboard(getSellerUrl(vendedor.id))}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-ink/10 bg-paper px-3 text-xs font-black text-ink transition hover:border-ink/25 hover:bg-white"
                        >
                          <Copy className="h-4 w-4" aria-hidden="true" />
                          {copiedValue === getSellerUrl(vendedor.id)
                            ? 'Copiado'
                            : 'Copiar Link de Conexao'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-ink/10 bg-ink p-4 text-paper shadow-panel sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-black tracking-normal">Auditorias recentes</h2>
                <FileText className="h-5 w-5 text-paper/60" aria-hidden="true" />
              </div>

              <div className="mt-5 grid gap-3">
                {relatorios.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/10 p-5 text-sm font-semibold text-paper/70">
                    Nenhum relatorio gerado ainda.
                  </div>
                ) : (
                  relatorios.map((relatorio) => (
                    <button
                      key={relatorio.id}
                      type="button"
                      onClick={() => setSelectedReport(relatorio)}
                      className={[
                        'rounded-2xl border p-4 text-left transition',
                        selectedReport?.id === relatorio.id
                          ? 'border-citron bg-citron text-ink'
                          : 'border-white/10 bg-white/10 text-paper hover:bg-white/15',
                      ].join(' ')}
                    >
                      <p className="text-sm font-black">{relatorio.nome_vendedor}</p>
                      <p className="mt-1 text-xs font-bold opacity-75">
                        {formatDate(relatorio.data_referencia)} - {relatorio.status}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </section>
          </div>

          <section className="rounded-[1.75rem] border border-ink/10 bg-white/90 p-5 shadow-panel sm:p-7">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-graphite/50">
                  Visualizador de relatorio
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-normal">{selectedReportTitle}</h2>
              </div>
              {selectedReport && <StatusPill status={selectedReport.status} />}
            </div>

            <div className="mt-6 min-h-64 rounded-2xl border border-ink/10 bg-paper/70 p-5">
              {selectedReport ? (
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => (
                      <h1 className="mb-4 text-2xl font-black text-ink">{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="mb-3 mt-5 text-xl font-black text-ink">{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="mb-2 mt-4 text-lg font-black text-ink">{children}</h3>
                    ),
                    p: ({ children }) => (
                      <p className="mb-3 text-sm leading-7 text-graphite">{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className="mb-4 list-disc space-y-2 pl-5 text-sm leading-7 text-graphite">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm leading-7 text-graphite">
                        {children}
                      </ol>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-black text-ink">{children}</strong>
                    ),
                  }}
                >
                  {selectedReport.conteudo_analise}
                </ReactMarkdown>
              ) : (
                <div className="grid min-h-56 place-items-center text-center text-sm font-semibold text-graphite/65">
                  Escolha um relatorio recente para leitura.
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {modalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-ink/45 p-3 sm:place-items-center">
          <section className="w-full max-w-lg rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-panel sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black tracking-normal">Adicionar vendedor</h2>
                <p className="mt-1 text-sm leading-6 text-graphite/70">
                  Gere um novo link de pareamento.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-paper text-ink"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <form className="mt-6 flex flex-col gap-4" onSubmit={handleCreateSeller}>
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

              {createError && (
                <p className="rounded-2xl border border-ember/20 bg-ember/10 px-4 py-3 text-sm font-bold text-ember">
                  {createError}
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
                Salvar vendedor
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

function UnauthorizedState() {
  return (
    <>
      <Head>
        <title>Kogna Auditor | Acesso</title>
      </Head>
      <main className="grid min-h-screen place-items-center px-4 py-6 text-ink">
        <section className="w-full max-w-md rounded-[1.75rem] border border-ember/20 bg-white/90 p-7 text-center shadow-panel">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ember/10 text-ember">
            <ShieldCheck className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-normal">Acesso Nao Autorizado</h1>
          <p className="mt-3 text-sm leading-6 text-graphite/70">
            Verifique a chave de acesso enviada pelo gestor do sistema.
          </p>
        </section>
      </main>
    </>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[1.5rem] border border-ink/10 bg-white/85 p-5 shadow-panel">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-black text-graphite/65">{label}</p>
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-paper">{icon}</div>
      </div>
      <p className="mt-4 text-4xl font-black tracking-normal text-ink">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const connected = status === 'Conectado';

  return (
    <span
      className={[
        'inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-black',
        connected ? 'bg-moss/10 text-moss' : 'bg-ember/10 text-ember',
      ].join(' ')}
    >
      {connected ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
      {status}
    </span>
  );
}

function StatusPill({ status }: { status: 'pendente' | 'enviado' }) {
  return (
    <span className="inline-flex w-fit rounded-full bg-ink px-3 py-1 text-xs font-black text-paper">
      {status}
    </span>
  );
}

export const getServerSideProps: GetServerSideProps<AdminPageProps> = async (context) => {
  const receivedSecret = typeof context.query.secret === 'string' ? context.query.secret : '';
  const adminSecret = process.env.ADMIN_SECRET ?? '';
  const publicBaseUrl = getPublicBaseUrl(context.req.headers.host);

  if (!adminSecret || receivedSecret !== adminSecret) {
    return {
      props: {
        authorized: false,
        secret: '',
        publicBaseUrl,
        metrics: { totalVendedores: 0, whatsappAtivos: 0, relatoriosGerados: 0 },
        vendedores: [],
        relatorios: [],
      },
    };
  }

  const [vendedoresResult, relatoriosResult, relatoriosCountResult] = await Promise.all([
    pool.query<{
      id: string;
      nome_vendedor: string;
      whatsapp_gestor: string;
      evolution_instance_id: string;
      evolution_apikey: string;
    }>(
      `
        SELECT id, nome_vendedor, whatsapp_gestor, evolution_instance_id, evolution_apikey
        FROM vendedores
        ORDER BY created_at DESC
      `,
    ),
    pool.query<{
      id: string;
      vendedor_id: string;
      nome_vendedor: string | null;
      data_referencia: string;
      conteudo_analise: string;
      status: 'pendente' | 'enviado';
      created_at: string;
    }>(
      `
        SELECT
          r.id,
          r.vendedor_id,
          v.nome_vendedor,
          r.data_referencia::text,
          r.conteudo_analise,
          r.status,
          r.created_at::text
        FROM relatorios r
        LEFT JOIN vendedores v ON v.id = r.vendedor_id
        ORDER BY r.created_at DESC
        LIMIT 20
      `,
    ),
    pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM relatorios'),
  ]);

  const vendedores = await Promise.all(
    vendedoresResult.rows.map(async (vendedor) => ({
      id: vendedor.id,
      nome_vendedor: vendedor.nome_vendedor,
      whatsapp_gestor: vendedor.whatsapp_gestor,
      status_whatsapp: await getEvolutionConnectionStatus({
        instanceId: vendedor.evolution_instance_id,
        apiKey: vendedor.evolution_apikey,
      }),
    })),
  );

  return {
    props: {
      authorized: true,
      secret: receivedSecret,
      publicBaseUrl,
      metrics: {
        totalVendedores: vendedores.length,
        whatsappAtivos: vendedores.filter((vendedor) => vendedor.status_whatsapp === 'Conectado')
          .length,
        relatoriosGerados: Number(relatoriosCountResult.rows[0]?.count ?? 0),
      },
      vendedores,
      relatorios: relatoriosResult.rows.map((relatorio) => ({
        id: relatorio.id,
        vendedor_id: relatorio.vendedor_id,
        nome_vendedor: relatorio.nome_vendedor ?? 'Vendedor removido',
        data_referencia: relatorio.data_referencia,
        conteudo_analise: relatorio.conteudo_analise,
        status: relatorio.status,
        created_at: relatorio.created_at,
      })),
    },
  };
};

function getPublicBaseUrl(host?: string): string {
  return (
    process.env.APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    (host ? `https://${host}` : 'https://kogna-online.vercel.app')
  );
}

function maskBrazilPhone(value: string): string {
  return value.replace(/\D/g, '').slice(0, 13);
}

function formatDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function getApiError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error?: unknown }).error;
    return typeof error === 'string' && error.trim() ? error : fallback;
  }

  return fallback;
}
