ALTER TABLE mensagens
ADD COLUMN IF NOT EXISTS evolution_message_id VARCHAR(160);

ALTER TABLE mensagens
ALTER COLUMN evolution_message_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'mensagens_evolution_message_id_unique'
    ) THEN
        ALTER TABLE mensagens
        ADD CONSTRAINT mensagens_evolution_message_id_unique UNIQUE (evolution_message_id);
    END IF;
END
$$;
