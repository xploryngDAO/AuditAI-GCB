# Auditoria de isolamento entre tenants — AuditaQA

**Repositório:** `C:\AI_Apps\Projetos\Audit.AI`
**Snapshot auditado:** `server.ts` SHA-256 `403CAE5E4244BF64D742DCCBBF51666951659D2801FA027F7E1B6118ACB66806`, 10.359 linhas, mtime 11/11/2026 00:38:33 (America/Sao_Paulo).
**Método:** revisão estática de `server.ts` (rotas, middleware, helpers de escopo), `src/utils/userScope.ts`, `src/utils/tenantAdmin.ts`, `src/types.ts`, `src/utils/piiMasking.ts`, frontend (`src/App.tsx`, `src/components/DataChat.tsx` etc.) e leitura do estado persistido `database_store.json`. **Nenhum servidor, build ou teste foi executado** e nenhum arquivo de aplicação foi alterado.
**Aviso de concorrência:** o Lead aplicou hardening em `server.ts` **durante** toda esta auditoria (o arquivo mudou de 10.277 para ~10.400 linhas e ainda estava em edição ao final). Os números de linha dos achados referem-se ao **snapshot de análise** `403CAE5E…` (10.359 linhas, 00:38). O **status** de cada achado foi revalidado no snapshot `391C6AF6BF8A63C3BCD0E3343BA88D5142290A5922D1820C3106095EDAB16152` (10.398 linhas, 00:44:36) — ver §9 para os itens já corrigidos. Status: **presente** (existia no snapshot revalidado), **corrigido pelo Lead** (já alterado no working tree) ou **parcial** (correção cobre parte do fluxo). Revalidar por endpoint/âncora: o arquivo segue em edição.

---

## 1. Sumário executivo

**Conclusão:** no snapshot de análise, o isolamento entre tenants **não estava garantido**. A base de autorização por sessão assinada é sólida (`extractTenantIdFromReq` deriva o tenant da sessão, não de query/body/header), mas havia **vazamentos cross-tenant comprovados por código** em três frentes críticas. **Durante a auditoria o Lead corrigiu essas três frentes** (C-1, C-2 e C-3; ver §9); o risco residual agora está nos **8 ALTOS e 6 MÉDIOS** que também quebram isolamento, integridade ou confidencialidade — em especial A-4 (destruição cross-tenant por nome), A-5, A-6, A-7 e A-8, que seguiam **presentes** no snapshot de revalidação.

1. **Credenciais de integração de todos os tenants** são devolvidas por `GET /api/integrations` a **qualquer usuário autenticado, inclusive o papel `bpo`** (o de menor privilégio).
2. **Interações/transcrições de outra tenant** ficam visíveis para usuários de sub-tenant por conta de um filtro `bpoName` (comparação por **nome**, sem vínculo de tenant) em `GET /api/interactions`, `GET /api/confronto` e no contexto de `POST /api/chat`. A exploração é auto-serviço por um **admin de tenant** (basta criar/renomear um sub-tenant com o `bpoName` da vítima e logar como o usuário `bpo` resultante) — ou ocorre naturalmente quando dois clientes usam o mesmo parceiro BPO (ex.: "Concentrix", "AeC Online").
3. **IDOR** em `POST /api/interactions/re-audit-batch`: busca IDs na base **global** e devolve os objetos completos (transcrição, cliente, notas) sem checagem de escopo. A variante `POST /api/interactions/:id/re-audit` **já foi corrigida pelo Lead** no working tree (helper `interactionVisibleToAuth`), mas a rota em lote continua vulnerável.

Além disso: o fallback do chat (`getFallbackChatResponse`) lê `interactionsDb`/`bposDb` **globais** e devolve nomes de operadores/BPOs e métricas de **todos** os tenants; exclusões em `DELETE /api/bpos/:name`, `bulk-delete` (clearAll + bpoName) e cascata de `DELETE /api/tenants/:id` apagam dados de **outros** tenants comparando apenas `bpoName`; `POST /api/integrations/sync` resolve sub-tenant pelo nome globalmente e devolve `bpoConfig` (credenciais/filas/logs) de outro tenant; e a configuração **global** de integrações continua gravável por admin de tenant.

> **Atualização durante a auditoria:** ao longo da auditoria o Lead corrigiu no working tree **as três frentes críticas e os dois primeiros itens altos priorizados**: C-1 (`tenantConfigs` removido de `GET /api/integrations`), C-2 (novo predicado canônico `interactionScopePredicate`, `server.ts:4498-4514`, aplicado em interactions/confronto/chat/bulk-delete/sync), C-3 (re-audit individual **e** batch com `interactionVisibleToAuth`/predicado), A-1 (fallback do chat agora recebe `scopedInteractions`/`scopedBpos`) e A-2/A-3 (credenciais e logs globais `superadmin`-only). Ver §9 e as notas de status em cada achado. **Ações remanescentes principais:** A-4 (deletes destrutivos cross-tenant por `bpoName`), A-5 (sync resolve sub-tenant por nome global), A-6 (config global gravável por admin), A-7 (webhook aceita `tenant_id`/ID do payload), A-8 (lista global de tenants em POST/PUT) e M-1..M-6. Também restam: teste de regressão por papel, rotação dos segredos expostos e migração do escopo para o banco (RLS).

### Contagem por severidade

| Severidade | Qtde | IDs |
|---|---|---|
| CRÍTICO | 3 | C-1, C-2, C-3 |
| ALTO | 8 | A-1…A-8 |
| MÉDIO | 6 | M-1…M-6 |
| BAIXO | 3 | B-1…B-3 |

> Contagem = achados **identificados** no snapshot de análise. C-1, C-2, C-3, A-1, A-2 e A-3 foram **corrigidos pelo Lead** durante a auditoria (§9) e por isso não representam risco no snapshot de revalidação; A-4…A-8 e M-1 (parcial)…M-6 seguiam abertos.

### Top 5 prioridades (solicitadas pelo Lead)

| # | Item | Status no snapshot |
|---|---|---|
| 1 | `GET /api/integrations` expondo `tenantConfigs`/credenciais a qualquer autenticado | **corrigido pelo Lead** (C-1; revalidação `server.ts:8227-8231`) |
| 2 | `GET /api/genesys/recurring` e `GET /api/zendesk/recurring` expondo credenciais | **corrigido pelo Lead** (A-2; revalidação `server.ts:6197-6208`, `7102-7112`) |
| 3 | Fallback do `/api/chat` usando `interactionsDb`/`bposDb` globais | **corrigido pelo Lead** (A-1; revalidação `server.ts:10164-10175` + chamadas em `4907/4910`) |
| 4 | Filtro `bpoName` do sub-tenant em `GET /api/interactions` (cross-tenant) | **corrigido pelo Lead** (C-2; `interactionScopePredicate`, revalidação `server.ts:4498-4514`, aplicado em `2156`, `3683`, `4833`) |
| 5 | IDOR de re-audit | **corrigido pelo Lead** (C-3; individual `server.ts:4524-4533` e batch `4555-4572`, ambos com predicado/`interactionVisibleToAuth`) |

---

## 2. Matriz de acesso esperada × implementada

A matriz esperada (definida na task e nos comentários do próprio código, ex. `server.ts:4605-4628`): **superadmin global vê tudo**; **admin do tenant vê o próprio tenant + sub-tenants**; **`bpo` (usuário de sub-tenant) vê somente a própria sub-tenant**. O papel `bpo` é o administrador criado junto com um sub-tenant (`POST /api/tenants` → `userRole = 'bpo'`, `server.ts:9673`) e é **read-only** por middleware (`server.ts:2069`).

| Ator | Esperado | Implementado (rotas principais) | Divergências |
|---|---|---|---|
| `superadmin` | tudo, inclusive config global | OK, por design (`canAccessTenant` retorna `true`, `server.ts:1369-1374`) | Credenciais globais também legíveis (ok para o ator); ver A-2 |
| `admin` (tenant matriz) | próprio tenant + sub-tenants; escrita no próprio escopo | Interações: pai + filhos por `tenantId` (`interactionScopePredicate`, `server.ts:4512-4513`); chats: pai + filhos (`getChatScopeIds`); config/guia/books escopados; `/api/users` escopado | **Vaza**: diretório completo de tenants nas respostas de `POST/PUT /api/tenants` (A-8); pode apagar dados de outros tenants por `bpoName` (A-4); pode gravar config global (A-6); sync resolve sub-tenant por nome global (A-5). Itens **corrigidos**: C-1, A-2, A-3 |
| `bpo` (sub-tenant) | **somente a própria sub-tenant** | Chats: só a própria sub-tenant (`getScopedChats`); config 403 (`adminOnly`, `server.ts:2082-2085`); `/api/users`, `/api/tenants` 403; interações pelo predicado canônico (`server.ts:4502-4511`) | **Aberto**: nomes de BPOs irmãos (`GET /api/bpos`, M-3); config cross-tenant em M-4. **Corrigidos durante a auditoria**: C-1, C-2 (leitura de interações), C-3, A-1, A-2, A-3 |

Observações de modelagem relevantes para a matriz:
- Interações **não são gravadas com o `tenantId` do sub-tenant**: quem ingere é o admin do tenant pai (ou o sync), então `tenantId` = tenant matriz do uploader. Por isso a visão do sub-tenant depende de `bpoName` — e é exatamente esse acoplamento por **nome** que rompe o isolamento (C-2). Esse ponto conecta-se ao bug investigado na task-3 (visibilidade de sub-tenant).
- `tenantId` ausente em interação legada é tratado como "restrito ao superadmin" nas consultas por `tenantId`, mas **não** no `GET /api/interactions` quando o tenant do usuário não existe na base (M-1, fail-open).

---

## 3. Achados CRÍTICOS

> **Convenção de linhas:** os números citados nesta seção são do **snapshot de análise** `403CAE5E…` (10.359 linhas). Achados corrigidos depois trazem a âncora de linha do snapshot de revalidação no próprio status; a lista consolidada está no §9.
### C-1 — `GET /api/integrations` devolve `tenantConfigs` (credenciais de TODOS os tenants) para qualquer autenticado, inclusive `bpo`

**Status:** **corrigido pelo Lead** no working tree. Revalidação: `server.ts:8227-8231` — `const { tenantConfigs: _allTenantConfigs, ...sysPublic } = sys as any;` e a resposta passa a usar `...sysPublic`. Evidência abaixo = cenário original (snapshot de análise). Ações remanescentes: teste de regressão e **rotação das credenciais** que ficaram expostas no período.

**Evidência**
- `server.ts:8084-8087` — rota acessível a qualquer sessão (não está no `adminOnly`, `server.ts:2065`; GET não é bloqueado para `bpo`, `server.ts:2069`):
  ```ts
  app.get("/api/integrations", (req, res) => {
    const auth = (req as any).auth as AuthenticatedUser;
    const tid = extractTenantIdFromReq(req);
    const isMaster = auth.role === 'superadmin';
  ```
- `server.ts:8168-8171` — o objeto persistido `sys` é espalhado **sem remover** `tenantConfigs`:
  ```ts
  return {
    ...sys,                                  // inclui sys.tenantConfigs (TODOS os tenants)
    availableQueues: systemCapturedLiveQueues,
    tenantEnabled: tenantCfg.enabled,
    tenantCreds: tenantCfg.creds || {},
    ...
  };
  ```
- `database_store.json` confirma o formato: `systemsIntegrationsDb[].tenantConfigs["<tenantId>"].bpoConfigs["<bpo>"].creds` contém `clientId`, `clientSecret`, `apiToken`, `oauthToken`, `accountSid`, `authToken`, `secretAccessKey`, `apiSecret`, `webhookSecret`, além de filas e logs — para **cada** tenant. Exemplo observado no estado local (não versionado), com valores redigidos: `tenant-exemplo.bpoConfigs["BPO Exemplo"].creds.clientId = "<client-id-redigido>"` e centenas de filas.

**Exploração (passo a passo)**
1. Autenticar com **qualquer** conta, inclusive `bpo` de uma sub-tenant de um cliente qualquer.
2. `GET /api/integrations`
3. Ler `response.systems[*].tenantConfigs` → credenciais e configurações de **todos** os tenants (Genesys, Zendesk, Twilio, Amazon Connect, Avaya, Cisco, webhook universal), além dos nomes de BPO de todos os clientes (insumo para C-2/A-5).

```bash
curl -s -c c.txt -H 'Content-Type: application/json' \
  -d '{"email":"<usuario-bpo>","password":"<senha>"}' https://HOST/api/login
curl -s -b c.txt https://HOST/api/integrations \
  | jq '.systems[] | {id, tenantConfigs}'
```

**Impacto:** segredos OAuth/API de **todos os tenants** (acesso às orgs Genesys/Zendesk/Twilio/AWS de clientes), catálogo de filas e logs operacionais; enumeração completa de tenants/BPOs. É o achado de maior impacto e o habilitador mais direto dos demais (C-2, A-5).

**Correção mínima:** montar a resposta com **allowlist de campos** (`id, name, vendor, type, iconName, authType, masterEnabled, tenantEnabled, bpoConfigs escopados, lastSync`) e **nunca** devolver `sys.tenantConfigs`, `sys.masterConfig`, `sys.availableQueues` globais nem `creds`; devolver `hasCreds: boolean` em vez das chaves. Idealmente `tenantConfigs` migra para uma tabela com escopo e RLS (ver M-6).

---

### C-2 — Filtro de sub-tenant por `bpoName` (comparação por nome, sem vínculo de tenant) permite ler interações/transcrições de outras tenants

**Status:** **corrigido pelo Lead** no working tree. Revalidação: escopo canônico extraído para `src/utils/interactionScope.ts` (`interactionInScope`, linhas 36-56) + `interactionScopePredicate`/`interactionVisibleToAuth` no servidor (`server.ts:4482-4497`), aplicado em `GET /api/interactions` (`2156`), confronto (`3673`), chat (`4809`), bulk-delete/re-audit (`2206`, `2230`, `4542`) e sync (`5963`). Sub-tenant só vê o próprio `tenantId` ou herança do pai/`system-global`/sem-dono **quando o alias de BPO casa dentro da mesma árvore**; tenant inexistente → `false`/`[]`. **Residual:** registros legados com `tenantId` nulo/global continuam visíveis por alias; recomendo backfill de `tenantId`. Evidência abaixo = cenário original (snapshot de análise).

**Evidência**
- `GET /api/interactions`, `server.ts:2145`:
  ```ts
  list = list.filter(i => i.tenantId === targetTenantId ||
    (tenantObj.bpoName && i.bpoName?.toLowerCase() === tenantObj.bpoName.toLowerCase()));
  ```
  O segundo termo **não checa o tenant dono da interação**: qualquer interação da base global cujo `bpoName` coincida entra na lista. A resposta é a coleção completa (`res.json(list)`, `server.ts:2160`), incluindo `transcript`, `customerName`, `agentName`, `score`, `evaluation`.
- Mesmo filtro em `GET /api/confronto`, `server.ts:3693`, e no contexto do `POST /api/chat`, `server.ts:4818` (detalhes de atendimento enviados ao modelo de IA e potencialmente devolvidos na resposta).
- O filtro de "tenant pai" usa `tenantId` (`server.ts:2145-2150`), mas o de sub-tenant cai para nome — e interações de sub-tenant normalmente são gravadas com `tenantId` do tenant matriz (upload feito pelo admin pai), tornando o `bpoName` o único critério na prática.
- O `bpoName` do sub-tenant é livre e definido por quem cria/edita: `POST /api/tenants` → `bpoName: cleanBpoName` (`server.ts:9667`), `PUT /api/tenants/:id` → `current.bpoName = bpoName` (`server.ts:9884`), e o usuário `bpo` criado herda esse nome (`server.ts:9673-9676`).

**Exploração (auto-serviço, sem privilégio global)**
1. **Admin do tenant A** (papel `admin`) descobre o nome de um BPO da vítima (via C-1, `GET /api/integrations`; ou A-3, logs de webhook; ou conhecimento público, ex.: "Concentrix").
2. Cria um sub-tenant com esse `bpoName` e um admin conhecido:
   ```bash
   curl -b adminA.txt -H 'Content-Type: application/json' -d '{
     "name":"Probe","adminEmail":"probe@tenant-a.com",
     "adminPassword":"S3nh4-Forte#2026","isSubtenant":true,
     "bpoName":"<BPO da vitima>"
   }' https://HOST/api/tenants
   ```
   (Alternativa: `PUT /api/tenants/<subtenant proprio>` com `{"bpoName":"<BPO da vitima>"}`, `server.ts:9884`.)
3. Logar como o usuário `bpo` criado (papel read-only, mas **GET** é permitido):
   ```bash
   curl -s -c probe.txt -H 'Content-Type: application/json' \
     -d '{"email":"probe@tenant-a.com","password":"S3nh4-Forte#2026"}' https://HOST/api/login
   curl -s -b probe.txt https://HOST/api/interactions \
     | jq '.[0] | {id,tenantId,bpoName,agentName,customerName,score,transcript}'
   ```
4. Recebe as interações da(s) outra(s) tenant(s) com aquele `bpoName` — transcrição, nome do operador (PII), primeiro nome do cliente/`customerName` e notas. `GET /api/confronto` e `POST /api/chat` (contexto) replicam o vazamento.

**Impacto:** leitura cross-tenant de **conteúdo de atendimentos** (transcrições, PII de operadores e clientes, notas, desvios) — o núcleo do produto. Atinge o ator de menor privilégio; exploit reproduzível por um admin cliente. Também explica o comportamento do bug de visibilidade da task-3: a visão do sub-tenant é nome-based, não vínculo-based.

**Correção mínima:** escopo canônico por `tenantId` (dono do dado) e `bpoName` apenas como filtro de exibição **dentro** do escopo. Para dados legados só com `bpoName`, restringir a interações cujo `tenantId` pertença à árvore do pai (`canAccessTenant`/`validIds`) **e** resolver `bpoName → sub-tenant` de forma única (`tenantsDb.filter(t => t.parentId === parentId && bpoName match)`), nunca um `OR` global. O mesmo ajuste vale para `server.ts:3693` (confronto) e `server.ts:4818` (chat).

---

### C-3 — IDOR: `POST /api/interactions/re-audit-batch` busca IDs na base global e devolve interações completas de outras tenants

**Status:** **corrigido pelo Lead** (individual e lote). Revalidação: `POST /api/interactions/:id/re-audit` usa `interactionVisibleToAuth` (`server.ts:4524-4533`); `POST /api/interactions/re-audit-batch` aplica `interactionScopePredicate` no filtro dos `ids` (`server.ts:4555-4572`). Evidência abaixo = cenário original (snapshot de análise).

**Evidência**
- Corrigido (referência): `server.ts:4505-4521` — `interactionVisibleToAuth(auth, existing)` antes de re-auditar/exibir:
  ```ts
  function interactionVisibleToAuth(auth, interaction) {
    if (auth.role === 'superadmin') return true;
    if (!interaction.tenantId) return false;
    return canAccessTenant(auth, interaction.tenantId);
  }
  ...
  if (!existing || !interactionVisibleToAuth(auth, existing)) return res.status(404)...
  ```
- **Ainda vulnerável:** `server.ts:4542-4553` — o lote ignora o escopo ao receber `ids`:
  ```ts
  app.post("/api/interactions/re-audit-batch", async (req, res) => {
    const { ids } = req.body || {};
    const targetTenantId = extractTenantIdFromReq(req);
    ...
    if (Array.isArray(ids) && ids.length > 0) {
      targetItems = interactionsDb.filter(i => ids.includes(i.id));   // base global, sem canAccessTenant
    }
  ```
  A resposta inclui `interactions: updatedList` com os objetos completos (`server.ts:4569+`), e o processo **sobrescreve** o item na base com o resultado da re-auditoria usando a config de IA do atacante (`processAuditAnalysisForItem(item, targetTenantId)`).
- IDs são previsíveis/descobríveis: `processAuditAnalysisForItem` gera `INT-${Math.floor(100 + Math.random()*900)}` quando não vem ID (`server.ts:4317` do snapshot anterior, mesma lógica) e o frontend usa `INT-<1000..9999>`; IDs de webhook aparecem em `GET /api/integrations/webhook/logs` (A-3). Lote de `INT-100..INT-9999` cobre todo o espaço auto-gerado.

**Exploração**
```bash
# admin de qualquer tenant
curl -b adminA.txt -H 'Content-Type: application/json' \
  -d '{"ids":["INT-100","INT-101","...","INT-999"]}' \
  https://HOST/api/interactions/re-audit-batch \
  | jq '.interactions[] | {id,tenantId,agentName,customerName,transcript,score}'
```
**Impacto:** leitura cross-tenant de interações completas + escrita (o item da vítima é regravado) + consumo da cota de IA do atacante sobre dados alheios. Com a correção do Lead, a mesma requisição por `:id` agora retorna 404 — o lote é o caminho remanescente.

**Correção mínima:** aplicar `interactionVisibleToAuth` também no filtro por `ids` (e manter o filtro atual por tenant no caminho sem `ids`); opcionalmente limitar `ids.length` e não regravar itens sem escopo.

---

## 4. Achados ALTOS

### A-1 — Fallback do `POST /api/chat` lê `interactionsDb`/`bposDb` globais e responde com dados de todos os tenants

**Status:** **corrigido pelo Lead**. Revalidação: `getFallbackChatResponse(query, context, scopedInteractions, scopedBpos)` (`server.ts:10164-10169`), chamadas passando os dados escopados (`server.ts:4907`, `4910`) e corpo usando `scopedBpos`/`scopedInteractions` (`10173-10175`). Evidência abaixo = cenário original.

**Evidência**
- Chamadas do fallback: `server.ts:4898` (erro da IA) e `server.ts:4901` (provedor não configurado).
- `getFallbackChatResponse`, `server.ts:10113` — **ignora** o parâmetro `context` (contexto escopado) e usa as bases globais:
  - `server.ts:10119` `const bpoCalls = interactionsDb.filter(i => i.bpoName.toLowerCase() === matchedBpo.toLowerCase());`
  - `server.ts:10188` `const totalCalls = interactionsDb.length;` e `server.ts:10197` `interactionsDb.forEach(...)` (falhas críticas)
  - `server.ts:10242` `interactionsDb.forEach(...)` (lista todos os operadores com médias)
  - `server.ts:10295-10300` `interactionsDb.length/reduce(...)` e `bposDb.map(...)` (painel geral)
- O caminho é comum: tenant novo/sem provedor configurado cai direto no `else` de `server.ts:4901`.

**Exploração**
```bash
# usuário bpo de um tenant sem IA configurada (ou com IA em erro)
curl -b bpo.txt -H 'Content-Type: application/json' \
  -d '{"message":"liste os operadores com as piores notas e as falhas criticas"}' \
  https://HOST/api/chat
# resposta do fallback: nomes de operadores, notas, BPOs e contagens de TODOS os tenants
```
**Impacto:** PII de colaboradores (nomes) e métricas comerciais de todos os tenants para o papel de menor privilégio; também vaza em respostas de erro quando a IA falha.

**Correção mínima:** passar `scopedInteractions` (já calculado em `server.ts:4818-4824`) e o `bpos` escopado para o fallback; remover qualquer leitura de `interactionsDb`/`bposDb` global na função. Há um `dbSummaryContext` já escopado que pode ser reutilizado.

---

### A-2 — `GET /api/genesys/recurring` e `GET /api/zendesk/recurring` devolvem credenciais globais a qualquer autenticado

**Status:** **corrigido pelo Lead** no working tree. Revalidação: checagem `auth.role !== 'superadmin'` → 403 em Genesys (`server.ts:6197-6208`) e Zendesk (`server.ts:7102-7112`). Evidência abaixo = cenário original. Ações remanescentes: rotação das credenciais e migração da config para escopo por tenant.

**Evidência**
- `server.ts:6174-6179`:
  ```ts
  app.get("/api/genesys/recurring", (req, res) => {
    return res.json({ success: true, config: genesysRecurringConfigDb });  // inclui creds.clientId/clientSecret
  });
  ```
- `server.ts:7073-7078`: idem para `zendeskRecurringConfigDb` (creds `adminEmail`, `apiToken`, `oauthToken`).
- As rotas **não** estão no `adminOnly` (`server.ts:2065`) e não têm checagem de papel; `GET` é permitido ao `bpo`.
- Os configs são globais e são usados pelo worker/sync de todos (`server.ts:5994-6016`, `6925-6940`), e são graváveis por qualquer admin de tenant (A-6).

**Exploração**
```bash
curl -b bpo.txt https://HOST/api/genesys/recurring | jq '.config.creds'
curl -b bpo.txt https://HOST/api/zendesk/recurring | jq '.config.creds'
```
**Impacto:** segredos OAuth/API globais (acesso à org de contact center compartilhada; possibilidade de ler gravações/transcrições de chamadas de todos os clientes da org). Também expõe logs do worker global com nomes de BPO e IDs de conversas.

**Correção mínima:** exigir `superadmin` (ou remover `creds` do response); migrar config por tenant (`systemsIntegrationsDb.tenantConfigs`) e manter somente o necessário global; rotação das credenciais expostas em produção.

---

### A-3 — `GET /api/integrations/webhook/config` e `/webhook/logs` expõem segredo HMAC e logs globais de ingestão

**Status:** **corrigido pelo Lead** no working tree. Revalidação: `GET/POST /api/integrations/webhook/config` e `GET .../logs` agora exigem `superadmin` (`server.ts:7987-8033`); o `payloadSnippet` passou a ser mascarado na ingestão (`maskExternalPrompt`, `server.ts:7896-7897`). Evidência abaixo = cenário original. Ação remanescente: rotação do `webhookSecret` e logs por tenant.

**Evidência**
- `server.ts:7941-7946`: `config: universalWebhookConfigDb` (inclui `webhookSecret`) para qualquer autenticado.
- `server.ts:7968-7973`: `logs: universalWebhookConfigDb.recentLogs` — logs **globais** gravados em `server.ts:7878-7894` com `interactionId`, `agentName`, `bpoName`, `ip` e `payloadSnippet = rawBody.slice(0,150)` (pode conter início da transcrição/nome de cliente), de **todos** os tenants.
- Escrita do wbehook config é `POST` (bloqueada para `bpo`, mas permitida a qualquer `admin`).

**Exploração**
```bash
curl -b bpo.txt https://HOST/api/integrations/webhook/config | jq '.config.webhookSecret'
curl -b bpo.txt https://HOST/api/integrations/webhook/logs  | jq '.logs[0]'
```
**Impacto:** segredo de assinatura HMAC do webhook global + vazamento cross-tenant de IDs de interação, nomes de operadores/BPO e trechos de payload (PII). Os IDs vazados aqui alimentam o IDOR C-3.

**Correção mínima:** `superadmin`-only para config; `logs` filtrados por tenant do solicitante (gravar `tenantId` no log) e sem `payloadSnippet` de PII; rotacionar `webhookSecret`.

---

### A-4 — Exclusões destrutivas cross-tenant por `bpoName` (delete de BPO, bulk-delete clearAll, cascata de tenant)

**Status:** presente no snapshot.

**Evidência**
- `DELETE /api/bpos/:name`: remove usuários (`server.ts:2411`), interações (`server.ts:2425`) e monitorias de **todos os tenants** cujo `bpoName` coincida — sem filtro de `tenantId`:
  ```ts
  usersDb = usersDb.filter(u => !u.bpoName || u.bpoName.toLowerCase() !== cleanName.toLowerCase());
  interactionsDb = interactionsDb.filter(i => !i.bpoName || i.bpoName.toLowerCase() !== cleanName.toLowerCase());
  ```
  (O passo 2 remove sub-tenants só do pai do solicitante, mas os passos 3–4 são globais.)
- `POST /api/interactions/bulk-delete` com `{clearAll:true, bpoName:"X"}`: `server.ts:2199` apaga interações de todos os tenants com esse nome; `monitoriasTradicionaisDb` idem.
- `POST /api/interactions/clear` na variante sub-tenant também apaga por nome (`server.ts:2204,2249`).
- `DELETE /api/tenants/:id` (admin pode excluir os próprios sub-tenants, `server.ts:9748-9753`): monta `namesToClean` a partir de `name/bpoName/slug` (`server.ts:9756`) e remove usuários/interações/interações por **substring** em toda a base (`server.ts:9779-9799`, `interactionsDb` em `server.ts:9786`).

**Exploração**
```bash
# admin do tenant A (não precisa ser superadmin)
curl -X DELETE -b adminA.txt 'https://HOST/api/bpos/<BPO%20da%20vitima>'
curl -b adminA.txt -H 'Content-Type: application/json' \
  -d '{"clearAll":true,"bpoName":"<BPO da vitima>"}' https://HOST/api/interactions/bulk-delete
```
**Impacto:** destruição de dados de auditoria e de contas de **outros tenants** (integridade/disponibilidade), incluindo relatórios e histórico — ação não reversível (não há soft delete).

**Correção mínima:** todo delete em coleção global deve filtrar por `tenantId`/`canAccessTenant` e validar que `bpoName` pertence ao escopo do solicitante (`tenantsDb` do próprio tenant); o `clearAll` deve ser `superadmin`-only quando sem `bpoName`/tenant explícito; remover o casamento por `includes()` na cascata de tenant (usar ids de tenant/parent e `tenantId` das interações).

---

### A-5 — `POST /api/integrations/sync` resolve sub-tenant por `bpoName` global, devolve `bpoConfig` de outro tenant e grava config nele

**Status:** presente no snapshot.

**Evidência**
- `server.ts:9309-9324`:
  ```ts
  const targetBpo = bpoName || (bposDb[0] || "BPO Alpha");
  const subtenantMatch = tenantsDb.find(t => t.isSubtenant && (
    (t.bpoName && t.bpoName.toLowerCase() === targetBpo.toLowerCase()) || ...));
  const resolvedTenantId = subtenantMatch ? subtenantMatch.id : targetTenantId;
  const candidateTenantIds = [resolvedTenantId, targetTenantId, subtenantMatch?.parentId, 'system-global'];
  for (const cId of candidateTenantIds) {
    if (sys.tenantConfigs?.[cId]?.bpoConfigs?.[targetBpo]) { foundBpoCfg = ...; break; }
  ```
  Com `bpoName` de um sub-tenant de **outro** pai, `foundBpoCfg` é a config da vítima e `tenantCfg`/`bpoCfg` passam a apontar para ela; o endpoint responde `bpoConfig: bpoCfg` (credenciais, filas, logs) em `server.ts:9386` (e `9414` no caminho "já em execução").
- O job é iniciado com `resolvedTenantId` da vítima (`runBackgroundCaptureJob`), podendo gravar interações/config no tenant alvo.

**Exploração**
```bash
curl -b adminA.txt -H 'Content-Type: application/json' \
  -d '{"systemId":"genesys","bpoName":"<BPO da vitima>"}' \
  https://HOST/api/integrations/sync | jq '.bpoConfig'
```
**Impacto:** leitura das credenciais/filas/logs de integração de outra tenant + escrita de configuração no escopo dela (poluição/DoS do conector da vítima).

**Correção mínima:** resolver `subtenantMatch` apenas entre `tenantsDb.filter(t => t.isSubtenant && t.parentId === auth.tenantId)` (ou via `canAccessTenant`); nunca devolver `creds` na resposta; validar `resolvedTenantId` com `canAccessTenant` antes de qualquer escrita.

---

### A-6 — Configuração global de integrações é gravável por qualquer admin de tenant (inclusive desligar mascaramento PII global)

**Status:** presente no snapshot de revalidação (a leitura de credenciais já foi corrigida em A-2, mas as **escritas** continuam): `POST /api/genesys/config` (`server.ts:6218+`), `POST /api/zendesk/config` (`server.ts:7114+`) e `POST /api/genesys/queues` (`server.ts:6394+`, fora do `adminOnly`) não têm checagem `superadmin`, e o `adminOnly` (`server.ts:2082`) permite `admin` nas rotas de config dos conectores.

**Evidência**
- `adminOnly` (`server.ts:2065`) permite `admin` (não só superadmin) em `/genesys/config` e `/zendesk/config`:
  - `POST /api/genesys/config`, `server.ts:6181` — sobrescreve `genesysRecurringConfigDb.creds` **globais** (usados pelo worker de todos os tenants).
  - `POST /api/zendesk/config`, `server.ts:7080` — idem para Zendesk.
- `POST /api/genesys/queues`, `server.ts:6357` — fora do `adminOnly`; qualquer `admin` altera `queues` e `piiMaskingEnabled` **globais**:
  ```ts
  if (typeof piiMaskingEnabled === 'boolean') genesysRecurringConfigDb.piiMaskingEnabled = piiMaskingEnabled;
  ```
  Esse flag controla o mascaramento de PII na ingestão/auditoria (`server.ts:4075`, `4308`, `5192`, `9434`).

**Exploração**
```bash
curl -b adminA.txt -H 'Content-Type: application/json' \
  -d '{"creds":{"clientId":"atacante","clientSecret":"x"},"enabled":true}' https://HOST/api/genesys/config
curl -b adminA.txt -H 'Content-Type: application/json' \
  -d '{"piiMaskingEnabled":false}' https://HOST/api/genesys/queues
```
**Impacto:** cross-tenant integrity (quebra/redireciona integração de todos os clientes; worker passa a usar credenciais do atacante) e impacto LGPD (desliga mascaramento para todos, gravando dados pessoais em claro). Combinar com A-2 para roubo de credenciais.

**Correção mínima:** rotas de configuração **global** `superadmin`-only; flags de PII não devem ser globais (por tenant em `tenantConfigs`); validar `masterEnabled`/config no backend.

---

### A-7 — Colisão/sobrescrita cross-tenant por ID previsível e `tenant_id` vindo do payload do webhook

**Status:** presente no snapshot.

**Evidência**
- `POST /api/integrations/webhook/ingest` (exige sessão — ver B-1): o `tenantId` vem do **corpo**, não da sessão (`server.ts:7820`):
  ```ts
  const tenantId = body[map.tenantKey || 'tenant_id'] || body.tenantId || undefined;
  ```
  e grava/sobrescreve por ID na base **global** (`server.ts:7849-7875`):
  ```ts
  const existingIdx = interactionsDb.findIndex(i => i.id === fullInteraction.id || i.genesysExternalId === ...);
  if (existingIdx >= 0) interactionsDb[existingIdx] = fullInteraction;
  ```
- `POST /api/analyze` idem para sobrescrita por colisão de `id` (`server.ts:4421-4425`), com IDs auto-gerados previsíveis (`INT-<100..999>` no servidor; `INT-<1000..9999>` no frontend).
- IDs também podem ser informados pelo cliente (`items[].id`), permitindo sobrescrever deliberadamente um ID conhecido de outro tenant (insumo: logs de webhook em A-3).

**Exploração**
```bash
# admin do tenant A injetando/sobrescrevendo no tenant B
curl -b adminA.txt -H 'Content-Type: application/json' -d '{
  "tenant_id":"tenant-casas-bahia",
  "id":"<id de interacao conhecido>",
  "transcript":"...", "agent_name":"X", "bpo_name":"Y", "channel":"chat"
}' https://HOST/api/integrations/webhook/ingest
```
**Impacto:** escrita/adulteração de dados em outro tenant (poisoning de auditorias), perda silenciosa de registros por colisão de ID entre tenants, e risco de mistura de dados (integridade). Não há leitura direta, mas o dado sobrescrito passa a ser exibido no tenant vítima.

**Correção mínima:** ignorar `tenant_id` do payload e derivar da sessão (ou de credencial de integração); tratar ID duplicado de outro tenant como `409`; gerar IDs com UUID (`crypto.randomUUID()`) e nunca aceitar ID arbitrário do cliente sem prefixo de tenant.

---

### A-8 — `POST/PUT /api/tenants` devolvem a lista **global** de tenants a um admin de tenant

**Status:** presente no snapshot.

**Evidência**
- `server.ts:9719` (resposta de `POST /api/tenants`) e `server.ts:9895` (`PUT /api/tenants/:id`):
  ```ts
  tenants: tenantsDb,   // lista completa, não a scopedList
  ```
  A rota é acessível a `admin` (está no `adminOnly`). A `scopedList` só é usada no `DELETE` (`server.ts:9804+` é o caminho superadmin).
- Cada item contém `id`, `name`, `slug`, `cnpj`, `adminEmail`, `plan`, `createdAt` de **todos** os clientes.

**Exploração**
```bash
curl -b adminA.txt -H 'Content-Type: application/json' -d '{
  "name":"Probe","adminEmail":"probe@tenant-a.com","adminPassword":"S3nh4-Forte#2026",
  "isSubtenant":true,"bpoName":"x"}' https://HOST/api/tenants | jq '.tenants'
```
**Impacto:** diretório completo de clientes (nomes, CNPJ, e-mail do admin, plano) exposto a qualquer admin de tenant — PII/confidencialidade entre clientes.

**Correção mínima:** retornar `scopedList` (mesma regra do `GET /api/tenants`, `server.ts:9571+`) ou apenas o tenant criado/atualizado.

---

## 5. Achados MÉDIOS

### M-1 — Fail-open: usuário sem tenant válido (órfão/legado em `system-global`) lê a base inteira

**Status:** **parcial**. Revalidação: o novo helper puro `interactionInScope`/`filterInteractionsForScope` retorna `false`/`[]` para tenant inexistente (`src/utils/interactionScope.ts:41`, `88-89`), fechando o fail-open do órfão; porém **`system-global` ainda devolve a base inteira sem olhar o papel** (`src/utils/interactionScope.ts:83-86`: `if (!tenantId || tenantId === GLOBAL_TENANT_ID) return [...interactions]`) e login/`loadDatabase` ainda podem colocar conta não-superadmin em `system-global` (`server.ts:968`, `2476-2495`) — nesse estado a leitura global permanece possível (também em `server.ts:5963`). Correção mínima: receber `scope.role` no filtro e só aceitar `system-global` para `superadmin` (`if (scope.role !== 'superadmin' && tenantId === GLOBAL_TENANT_ID) return []`).
- `GET /api/interactions`, `server.ts:2136-2152`: o filtro só é aplicado **se** `targetTenantId !== 'system-global'` **e** `tenantObj` for encontrado. Se o `tenantId` do usuário não existe em `tenantsDb`, nenhum filtro é aplicado → `list = interactionsDb` (tudo). `GET /api/confronto` (`server.ts:3690-3691`) e `GET /api/chats` (`server.ts:4617-4618`) têm o mesmo `system-global → tudo`.
- Como um usuário não-superadmin chega a `system-global`: `effectiveUserTenantId` devolve `system-global` quando o registro não tem `tenantId` (`src/utils/userScope.ts:35-39`); `loadDatabase` mapeia `tenantId: u.tenantId || 'system-global'` (`server.ts:968`); login mantém `system-global` se não achar tenant por `adminEmail` (`server.ts:2476-2495`). Contas legadas/órfãs (pré-multi-tenant) entram nesse estado. Criação de órfão via `PUT /api/users` foi **fechada pelo Lead** no hardening (o tenant final é validado contra `tenantsDb`, `server.ts:2661-2666` no snapshot de revalidação), então a via atual é apenas estado legado/edição manual do JSON.
- `database_store.json` atual está sem `usersDb`, então **não há conta órfã comprovada no estado versionado** — é um fail-open latente, não um incidente atual. Severidade MÉDIO por depender desse estado, mas impacto total (leitura global) e silencioso.
- **Correção mínima:** fail-closed: se o tenant do usuário não existir (ou for `system-global` para não-superadmin), responder `403`/lista vazia; nunca tratar `system-global` como "todas as tenants" fora de `role === 'superadmin'`.

### M-2 — Upload de monitoria tradicional sem `tenantId` (coleção global; injeção cross-tenant no confronto)

**Status:** presente no snapshot.
- `POST /api/monitoria-tradicional/upload`, `server.ts:3632` — grava `monitoriasTradicionaisDb` sem nenhum campo de tenant; o tipo `MonitoriaTradicional` (`src/types.ts:53-66`) **não possui** `tenantId`.
- `GET /api/confronto` casa monitorias por `idLigacao`/`id` (`server.ts:3712-3715`, correspondente ao `filter` de falhas tradicionais) — um admin pode plantar linhas com `idLigacao` de uma interação de outro tenant; se o ID for conhecido/colidir, o confronto da vítima exibe a justificativa/penalidade plantada (integridade/relatório).
- **Correção mínima:** adicionar `tenantId` ao schema, gravar a partir da sessão e filtrar por escopo na leitura; validar que `idLigacao` pertence a interação acessível.

### M-3 — `GET /api/bpos` e `GET /api/integrations` expõem BPOs **irmãos** ao usuário `bpo`

**Status:** presente no snapshot.
- `getUnifiedBpos(subtenantId)` monta o escopo pelo `parentId` do sub-tenant e inclui **todos** os sub-tenants do mesmo pai (`server.ts:2275`): `t.isSubtenant && (t.parentId === parentTid || ...)`.
- `GET /api/bpos` (`server.ts:2319`) e o campo `bpos` de `GET /api/integrations` (`server.ts:8171+`) retornam esses nomes ao `bpo` — que, pela matriz, deveria ver só a própria sub-tenant.
- Impacto: reconhecimento de parceiros/clientes irmãos (baixo volume, nomes), útil para C-2/A-5. **Correção mínima:** para `role === 'bpo'`, retornar somente o próprio `bpoName`.

### M-4 — Escritas cross-tenant de configuração de integração (`/api/integrations/tenant/bpo`, `/discover-queues`)

**Status:** presente no snapshot.
- `POST /api/integrations/tenant/bpo` (`server.ts:8454`): `subtenantMatch` é buscado na base **global** por `bpoName` e o `updatedBpoCfg` (com credenciais) é gravado em `[tid, subtenantMatch.id, subtenantMatch.parentId]` (`server.ts:8479-8502` no snapshot anterior, mesma lógica).
- `persistDiscoveredQueuesForBpo` (`server.ts:8590`) faz o mesmo e inclui `'system-global'` no alvo (`server.ts:8607-8612`); chamado por `POST /api/integrations/discover-queues` (`server.ts:8654`).
- **Correção mínima:** `subtenantMatch` restrito a filhos de `auth.tenantId`; validar `tenantId` informado contra `canAccessTenant`; não gravar em `system-global` a partir de sessão de tenant.

### M-5 — Admin do pai pode alterar `bpoName`/senha de usuário de sub-tenant e reparentar sub-tenant (habilitadores de C-2)

**Status:** presente no snapshot.
- `PUT /api/users/:email` permite `bpoName` arbitrário para usuário no escopo (`server.ts:2674`); admin do pai acessa usuários dos filhos (`canAccessTenant`, `server.ts:1369-1374`), podendo redefinir senha (`server.ts:2649-2650`) e `bpoName`.
- `PUT /api/tenants/:id` permite `parentId` e `bpoName` arbitrários no próprio sub-tenant (`server.ts:9881` e linha seguinte de `bpoName`), inclusive reparentar.
- **Correção mínima:** validar `bpoName` contra a lista de BPOs/sub-tenants do escopo; proibir reparent/`bpoName` de outro tenant; auditar alterações.

### M-6 — Isolamento é somente na aplicação; `shadowTables` sem RLS e estado JSON único

**Status:** presente (arquitetura).
- README:110 documenta: "Ainda não há RLS: o isolamento por tenant é feito na aplicação. O Estágio 3 deve levar o escopo para o banco."
- `server/shadowTables.ts` e `server/tenantStore.ts` espelham `users`/`interactions`/`tenants` em tabelas; sem policies, qualquer caminho SQL novo (ou falha de filtro na aplicação) vira vazamento total. `database_store.json` é um documento único com todos os tenants.
- **Correção mínima:** RLS + `tenant_id` em todas as tabelas; migrar leituras críticas para queries escopadas; manter testes de contrato multi-tenant.

---

## 6. Achados BAIXOS

### B-1 — `POST /api/integrations/webhook/ingest` exige sessão (webhook externo não funciona; sem vetor anônimo)
O middleware `/api` autentica tudo exceto `/health`, `/setup/*` e `POST /login` (`server.ts:2031-2055`). O endpoint "webhook" exige cookie de sessão — um sistema externo não consegue usá-lo (bug funcional), e **não há** injeção anônima hoje. Ao torná-lo público, o HMAC **precisa** ser obrigatório (hoje `verifyWebhookSignature` retorna `true` se não houver secret configurado — `server.ts` na função `verifyWebhookSignature`) e o `tenant_id` deve vir da credencial, não do corpo (A-7). **Correção:** autenticação por token de integração/tenant + HMAC obrigatório.

### B-2 — Atalho legado `master@admin.com` no login (mitigado)
`server.ts:2459` considera `isSuper` para `user.role === 'superadmin' || user.email === 'master@admin.com'`; um usuário `bpo` criado com esse e-mail ganharia sessão `superadmin`, **mas** o middleware rejeita por divergência de papel (`currentUser.role !== session.role`, `server.ts:2060`) → 401. Recomenda-se remover o atalho legado (defesa em profundidade) e manter `master@admin.com` na lista de contas de demonstração purgadas (`purgeDemoAccounts`, `server.ts:1168`).

### B-3 — `/api/health` é público, mas não vaza dados de tenant (verificado)
`buildHealthPayload` (`server.ts:1973-1995`) expõe apenas contadores/estado (`userCount`, `tenantCount`, `tenantAdminMismatches`, `shadowTables`, `tenantStore`) e detalhes de erro/digest somente com `x-setup-token` válido (`server.ts:1985-1992`). Sem IDs/e-mails/nomes. **Seguro** no snapshot; manter a regra ao evoluir o payload.

---

## 7. Suspeitas refutadas / explicações de segurança

1. **`userEmail`/`userRole` da query em `GET /api/interactions` não autorizam nada.** No snapshot de revalidação o endpoint nem os desestrutura mais (`const { bpoName } = req.query`); `bpoName` é apenas **filtro de estreitamento** sobre a lista já escopada, e o escopo vem de `extractTenantIdFromReq` (sessão assinada). Para não-superadmin o `tenantId` da query é **ignorado**. Frontend envia `?tenantId=&userEmail=` (ex. `src/App.tsx:95,127`) e headers `x-tenant-id`/`x-user-email` (ex. `src/App.tsx:103-105`) — **não há leitura de headers** no servidor. Portanto **não** existe bypass por esses parâmetros; o problema real do endpoint era o filtro por `bpoName` sem vínculo de tenant (C-2, **corrigido**) e o fail-open de tenant órfão (M-1, **parcial**).
2. **Chats: leitura/edição/exclusão por ID de outra tenant não funciona.** `GET/POST/PUT/DELETE /api/chats` usam `getScopedChats` (`server.ts:4617-4621`) e `getChatScopeIds` (`server.ts:4605-4615`): sub-tenant vê só o próprio id; tenant pai vê pai+filhos; chat alheio → 404 (`server.ts:4655-4656`, `4678-4679`). `POST /api/chat` com `chatId` de outra tenant não abre o chat: cai em `scopedChats.find` e cria sessão nova (não usa o "primeiro chat do banco"). Histórico de mensagens só é enviado ao modelo a partir do chat **do próprio escopo**. O vazamento no chat é de **contexto de dados** (C-2/A-1), não de sessões.
3. **Configuração de IA/metodologia é escopada.** `GET/POST /api/config`, `/config/blocos*`, `/config/gemini`, `/config/ai*`, `/config/book(s)`, `/guia/*` usam `extractTenantIdFromReq` e escrevem em `tenantAiConfigsDb[tenantId]` ou `auditConfigDb` (somente superadmin/`system-global`); `/api/config` é `adminOnly` (BPO recebe 403) e `redactConfig` remove `geminiApiKey`/`providers[].apiKey` (`server.ts:1422-1432`). `GET/POST /api/tenants/:id/aiconfig` exigem `canAccessTenant` (`server.ts:9904-9910`).
4. **`GET /api/users` escopado; respostas de `POST`/`DELETE` foram corrigidas pelo Lead.** `safeUsersForScope` (`server.ts:2514-2530`) filtra por `canAccessTenant` e é usada em GET/POST/DELETE/PUT de usuários. Antes do hardening, `POST/DELETE` devolviam `usersDb` cru (vazamento de e-mails de todos os tenants) — **corrigido pelo Lead** no working tree; manter teste de regressão.
5. **`DELETE /api/interactions/:id` checa escopo** (`interactionVisibleToAuth`-like via `canAccessTenant`, `server.ts:2174`) — IDOR de exclusão individual **não** reproduz. O problema são os deletes em massa por `bpoName` (A-4).
6. **`POST /api/interactions/bulk-delete` com `ids` é escopado** por `canAccessTenant` no filtro (`server.ts` linhas do bloco `removedIds`); a variante `clearAll` **não** é (A-4).
7. **Sessão sólida:** cookie HttpOnly + `SameSite=Strict` + HMAC-SHA256 com `timingSafeEqual`, `Secure` em produção (`server.ts:73-106`, `2466` no snapshot anterior); sem CORS permissivo. Rate-limit de login (10/15min) e API (300/min) (`server.ts:75-76`, `2031-2055`). Revogação por revalidação de papel/tenant a cada request (`server.ts:2060`).
8. **`POST /api/setup/superadmin` exige `SETUP_TOKEN` e só funciona com zero superadmins** (`server.ts:2061-2107`) — seguro. `GET /api/saas/metrics` é superadmin-only (`server.ts:8053-8057`).
9. **`POST /api/pii/test`** apenas mascara texto; não lê base.
10. **`GET /api/session`** devolve só `req.auth` (email/role/tenantId/bpoName) — sem segredos.

---

## 8. Cobertura: endpoint → escopo observado

| Endpoint(s) | Escopo observado | Situação |
|---|---|---|
| `GET /api/interactions` | sessão (`extractTenantIdFromReq`) + filtro pai/filho por `tenantId`; sub-tenant por `bpoName` | **C-2**, M-1 |
| `DELETE /api/interactions/:id`, `POST /bulk-delete` (ids) | `canAccessTenant` | OK (individual/ids); clearAll+A-4 |
| `POST /interactions/clear`, `bulk-delete clearAll` | `bpoName`/tenant, mas com braços globais | **A-4** |
| `POST /interactions/:id/re-audit` | `interactionVisibleToAuth` (Lead) | **corrigido** |
| `POST /interactions/re-audit-batch` | global em `ids` | **C-3** |
| `POST /analyze` | tenant da sessão; sobrescreve por ID global | **A-7** |
| `GET/POST/PUT/DELETE /api/chats` | `getScopedChats` (tenant e filhos) | **OK** |
| `POST /api/chat` | `getScopedChats` para sessão + `scopedInteractions` por `tenantId`/`bpoName`; fallback global | **C-2** (contexto), **A-1** (fallback) |
| `GET/POST /api/config*`, `/guia/*`, `/config/book(s)` | `extractTenantIdFromReq`; adminOnly | OK |
| `GET /api/users`, `POST/PUT/DELETE /api/users` | `safeUsersForScope`/`canAccessTenant`; tenantId só superadmin | OK (após hardening) |
| `GET/POST/DELETE/PUT /api/tenants` | GET/DELETE escopados; POST/PUT resposta global | **A-8** |
| `GET/POST/PUT /api/bpos`, `DELETE /api/bpos/:name` | GET escopado (com irmãos no sub-tenant); POST escopado; DELETE global por nome | **A-4**, M-3 |
| `GET /api/genesys/recurring`, `/zendesk/recurring` | nenhum (global, sem papel) | **A-2** |
| `POST /api/genesys/config`, `/zendesk/config`, `/genesys/queues` | adminOnly/qualquer admin → grava global | **A-6** |
| `POST /genesys/sync`, `/zendesk/sync`, `/genesys/queues/discover` | tenant da sessão; fallback de creds globais | parcial (A-2/A-6) |
| `GET /api/integrations` | tenant para config, mas `...sys` vaza tenantConfigs | **C-1** |
| `POST /api/integrations/master*`, `/health*` | superadmin no handler | OK |
| `POST /api/integrations/tenant/bpo`, `/discover-queues` | `extractTenantIdFromReq` + `subtenantMatch` global | **M-4** |
| `POST /api/integrations/sync` | `subtenantMatch` global + response `bpoConfig` | **A-5** |
| `POST /api/integrations/webhook/ingest` | sessão obrigatória; `tenant_id`/id do payload | **A-7**, B-1 |
| `GET /api/integrations/webhook/config|logs` | nenhum papel | **A-3** |
| `POST /api/monitoria-tradicional/upload`; `GET /api/confronto` | upload sem tenant; confronto escopado com match por id | **M-2**, **C-2** (via `bpoName`) |
| `GET /api/saas/metrics`, `/health`, `/session`, `/pii/test` | superadmin / público sem PII / sessão | OK |
| `app.all("/api/*")` 404 | — | OK |

---

## 9. Correções já aplicadas pelo Lead no working tree (revalidar/testar; não são achados abertos)

Snapshot de revalidação: `391C6AF6…` (10.398 linhas, 00:44:36; âncoras aproximadas — o arquivo mudou mais de 20 vezes durante a sessão). Itens verificados já corrigidos:

1. **C-1** — `GET /api/integrations` não devolve mais `tenantConfigs`: destructuring em `server.ts:8217-8221` (`const { tenantConfigs: _allTenantConfigs, ...sysPublic } = sys`). **Ação:** teste de regressão + rotação das credenciais que ficaram expostas.
2. **C-2** — escopo canônico extraído para `src/utils/interactionScope.ts` (funções puras, com `tests/interactionScope.test.ts`): `interactionInScope` (matriz = próprios + filhas; sub-tenant = próprio dono + herança do pai/global/sem-dono **apenas** se `bpoAliases` casar — sem vazamento entre matrizes) e `interactionOwnedByScope` (posse estrita p/ mutações). No servidor: import `server.ts:40`; `filterInteractionsForScope` em `GET /api/interactions` (`2156`); `interactionScopePredicate` (`4482-4489`) em confronto (`3673`), chat (`4809`), sync (`5963`); `interactionVisibleToAuth` (`4494-4497`) em delete/re-audit (`4507`, `4542`). **Residual:** registros legados com `tenantId` nulo/`system-global` continuam visíveis por alias dentro da árvore; recomendo backfill de `tenantId`.
3. **C-3** — individual (`server.ts:4524-4533`) e batch (`4555-4572`) agora usam `interactionVisibleToAuth`/predicado. **Ação:** teste de IDOR por papel.
4. **A-1** — fallback do chat recebe dados escopados (`server.ts:10164-10175`; chamadas `4907/4910`).
5. **A-2** — `GET /api/genesys/recurring` e `GET /api/zendesk/recurring` exigem `superadmin` (`server.ts:6185-6196`, `7090-7100` no snapshot de revalidação). **Ação:** rotação.
6. **A-3** — config/logs globais do webhook exigem `superadmin` (`server.ts:7975-8033`) e snippet mascarado (`server.ts:7864-7865`). **Ação:** rotação do `webhookSecret`.
7. **`/api/users`** — `safeUsersForScope` (`server.ts:2508-2524`) em GET/POST/DELETE e validações de escopo em `PUT /api/users`; fecha vazamento de e-mails e sequestro de conta via POST.
8. **Escopo de superadmin** — normalização (`src/utils/userScope.ts` + `server.ts:967-980`, `1209-1233`, `2052-2078`, `2476-2501`) e guardas em `POST/PUT /api/tenants` para não "adotar" conta superadmin/realocar usuário para tenant inexistente.
9. Obs.: o arquivo mudou de 10.277 → ~10.400 linhas durante a auditoria. **Linhas dos achados = snapshot `403CAE5E…`**; âncoras de status desta seção = snapshot `3B0D4A3F…` (10.401 linhas); o Lead segue editando — revalidar por endpoint/âncora antes de fechar.


---

## 10. Recomendações priorizadas

**P0 (bloqueia release / LGPD)** — *itens C-1, C-2, C-3, A-1, A-2 e A-3 já foram corrigidos pelo Lead no working tree (§9); as ações abaixo viram teste de regressão, backfill e rotação de credenciais.*
1. Corrigir C-1: allowlist de campos em `GET /api/integrations`; remover `tenantConfigs`, `masterConfig`, `availableQueues` globais e qualquer `creds` do response. Rodar rotação de credenciais potencialmente expostas.
2. Corrigir C-2: escopo canônico por `tenantId` em interactions/confronto/chat; `bpoName` só dentro do escopo; resolver dono do dado por `tenantId` e migrar dados legados (backfill `tenantId` por vínculo `bpoName→sub-tenant` do mesmo pai).
3. Corrigir C-3 (batch) com `interactionVisibleToAuth` no filtro de `ids`.
4. A-1: fallback do chat apenas com dados escopados.
5. A-2/A-3/A-6: rotas de credenciais/config global `superadmin`-only + redigir segredos; rotacionar `webhookSecret` e tokens.
6. A-4: todo delete em coleção global filtrar por tenant/`canAccessTenant`; remover matches por `includes()`.

**P1**
7. A-5/M-4: resolver sub-tenant só entre filhos do próprio tenant; validar `canAccessTenant` em toda escrita; não devolver `bpoConfig`.
8. A-7: `tenantId` do webhook derivado de credencial/sessão; IDs UUID; conflito de ID entre tenants = 409.
9. A-8: respostas de tenants sempre `scopedList`.
10. M-1: fail-closed para tenant inexistente/`system-global` não-superadmin.
11. M-2: `tenantId` em monitorias tradicionais (schema + upload + leitura).
12. M-3/M-5: escopo do papel `bpo` (só a própria sub-tenant) e validação de `bpoName`/`parentId` em PUTs.

**P2**
13. M-6: RLS/`tenant_id` no banco; testes automatizados de isolamento por papel/tenant em CI (matriz superadmin/admin/bpo × endpoints read/write).
14. B-1/B-2: autenticação de integração por tenant + HMAC obrigatório; remover atalho `master@admin.com`.
15. Remover dados reais de integração de `database_store.json` versionado (client id e catálogo de ~430 filas) e adicionar scanner de segredos/dados no CI.

---

## 11. Limitações e observações

- **Não houve teste dinâmico**: nenhum servidor foi iniciado, nenhum build/test executado (respeitando a task). As explorações são derivadas de leitura de código e devem ser confirmadas pelo Lead em ambiente de teste com dados fixtures.
- `database_store.json` do repositório tem `usersDb`, `interactionsDb`, `chatsDb` praticamente vazios; a demonstração de exposição usa a estrutura de `systemsIntegrationsDb.tenantConfigs` (que contém credenciais/filas) e o fluxo de código. Em produção, os cenários C-1/C-2 expõem dados reais.
- O código estava sob edição concorrente do Lead durante a auditoria; revalidar cada item pelo snippet/âncora e pelo endpoint, não apenas pela linha. **Status revalidado no snapshot `391C6AF6…` (10.398 linhas, 00:44:36)**: C-1, C-2, C-3, A-1, A-2, A-3, a variante individual de C-3 e os vazamentos de `/api/users` já estão **corrigidos** no working tree (§9); os ALTOS A-4…A-8 e os MÉDIOS M-1 (parcial)…M-6 seguiam **abertos/presentes** nesse snapshot.
- Achados de PII/LGPD no envio a provedores de IA (prompts, mascaramento) são escopo da task-1 (`lgpd-ia-auditor`) e foram apenas tangenciados aqui (A-1, A-6, C-2/contexto do chat).
- O bug funcional de visibilidade de sub-tenant (dados atribuídos ao BPO não aparecem) é escopo da task-3; este relatório explica a **causa estrutural** (escopo baseado em `bpoName` no sub-tenant e `tenantId` no upload) e por que a correção precisa ser `tenantId`-canônica + `bpoName` apenas como agrupamento.

---

## 12. Anexo — reprodução rápida (ambiente de teste)

> **Nota de status:** os passos marcados **[CORRIGIDO]** já foram fechados pelo Lead no snapshot de revalidação (devem retornar 403/sem dados; use-os como teste de regressão, não como exploit). Os demais seguiam reproduzíveis naquele snapshot.

```bash
HOST=https://<ambiente-de-teste>
J='Content-Type: application/json'

# 0) autenticar (admin do tenant A e um usuário bpo qualquer)
curl -s -c adminA.txt -H "$J" -d '{"email":"<adminA>","password":"<senha>"}' $HOST/api/login
curl -s -c bpo.txt    -H "$J" -d '{"email":"<bpo>","password":"<senha>"}'    $HOST/api/login

# C-1 [CORRIGIDO]: credenciais de todos os tenants (qualquer sessão, inclusive bpo)
curl -s -b bpo.txt $HOST/api/integrations | jq '.systems[] | {id, tenantConfigs}'

# A-2 [CORRIGIDO]: credenciais globais Genesys/Zendesk
curl -s -b bpo.txt $HOST/api/genesys/recurring | jq '.config.creds'
curl -s -b bpo.txt $HOST/api/zendesk/recurring | jq '.config.creds'

# A-3 [CORRIGIDO]: segredo + logs globais de webhook
curl -s -b bpo.txt $HOST/api/integrations/webhook/config | jq '.config.webhookSecret'
curl -s -b bpo.txt $HOST/api/integrations/webhook/logs  | jq '.logs[0]'

# C-2 [CORRIGIDO]: admin A cria sub-tenant com bpoName da vítima e lê interações dela
curl -s -b adminA.txt -H "$J" -d '{"name":"Probe","adminEmail":"probe@tenant-a.com",
  "adminPassword":"S3nh4-Forte#2026","isSubtenant":true,"bpoName":"<BPO da vitima>"}' \
  $HOST/api/tenants
curl -s -c probe.txt -H "$J" -d '{"email":"probe@tenant-a.com","password":"S3nh4-Forte#2026"}' $HOST/api/login
curl -s -b probe.txt $HOST/api/interactions | jq '.[0] | {id,tenantId,bpoName,agentName,customerName,transcript}'
curl -s -b probe.txt $HOST/api/confronto  | jq '.correlacoes[0]'
curl -s -b probe.txt -H "$J" -d '{"message":"resuma os atendimentos do BPO <BPO da vitima>"}' $HOST/api/chat

# C-3 [CORRIGIDO]: batch com IDs de outra tenant
curl -s -b adminA.txt -H "$J" -d '{"ids":["INT-100","INT-101","INT-102"]}' \
  $HOST/api/interactions/re-audit-batch | jq '.interactions[] | {id,tenantId,transcript}'

# A-1 [CORRIGIDO]: fallback global do chat (tenant sem provedor configurado)
curl -s -b bpo.txt -H "$J" -d '{"message":"liste os operadores com as piores notas e falhas criticas"}' $HOST/api/chat

# A-4: destruição cross-tenant por nome (usar SOMENTE em ambiente descartável)
curl -s -X DELETE -b adminA.txt "$HOST/api/bpos/<BPO%20da%20vitima>"
curl -s -b adminA.txt -H "$J" -d '{"clearAll":true,"bpoName":"<BPO da vitima>"}' \
  $HOST/api/interactions/bulk-delete

# A-5: config de integração de outro tenant
curl -s -b adminA.txt -H "$J" -d '{"systemId":"genesys","bpoName":"<BPO da vitima>"}' \
  $HOST/api/integrations/sync | jq '.bpoConfig'

# A-7: escrita/sobrescrita no tenant vítima via webhook (sessão de admin)
curl -s -b adminA.txt -H "$J" -d '{"tenant_id":"<tenant da vitima>",
  "id":"<id de interacao>","transcript":"...","agent_name":"X","bpo_name":"Y","channel":"chat"}' \
  $HOST/api/integrations/webhook/ingest

# A-8: diretório global de tenants na resposta de criação
curl -s -b adminA.txt -H "$J" -d '{"name":"Probe2","adminEmail":"p2@tenant-a.com",
  "adminPassword":"S3nh4-Forte#2026","isSubtenant":true,"bpoName":"z"}' \
  $HOST/api/tenants | jq '.tenants'
```

> Observações de segurança para o teste: use ambiente isolado e dados sintéticos; não rode os passos destrutivos (A-4) fora de ambiente descartável; não salve as saídas com credenciais reais em arquivos versionados.
