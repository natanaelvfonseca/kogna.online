import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../lib/server/db';
import { getEvolutionConnectionStatus } from '../../../lib/server/evolution';

type VendedorResponse = {
  id: string;
  nome_vendedor: string;
  whatsapp_vendedor: string;
  whatsapp_gestor: string;
  evolution_instance_id: string;
  status_whatsapp: 'Conectado' | 'Desconectado';
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<VendedorResponse | { error: string }>,
) {
  const id = getRouteId(req);

  if (!id || !isUuid(id)) {
    return res.status(400).json({ error: 'Invalid vendedor id' });
  }

  if (req.method === 'GET') {
    return getVendedor(id, res);
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    return updateVendedor(id, req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function getVendedor(
  id: string,
  res: NextApiResponse<VendedorResponse | { error: string }>,
) {
  const result = await pool.query<{
    id: string;
    nome_vendedor: string;
    whatsapp_vendedor: string;
    whatsapp_gestor: string;
    evolution_instance_id: string;
    evolution_apikey: string;
  }>(
    `
      SELECT
        id,
        nome_vendedor,
        whatsapp_vendedor,
        whatsapp_gestor,
        evolution_instance_id,
        evolution_apikey
      FROM vendedores
      WHERE id = $1
      LIMIT 1
    `,
    [id],
  );

  const vendedor = result.rows[0];
  if (!vendedor) {
    return res.status(404).json({ error: 'Vendedor not found' });
  }

  const status = await getEvolutionConnectionStatus({
    instanceId: vendedor.evolution_instance_id,
    apiKey: vendedor.evolution_apikey,
  });

  return res.status(200).json({
    id: vendedor.id,
    nome_vendedor: vendedor.nome_vendedor,
    whatsapp_vendedor: vendedor.whatsapp_vendedor,
    whatsapp_gestor: vendedor.whatsapp_gestor,
    evolution_instance_id: vendedor.evolution_instance_id,
    status_whatsapp: status,
  });
}

async function updateVendedor(
  id: string,
  req: NextApiRequest,
  res: NextApiResponse<VendedorResponse | { error: string }>,
) {
  const nomeVendedor =
    typeof req.body?.nome_vendedor === 'string' ? req.body.nome_vendedor.trim() : '';
  const whatsappGestor =
    typeof req.body?.whatsapp_gestor === 'string' ? normalizeInternationalPhone(req.body.whatsapp_gestor) : '';

  if (!nomeVendedor) {
    return res.status(400).json({ error: 'nome_vendedor is required' });
  }

  if (!isInternationalPhone(whatsappGestor)) {
    return res.status(400).json({ error: 'whatsapp_gestor must use international format' });
  }

  const result = await pool.query<{
    id: string;
    nome_vendedor: string;
    whatsapp_vendedor: string;
    whatsapp_gestor: string;
    evolution_instance_id: string;
    evolution_apikey: string;
  }>(
    `
      UPDATE vendedores
      SET
        nome_vendedor = $2,
        whatsapp_gestor = $3
      WHERE id = $1
      RETURNING
        id,
        nome_vendedor,
        whatsapp_vendedor,
        whatsapp_gestor,
        evolution_instance_id,
        evolution_apikey
    `,
    [id, nomeVendedor, whatsappGestor],
  );

  const vendedor = result.rows[0];
  if (!vendedor) {
    return res.status(404).json({ error: 'Vendedor not found' });
  }

  const status = await getEvolutionConnectionStatus({
    instanceId: vendedor.evolution_instance_id,
    apiKey: vendedor.evolution_apikey,
  });

  return res.status(200).json({
    id: vendedor.id,
    nome_vendedor: vendedor.nome_vendedor,
    whatsapp_vendedor: vendedor.whatsapp_vendedor,
    whatsapp_gestor: vendedor.whatsapp_gestor,
    evolution_instance_id: vendedor.evolution_instance_id,
    status_whatsapp: status,
  });
}

function getRouteId(req: NextApiRequest): string | null {
  const id = req.query.id;
  return typeof id === 'string' ? id : null;
}

function normalizeInternationalPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits ? `+${digits}` : '';
}

function isInternationalPhone(value: string): boolean {
  return /^\+\d{10,15}$/.test(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
