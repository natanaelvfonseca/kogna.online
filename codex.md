# CODEX.MD - Contexto e Diretrizes do Projeto

## 1. Visao Geral do Produto
SaaS de inteligencia comercial para o mercado educacional (cursos livres, tecnicos e faculdades). O sistema se conecta passivamente ao WhatsApp de vendedores via API da Evolution (QR Code) para analisar as conversas com IA e enviar um relatorio diario de auditoria para o WhatsApp do gestor comercial as 8:00 AM [6, 7].
*   **Posicionamento:** Potencializador de vendas para o vendedor (foco em conversao) e inteligencia de gargalos para o gestor [8].

## 2. Pilha Tecnologica (Tech Stack)
*   **Banco de Dados:** PostgreSQL (Persistencia de conversas, credenciais da Evolution e relatorios gerados).
*   **Hospedagem/Deploy:** Vercel (Serverless Functions).
*   **Agendador (Cron):** Chamadas HTTP autenticadas vindas de cron.org disparadas para endpoints `/api/cron/*` da Vercel.
*   **Integracao WhatsApp:** API Evolution (Instancias via Webhooks para ingestao de mensagens e chamadas HTTP para disparo de relatorios).

## 3. Escopo Restrito do MVP (Evitar Desvios de Escopo)
Para manter o MVP enxuto e rapido, as seguintes regras de escopo devem ser seguidas estritamente pelo Codex [5, 9]:
*   **Sincronizacao:** NAO sincronizar historico antigo de conversas. Capturar apenas mensagens geradas a partir do momento em que a instancia da API Evolution for pareada por QR Code.
*   **Processamento de IA:** O processamento nao ocorre em tempo real. Ocorre em lote (batch) uma vez por dia por meio da rota chamada pela cron.org.
*   **Sem Dashboard Complexo:** O MVP nao possui painel grafico de acompanhamento em tempo real para o cliente. A interface unica do cliente e a tela de pareamento de QR Code. O entregavel real e o relatorio enviado diretamente no WhatsApp do gestor [10, 11].

## 4. Arquitetura de Dados e Fluxo de Execucao
O Codex deve seguir rigorosamente este fluxo assincrono para garantir a estabilidade do sistema:
1.  **Ingestao via Webhook (API Evolution):** Endpoint `/api/webhooks/evolution` recebe eventos de mensagens enviadas/recebidas e as salva imediatamente no PostgreSQL.
2.  **Gatilho da Cron (cron.org -> `/api/cron/analyze`):**
    *   Disparado as 3h da manha.
    *   Agrupa todas as mensagens do dia anterior por vendedor e por lead/aluno.
    *   Envia as conversas consolidadas para a API de IA com o prompt especialista em vendas educacionais.
    *   Salva o relatorio gerado no PostgreSQL com status `Pendente`.
3.  **Gatilho de Envio (cron.org -> `/api/cron/send-reports`):**
    *   Disparado as 8h da manha.
    *   Busca relatorios `Pendentes` no banco.
    *   Dispara o conteudo formatado para o WhatsApp do gestor via API Evolution.
    *   Atualiza o status para `Enviado`.

## 5. Seguranca e Conformidade (LGPD Educacional)
Vulnerabilidades em dados educacionais sao riscos graves [3]. O Codex deve implementar os seguintes mecanismos de protecao:
*   **Sanitizacao de Dados Pessoais:** Criar uma camada auxiliar utilitaria para mascarar ou anonimizar dados altamente sensiveis (como CPFs, dados de cartao de credito e senhas digitadas por candidatos) antes de enviar qualquer payload de conversa para a API de IA [3, 12].
*   **Autenticacao do Webhook e da Cron:** O endpoint de webhook da Evolution e as rotas `/api/cron/*` devem exigir validacao de token/assinatura nos cabecalhos HTTP para impedir execucoes maliciosas de terceiros [13].

## 6. Historico de Sessoes e Decisoes (Preencher ao final de cada turno)
*   **[DD/MM/AAAA]:** Inicializacao do projeto, criacao do schema de banco PostgreSQL e rotas basicas de webhook.
*   **[06/07/2026]:** Criacao do schema PostgreSQL inicial em `database/schema.sql` para vendedores, mensagens e relatorios, com UUIDs, enums, chaves estrangeiras, triggers de `updated_at` e indices para consultas batch das crons.
*   **[06/07/2026]:** Projeto local vinculado a Vercel em `natanaelfonseca-1617s-projects/kogna`. Variaveis de ambiente foram encontradas, incluindo `DATABASE_URL`, mas a conexao PostgreSQL externa configurada na Vercel falhou por autenticacao do usuario `postgres`; criacao do banco separado `Kogna-auditor` ficou pendente de credencial valida.
*   **[06/07/2026]:** Credencial correta localizada no projeto Vercel `planarius-ascent`. Banco PostgreSQL separado `Kogna-auditor` criado no servidor externo e schema inicial aplicado com sucesso. Criado arquivo local ignorado pelo git `.env.kogna-auditor.local` com as envs uteis do Kogna para o MVP e `DATABASE_URL` apontando para o novo banco.
*   **[06/07/2026]:** Criado endpoint serverless `api/webhooks/evolution.ts` para ingestao de eventos `messages.upsert` da Evolution, com validacao por `EVOLUTION_WEBHOOK_SECRET`, sanitizacao LGPD, idempotencia por `evolution_message_id` e persistencia no PostgreSQL. Schema atualizado com coluna/constraint unica para o ID da mensagem da Evolution.
*   **[06/07/2026]:** Criado endpoint serverless `api/analyze.ts` para gerar relatorios gerenciais por vendedor/data. A funcao busca mensagens no PostgreSQL, agrupa conversas por lead, chama a OpenAI Responses API com prompt especializado em vendas educacionais e salva/upserta o relatorio com status `pendente`.
*   **[06/07/2026]:** Criada interface Next.js em `pages/vendedor/[id].tsx` para configuracao mobile-first do vendedor, com carregamento de dados, status WhatsApp, geracao de QR Code Evolution, polling de conexao e formulario do gestor. Criados endpoints internos `pages/api/vendedores/[id]`, `qrcode` e `status`.
*   **[06/07/2026]:** Ajuste de deploy Vercel: criada pagina raiz `pages/index.tsx`, endpoint `pages/api/health.ts` e wrappers Next API para `/api/analyze` e `/api/webhooks/evolution`, garantindo que o build Next exponha rotas reais e nao retorne 404 na raiz.
