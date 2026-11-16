# Bug: sub-tenant atribuída a parceiro BPO não mostra os dados atribuídos ao BPO

- **Task:** `task-3` (quadro compartilhado) — investigação, sem implementação.
- **Repo:** `C:\AI_Apps\Projetos\Audit.AI` (AuditaQA — Express + React/Vite, estado JSON persistido).
- **Snapshot de código:** `HEAD = fa64165` ("fix: keep the selected call stable during polling"), `server.ts` com 10.183 linhas no commit. Durante a auditoria o working tree tinha alterações não commitadas de **outra task** (escopo de superadmin, `src/utils/userScope.ts`, `interactionVisibleToAuth`); por isso **as linhas citadas são as do HEAD fa64165** — no working tree elas estão deslocadas (≈ +45 a +160 linhas). Cada trecho é citado junto para localizar por `grep`.
- **Método:** leitura estática de server.ts / componentes + simulação executável dos filtros com fixture (nenhum servidor iniciado, nenhum arquivo de src/testes/database_store alterado).

---

## 0. TL;DR (causa raiz e correção)

**Causa raiz:** a visibilidade da sub-tenant é decidida por **igualdade de string em `bpoName`**, não pela posse do registro (`tenantId`). `bpoName` é um rótulo operacional escrito por fontes diferentes e não canônicas (nome da tenant via `getUnifiedBpos`, label digitado/criado, fallbacks `"BPO Alpha"`/`"BPO Principal"`/`"Parceiro Geral"`, config **global** de Genesys), enquanto o dono real é `tenantId`. Quando o rótulo gravado na interação diverge de `tenant.bpoName`/`user.bpoName`, a sub-tenant perde os dados — e o inverso também ocorre: dados atribuídos ao BPO com `tenantId` do pai/`system-global` não entram no "perfil" da sub-tenant em endpoints que só olham `tenantId`.

**Filtros exatos que omitem (os que causam o bug):**

1. `GET /api/interactions` — `server.ts` HEAD **2088–2092** (`bpoName` da query aplicado **depois** do escopo, de forma estrita). Toda conta de sub-tenant é provisionada como **`role='bpo'`** (HEAD **9513/9518**) e o front **sempre** envia `&bpoName=session.bpoName` (App.tsx **91–99**, chamadas no login **190/283**) → o filtro estrito roda em toda carga da tela.
2. Filtros client-side duplicados que descartam linhas já autorizadas pelo servidor: `DashboardGeral.tsx:83`, `AnalisesAuditoria.tsx:819`, `AdesaoScript.tsx:57–58` (e `OperadoresMonitoria.tsx:48`, código morto).
3. `GET /api/saas/metrics` — HEAD **7910**: `interactionsCount = interactionsDb.filter(i => i.tenantId === tenant.id)` → a linha da sub-tenant no *Inventário Operacional Agregado por Tenant/Sub-tenant* (SaasMasterDashboard **451–461**) fica **0** para dados atribuídos ao BPO mas gravados com `tenantId` do pai ou `system-global`.
4. `POST /api/interactions/re-audit-batch` — HEAD **4399–4401**: só `tenantId` (não reprocessa herdados) e, quando vêm `ids` do body, **não aplica escopo algum** (IDOR).

**Correção mínima proposta:** uma única função canônica de escopo (dono = `tenantId`; herança da sub-tenant **apenas** do pai/global e **apenas** quando o `bpoName` casa com aliases calculados no servidor `{tenant.bpoName, tenant.name}`, ancorados na cadeia `parentId`), usada por `/api/interactions`, `/api/confronto`, `/api/chat`, `/api/saas/metrics` e `/api/interactions/re-audit-batch`; o `bpoName` vindo do cliente deixa de ser filtro de autorização para escopo de sub-tenant (vira, no máximo, filtro de exibição); cliente para de filtrar por `bpoName`; escrita passa a ser canônica (`getUnifiedBpos` devolve `bpoName||name`; sync Genesys resolve a sub-tenant como o `/api/integrations/sync` já faz; cron global não grava `tenantId` nulo); UI corrige o auto-fill do `bpoName`. Detalhes na §6.

---

## 1. Modelo de dados (como o próprio código o define)

`src/types.ts`:

- `Interaction.tenantId?: string` — dono do registro.
- `Interaction.bpoName: string` — rótulo/agrupamento operacional ("BPO Alpha", "AeC Online", …).
- `Tenant` (HEAD **types.ts:160–173**): `parentId` (null na matriz; id da matriz na sub-tenant), `isSubtenant`, e **`bpoName?: string` — "Associated BPO partner name if sub-tenant"**.
- `UserSession.bpoName` — "restricts read scope for BPO users" (types.ts:175–181). `role ∈ {superadmin, admin, bpo}`.

Portanto a intenção declarada é: **`tenantId` = dono; `bpoName` = agrupamento operacional/escopo de leitura para usuários BPO; a sub-tenant herda do pai "quando aplicável"** (o código implementa isso como: herdado = interações do pai/global cujo `bpoName` seja o do parceiro).

No runtime isso se desorganiza por três razões estruturais:

1. **Não existe um identificador canônico de parceiro BPO.** O vínculo é uma string (`tenant.bpoName`) comparada com outra string (`interaction.bpoName`), sem normalização única (trim/case é feito de forma inconsistente) e sem FK.
2. **Quem grava a interação escolhe o rótulo de fontes diferentes** (§2): o nome de exibição da tenant, o label do formulário, um fallback, ou a config *global* de Genesys.
3. **Quem lê aplica o rótulo como se fosse autorização** (§3), e em endpoints diferentes aplica filtros diferentes (ora `tenantId`, ora `bpoName`, ora os dois, com regras distintas).

---

## 2. Caminhos de escrita — de onde vêm `tenantId` e `bpoName`

| # | Caminho | `tenantId` gravado | `bpoName` gravado | Evidência (HEAD fa64165) |
|---|---|---|---|---|
| W1 | `POST /api/analyze` (Ingestão em Lote / Hub) | **tenant da sessão** (`extractTenantIdFromReq`); `items[i].tenantId` é ignorado para não-superadmin | `item.bpoName` = `selectedBpo` do front, que vem de `GET /api/bpos` = `getUnifiedBpos` = **`t.name`** da sub-tenant | server.ts **4286–4312**, **3821–3827**, **4248–4251 (bpoName)**; `IngestaoLote.tsx:568–577, 618–632`; `getUnifiedBpos` **2196–2249 (2209 `t.name \|\| t.bpoName`)** |
| W2 | `POST /api/integrations/sync` (Hub multissistemas) | resolve sub-tenant por `bpoName OR name OR id` → `resolvedTenantId`; senão tenant da sessão; senão `system-global` | `targetBpo` cru (label do formulário) | **9159–9190** (9167–9174); consumo em `runBackgroundCaptureJob` |
| W3 | `POST /api/integrations/tenant/bpo` (salvar config isolada) | grava a **mesma** config em `[tenant da sessão, sub-tenant casada, parentId da sub-tenant]` | chave do `bpoConfigs` = `bpoName` cru | **8304–8412** (8390–8411) |
| W4 | `POST /api/genesys/sync` (tela antiga de integração Genesys) | **tenant da sessão, SEM resolver a sub-tenant** — matriz logada grava `tenantId=matriz` para capturas "atribuídas ao BPO" | `targetBpo` cru | **6137–6158** (6140, 6158) + `executeGenesysSyncLogic` grava `createPendingInteraction({ ..., tenantId: targetTenantId })` **5779–5791** |
| W5 | Cron Genesys recorrente (global) | **`undefined`** → `processAuditAnalysisForItem` cai em `"system-global"` | `genesysRecurringConfigDb.targetBpo` — uma config **global**, não por tenant, com fallback `"BPO Alpha"` | **5912–5948** (5924, 5938–5948); **3821–3822** (`overrideTenantId \|\| item.tenantId \|\| "system-global"`); cron iniciado no load do módulo **6020** (`void runGenesysScheduledSync()`) |
| W6 | `POST /api/integrations/webhook/ingest` | **do payload** (`body.tenant_id`), pode faltar/errar | **do payload** (`body.bpo_name`/campo mapeado) | `mapUniversalPayload` **7658–7695** (7666, 7670) |
| W7 | `POST /api/tenants` (criar sub-tenant/parceiro) | `newTenant.id` p/ tenant e admin user | `cleanBpoName = bpoName \|\| name` — **string livre**, sem canonicalização; admin user é **`role='bpo'`** com o mesmo valor | **9454–9523** (9502/9507 tenant, **9513–9519** user) |
| W8 | `POST /api/bpos` **com `parentId`** | id gerado | cria sub-tenant com **`name = "Sub-Tenant X (Parent)"` e `bpoName = "X"`** — divergência por construção | **2257–2314** (2288–2301) |
| W9 | `PUT /api/tenants/:id` | inalterado | aceita `bpoName` novo **sem reconciliar** usuários do tenant nem interações existentes | **9654–9707** (9707) |
| W10 | `PUT /api/users/:email` | inalterado | aceita `bpoName` livre (superadmin) | **2520–2543** (2543) |

No front, `bpoName` da sub-tenant também nasce errado em `GestaoTenants.tsx:466–469`:

```tsx
onChange={(e) => {
  setName(e.target.value);
  if (!bpoName) setBpoName(e.target.value);   // <-- só a PRIMEIRA tecla; "BPO Delta" digitado -> bpoName = "B"
}}
```

Como não existe campo próprio de BPO no modal (só "Nome da Operação / Parceiro BPO"), o `bpoName` gravado no tenant/usuário tende a ser **o primeiro caractere** do nome digitado (ou o nome inteiro, se colado). O próprio código tem cicatrizes disso: `getUnifiedBpos` filtra `bName.trim() !== 'A'` (HEAD **2210, 2235, 2247**) — ou seja, em algum momento existiram sub-tenants com `bpoName = "A"`.

> **Consequência W1–W10:** o mesmo parceiro pode aparecer como `"BPO Delta"` (nome), `"B"` (bpoName gravado por digitação), `"BPO Delta"` (config de integração), `"BPO Alpha"`/`"BPO Principal"`/`"Parceiro Geral"` (fallbacks) e `"Sub-Tenant BPO Delta (Casas Bahia)"` (W8). As interações ficam com o rótulo do momento da captura; o vínculo do tenant/usuário fica com outro. Não há reconciliação em nenhum ponto.

---

## 3. Caminhos de leitura — comparação de todos os filtros

### 3.1 Servidor

| Endpoint | Regra atual (HEAD) | O que falta / problema |
|---|---|---|
| `GET /api/interactions` **2066–2093** | Sub-tenant: `i.tenantId === targetTenantId \|\| (tenantObj.bpoName && norm(i.bpoName) === norm(tenantObj.bpoName))` (**2078**). Matriz: `tenantId ∈ {matriz} ∪ filhos` (**2081–2083**). Depois: se query `bpoName` ≠ `all`, filtra **estrito** `norm(i.bpoName) === norm(bpoName)` (**2088–2092**). | (a) o OR usa **só** `tenantObj.bpoName` (não `name`, não aliases) → qualquer divergência de rótulo = omissão; (b) o filtro da query **remove até linhas do próprio tenant** da sub-tenant; (c) o OR não ancora o dono: inclui interação de **qualquer** tenant com o mesmo rótulo (risco cross-tenant, ver §7); (d) superadmin com `tenantId` de sub-tenant herda os mesmos defeitos (futura tela de inspeção). |
| `GET /api/confronto` **3546–3561** | Mesmo OR da sub-tenant (**3555**); matriz igual. Sem filtro de query. | Mesmo (a)/(c). |
| `POST /api/chat` (contexto de IA) **4662–4674** | Mesmo OR (**4668**). | Mesmo (a)/(c): o assistente da sub-tenant responde com base incompleta. |
| `GET /api/chats` / `getChatScopeIds` **4455–4465** | `tenantId` apenas; matriz vê chats dos filhos; sub-tenant vê só os próprios. | Não é o bug (chat nasce com o `tenantId` da sessão). Mantém-se. |
| **`GET /api/saas/metrics`** **7903–7931** | `interactionsCount = interactionsDb.filter(i => i.tenantId === tenant.id)` (**7910**) | **Filtro que causa a omissão no "perfil" exibido ao Master:** dados atribuídos ao BPO com `tenantId` do pai/`system-global` (W1/W4/W5/W6) → 0 na linha da sub-tenant. |
| **`POST /api/interactions/re-audit-batch`** **4392–4402** | `ids` do body sem escopo (**4399**); pendentes só por `tenantId === targetTenantId` (**4401**). | Sub-tenant não reprocessa herdados (pendentes com `tenantId` do pai/global); e IDOR no caminho por ids. |
| `GET /api/users` **2432** | filtra `canAccessTenant(auth, u.tenantId)` — `canAccessTenant` enxerga o próprio + filhos (admin). | Admin da matriz enxerga usuários dos filhos (intencional); não afeta dados de atendimento. |
| `GET /api/tenants` **9421** | superadmin: todos; senão próprio + filhos (admin). | OK. |
| `DELETE /api/interactions/:id`, `bulk-delete`, `clear` | usam o mesmo padrão OR/bpoName do read. | Herdam os mesmos defeitos ao apagar (podem apagar menos/mis). |

### 3.2 Cliente (o que roda depois do payload)

| Componente | Linha | Regra | Efeito |
|---|---|---|---|
| `App.fetchInteractions` | **91–99** (chamadas **190, 211, 226, 283, 389–393**) | se `session.bpoName` (sempre p/ `role='bpo'`) → `&bpoName=` | **Ativa o filtro estrito do servidor** em toda carga da sub-tenant. |
| `DashboardGeral.tsx` | **70–84** | `if (isBpoUser && userBpo && norm(item.bpoName) !== norm(userBpo)) return false;` | Descarta linhas autorizadas pelo servidor (inclusive do próprio tenant). |
| `AnalisesAuditoria.tsx` | **813–820** | idem | idem. |
| `AdesaoScript.tsx` | **48–63** | idem | idem (Resumo/adesão fica vazio). |
| `OperadoresMonitoria.tsx` | **35–50** | idem | Código **morto** (não é importado por App.tsx); não é a causa, mas é o mesmo padrão a remover. |
| `SaasMasterDashboard.tsx` | **104 e 451–461** | usa `metricsByTenant` de `/api/saas/metrics` | Exibe 0 na linha da sub-tenant. |

**Tela específica de "perfil da sub-tenant": não existe endpoint/tela dedicada.** O que existe:

- (i) a sub-tenant**logada** (admin provisionado como `role='bpo'` em W7) consumindo `/api/interactions` + dashboards client-side — é o fluxo "acesso o perfil de uma sub-tenant";
- (ii) a linha da sub-tenant no *"Inventário Operacional Agregado por Tenant / Sub-tenant"* do Painel Master (`SaasMasterDashboard.tsx`), alimentada por `/api/saas/metrics` (superadmin only);
- (iii) os cards de `GestaoTenants.tsx` — só metadados, sem dados de atendimento.

Ambos (i) e (ii) estão quebrados, por filtros diferentes (item 1 e item 3 do TL;DR).

---

## 4. Mecanismo exato da omissão (passo a passo)

Cenário mais provável em produção (usa apenas a UI atual e o código do HEAD):

1. Admin da matriz cria a sub-tenant pelo modal de Gestão de Tenants digitando o nome: `name="BPO Delta"`, mas `tenant.bpoName="B"` e o admin user nasce `role='bpo', bpoName="B"` (`GestaoTenants.tsx:466–469` + server **9513–9519**).
2. Admin da matriz configura/captura a integração escolhendo o parceiro na lista de BPOs: a lista é `getUnifiedBpos` = **`t.name` = "BPO Delta"** (server **2209**). A captura grava:
   - Hub/`/api/integrations/sync`: `tenantId = sub.id` (resolve por `name` em **9167–9174**) e `bpoName = "BPO Delta"`;
   - tela Genesys/`/api/genesys/sync`: `tenantId = matriz` (W4) e `bpoName = "BPO Delta"`;
   - cron Genesys: `tenantId = system-global` (W5) e `bpoName = "BPO Delta"`.
3. A sub-tenant loga (`role='bpo'`, `tenantId=sub`, `bpoName="B"`). O front chama `GET /api/interactions?tenantId=sub&bpoName=B` (App **91–99**, **283**).
4. Servidor: escopo da sub-tenant inclui as interações por `tenantId=sub` (as do Hub) — mas **o filtro da query** (HEAD **2088–2092**) exige `bpoName === "B"` e as descarta, porque o rótulo gravado é `"BPO Delta"`. As gravadas com `tenantId=matriz/system-global` já falham antes no OR (**2078**), que compara só com `tenant.bpoName="B"`.
5. Resultado: Dashboard, Auditoria, Resumo e o chat da sub-tenant ficam vazios/incompletos — embora os dados existam e estejam "atribuídos ao parceiro BPO" na visão da matriz. No Painel Master, a linha da sub-tenant em `/api/saas/metrics` também mostra menos/0 (só conta `tenantId=sub`).

A mesma cadeia ocorre sem o passo 1 (sem a UI):
- sub-tenant criada via API com `name` (operação) ≠ `bpoName` (parceiro) — modelo previsto em `types.ts:170` e aceito por **9454–9523**; os dados são rotulados com `t.name` por W1/W3 (linha 2209) e a conta filtra por `bpoName` → omissão;
- sub-tenant criada por W8 (`name="Sub-Tenant X (Parent)"`, `bpoName="X"`);
- qualquer registro antigo com rótulo legado/fallback (`"BPO Alpha"`, `"BPO Principal"`, `"Parceiro Geral"`, `bposDb[0]`, config global de Genesys) — nunca casa com o vínculo atual.

**Prova de que a causa é a divergência de rótulo, não a hierarquia:** com rótulos consistentes o fluxo da sub-tenant **funciona** no código atual (OR + query casam). Simulação na §5: o cenário `AeC Online` (rótulos iguais, como no `database_store.json` versionado em `a1c4af4`) devolve tudo; os cenários com divergência perdem exatamente as linhas atribuídas ao BPO.

---

## 5. Reprodução — fixture + resultado esperado vs atual

### 5.1 Fixture

```js
tenants = [
  { id:'tenant-mtz',    name:'Casas Bahia', parentId:null,          isSubtenant:false },
  { id:'tenant-aec',    name:'AeC Online',  parentId:'tenant-mtz',  isSubtenant:true, bpoName:'AeC Online' }, // rótulos consistentes
  { id:'tenant-delta',  name:'BPO Delta',   parentId:'tenant-mtz',  isSubtenant:true, bpoName:'B' },          // UI: 1ª tecla digitada
  { id:'tenant-opsp',   name:'Operação SP', parentId:'tenant-mtz',  isSubtenant:true, bpoName:'BPO Omega' }   // name != bpoName (modelo previsto)
]
users = [
  { role:'bpo', tenantId:'tenant-aec',   bpoName:'AeC Online' },
  { role:'bpo', tenantId:'tenant-delta', bpoName:'B' },
  { role:'bpo', tenantId:'tenant-opsp',  bpoName:'BPO Omega' }
]
interactions = [
  { id:'i1', tenantId:'tenant-mtz',      bpoName:'AeC Online' },   // matriz captura p/ BPO (W1/W4)
  { id:'i2', tenantId:'tenant-aec',      bpoName:'AeC Online' },   // Hub resolveu a sub-tenant (W2)
  { id:'i3', tenantId:'tenant-mtz',      bpoName:'BPO Delta' },    // matriz captura rótulo "t.name"
  { id:'i4', tenantId:'tenant-delta',    bpoName:'BPO Delta' },    // Hub gravou t.name no dono sub-tenant
  { id:'i5', tenantId:'tenant-delta',    bpoName:'B' },            // rótulo canônico
  { id:'i6', tenantId:'system-global',   bpoName:'BPO Omega' },    // cron Genesys global (W5)
  { id:'i7', tenantId:'tenant-mtz',      bpoName:'BPO Omega' },    // matriz captura p/ Omega
  { id:'i8', tenantId:'tenant-opsp',     bpoName:'Operação SP' },  // Hub gravou t.name no dono sub-tenant
  { id:'i9', tenantId:'tenant-opsp',     bpoName:'BPO Omega' }     // rótulo canônico
]
```

**Esperado** para a sub-tenant (regra canônica da §6): linhas com `tenantId = sub` **sempre** + linhas do pai/`system-global`/sem dono cujo `bpoName ∈ {tenant.bpoName, tenant.name}`.

### 5.2 Script de simulação (réplica fiel de HEAD 2066–2092 + filtros client-side + metrics)

```js
const norm = s => String(s || '').trim().toLowerCase();
// GET /api/interactions (HEAD 2066-2092), auth não-superadmin
function api(auth, queryBpo) {
  const targetTenantId = auth.tenantId; // extractTenantIdFromReq ignora query p/ não-superadmin
  let list = interactions.slice();
  if (targetTenantId && targetTenantId !== 'system-global') {
    const t = tenants.find(x => x.id === targetTenantId);
    if (t) {
      if (t.parentId) list = list.filter(i => i.tenantId === targetTenantId || (t.bpoName && norm(i.bpoName) === norm(t.bpoName))); // 2078
      else {
        const ids = new Set([targetTenantId, ...tenants.filter(x => x.parentId === targetTenantId).map(x => x.id)]);
        list = list.filter(i => (i.tenantId && ids.has(i.tenantId)) || (!i.tenantId && targetTenantId === 'system-global'));
      }
    }
  }
  if (queryBpo && queryBpo !== 'all') list = list.filter(i => i.bpoName && norm(i.bpoName) === norm(queryBpo)); // 2088-2092
  return list;
}
const client = (rows, s) => s.role === 'bpo' && s.bpoName
  ? rows.filter(i => norm(i.bpoName) === norm(s.bpoName)) : rows;                 // DashboardGeral:83 etc.
const metrics = id => interactions.filter(i => i.tenantId === id).length;         // HEAD 7910
```

### 5.3 Saída real da simulação

```text
### aec_online@teste.com (rótulos consistentes)
  GET /api/interactions?tenantId=tenant-aec&bpoName=AeC Online
  esperado: i1,i2
  API     : i1,i2 | omitidos: -
  tela    : i1,i2 | omitidos: -
  /api/saas/metrics (tenantId-only): 1 | esperado: 2

### admin do tenant BPO Delta (bpoName="B" divergente)
  GET /api/interactions?tenantId=tenant-delta&bpoName=B
  esperado: i3,i4,i5
  API     : i5 | omitidos: i3,i4          <-- inclui i4, dado do PRÓPRIO tenant
  tela    : i5 | omitidos: i3,i4
  /api/saas/metrics (tenantId-only): 2 | esperado: 3

### admin do tenant Operação SP (name != bpoName)
  GET /api/interactions?tenantId=tenant-opsp&bpoName=BPO Omega
  esperado: i6,i7,i8,i9
  API     : i6,i7,i9 | omitidos: i8       <-- dado do próprio tenant rotulado com t.name
  tela    : i6,i7,i9 | omitidos: i8
  /api/saas/metrics (tenantId-only): 2 | esperado: 4

### Matriz Casas Bahia (admin) — esperado: próprios + filhos
  API: i1,i2,i3,i4,i5,i7,i8,i9

### Superadmin (system-global) — esperado: tudo
  API: i1,i2,i3,i4,i5,i6,i7,i8,i9
```

Leituras:
- a matriz e o superadmin veem tudo (por isso o problema "só aparece no perfil da sub-tenant");
- a sub-tenant com rótulos consistentes vê tudo (lista) — confirma que o bug é a **divergência de rótulo**, não a hierarquia;
- com divergência, some tanto o dado **herdado** (atribuído ao BPO, `tenantId` do pai/global) quanto o dado **do próprio tenant** com outro rótulo;
- **`/api/saas/metrics` erra em todos os casos** em que o dado é atribuído ao BPO e gravado com `tenantId` do pai/global — inclusive no cenário consistente (`AeC`: 1 vs 2). Esse é o sintoma exato do relato do usuário se ele estava no Painel Master.

### 5.4 Requisição concreta (para reproduzir no ambiente, sem criar dados)

```http
GET /api/interactions?tenantId=tenant-1787055705707&userEmail=aec_online@teste.com
Cookie: auditai_session=<sessão bpo da sub-tenant>
```
Hoje o front manda também `&bpoName=<user.bpoName>`. Compare o resultado com e sem o parâmetro:
- **sem `bpoName`** (sessão bpo): o servidor devolve `tenantId=sub` + `bpoName = tenant.bpoName`;
- **com `bpoName=user.bpoName`** (fluxo real): devolve só a interseção — se o rótulo não casar, volta vazio.

---

## 6. Correção mínima proposta (para o lead implementar)

### 6.1 Núcleo: uma função canônica de escopo (novo `src/utils/interactionScope.ts`)

Regra canônica — **dono = `tenantId`; `bpoName` = agrupamento; herança da sub-tenant só do pai/global e só para o BPO dela; nunca ampliar para outra tenant**:

```ts
// src/utils/interactionScope.ts
import type { Interaction, Tenant } from "../types";

export type ScopeTenant = Pick<Tenant, "id" | "name" | "parentId" | "isSubtenant" | "bpoName">;
export type ScopeUser = { role: "superadmin" | "admin" | "bpo"; tenantId: string };

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

/** Rótulos aceitos do parceiro BPO da sub-tenant (vínculo canônico + nome legado). */
export function bpoAliases(tenant: ScopeTenant): Set<string> {
  return new Set([tenant.bpoName, tenant.name].map(norm).filter(Boolean));
}

/** Autorização de LEITURA de uma interação. scopeTenant = tenant efetivo da sessão/consulta. */
export function interactionInScope(
  interaction: Pick<Interaction, "tenantId" | "bpoName">,
  scopeTenant: ScopeTenant | undefined,
  allTenants: readonly ScopeTenant[]
): boolean {
  if (!scopeTenant) return false;
  const owner = norm(interaction.tenantId);

  if (!scopeTenant.parentId) {
    // Matriz: próprios + filhos diretos (comportamento atual preservado)
    if (owner === norm(scopeTenant.id)) return true;
    return allTenants.some(t => t.parentId === scopeTenant.id && norm(t.id) === owner);
  }

  // Sub-tenant: 1) dono é sempre visível (mesmo com rótulo divergente)
  if (owner === norm(scopeTenant.id)) return true;
  // 2) herança BPO: só do pai/system-global/sem-dono E com rótulo do parceiro
  const inheritedFrom = new Set([norm(scopeTenant.parentId), "system-global", ""]);
  if (!inheritedFrom.has(owner)) return false;            // NUNCA outra tenant
  return bpoAliases(scopeTenant).has(norm(interaction.bpoName));
}

export function filterInteractionsForScope(params: {
  interactions: readonly Interaction[];
  tenants: readonly ScopeTenant[];
  scope: ScopeUser;
  requestedTenantId?: string | null;   // só superadmin usa
  requestedBpo?: string | null;        // query/sessão — filtro de EXIBIÇÃO
}): Interaction[] {
  const { interactions, tenants, scope } = params;
  if (scope.role === "superadmin" && !params.requestedTenantId) return [...interactions];
  const tenantId = scope.role === "superadmin" ? String(params.requestedTenantId || "") : scope.tenantId;
  if (!tenantId || tenantId === "system-global") return [...interactions];
  const tenant = tenants.find(t => t.id === tenantId);
  if (!tenant) return [];

  const requested = norm(params.requestedBpo);
  const requestedActive = Boolean(requested) && requested !== "all";
  const isSubtenantScope = Boolean(tenant.parentId);

  return interactions.filter(interaction => {
    if (!interactionInScope(interaction, tenant, tenants)) return false;
    if (!requestedActive) return true;
    if (!isSubtenantScope) return norm(interaction.bpoName) === requested;      // matriz: estrito (não amplia usuário BPO da matriz)
    if (norm(interaction.tenantId) === norm(tenant.id)) return true;             // sub-tenant: filtro nunca esconde o próprio dado
    return bpoAliases(tenant).has(norm(interaction.bpoName));                    // herdado: só aliases do parceiro
  });
}
```

### 6.2 Servidor — substituir os filtros duplicados pelo helper

| Local | De (HEAD) | Para |
|---|---|---|
| `GET /api/interactions` **2069–2092** | bloco manual + filtro query | `const list = filterInteractionsForScope({ interactions: interactionsDb, tenants: tenantsDb, scope: auth, requestedTenantId: extractTenantIdFromReq(req), requestedBpo: bpoName });` — **ou** manter o bloco atual correto e trocar só o filtro final: para `isSubtenantScope`, `list.filter(i => norm(i.tenantId) === norm(targetTenantId) || bpoAliases(tenantObj).has(norm(i.bpoName)))` |
| `GET /api/confronto` **3551–3560** | bloco manual | `filterInteractionsForScope(...)` |
| `POST /api/chat` **4664–4674** | bloco manual | `filterInteractionsForScope(...)` |
| `GET /api/saas/metrics` **7910** | `filter(i => i.tenantId === tenant.id)` | `filterInteractionsForScope({ interactions: interactionsDb, tenants: tenantsDb, scope: { role: "superadmin", tenantId: "system-global" }, requestedTenantId: tenant.id }).length` → sub-tenant passa a contar próprios + herdados do BPO, matriz continua própria+filhos |
| `POST /api/interactions/re-audit-batch` **4398–4401** | ids sem escopo + pendentes só `tenantId` | `const scoped = filterInteractionsForScope({ interactions: interactionsDb, tenants: tenantsDb, scope: auth, requestedTenantId: extractTenantIdFromReq(req) });` depois `ids ? scoped.filter(i => ids.includes(i.id)) : scoped.filter(pending)` (corrige omissão **e** IDOR) |
| `DELETE /api/interactions/:id`, `bulk-delete`, `clear` | padrões manuais | mesma função para decidir o que pode ser apagado |

> Se o lead já estiver com `interactionVisibleToAuth` (ownership-only, em progresso no working tree): **não usá-la na listagem** — usá-la só em mutações pontuais. Ownership-only esconde justamente o herdado do BPO (o caso do bug). Para listagem de sub-tenant a regra é a `interactionInScope` acima.

### 6.3 Escrita canônica (evita reincidência)

1. `getUnifiedBpos` (HEAD **2196–2249**): trocar as 3 ocorrências de `const bName = t.name || t.bpoName;` por **`const bName = t.bpoName || t.name;`** e, se `targetTid` for sub-tenant, retornar **somente o rótulo dela** (hoje a condição `t.parentId === parentTid` lista também os irmãos — HEAD 2207–2213).
2. `POST /api/genesys/sync` (HEAD **6137–6158**) + `runGenesysRecurringSyncInternal` (HEAD **5912–5948**): resolver a sub-tenant a partir de `targetBpo` com o mesmo bloco de `/api/integrations/sync` (HEAD **9167–9174**) e passar `resolvedTenantId` (hoje passa tenant da sessão / `undefined`). Gravar `bpoName = matchedSubtenant.bpoName` (canônico), não o rótulo cru.
3. `POST /api/analyze` / `processAuditAnalysisForItem`: normalizar `bpoName` — se `bpoName` casar com um filho (alias) do tenant da sessão, gravar o **`bpoName` canônico** do filho. (Opcional: gravar `tenantId = filho.id` quando o casamento for único — simplifica `/api/saas/metrics` e re-auditoria; decidir com o lead pelos efeitos em delete/relatórios.)
4. `POST /api/integrations/tenant/bpo` (HEAD **8390–8411**) e `discover-queues`: usar o mesmo resolvedor único (helper `resolveSubtenantByBpoLabel(tenants, label)` com normalização) em vez de 3 blocos `find` copiados.
5. `PUT /api/tenants/:id` (HEAD **9707**): se `bpoName` mudar, atualizar também `usersDb` do tenant (admin/BPO) e, opcionalmente, relabelar interações do tenant rotuladas com o valor antigo; senão a divergência renasce.
6. `POST /api/bpos` com `parentId` (HEAD **2288–2301**): alinhar `name` e `bpoName` (ou parar de usar no fluxo atual; hoje o `name` artificial `"Sub-Tenant X (Parent)"` é uma fonte garantida de divergência).

### 6.4 Cliente — remover a duplicação do filtro de autorização

Em `DashboardGeral.tsx:83`, `AnalisesAuditoria.tsx:819`, `AdesaoScript.tsx:57–58` (e `OperadoresMonitoria.tsx:48`, código morto):
remover a linha `if (isBpoUser && session.bpoName && ...) return false;` — a autorização passa a ser exclusivamente do servidor; o dropdown `selectedBpo` continua como filtro **de exibição** (default `all`).
`App.fetchInteractions` pode continuar enviando `bpoName` (compatibilidade): com a §6.2, para sub-tenant ele nunca esconde o próprio dado e para matriz segue estrito.

### 6.5 UI — corrigir a origem da divergência

`GestaoTenants.tsx:466–469`: remover o `if (!bpoName) setBpoName(e.target.value);` do `onChange`. O submit já faz `cleanBpoName = bpoName.trim() || name.trim()`; sem o auto-fill, `bpoName` nasce vazio e o servidor grava `bpoName = name` (consistente). Se o produto quiser modelar "nome da operação ≠ nome do parceiro", adicionar um campo explícito "Parceiro BPO" no modal (hoje ele não existe).

### 6.6 Reparação de dados (follow-up recomendado, não é o mínimo)

Script idempotente, dry-run primeiro, sobre `interactionsDb`:
para cada interação com `bpoName` casando **exatamente um** sub-tenant na cadeia do mesmo pai e `tenantId ∈ {parentId, system-global, ausente}` → setar `tenantId = subtenant.id` e `bpoName = subtenant.bpoName`. Isso conserta `/api/saas/metrics`, re-auditoria e relatórios sem depender de leitura ampliada. Se o casamento for ambíguo, **não** migrar — apenas reportar. Também normalizar `tenant.bpoName`/`user.bpoName` divergentes (`name` vs `bpoName` vs `"A"`-style) com relatório de mudanças.

### 6.7 Ordem mínima de patch (o que eu faria primeiro)

1. `src/utils/interactionScope.ts` + testes (§8).
2. `GET /api/interactions` (query filter) → helper (resolve a tela do perfil).
3. Filtros client-side removidos (idem).
4. `GestaoTenants.tsx` auto-fill + `getUnifiedBpos` canônico (evita novos registros divergentes).
5. `/api/saas/metrics` + `re-audit-batch` via helper (perfil do Master e reprocessamento).
6. Genesys sync/cron (`tenantId`/`bpoName` canônicos) e, por último, reparo de dados.

---

## 7. Riscos / over-exposure (a correção não pode mostrar dados de outro tenant)

Regras de segurança embutidas na §6.1:

- **Ancoragem na cadeia de parentesco:** o match por `bpoName`/alias só vale para linhas cujo `tenantId` seja o da própria sub-tenant, o do `parentId`, `system-global` ou ausente; **qualquer outro tenant é excluído**. Sem isso, duas matrizes com sub-tenant homônima ("BPO Delta") poderiam vazar dados entre si — o código atual (HEAD 2078) **não tem essa âncora** e é ele próprio um risco cross-tenant.
- **Aliases calculados no servidor** (`tenant.bpoName`, `tenant.name`); o cliente não fornece aliases. `bpoName` da query nunca amplia o conjunto — só reduz (e, na sub-tenant, nunca remove o dado do próprio dono).
- **Escopo da matriz inalterado:** `tenantId ∈ {matriz} ∪ filhos`; filtro `bpoName` estrito para não ampliar o que um usuário `role='bpo'` da matriz enxerga.
- **Superadmin:** global; quando consultar um `tenantId` específico (futura inspeção), usa a mesma função (para não repetir o bug).
- **`tenant.name` como alias legado:** é necessário porque W1/W3 gravam `t.name`; o risco teórico é uma sub-tenant irmã com nome igual ao `bpoName` de outra — mitigado pela âncora de dono (linhas de irmãs ficam fora). Registrar como dívida: o correto a médio prazo é ter `bpoTenantId`/FK no registro (Estágio 3 do roadmap de normalização).
- **Mutação vs leitura:** para deletar/re-auditar um id específico, manter a checagem estrita de dono (`interactionVisibleToAuth`/`canAccessTenant`); herança BPO deve valer só para leitura/listagem. A re-auditoria em lote de pendentes pode usar o escopo de leitura (o efeito é só reprocessar o próprio dado herdado).
- **Duplicidade:** a função retorna cada linha uma vez (um `filter` com OR), sem união de arrays.

---

## 8. Testes de regressão sugeridos

Criar `tests/interactionScope.test.ts` (padrão do repo: `node:test` + TS nativo, como `tests/userScope.test.ts`) com a fixture da §5.1. Casos mínimos:

1. Sub-tenant vê **todas** as próprias interações (`tenantId = sub`), mesmo com `bpoName` arbitrário/divergente.
2. Sub-tenant vê herdadas do pai/`system-global`/sem `tenantId` **somente** com `bpoName ∈ {tenant.bpoName, tenant.name}`.
3. Sub-tenant **não** vê linhas de: outra sub-tenant irmã, outra matriz, ou do pai com outro BPO.
4. Matriz vê próprias + filhas (independentemente de rótulo) e **não** vê `system-global`/outra matriz.
5. Usuário `bpo` da matriz com `requestedBpo` continua estrito (não ganha dados de outras filhas).
6. `requestedBpo` de sub-tenant não remove o próprio dado (caso Delta).
7. `getUnifiedBpos`/resolvedor de label: caso `name ≠ bpoName` (W8) e `bpoName="A"` (UI) continuam resolvendo a sub-tenant por `name`/`bpoName`/`id`; retorna o rótulo canônico (`bpoName || name`).
8. `/api/saas/metrics`-equivalente: sub-tenant conta próprios + herdados; matriz conta própria+filhas (sem dupla contagem).
9. Escopo superadmin global = todas; `requestedTenantId` = visão daquela tenant.
10. Semântica de `re-audit-batch`: pendentes herdados entram; `ids` de outra tenant ficam de fora.

Comandos de verificação (o lead roda no fechamento): `npm run typecheck && npm test` (CI `.github/workflows/ci.yml` já roda isso + `npm run build`).

Smoke manual sugerido (sem alterar dados de produção): criar sub-tenant de teste **digitando** o nome no modal, importar 1 lote para ela como matriz, logar como sub-tenant e conferir Dashboard/Auditoria/Resumo; repetir com um segundo BPO e conferir que nada do primeiro aparece.

---

## 9. Diagnóstico rápido no ambiente real (read-only)

Rodar sobre um dump do estado (`database_store.json` / `platform_state`) para confirmar **qual** divergência existe hoje antes de fechar a correção:

```js
const state = JSON.parse(require('fs').readFileSync('database_store.json', 'utf8'));
const tenants = state.tenantsDb || [];
const byId = new Map(tenants.map(t => [t.id, t]));
const norm = s => String(s || '').trim().toLowerCase();

console.log('1) tenants cujo name != bpoName:');
tenants.filter(t => norm(t.name) !== norm(t.bpoName)).forEach(t => console.log('  ', t.id, JSON.stringify(t.name), 'vs', JSON.stringify(t.bpoName)));

console.log('2) usuários cujo bpoName != bpoName do tenant:');
(state.usersDb || []).forEach(u => {
  const t = byId.get(u.tenantId);
  if (t && norm(u.bpoName) !== norm(t.bpoName)) console.log('  ', u.email, u.tenantId, 'user:', JSON.stringify(u.bpoName), 'tenant:', JSON.stringify(t.bpoName));
});

console.log('3) pares (tenantId, bpoName) das interações:');
const pairs = {};
(state.interactionsDb || []).forEach(i => { const k = `${i.tenantId ?? '<none>'} | ${i.bpoName ?? '<none>'}`; pairs[k] = (pairs[k] || 0) + 1; });
console.log(pairs);

console.log('4) interações atribuídas a um BPO de sub-tenant mas com dono != sub-tenant (candidatas à herança):');
(state.interactionsDb || []).forEach(i => {
  const sub = tenants.find(t => t.isSubtenant && (norm(t.bpoName) === norm(i.bpoName) || norm(t.name) === norm(i.bpoName)));
  if (sub && i.tenantId !== sub.id) console.log('  ', i.id, 'owner=', i.tenantId ?? '<none>', 'bpo=', i.bpoName, '-> sub=', sub.id);
});
```

Os itens 1–2 confirmam a origem; o item 4 mostra exatamente quantas interações o usuário não está vendo hoje (são as que a correção de leitura passa a incluir via herança ancorada; as que não casarem com nenhum alias exigem o reparo da §6.6).

---

## 10. Achados secundários (mesmo tema, fora do mínimo)

1. **CRÍTICO (isolamento, cruza com task-2):** o match da sub-tenant em `GET /api/interactions` (HEAD 2078) inclui interações de **qualquer** tenant cujo `bpoName` case com o parceiro. Duas matrizes com sub-tenant homônima → vazamento entre matrizes. A correção da §6.1 resolve.
2. **ALTO:** `getUnifiedBpos` para escopo de sub-tenant lista **todos os irmãos** (HEAD 2207–2213: `t.parentId === parentTid`), e o Hub usa `activeBpos[0]` como default. Um usuário de sub-tenant enumera/é induzido a outro parceiro; deveria ver só o próprio rótulo.
3. **ALTO:** cron Genesys é **global** (`genesysRecurringConfigDb.targetBpo`, um único rótulo; HEAD 5912–5948) e grava `tenantId=undefined→system-global`. Capturas simultâneas de BPOs diferentes na mesma instância misturam atribuição. Precisa escopo por tenant/BPO.
4. **ALTO:** `POST /api/interactions/re-audit-batch` com `ids` do body não aplica escopo (HEAD 4399) → IDOR de leitura/escrita/consumo de IA em outra tenant.
5. **MÉDIO:** `POST /api/integrations/webhook/ingest` confia em `tenant_id`/`bpo_name` do payload (HEAD 7666/7670) — contraria a regra do README ("tenant derivado da sessão"): um cliente autenticado de um tenant pode gravar registro em outro escopo. Validar contra `canAccessTenant` e resolver `bpoName` a partir do tenant.
6. **MÉDIO:** sub-tenant admin nasce `role='bpo'` (HEAD 9513–9518) e o middleware HEAD **2002** (working tree ~2046) bloqueia **qualquer** POST/PUT/DELETE para `bpo` exceto `/chat`. O "perfil da sub-tenant" é somente leitura: não consegue importar, re-auditar nem salvar metodologia. Se a expectativa do usuário era operar a sub-tenant, isso também contribui para "não estou vendo" (dados capturados por outro fluxo). Decidir produto: `admin` escopado ao próprio tenant ou manter BPO read-only documentado.
7. **BAIXO:** `OperadoresMonitoria.tsx` é código morto com o mesmo filtro (não renderizado em `App.tsx`), mas permanece como armadilha.
8. **NOTA de coordenação:** o helper `interactionVisibleToAuth` em progresso no working tree é ownership-only (tenantId). Não substituir as leituras de listagem por ele — a sub-tenant voltaria a não ver os dados herdados do pai/`system-global` atribuídos ao seu BPO. Usar `interactionInScope` (§6.1) para leitura e `interactionVisibleToAuth` para mutações pontuais.

---

## Anexo A — trechos-chave (HEAD fa64165, para localizar no working tree)

```ts
// server.ts:2066-2093 — GET /api/interactions
app.get("/api/interactions", (req, res) => {
  const { bpoName, userEmail, userRole } = req.query;           // 2067: userEmail/userRole ignorados
  const targetTenantId = extractTenantIdFromReq(req);            // 2069: query tenantId só vale p/ superadmin
  let list = interactionsDb;
  if (targetTenantId && targetTenantId !== 'system-global') {
    const tenantObj = tenantsDb.find(t => t.id === targetTenantId);
    if (tenantObj) {
      if (tenantObj.parentId) {                                  // 2076 Sub-tenant
        list = list.filter(i => i.tenantId === targetTenantId
          || (tenantObj.bpoName && i.bpoName?.toLowerCase() === tenantObj.bpoName.toLowerCase())); // 2078
      } else { /* 2081-2083 matriz + childIds */ }
    }
  }
  if (bpoName && bpoName !== "all" && typeof bpoName === "string") {            // 2088
    list = list.filter(item => item.bpoName && item.bpoName.toLowerCase() === bpoName.toLowerCase()); // 2089-2090
  }
  res.json(list);
});
```

```ts
// server.ts:2196-2249 — getUnifiedBpos (rótulo de BPO = t.name; lista irmãos p/ sub-tenant)
const bName = t.name || t.bpoName;                                // 2209 / 2234
if (t.isSubtenant && (t.parentId === parentTid || ...)) { ... }   // 2207-2213 (parentTid = pai ⇒ inclui irmãos)
if (bName && bName.trim() && bName.trim() !== 'A') { ... }        // 2210/2235/2247 — cicatriz do bpoName "A"
```

```ts
// server.ts:9454-9523 — POST /api/tenants (sub-tenant): bpoName livre + admin role bpo
bpoName: effectiveIsSubtenant ? cleanBpoName : undefined,         // 9507
const userRole: 'bpo' | 'admin' = effectiveIsSubtenant ? 'bpo' : 'admin'; // 9513
bpoName: effectiveIsSubtenant ? cleanBpoName : null,              // 9518
```

```ts
// server.ts:7903-7931 — /api/saas/metrics: contagem só por tenantId
const interactionsCount = interactionsDb.filter(interaction => interaction.tenantId === tenant.id).length; // 7910
```

```ts
// server.ts:5912-5948 — cron Genesys global: targetBpo global, sem tenantId
const targetBpo = genesysRecurringConfigDb.targetBpo || "BPO Alpha";          // 5924
const result = await executeGenesysSyncLogic(creds, targetBpo, undefined, undefined, targetQueues, undefined, undefined, undefined, shouldContinue); // 5938-5948
// e dentro do sync: createPendingInteraction({ ..., tenantId: targetTenantId }) // 5779-5791 → cai em "system-global" (3822)
```

```tsx
// src/App.tsx:91-99 — o front manda bpoName em toda chamada
const bpo = bpoToFetch !== undefined ? bpoToFetch : session.bpoName;
if (bpo && bpo !== 'all') url += `&bpoName=${encodeURIComponent(bpo)}`;
```

```tsx
// src/components/GestaoTenants.tsx:466-469 — origem da divergência name×bpoName
onChange={(e) => { setName(e.target.value); if (!bpoName) setBpoName(e.target.value); }}
```

## Anexo B — estado do repositório durante a auditoria

- `HEAD fa64165`: `server.ts` 10.183 linhas; `tenantIsolation` ainda com os filtros acima.
- Working tree continha alterações não commitadas de outra task (superadmin/`userScope`, `interactionVisibleToAuth`, `safeUsersForScope`) — por isso os números de linha do working tree estão deslocados (~+45/+160). Para localizar qualquer trecho: `grep -n "tenantObj.bpoName && i.bpoName" server.ts`, `grep -n "const bName = t.name" server.ts`, etc.
- `database_store.json` local está vazio de interações/usuários (purge de contas demo), mas o estado versionado em `a1c4af4` documenta o modelo real: matriz `tenant-casas-bahia`, sub-tenants `AeC Online`/`AeC Offline` com `bpoName` igual ao nome e usuários `aec_online@teste.com`/`aec_offline@teste.com` com `role='bpo'` — foi dessa fixture que saiu o cenário "rótulos consistentes" da §5.
