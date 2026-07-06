import {
  AlertCircle,
  Check,
  Loader2,
  QrCode,
  RefreshCw,
  Save,
  Smartphone,
  WifiOff,
} from 'lucide-react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type ConnectionStatus = 'Conectado' | 'Desconectado';

type Vendedor = {
  id: string;
  nome_vendedor: string;
  whatsapp_vendedor: string;
  whatsapp_gestor: string;
  evolution_instance_id: string;
  status_whatsapp: ConnectionStatus;
};

type QrPayload = {
  qrCodeImage: string | null;
  qrCodeText: string | null;
};

export default function VendedorPage() {
  const router = useRouter();
  const vendedorId = typeof router.query.id === 'string' ? router.query.id : null;

  const [vendedor, setVendedor] = useState<Vendedor | null>(null);
  const [nomeVendedor, setNomeVendedor] = useState('');
  const [whatsappGestor, setWhatsappGestor] = useState('');
  const [qrPayload, setQrPayload] = useState<QrPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isConnected = vendedor?.status_whatsapp === 'Conectado';

  const statusCopy = useMemo(() => {
    if (!vendedor) return 'Carregando';
    return isConnected ? 'Conectado e monitorando' : 'Aguardando conexão';
  }, [isConnected, vendedor]);

  const loadVendedor = useCallback(async () => {
    if (!vendedorId) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/vendedores/${vendedorId}`);
      const data = (await response.json()) as Vendedor | { error?: string };

      if (!response.ok) {
        throw new Error(getApiError(data, 'Não foi possível carregar o vendedor.'));
      }

      const vendedorData = data as Vendedor;
      setVendedor(vendedorData);
      setNomeVendedor(vendedorData.nome_vendedor ?? '');
      setWhatsappGestor(vendedorData.whatsapp_gestor ?? '');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, [vendedorId]);

  const checkConnectionStatus = useCallback(async () => {
    if (!vendedorId) return;

    setCheckingStatus(true);

    try {
      const response = await fetch(`/api/vendedores/${vendedorId}/status`);
      const data = (await response.json()) as { status_whatsapp?: ConnectionStatus; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? 'Não foi possível verificar a conexão.');
      }

      if (!data.status_whatsapp) {
        throw new Error('Status inválido retornado pela API.');
      }

      const nextStatus = data.status_whatsapp;
      setVendedor((current) =>
        current ? { ...current, status_whatsapp: nextStatus } : current,
      );

      if (nextStatus === 'Conectado') {
        setQrPayload(null);
        setSuccessMessage('WhatsApp conectado com sucesso.');
      }
    } catch {
      setErrorMessage('Não foi possível verificar a conexão agora.');
    } finally {
      setCheckingStatus(false);
    }
  }, [vendedorId]);

  useEffect(() => {
    loadVendedor();
  }, [loadVendedor]);

  useEffect(() => {
    if (!qrPayload || isConnected) return undefined;

    const interval = window.setInterval(checkConnectionStatus, 5_000);
    return () => window.clearInterval(interval);
  }, [checkConnectionStatus, isConnected, qrPayload]);

  async function handleGenerateQrCode() {
    if (!vendedorId) return;

    setGeneratingQr(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/vendedores/${vendedorId}/qrcode`, {
        method: 'POST',
      });
      const data = (await response.json()) as QrPayload | { error?: string };

      if (!response.ok) {
        throw new Error(getApiError(data, 'Não foi possível gerar o QR Code.'));
      }

      setQrPayload(data as QrPayload);
      window.setTimeout(checkConnectionStatus, 1_000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao gerar QR Code.');
    } finally {
      setGeneratingQr(false);
    }
  }

  async function handleSaveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vendedorId) return;

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/vendedores/${vendedorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_vendedor: nomeVendedor,
          whatsapp_gestor: whatsappGestor,
        }),
      });
      const data = (await response.json()) as Vendedor | { error?: string };

      if (!response.ok) {
        throw new Error(getApiError(data, 'Não foi possível salvar as configurações.'));
      }

      const vendedorData = data as Vendedor;
      setVendedor(vendedorData);
      setNomeVendedor(vendedorData.nome_vendedor ?? '');
      setWhatsappGestor(vendedorData.whatsapp_gestor ?? '');
      setSuccessMessage('Configurações salvas com sucesso.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Head>
        <title>Kogna Auditor | Vendedor</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="min-h-screen px-4 py-5 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
          <header className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-graphite/60">
                Kogna Auditor
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-normal text-ink sm:text-4xl">
                Pareamento do vendedor
              </h1>
            </div>
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ink text-paper shadow-panel">
              <Smartphone className="h-6 w-6" aria-hidden="true" />
            </div>
          </header>

          {loading ? (
            <LoadingState />
          ) : errorMessage && !vendedor ? (
            <ErrorState message={errorMessage} onRetry={loadVendedor} />
          ) : vendedor ? (
            <>
              <section
                className={[
                  'rounded-[1.75rem] border p-5 shadow-panel sm:p-7',
                  isConnected
                    ? 'border-moss/25 bg-white/90'
                    : 'border-ember/20 bg-white/85',
                ].join(' ')}
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={[
                        'grid h-14 w-14 shrink-0 place-items-center rounded-2xl',
                        isConnected ? 'bg-moss text-white' : 'bg-ember/10 text-ember',
                      ].join(' ')}
                    >
                      {isConnected ? (
                        <Check className="h-7 w-7" aria-hidden="true" />
                      ) : (
                        <WifiOff className="h-7 w-7" aria-hidden="true" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-graphite/65">
                        {vendedor.nome_vendedor || 'Vendedor sem nome'}
                      </p>
                      <h2 className="text-2xl font-black tracking-normal">{statusCopy}</h2>
                      <p className="mt-1 text-sm text-graphite/70">
                        WhatsApp monitorado: {formatPhone(vendedor.whatsapp_vendedor)}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={checkConnectionStatus}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-ink/10 bg-paper px-4 text-sm font-bold text-ink transition hover:border-ink/25 hover:bg-white disabled:opacity-60"
                    disabled={checkingStatus}
                  >
                    {checkingStatus ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    )}
                    Atualizar
                  </button>
                </div>
              </section>

              {(successMessage || errorMessage) && (
                <div
                  className={[
                    'flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold',
                    successMessage
                      ? 'border-moss/20 bg-moss/10 text-moss'
                      : 'border-ember/20 bg-ember/10 text-ember',
                  ].join(' ')}
                >
                  {successMessage ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>{successMessage ?? errorMessage}</span>
                </div>
              )}

              <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
                <section className="rounded-[1.75rem] border border-ink/10 bg-white/90 p-5 shadow-panel sm:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-black tracking-normal">Conexão WhatsApp</h2>
                      <p className="mt-1 text-sm leading-6 text-graphite/70">
                        {isConnected
                          ? 'Instância ativa para capturar novas conversas.'
                          : 'Faça o pareamento para iniciar a captura das próximas mensagens.'}
                      </p>
                    </div>
                    <QrCode className="h-6 w-6 shrink-0 text-graphite/50" aria-hidden="true" />
                  </div>

                  {!isConnected && (
                    <div className="mt-6">
                      {!qrPayload ? (
                        <button
                          type="button"
                          onClick={handleGenerateQrCode}
                          disabled={generatingQr}
                          className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-ink px-5 text-base font-black text-paper transition hover:bg-graphite disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {generatingQr ? (
                            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                          ) : (
                            <QrCode className="h-5 w-5" aria-hidden="true" />
                          )}
                          Gerar QR Code
                        </button>
                      ) : (
                        <div className="flex flex-col items-center rounded-[1.5rem] border border-dashed border-ink/20 bg-paper/70 p-5 text-center">
                          {qrPayload.qrCodeImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={qrPayload.qrCodeImage}
                              alt="QR Code para conectar WhatsApp"
                              className="h-64 w-64 rounded-2xl bg-white object-contain p-3 shadow-panel"
                            />
                          ) : (
                            <pre className="max-h-56 w-full overflow-auto rounded-2xl bg-white p-4 text-left text-xs text-graphite">
                              {qrPayload.qrCodeText}
                            </pre>
                          )}

                          <p className="mt-5 text-base font-black text-ink">
                            Abra o WhatsApp &gt; Aparelhos conectados &gt; Conectar um aparelho
                          </p>
                          <p className="mt-2 text-sm leading-6 text-graphite/70">
                            A tela muda automaticamente quando a conexão for concluída.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {isConnected && (
                    <div className="mt-6 rounded-2xl bg-moss/10 px-4 py-4 text-sm font-semibold text-moss">
                      Conversas novas serão gravadas e analisadas no ciclo diário.
                    </div>
                  )}
                </section>

                <section className="rounded-[1.75rem] border border-ink/10 bg-ink p-5 text-paper shadow-panel sm:p-7">
                  <h2 className="text-xl font-black tracking-normal">Configuração</h2>
                  <form className="mt-6 flex flex-col gap-4" onSubmit={handleSaveConfig}>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-bold text-paper/70">Nome do vendedor</span>
                      <input
                        value={nomeVendedor}
                        onChange={(event) => setNomeVendedor(event.target.value)}
                        className="min-h-13 rounded-2xl border border-white/10 bg-white/10 px-4 text-base font-semibold text-white outline-none transition placeholder:text-white/35 focus:border-citron/70 focus:bg-white/15"
                        placeholder="Nome completo"
                      />
                    </label>

                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-bold text-paper/70">WhatsApp do gestor</span>
                      <input
                        value={whatsappGestor}
                        onChange={(event) => setWhatsappGestor(maskInternationalPhone(event.target.value))}
                        inputMode="tel"
                        className="min-h-13 rounded-2xl border border-white/10 bg-white/10 px-4 text-base font-semibold text-white outline-none transition placeholder:text-white/35 focus:border-citron/70 focus:bg-white/15"
                        placeholder="+5511999999999"
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={saving}
                      className="mt-2 inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-citron px-5 text-base font-black text-ink transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {saving ? (
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Save className="h-5 w-5" aria-hidden="true" />
                      )}
                      Salvar configurações
                    </button>
                  </form>
                </section>
              </div>
            </>
          ) : null}
        </div>
      </main>
    </>
  );
}

function LoadingState() {
  return (
    <section className="grid min-h-[60vh] place-items-center rounded-[1.75rem] border border-ink/10 bg-white/80 p-8 shadow-panel">
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-ink" aria-hidden="true" />
        <p className="text-sm font-bold text-graphite/70">Carregando vendedor</p>
      </div>
    </section>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="grid min-h-[60vh] place-items-center rounded-[1.75rem] border border-ember/20 bg-white/85 p-8 text-center shadow-panel">
      <div className="max-w-sm">
        <AlertCircle className="mx-auto h-9 w-9 text-ember" aria-hidden="true" />
        <h2 className="mt-4 text-2xl font-black">Falha ao carregar</h2>
        <p className="mt-2 text-sm leading-6 text-graphite/70">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-ink px-5 text-sm font-black text-paper"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Tentar novamente
        </button>
      </div>
    </section>
  );
}

function maskInternationalPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 15);
  return digits ? `+${digits}` : '';
}

function formatPhone(value: string): string {
  if (!value) return 'Não informado';
  return value.startsWith('+') ? value : `+${value}`;
}

function getApiError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error?: unknown }).error;
    return typeof error === 'string' && error.trim() ? error : fallback;
  }

  return fallback;
}
