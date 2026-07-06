import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';
import crypto from 'node:crypto';

type AnalyzeRequestBody = {
  vendedor_id?: unknown;
  data?: unknown;
};

type MessageRow = {
  lead_whatsapp: string;
  conteudo_limpo: string;
  direcao: 'recebida' | 'enviada';
  timestamp_mensagem: string;
};

const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';
const DEFAULT_OPENAI_MODEL = 'gpt-5.5';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  idleTimeoutMillis: 5_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : undefined,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body as AnalyzeRequestBody;
  const vendedorId = typeof body.vendedor_id === 'string' ? body.vendedor_id : '';

  if (!isUuid(vendedorId)) {
    return res.status(400).json({ error: 'vendedor_id must be a valid UUID' });
  }

  const dataReferencia = resolveReferenceDate(body.data);
  if (!dataReferencia) {
    return res.status(400).json({ error: 'data must use YYYY-MM-DD format' });
  }

  try {
    const messages = await fetchMessages(vendedorId, dataReferencia);

    if (messages.length === 0) {
      return res.status(200).json({
        ok: true,
        message: 'Nenhuma atividade registrada para este vendedor na data selecionada.',
        vendedor_id: vendedorId,
        data_referencia: dataReferencia,
      });
    }

    const conversationContext = formatConversationContext(messages);
    const markdownReport = await generateManagementReport({
      dataReferencia,
      conversationContext,
    });

    const relatorioId = await saveReport({
      vendedorId,
      dataReferencia,
      conteudoAnalise: markdownReport,
    });

    return res.status(200).json({
      ok: true,
      relatorio_id: relatorioId,
      vendedor_id: vendedorId,
      data_referencia: dataReferencia,
      mensagens_analisadas: messages.length,
      status: 'pendente',
    });
  } catch (error) {
    console.error('analyze endpoint failed', safeError(error));
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function getSystemPrompt(): string {
  return `
Voce e uma Diretora Comercial Senior de escolas, faculdades e cursos tecnicos.
Analise exclusivamente conversas de WhatsApp entre vendedor e leads educacionais.

Seu objetivo e gerar um relatorio gerencial curto, acionavel e facil de ler no celular.

Foques obrigatorios:
- Tempo de resposta: destaque atrasos que podem matar matriculas.
- Contorno de objecoes: avalie preco, duracao, horario, reconhecimento do MEC, modalidade, confianca e urgencia.
- Engajamento do lead: identifique quem parou de responder, quem demonstrou alta intencao e quem agendou visita/prova/aula.
- Proximos passos: liste acoes urgentes para o vendedor executar hoje.

Regras:
- Responda estritamente em Markdown.
- Use titulos curtos, bullets e negrito com parcimonia.
- Nao invente fatos que nao estejam nas conversas.
- Nao exponha dados pessoais sensiveis; mantenha qualquer marcador protegido como [CPF-PROTEGIDO].
- Seja direta, comercial e orientada a conversao de matriculas.
`.trim();
}

async function fetchMessages(
  vendedorId: string,
  dataReferencia: string,
): Promise<MessageRow[]> {
  const client = await pool.connect();

  try {
    const result = await client.query<MessageRow>(
      `
        SELECT
          lead_whatsapp,
          conteudo_limpo,
          direcao,
          timestamp_mensagem
        FROM mensagens
        WHERE vendedor_id = $1
          AND timestamp_mensagem >= ($2::date AT TIME ZONE $3)
          AND timestamp_mensagem < (($2::date + INTERVAL '1 day') AT TIME ZONE $3)
        ORDER BY lead_whatsapp ASC, timestamp_mensagem ASC
      `,
      [vendedorId, dataReferencia, SAO_PAULO_TIME_ZONE],
    );

    return result.rows;
  } finally {
    client.release();
  }
}

function formatConversationContext(messages: MessageRow[]): string {
  const grouped = new Map<string, MessageRow[]>();

  for (const message of messages) {
    const group = grouped.get(message.lead_whatsapp) ?? [];
    group.push(message);
    grouped.set(message.lead_whatsapp, group);
  }

  return [...grouped.entries()]
    .map(([leadWhatsapp, leadMessages]) => {
      const lines = leadMessages.map((message) => {
        const time = formatMessageTime(message.timestamp_mensagem);
        const speaker = message.direcao === 'enviada' ? 'Vendedor' : 'Lead';

        return `[${time}] ${speaker}: ${message.conteudo_limpo}`;
      });

      return [`---`, `Lead: +${leadWhatsapp}`, ...lines, `---`].join('\n');
    })
    .join('\n\n');
}

async function generateManagementReport(input: {
  dataReferencia: string;
  conversationContext: string;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
      instructions: getSystemPrompt(),
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `
Data de referencia: ${input.dataReferencia}

Analise as conversas abaixo e gere o relatorio gerencial em Markdown:

${input.conversationContext}
`.trim(),
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${body.slice(0, 500)}`);
  }

  const data = (await response.json()) as { output_text?: unknown };
  const output = typeof data.output_text === 'string' ? data.output_text.trim() : '';

  if (!output) {
    throw new Error('OpenAI response did not include output_text');
  }

  return output;
}

async function saveReport(input: {
  vendedorId: string;
  dataReferencia: string;
  conteudoAnalise: string;
}): Promise<string> {
  const client = await pool.connect();

  try {
    const result = await client.query<{ id: string }>(
      `
        INSERT INTO relatorios (
          vendedor_id,
          data_referencia,
          conteudo_analise,
          status
        )
        VALUES ($1, $2, $3, 'pendente')
        ON CONFLICT (vendedor_id, data_referencia)
        DO UPDATE SET
          conteudo_analise = EXCLUDED.conteudo_analise,
          status = 'pendente',
          updated_at = now()
        RETURNING id
      `,
      [input.vendedorId, input.dataReferencia, input.conteudoAnalise],
    );

    return result.rows[0].id;
  } finally {
    client.release();
  }
}

function isAuthorized(req: VercelRequest): boolean {
  const secret =
    process.env.ANALYZE_API_SECRET ??
    process.env.CRON_SECRET ??
    process.env.JWT_SECRET;

  if (!secret) {
    console.error('ANALYZE_API_SECRET, CRON_SECRET or JWT_SECRET must be configured');
    return false;
  }

  const received =
    getHeader(req, 'x-analyze-secret') ??
    getHeader(req, 'x-cron-secret') ??
    getHeader(req, 'x-api-key') ??
    getBearerToken(getHeader(req, 'authorization'));

  if (!received) return false;

  return timingSafeEqual(received, secret);
}

function resolveReferenceDate(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return isDateOnly(value.trim()) ? value.trim() : null;
  }

  const now = new Date();
  const saoPauloDate = getDatePartsInTimeZone(now, SAO_PAULO_TIME_ZONE);
  const yesterday = new Date(Date.UTC(saoPauloDate.year, saoPauloDate.month - 1, saoPauloDate.day));
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  return yesterday.toISOString().slice(0, 10);
}

function getDatePartsInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => Number(parts.find((part) => part.type === type)?.value);

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
  };
}

function formatMessageTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: SAO_PAULO_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

function getHeader(req: VercelRequest, name: string): string | null {
  const header = req.headers[name];
  if (Array.isArray(header)) return header[0] ?? null;
  return header ?? null;
}

function getBearerToken(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function timingSafeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function safeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }

  return { message: String(error) };
}
