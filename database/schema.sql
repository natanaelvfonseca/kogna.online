-- Kogna Auditor - PostgreSQL schema
-- MVP scope: passive WhatsApp ingestion, daily batch analysis, and report delivery.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'direcao_mensagem') THEN
        CREATE TYPE direcao_mensagem AS ENUM ('recebida', 'enviada');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_relatorio') THEN
        CREATE TYPE status_relatorio AS ENUM ('pendente', 'enviado');
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS vendedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_vendedor VARCHAR(160) NOT NULL,
    whatsapp_vendedor VARCHAR(32) NOT NULL UNIQUE,
    whatsapp_gestor VARCHAR(32) NOT NULL,
    evolution_instance_id VARCHAR(160) NOT NULL UNIQUE,
    evolution_apikey TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mensagens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evolution_message_id VARCHAR(160) NOT NULL,
    vendedor_id UUID NOT NULL REFERENCES vendedores(id) ON DELETE CASCADE,
    lead_whatsapp VARCHAR(32) NOT NULL,
    conteudo_limpo TEXT NOT NULL,
    direcao direcao_mensagem NOT NULL,
    timestamp_mensagem TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT mensagens_evolution_message_id_unique UNIQUE (evolution_message_id)
);

CREATE TABLE IF NOT EXISTS relatorios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendedor_id UUID NOT NULL REFERENCES vendedores(id) ON DELETE CASCADE,
    data_referencia DATE NOT NULL,
    conteudo_analise TEXT NOT NULL,
    status status_relatorio NOT NULL DEFAULT 'pendente',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT relatorios_vendedor_data_unique UNIQUE (vendedor_id, data_referencia)
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS vendedores_set_updated_at ON vendedores;
CREATE TRIGGER vendedores_set_updated_at
BEFORE UPDATE ON vendedores
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS relatorios_set_updated_at ON relatorios;
CREATE TRIGGER relatorios_set_updated_at
BEFORE UPDATE ON relatorios
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Batch analysis runs by vendedor and message date. This index keeps the daily
-- cron query narrow even when total message volume grows across many sellers.
CREATE INDEX IF NOT EXISTS idx_mensagens_vendedor_timestamp
ON mensagens (vendedor_id, timestamp_mensagem);

-- The unique constraint on evolution_message_id creates an index that lets the
-- webhook detect retries quickly and prevents duplicated conversation rows.

-- The analyzer groups conversations by vendedor and lead/aluno inside a date
-- window. This index speeds up fetching each lead thread in chronological order.
CREATE INDEX IF NOT EXISTS idx_mensagens_vendedor_lead_timestamp
ON mensagens (vendedor_id, lead_whatsapp, timestamp_mensagem);

-- The 8 AM sender only needs pending reports. A partial index keeps that lookup
-- small as the historical reports table grows.
CREATE INDEX IF NOT EXISTS idx_relatorios_pendentes
ON relatorios (created_at)
WHERE status = 'pendente';

-- Useful for idempotent reprocessing and audit lookups by reference day.
CREATE INDEX IF NOT EXISTS idx_relatorios_vendedor_data
ON relatorios (vendedor_id, data_referencia);
