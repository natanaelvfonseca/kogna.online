export type WhatsAppConnectionStatus = 'Conectado' | 'Desconectado';

type EvolutionRequestOptions = {
  instanceId: string;
  apiKey?: string | null;
};

type EvolutionQrCode = {
  qrCodeImage: string | null;
  qrCodeText: string | null;
};

export async function getEvolutionConnectionStatus({
  instanceId,
  apiKey,
}: EvolutionRequestOptions): Promise<WhatsAppConnectionStatus> {
  if (!instanceId) return 'Desconectado';

  const response = await evolutionFetch(`/instance/connectionState/${encodeURIComponent(instanceId)}`, {
    method: 'GET',
    apiKey,
  });

  if (!response.ok) return 'Desconectado';

  const payload = (await response.json()) as unknown;
  const normalized = JSON.stringify(payload).toLowerCase();

  return normalized.includes('open') || normalized.includes('connected') || normalized.includes('conectado')
    ? 'Conectado'
    : 'Desconectado';
}

export async function getEvolutionQrCode({
  instanceId,
  apiKey,
}: EvolutionRequestOptions): Promise<EvolutionQrCode> {
  const response = await evolutionFetch(`/instance/connect/${encodeURIComponent(instanceId)}`, {
    method: 'GET',
    apiKey,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Evolution QR request failed: ${response.status} ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as unknown;
  const candidate = findQrCandidate(payload);

  if (!candidate) {
    return { qrCodeImage: null, qrCodeText: null };
  }

  if (candidate.startsWith('data:image')) {
    return { qrCodeImage: candidate, qrCodeText: null };
  }

  if (looksLikeBase64Image(candidate)) {
    return { qrCodeImage: `data:image/png;base64,${candidate}`, qrCodeText: null };
  }

  return { qrCodeImage: null, qrCodeText: candidate };
}

async function evolutionFetch(
  path: string,
  options: RequestInit & { apiKey?: string | null },
): Promise<Response> {
  const baseUrl = process.env.EVOLUTION_API_URL;
  const apiKey = options.apiKey ?? process.env.EVOLUTION_API_KEY;

  if (!baseUrl) throw new Error('EVOLUTION_API_URL is not configured');
  if (!apiKey) throw new Error('Evolution API key is not configured');

  const url = `${baseUrl.replace(/\/$/, '')}${path}`;
  const headers = new Headers(options.headers);
  headers.set('apikey', apiKey);
  headers.set('Content-Type', 'application/json');

  return fetch(url, {
    ...options,
    headers,
  });
}

function findQrCandidate(payload: unknown): string | null {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return null;

  const record = payload as Record<string, unknown>;
  const keys = ['base64', 'qrcode', 'qrCode', 'code', 'pairingCode'];

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  for (const value of Object.values(record)) {
    const nested = findQrCandidate(value);
    if (nested) return nested;
  }

  return null;
}

function looksLikeBase64Image(value: string): boolean {
  return /^(iVBORw0KGgo|\/9j\/|PHN2Zy|R0lGOD)/.test(value);
}
