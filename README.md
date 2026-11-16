# AuditaQA

Plataforma SaaS de auditoria e monitoria de qualidade de atendimento (Auto-QA) com IA.

## Requisitos e execução local

- Node.js 24+
- Um banco Postgres (Neon em produção)

```bash
npm ci
cp .env.example .env   # preencha os valores locais
npm run dev            # API + Vite em http://localhost:3000
```

Comandos de verificação:

```bash
npm run typecheck   # tsc --noEmit
npm test            # testes unitários (node:test)
npm run build       # cliente Vite + bundle do servidor em dist/server.cjs
npm start           # executa o bundle de produção
```

## Variáveis de ambiente

Configure em **Project Settings > Environment Variables** (Production e Preview). Nunca versione segredos.

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | Connection string do Neon. A integração da Vercel injeta automaticamente; localmente use a URL do banco de desenvolvimento. |
| `SESSION_SECRET` | sim | Segredo aleatório com no mínimo 32 caracteres. |
| `SETUP_TOKEN` | sim | Token para criar o primeiro superadministrador (mínimo 32 caracteres). Inerte depois que existe um superadmin. |
| `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` | não | Alternativa ao fluxo de setup; recria o superadmin se ele não existir. Remova depois do provisionamento. |
| `GEMINI_API_KEY` | não | Somente se os recursos de IA forem usados. |
| `APP_URL` | não | `https://auditai-dev.vercel.app`. |
| `MAX_REQUEST_BODY` | não | Padrão `25mb`. |
| `ALLOW_EPHEMERAL_PERSISTENCE` | não | `true` mantém a API no ar (sem persistir) se o Postgres estiver inacessível. |

Nunca defina segredos em arquivos versionados. O servidor usa sessão assinada, `HttpOnly`, `Secure` em produção e `SameSite=Strict`; o tenant é derivado da sessão, nunca de valores enviados pelo navegador.

## Persistência e integridade

O estado da plataforma é um documento JSON versionado na tabela `platform_state` (`id = 'primary'`):

- a tabela é criada na inicialização (`create table if not exists`);
- a gravação usa `INSERT ... ON CONFLICT (id) DO UPDATE ... WHERE version = esperada`: o primeiro boot em um banco vazio cria a linha `primary`, e escritas concorrentes não se sobrescrevem silenciosamente (o perdedor relê a versão e reaplica);
- `stateVersion` e `stateConflicts` aparecem no `/api/health`;
- as respostas de mutação aguardam a gravação do documento (com timeout de segurança de 3s) antes de retornar, para que uma leitura imediata — inclusive em outra instância — não veja o estado anterior;
- o `/tmp/database_store.json` é apenas um espelho local de curta duração; `database_store.json` na raiz é usado somente em desenvolvimento (ambos ignorados pelo git).

### Normalização relacional

O documento continua sendo a fonte da verdade, mas as leituras de tenant já vêm de tabela:

- **Estágio 1** (`053da84`): tabelas `tenants`, `app_users` e `interactions` criadas sob demanda, com espelho *best-effort* de usuários e interações.
- **Estágio 2**: `GET /api/tenants` lê da tabela `tenants`. A resposta só usa a tabela quando ela está **idêntica** ao documento (mesmos ids e mesmos campos normalizados); se a tabela estiver ausente, vazia ou divergente, a API responde pelo documento. Uma divergência nunca serve dado parcial.
- **Escritas de tenant**: criar, editar ou excluir tenants (inclusive via BPO) reconcilia a tabela antes de responder, e o boot reconcilia antes de aceitar tráfego. Isso evita depender do espelho assíncrono, que pode ser congelado em serverless.
- **Próximo (Estágio 3)**: escritas transacionais de usuários e interações, com FKs, índices e migrações versionadas. Hoje `app_users`/`interactions` são espelhos de diagnóstico e não servem leitura.

O `/api/health` publica o bloco `tenantStore`:

| Campo | Significado |
|---|---|
| `enabled` | A leitura relacional está habilitada (Postgres hidratado). |
| `available` | A tabela existiu e pôde ser lida nesta checagem. |
| `source` | `table` ou `document` — de onde saiu a última leitura. |
| `tableCount` / `documentCount` | Linhas na tabela e tenants no documento. |
| `inSync` | `true` somente com ids e campos iguais dos dois lados. |
| `drift` | Contagem de ids `missing`, `extra` e de linhas `changed`. |
| `reason` | `table_missing`, `table_empty`, `parity_mismatch`, `read_failed`, `timeout` ou `storage_not_configured`. |

A rota pública não expõe ids, e-mails, nomes nem o digest dos tenants. Com o header `x-setup-token` entram `lastError` e `digest` (SHA-256 canônico) para diagnóstico. `shadowTables` é diagnóstico do espelho de usuários/interações e pode ficar defasado; não é usado para servir leitura.

### Consistência de tenants e usuários

- Criação, edição e exclusão de tenants e usuários usa gravação **aguardada** com retry otimista: se outra instância gravou antes, a mutação é reaplicada sobre o estado mais novo; se o conflito persistir após 4 tentativas, a API responde `409` e **não** deixa gravação parcial.
- A troca do `adminEmail` de um tenant exige usuário correspondente: renomeia o admin atual (preservando a senha) ou vincula uma conta existente; caso contrário responde `400`/`409`. O tenant nunca fica apontando para um admin inexistente.
- `/api/users` aplica a mesma política de senha do restante da plataforma (16+ caracteres, 3 classes), para que uma conta legítima não seja confundida com conta de demonstração no boot.
- O boot avisa e o `/api/health` expõe `tenantAdminMismatches` (tenants sem usuário vinculado) e `legacyUsersDropped` (hashes legados invalidados na carga). Ambos devem ficar em `0`.

### Modo efêmero (emergência)

Se o banco estiver inacessível e `ALLOW_EPHEMERAL_PERSISTENCE=true`, a API continua no ar usando apenas `/tmp`: **nada é gravado no banco e todos os dados são perdidos no próximo cold start**. O `/api/health` reporta `persistence: "ephemeral"` e um `warning`. As gravações na nuvem ficam bloqueadas nesse modo para não corromper o estado real.

## Criar o superadministrador

O provisionamento só funciona enquanto **não existe nenhum superadministrador** e exige o `SETUP_TOKEN`. Depois do primeiro usuário criado, o endpoint responde `409`.

```bash
# 1. Confira se o serviço está saudável e se o setup está liberado
npm run admin:create -- --check

# 2. Crie o superadministrador (gera uma senha forte e mostra uma única vez)
npm run admin:create -- --email voce@empresa.com

# Opcional: informe a senha você mesmo (mínimo 16 caracteres, 3 classes)
npm run admin:create -- --email voce@empresa.com --password "SuaSenhaForte123!"
```

O token vem de `SETUP_TOKEN` (ambiente) ou do arquivo `.env.setup` (ignorado pelo git). Depois do provisionamento, remova `SETUP_TOKEN` e `BOOTSTRAP_ADMIN_*` do ambiente de produção.

## Política de senhas e segurança

- Mínimo de 16 caracteres e ao menos 3 das 4 classes (minúsculas, maiúsculas, números, símbolos).
- Senhas comuns (`admin123` e similares) são rejeitadas.
- Hashes com `scrypt` e salt aleatório; a senha em texto puro nunca é armazenada.
- Contas de demonstração e usuários com senha pública conhecida são removidos na inicialização.
- Rate limit de login/API é em memória por instância; em serverless não é global.
- Ainda não há RLS: o isolamento por tenant é feito na aplicação. O Estágio 3 deve levar o escopo para o banco.

## IA multi-provedor por escopo

- **Global** é o padrão; **tenant** e **subtenant** podem sobrescrever provedores, modelos e o provedor ativo. Subtenant sem configuração herda o pai e, depois, o global.
- O painel **Configurações → Central de Inteligência Artificial** permite configurar vários provedores/modelos por escopo e escolher o provedor e o modelo ativos.
- O backend nunca devolve chaves de API: as respostas usam `hasApiKey`. Salvar com a chave em branco preserva a chave já gravada; a chave nova só é enviada quando digitada.
- As gravações de IA usam a mesma persistência crítica dos tenants/usuários, então a configuração sobrevive a logout/login e a conflitos entre instâncias.
- Sem provedor ativo utilizável, a API responde com uma orientação genérica; **não há fallback silencioso para o Google Gemini**.

## Health e diagnóstico

```bash
curl https://auditai-dev.vercel.app/api/health
curl https://auditai-dev.vercel.app/api/setup/status
curl -H "x-setup-token: $SETUP_TOKEN" https://auditai-dev.vercel.app/api/health
```

`/api/health` informa `ok`, `persistence` (`ready`/`ephemeral`/`failed`), `mode` (`postgres`/`local`/`ephemeral`), `databaseConfigured`, `stateVersion`, `stateConflicts`, `shadowTables`, `tenantStore`, `tenantAdminMismatches` e `legacyUsersDropped`. Com `x-setup-token` a resposta inclui `lastPersistError`, `detail` da falha de inicialização e o `digest` da paridade.

Alertas recomendados: `ok=false`, `tenantStore.inSync=false` por mais de 5 minutos, `tenantAdminMismatches>0`, `legacyUsersDropped>0`, `lastPersistError` preenchido e falhas repetidas de login.

## Guia de Penalidades (importação)

A aba **Metodologia → Guia de Penalidades** aceita `.csv`, `.tsv` e `.xlsx`. O botão **Importar Planilha** lê o arquivo no navegador, mostra uma prévia (novos, atualizados, ignorados, blocos novos e avisos) e só grava após a confirmação. O endpoint recebe a grade já extraída, não o arquivo.

Colunas reconhecidas (com aliases e sem diferenciar acento/caixa): `ID`/`Ítens`, `Bloco`, `Escopo Alvo` (ou `Sub-tenant` + `Fila`), `Gravidade`/`Relevância`, `Penalidade`/`Score`, `Motivo/Infração do Manual`, `Ação`, `Motivo Simplificado`, `Categoria Estratégica` e `Observação`. A coluna `Ação` alimenta o campo `acaoCorretiva`.

Regras de mesclagem:

- Atualiza pelo motivo e, quando o motivo ainda não existe, pelo `ID`; nunca apaga linhas ausentes do arquivo.
- ID divergente para um motivo já cadastrado é ignorado com aviso (o template atual repete o ID 48, por exemplo).
- Campos vazios em linhas existentes são preservados; em linhas novas usam o padrão (gravidade `MODERADA`, penalidade derivada 2/4/10/100, escopo `todos`/`todas`).
- Blocos ausentes em **Blocos de Metodologia** são criados automaticamente com peso 0% para não alterar a soma dos pesos; ajuste o peso depois.
- Penalidades aceitam número (`2`, `-2`, `2,5`), `NULL` (0) e textos como `NCG`/`Zera` (100).
- Limites: 10 MB, 2.000 linhas e 50 colunas. O botão **Modelo** baixa a matriz atual em CSV UTF-8 com BOM.



## Qualidade e CI

O workflow `.github/workflows/ci.yml` roda em todo push/PR: `npm ci`, `npm run typecheck`, `npm test` e `npm run build`.

Os testes usam `node:test` com TypeScript nativo. `--test-isolation=none` evita spawn de processos e funciona tanto no CI quanto em ambientes restritos.

## Deploy

### Vercel

O projeto usa `vercel.json` com build `npm run build` e a função `api/index.js` carregando `dist/server.cjs`.

- **Production/Preview**: o `DATABASE_URL` é injetado pela integração Neon. Cada ambiente deve apontar para um banco/branch distinto; nunca aponte Preview para o banco de produção.
- **Git**: o repositório está conectado ao projeto; cada push em `main` dispara um deploy de produção. `vercel --prod` continua disponível para deploy manual.
- **Smoke mínimo**: `/api/health` com `persistence: "ready"` e `tenantStore.inSync: true`; login; `GET /api/tenants`; criar e excluir um tenant de teste conferindo a paridade; confirmar que `stateVersion` incrementa.
- **Rollback**: deployments da Vercel são imutáveis. O Estágio 2 é retrocompatível (documento é a fonte da verdade), então voltar ao deployment anterior não corrompe dados.

### GitHub

```bash
git push origin main
```

O push em `main` deve passar pelo CI. Se o repositório for privado, garanta que a integração da Vercel tenha acesso a ele (quando conectada via Git).

### Banco

- Habilite Point-in-Time Recovery / backup no Neon e faça um ensaio de restauração em um branch separado.
- Migrações ainda são DDL idempotente no boot; o Estágio 3 deve introduzir `schema_migrations` e migrações versionadas.
