import type { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '../../../../lib/server/db';
import { getEvolutionConnectionStatus } from '../../../../lib/server/evolution';

type StatusResponse = {
  status_whatsapp: 'Conectado' | 'Desconectado';
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StatusResponse | { error: string }>,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!isUuid(id)) {
    return res.status(400).json({ error: 'Invalid vendedor id' });
  }

  const result = await pool.query<{
    evolution_instance_id: string;
    evolution_apikey: string;
  }>(
    `
      SELECT evolution_instance_id, evolution_apikey
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

  return res.status(200).json({ status_whatsapp: status });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
