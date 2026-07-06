import {
  AlertCircle,
  Check,
  Loader2,
  QrCode,
  RefreshCw,
  Smartphone,
  WifiOff,
} from 'lucide-react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ConnectionStatus = 'Conectado' | 'Desconectado';

type Vendedor = {
  id: string;
  nome_vendedor: string;
  whatsapp_vendedor: string | null;
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
  const [qrPayload, setQrPayload] = useState<QrPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [qrAutoRequested, setQrAutoRequested] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isConnected = vendedor?.status_whatsapp === 'Conectado';

  const statusCopy = useMemo(() => {
    if (!vendedor) return 'Carregando';
    return isConnected ? 'Conectado e monitorando' : 'Aguardando conexao';
  }, [isConnected, vendedor]);

  const loadVendedor = useCallback(async () => {
    if (!vendedorId) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/vendedores/${vendedorId}`);
      const data = (await response.json()) as Vendedor | { error?: string };

      if (!response.ok) {
        throw new Error(getApiError(data, 'Nao foi possivel carregar o vendedor.'));
      }

      setVendedor(data as Vendedor);
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
        throw new Error(data.error ?? 'Nao foi possivel verificar a conexao.');
      }

      if (!data.status_whatsapp) {
        throw new Error('Status invalido retornado pela API.');
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
      setErrorMessage('Nao foi possivel verificar a conexao agora.');
    } finally {
      setCheckingStatus(false);
    }
  }, [vendedorId]);

  const generateQrCode = useCallback(async () => {
    if (!vendedorId || generatingQr || isConnected) return;

    setQrAutoRequested(true);
    setGeneratingQr(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/vendedores/${vendedorId}/qrcode`, {
        method: 'POST',
      });
      const data = (await response.json()) as QrPayload | { error?: string };

      if (!response.ok) {
        throw new Error(getApiError(data, 'Nao foi possivel gerar o QR Code.'));
      }

      setQrPayload(data as QrPayload);
      window.setTimeout(checkConnectionStatus, 1_000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Erro ao gerar QR Code.');
    } finally {
      setGeneratingQr(false);
    }
  }, [checkConnectionStatus, generatingQr, isConnected, vendedorId]);

  useEffect(() => {
    loadVendedor();
  }, [loadVendedor]);

  useEffect(() => {
    if (!vendedor || isConnected || qrPayload || generatingQr || qrAutoRequested) return;
    generateQrCode();
  }, [generateQrCode, generatingQr, isConnected, qrAutoRequested, qrPayload, vendedor]);

  useEffect(() => {
    if (!qrPayload || isConnected) return undefined;

    const interval = window.setInterval(checkConnectionStatus, 5_000);
    return () => window.clearInterval(interval);
  }, [checkConnectionStatus, isConnected, qrPayload]);

  return (
    <>
      <Head>
        <title>Kogna Auditor | Conectar WhatsApp</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="min-h-screen px-4 py-5 text-ink sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
          <header className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-graphite/60">
                Kogna Auditor
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-normal text-ink sm:text-4xl">
                Ativacao do WhatsApp
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
                        Ola {vendedor.nome_vendedor}
                      </p>
                      <h2 className="text-2xl font-black tracking-normal">{statusCopy}</h2>
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

              <section className="rounded-[1.75rem] border border-ink/10 bg-white/90 p-5 text-center shadow-panel sm:p-8">
                <div className="mx-auto max-w-2xl">
                  <h2 className="text-3xl font-black leading-tight tracking-normal text-ink sm:text-5xl">
                    Ola {vendedor.nome_vendedor}, escaneie o codigo QR abaixo para ativar o
                    seu assistente Kogna no WhatsApp
                  </h2>
                  <p className="mt-4 text-sm leading-6 text-graphite/70 sm:text-base">
                    Abra o WhatsApp &gt; Aparelhos conectados &gt; Conectar um aparelho.
                  </p>
                </div>

                <div className="mt-7 flex justify-center">
                  {isConnected ? (
                    <div className="grid h-72 w-full max-w-sm place-items-center rounded-[1.5rem] bg-moss/10 p-6 text-moss">
                      <div>
                        <Check className="mx-auto h-12 w-12" aria-hidden="true" />
                        <p className="mt-4 text-lg font-black">WhatsApp conectado</p>
                        <p className="mt-2 text-sm font-semibold text-moss/80">
                          O monitoramento das novas conversas esta ativo.
                        </p>
                      </div>
                    </div>
                  ) : generatingQr && !qrPayload ? (
                    <div className="grid h-72 w-full max-w-sm place-items-center rounded-[1.5rem] border border-dashed border-ink/20 bg-paper/70 p-6">
                      <div>
                        <Loader2
                          className="mx-auto h-10 w-10 animate-spin text-ink"
                          aria-hidden="true"
                        />
                        <p className="mt-4 text-sm font-black text-graphite/70">
                          Gerando QR Code
                        </p>
                      </div>
                    </div>
                  ) : qrPayload?.qrCodeImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrPayload.qrCodeImage}
                      alt="QR Code para conectar WhatsApp"
                      className="h-72 w-72 rounded-[1.5rem] bg-white object-contain p-3 shadow-panel"
                    />
                  ) : qrPayload?.qrCodeText ? (
                    <pre className="max-h-72 w-full max-w-sm overflow-auto rounded-[1.5rem] bg-paper p-4 text-left text-xs text-graphite">
                      {qrPayload.qrCodeText}
                    </pre>
                  ) : (
                    <button
                      type="button"
                      onClick={generateQrCode}
                      className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-ink px-6 text-base font-black text-paper transition hover:bg-graphite"
                    >
                      <QrCode className="h-5 w-5" aria-hidden="true" />
                      Tentar gerar novamente
                    </button>
                  )}
                </div>

                {!isConnected && (
                  <p className="mt-5 text-sm font-semibold text-graphite/70">
                    A tela sera atualizada automaticamente assim que a conexao for concluida.
                  </p>
                )}
              </section>
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

function getApiError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error?: unknown }).error;
    return typeof error === 'string' && error.trim() ? error : fallback;
  }

  return fallback;
}
