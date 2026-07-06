import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';
import crypto from 'node:crypto';

type Direction = 'recebida' | 'enviada';

type ExtractedMessage = {
  evolutionMessageId: string;
  instanceId: string | null;
  vendedorWhatsapp: string | null;
  leadWhatsapp: string;
  conteudoLimpo: string;
  direcao: Direction;
  timestampMensagem: Date;
};

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

  const payload = req.body;

  if (!isMessagesUpsertEvent(payload)) {
    return res.status(200).json({ ignored: true, reason: 'unsupported_event' });
  }

  try {
    const messages = extractMessages(payload);

    if (messages.length === 0) {
      return res.status(200).json({ ignored: true, reason: 'no_text_messages' });
    }

    const saved = await persistMessages(messages);

    return res.status(200).json({ ok: true, received: messages.length, saved });
  } catch (error) {
    console.error('evolution webhook failed', safeError(error));
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function isAuthorized(req: VercelRequest): boolean {
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET ?? process.env.EVOLUTION_API_KEY;
  if (!secret) {
    console.error('EVOLUTION_WEBHOOK_SECRET or EVOLUTION_API_KEY is not configured');
    return false;
  }

  const received =
    getHeader(req, 'x-evolution-webhook-secret') ??
    getHeader(req, 'x-webhook-secret') ??
    getHeader(req, 'x-api-key') ??
    getBearerToken(getHeader(req, 'authorization'));

  if (!received) return false;

  return timingSafeEqual(received, secret);
}

function isMessagesUpsertEvent(payload: unknown): boolean {
  if (!isRecord(payload)) return false;

  const event = getString(payload.event) ?? getString(payload.type);
  return event === 'messages.upsert';
}

function extractMessages(payload: unknown): ExtractedMessage[] {
  if (!isRecord(payload)) return [];

  const instanceId =
    getString(payload.instance) ??
    getString(payload.instanceId) ??
    getString(payload.instanceName);

  const data = payload.data;
  const items = Array.isArray(data) ? data : [data];

  return items.flatMap((item) => {
    const extracted = extractMessage(item, instanceId);
    return extracted ? [extracted] : [];
  });
}

function extractMessage(item: unknown, fallbackInstanceId: string | null): ExtractedMessage | null {
  if (!isRecord(item)) return null;

  const key = isRecord(item.key) ? item.key : {};
  const message = isRecord(item.message) ? item.message : item;
  const text = extractText(message);

  if (!text) return null;

  const evolutionMessageId =
    getString(key.id) ??
    getString(item.id) ??
    getString(item.messageId);

  if (!evolutionMessageId) return null;

  const fromMe = Boolean(key.fromMe ?? item.fromMe);
  const remoteJid = getString(key.remoteJid) ?? getString(item.remoteJid);
  const participant = getString(key.participant) ?? getString(item.participant);
  const senderJid = getString(item.sender) ?? participant;
  const instanceId =
    getString(item.instanceId) ??
    getString(item.instance) ??
    fallbackInstanceId;

  const vendedorWhatsapp = normalizePhone(
    getString(item.owner) ??
      getString(item.senderNumber) ??
      getString(item.instanceOwner) ??
      (fromMe ? senderJid : null),
  );

  const leadWhatsapp = normalizePhone(fromMe ? remoteJid : senderJid ?? remoteJid);
  if (!leadWhatsapp) return null;

  return {
    evolutionMessageId,
    instanceId,
    vendedorWhatsapp,
    leadWhatsapp,
    conteudoLimpo: sanitizeSensitiveData(text),
    direcao: fromMe ? 'enviada' : 'recebida',
    timestampMensagem: parseEvolutionTimestamp(item),
  };
}

function extractText(message: Record<string, unknown>): string | null {
  const directText =
    getString(message.conversation) ??
    getString(message.text) ??
    getString(message.body);

  if (directText) return directText.trim();

  const extendedText = getNestedString(message, ['extendedTextMessage', 'text']);
  if (extendedText) return extendedText.trim();

  const caption =
    getNestedString(message, ['imageMessage', 'caption']) ??
    getNestedString(message, ['videoMessage', 'caption']) ??
    getNestedString(message, ['documentMessage', 'caption']);

  return caption?.trim() || null;
}

export function sanitizeSensitiveData(text: string): string {
  return text
    // CPF em formatos como 000.000.000-00 ou 00000000000.
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF-PROTEGIDO]')
    // Cartoes comuns com 13 a 19 digitos, aceitando espacos ou hifens.
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, '[CARTAO-PROTEGIDO]')
    // Frases comuns em que o aluno envia senha/codigo de acesso.
    .replace(
      /\b(senha|password|codigo|c[oó]digo|token|pin)\s*[:=]?\s*\S+/gi,
      '$1: [SEGREDO-PROTEGIDO]',
    )
    // E-mails sao mascarados para reduzir exposicao de identificadores pessoais.
    .replace(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      '[EMAIL-PROTEGIDO]',
    );
}

async function persistMessages(messages: ExtractedMessage[]): Promise<number> {
  const client = await pool.connect();

  try {
    let saved = 0;

    for (const message of messages) {
      const duplicate = await client.query(
        'SELECT 1 FROM mensagens WHERE evolution_message_id = $1 LIMIT 1',
        [message.evolutionMessageId],
      );

      if (duplicate.rowCount && duplicate.rowCount > 0) continue;

      const vendedor = await client.query<{ id: string }>(
        `
          SELECT id
          FROM vendedores
          WHERE ($1::text IS NOT NULL AND evolution_instance_id = $1)
             OR ($2::text IS NOT NULL AND whatsapp_vendedor = $2)
          LIMIT 1
        `,
        [message.instanceId, message.vendedorWhatsapp],
      );

      const vendedorId = vendedor.rows[0]?.id;
      if (!vendedorId) {
        console.warn('message ignored: seller not found', {
          evolutionMessageId: message.evolutionMessageId,
          instanceId: message.instanceId,
          vendedorWhatsapp: message.vendedorWhatsapp,
        });
        continue;
      }

      await client.query(
        `
          INSERT INTO mensagens (
            evolution_message_id,
            vendedor_id,
            lead_whatsapp,
            conteudo_limpo,
            direcao,
            timestamp_mensagem
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (evolution_message_id) DO NOTHING
        `,
        [
          message.evolutionMessageId,
          vendedorId,
          message.leadWhatsapp,
          message.conteudoLimpo,
          message.direcao,
          message.timestampMensagem,
        ],
      );

      saved += 1;
    }

    return saved;
  } finally {
    client.release();
  }
}

function parseEvolutionTimestamp(item: Record<string, unknown>): Date {
  const raw =
    getString(item.messageTimestamp) ??
    getString(item.timestamp) ??
    getString(item.messageTimestampMs);

  if (!raw) return new Date();

  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    return new Date(numeric > 9_999_999_999 ? numeric : numeric * 1_000);
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function normalizePhone(value: string | null): string | null {
  if (!value) return null;
  const userPart = value.split('@')[0];
  const digits = userPart.replace(/\D/g, '');
  return digits || null;
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

function getNestedString(record: Record<string, unknown>, path: string[]): string | null {
  let current: unknown = record;

  for (const key of path) {
    if (!isRecord(current)) return null;
    current = current[key];
  }

  return getString(current);
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function safeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }

  return { message: String(error) };
}
