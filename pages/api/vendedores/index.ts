import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'node:crypto';
import { pool } from '../../../lib/server/db';
import { createEvolutionInstance } from '../../../lib/server/evolution';

type CreateVendedorResponse = {
  id: string;
  nome_vendedor: string;
  whatsapp_gestor: string;
  vendedor_url: string | null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CreateVendedorResponse | { error: string }>,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const nomeVendedor =
    typeof req.body?.nome_vendedor === 'string' ? req.body.nome_vendedor.trim() : '';
  const whatsappGestor =
    typeof req.body?.whatsapp_gestor === 'string'
      ? normalizeInternationalPhone(req.body.whatsapp_gestor)
      : '';

  if (!nomeVendedor) {
    return res.status(400).json({ error: 'Informe o nome do vendedor.' });
  }

  if (!isInternationalPhone(whatsappGestor)) {
    return res.status(400).json({ error: 'Informe o WhatsApp do gestor com DDD.' });
  }

  const id = crypto.randomUUID();
  const evolutionInstanceId = `kogna-${id}`;
  const evolutionApiKey = process.env.EVOLUTION_API_KEY;

  if (!evolutionApiKey) {
    return res.status(500).json({ error: 'EVOLUTION_API_KEY nao configurada.' });
  }

  try {
    await createEvolutionInstance({
      instanceId: evolutionInstanceId,
      apiKey: evolutionApiKey,
    });

    const result = await pool.query<{
      id: string;
      nome_vendedor: string;
      whatsapp_gestor: string;
    }>(
      `
        INSERT INTO vendedores (
          id,
          nome_vendedor,
          whatsapp_vendedor,
          whatsapp_gestor,
          evolution_instance_id,
          evolution_apikey
        )
        VALUES ($1, $2, NULL, $3, $4, $5)
        RETURNING id, nome_vendedor, whatsapp_gestor
      `,
      [id, nomeVendedor, whatsappGestor, evolutionInstanceId, evolutionApiKey],
    );

    const vendedor = result.rows[0];

    return res.status(201).json({
      id: vendedor.id,
      nome_vendedor: vendedor.nome_vendedor,
      whatsapp_gestor: vendedor.whatsapp_gestor,
      vendedor_url: getPublicVendedorUrl(req, vendedor.id),
    });
  } catch (error) {
    console.error('failed to create vendedor', safeError(error));
    return res.status(500).json({ error: 'Nao foi possivel criar a conexao agora.' });
  }
}

function getPublicVendedorUrl(req: NextApiRequest, id: string): string | null {
  const baseUrl =
    process.env.APP_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    (req.headers.host ? `https://${req.headers.host}` : null);

  return baseUrl ? `${baseUrl.replace(/\/$/, '')}/vendedor/${id}` : null;
}

function normalizeInternationalPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
}

function isInternationalPhone(value: string): boolean {
  return /^\+\d{10,15}$/.test(value);
}

function safeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }

  return { message: String(error) };
}
