import { ArrowRight, Activity, ShieldCheck, Smartphone } from 'lucide-react';
import Head from 'next/head';
import { FormEvent, useState } from 'react';

export default function HomePage() {
  const [vendedorId, setVendedorId] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = vendedorId.trim();

    if (!isUuid(id)) {
      setError('Informe um UUID valido de vendedor.');
      return;
    }

    window.location.href = `/vendedor/${id}`;
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
                <p className="text-xs font-semibold text-graphite/60">MVP operacional</p>
              </div>
            </div>
            <span className="rounded-full border border-moss/20 bg-moss/10 px-3 py-1 text-xs font-black text-moss">
              Online
            </span>
          </header>

          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-graphite/60">
                WhatsApp conectado ao processo comercial
              </p>
              <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[0.98] tracking-normal text-ink sm:text-6xl">
                Auditoria diaria para matriculas sem painel pesado.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-graphite/75 sm:text-lg">
                Configure o vendedor, conecte o WhatsApp por QR Code e deixe o relatorio
                gerencial chegar ao gestor no ciclo diario.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="rounded-[1.75rem] border border-ink/10 bg-white/90 p-5 shadow-panel sm:p-6"
            >
              <label className="flex flex-col gap-2">
                <span className="text-sm font-black text-ink">UUID do vendedor</span>
                <input
                  value={vendedorId}
                  onChange={(event) => {
                    setVendedorId(event.target.value);
                    setError(null);
                  }}
                  className="min-h-14 rounded-2xl border border-ink/10 bg-paper px-4 text-sm font-semibold text-ink outline-none transition placeholder:text-graphite/35 focus:border-ink/40 focus:bg-white"
                  placeholder="00000000-0000-0000-0000-000000000000"
                />
              </label>

              {error && <p className="mt-3 text-sm font-bold text-ember">{error}</p>}

              <button
                type="submit"
                className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-ink px-5 text-base font-black text-paper transition hover:bg-graphite"
              >
                Abrir pareamento
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </form>
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <InfoItem
              icon={<Smartphone className="h-5 w-5" aria-hidden="true" />}
              title="QR Code"
              text="Conexao passiva pela Evolution."
            />
            <InfoItem
              icon={<ShieldCheck className="h-5 w-5" aria-hidden="true" />}
              title="LGPD"
              text="Mensagens sanitizadas antes da IA."
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
  icon: React.ReactNode;
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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
