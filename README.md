# AuditAI GCB

Instância **local** da plataforma AuditaQA para o **Grupo Casas Bahia** (GCB).
Este repositório é isolado da versão de produção: não usa Neon/Vercel, não contém
credenciais de nuvem e roda inteiramente na máquina do usuário.

- **Projeto de produção (referência):** `xploryngDAO/Audit.AI`
- **Este repositório:** `xploryngDAO/AuditAI-GCB`
- **Banco de dados:** local, em arquivo (`database_store.json`) — nenhum serviço externo
- **Instalação:** um único duplo clique em [`INSTALAR.bat`](./INSTALAR.bat) no Windows
- **Sem landing page:** quem não está autenticado cai direto na tela de login

O fluxo funcional é o mesmo da versão de produção (login, tenants, usuários,
auditorias, metodologia, integrações, dashboards, IA multi-provedor). O que muda é
a infraestrutura: banco local e execução na sua máquina.

---

## 1. Requisitos

- Windows 10/11 (o instalador é um `.bat`).
- Node.js **24 ou superior** (o `INSTALAR.bat` tenta instalar o LTS via `winget`
  quando não encontra).
- Sem necessidade de Docker, Postgres, Neon, Vercel ou qualquer conta de nuvem.

## 2. Instalação e execução (rápido)

1. Clone o repositório e entre na pasta:

   ```bat
   git clone https://github.com/xploryngDAO/AuditAI-GCB.git
   cd AuditAI-GCB
   ```

2. Dê **duplo clique em `INSTALAR.bat`** (ou execute no cmd).

O `INSTALAR.bat` faz toda a instalação e configuração:

| Etapa | O que acontece |
|---|---|
| 1/7 | Verifica o Node.js 24+ e instala o LTS via `winget` se necessário |
| 2/7 | Instala as dependências com `npm ci` (determinístico, respeita o `package-lock`) |
| 3/7 | Cria o `.env` local com segredos aleatórios e uma porta livre (3000–3010) |
| 4/7 | Prepara o banco local e as contas iniciais (`database_store.json`) |
| 5/7 | Compila a aplicação em modo produção (`NODE_ENV=production npm run build`) |
| 6/7 | Confere se a porta está livre |
| 7/7 | Sobe o servidor em modo produção e abre o navegador |

Ao final, o sistema abre em **http://localhost:3000** (ou na porta indicada no
console). Para encerrar o servidor, pressione `Ctrl+C` na janela.

Nas próximas vezes, use **`INICIAR.bat`** para subir o sistema sem reinstalar.

## 3. Acesso inicial (seed local)

O banco local já vem preparado com o usuário master e a tenant do Grupo Casas Bahia:

| Conta | E-mail | Senha | Papel |
|---|---|---|---|
| SaaS Master (global) | `marcel.andre@viavarejo.com.br` | `Mudar@123` | superadmin |
| Usuário principal da tenant | `marcel.andre@casasbahia.com.br` | `Mudar@123` | admin |

**Tenant já cadastrada**

| Campo | Valor |
|---|---|
| Nome | Grupo Casas Bahia |
| ID | `grupo-casas-bahia` |
| Slug | `grupo-casas-bahia` |
| Plano | `enterprise` |
| Situação | Ativa |
| Admin vinculado | `marcel.andre@casasbahia.com.br` |

O master enxerga todos os tenants e o console SaaS; o usuário da tenant enxerga
apenas o escopo do Grupo Casas Bahia.

> **Observação de segurança:** `Mudar@123` tem 9 caracteres e não atende à política
> de senhas da plataforma (16+ caracteres). Ela é gravada pelo seed local
> (`scripts/seed-local.mjs`), que não passa pela validação de cadastro. Para uso
> fora do ambiente local, troque a senha pela interface (Configurações → Acessos)
> ou por uma senha forte.

## 4. Banco de dados local

Sem `DATABASE_URL` no `.env`, a API usa a persistência local já suportada pelo
sistema:

- o arquivo `database_store.json` na raiz **é o banco local** (fonte da verdade);
- ele é ignorado pelo git e criado pelo seed no passo 4 do instalador;
- o `/api/health` reporta `mode: "local"` e `persistence: "ready"`;
- backup: basta copiar o `database_store.json` com o servidor parado;
- reset: `npm run local:reset` (apaga o banco local e recria o seed).

Opcionalmente, para trabalhar com os recursos relacionais/Estágio 3, defina
`DATABASE_URL` no `.env` apontando para um Postgres local. Sem isso, tudo o que a
plataforma expõe funciona em modo local.

## 5. Comandos úteis

```bash
npm run dev              # desenvolvimento (API + Vite com HMR) em http://localhost:3000
npm run build            # cliente Vite + bundle do servidor em dist/server.cjs (modo produção)
npm run start:prod       # servidor compilado em modo produção (usado por INSTALAR/INICIAR)
npm start                # executa dist/server.cjs; exige NODE_ENV=production no ambiente
npm run typecheck        # tsc --noEmit
npm test                 # testes unitários (node:test)
npm run seed:local       # garante master, tenant e usuário principal no banco local
npm run seed:local:check # valida o seed sem gravar (exit 1 se algo divergir)
npm run local:reset      # apaga o banco local e recria o seed (destrutivo)
```

> `npm run build` e `npm start` seguem o `NODE_ENV` do ambiente. Os `.bat` usam
> `npm run start:prod`, que força `NODE_ENV=production` mesmo com o `.env` local em
> `development` (valor necessário para o `npm run dev` subir o Vite).

## 6. O que mudou em relação à produção

- **Landing page removida**: `src/components/LandingPage.tsx` foi excluída e
  `src/App.tsx`/`LoginScreen` passam direto para o login. Não há rota, estado ou
  botão "voltar para o início".
- **Banco local**: o fluxo padrão não depende de `DATABASE_URL`, Neon ou Vercel.
- **Build em modo produção**: o `INSTALAR.bat` força `NODE_ENV=production` no build;
  o `.env` mantém `development` para o `npm run dev`. O `npm run start:prod` garante
  a execução do bundle compilado em modo produção.
- **Instalador Windows**: `INSTALAR.bat` (instalação/configuração completa) e
  `INICIAR.bat` (rotina diária).
- **Seed específico do GCB**: master `marcel.andre@viavarejo.com.br`, tenant
  "Grupo Casas Bahia" e admin `marcel.andre@casasbahia.com.br`.
- **Cookie de sessão local**: em produção o cookie continua `Secure`; na execução
  local em `http://localhost` ele não recebe `Secure` (senão o navegador não o
  enviaria de volta). Ver `secureSessionCookie()` em `server.ts`.

O restante do código, rotas, telas e regras de negócio é o mesmo do AuditaQA.

## 7. Estrutura

```
INSTALAR.bat              # instalacao/configuracao completa + inicio
INICIAR.bat               # inicia o sistema ja configurado
server.ts                 # API Express + serving do cliente (Vite)
server/                   # persistencia (platform_state, tenants, espelhos)
src/                      # React + Tailwind (telas da plataforma)
scripts/seed-local.mjs    # seed idempotente do banco local (GCB)
scripts/open-when-ready.mjs # abre o navegador quando /api/health responde
scripts/start-production.mjs # sobe dist/server.cjs com NODE_ENV=production
tests/                    # testes unitarios (node:test)
db/                       # schema/migracoes relacionais (Estagio 3, opcional)
docs/                     # documentacao de seguranca e migracao
```

## 8. Verificação e CI

O workflow `.github/workflows/ci.yml` roda em push/PR: `npm ci`, seed local,
validação do seed, `npm run typecheck`, `npm test` e `npm run build`. O job
`db-schema` usa o Postgres do GitHub Actions apenas para validar as migrações do
Estágio 3 — não é necessário para rodar localmente.

Verificação manual rápida:

```powershell
# servidor no ar e modo local
Invoke-RestMethod http://localhost:3000/api/health

# login do master (guarde o cookie de sessão)
$s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/login `
  -ContentType 'application/json' -WebSession $s `
  -Body '{"email":"marcel.andre@viavarejo.com.br","password":"Mudar@123"}'

# tenants visíveis para a sessão
Invoke-RestMethod http://localhost:3000/api/tenants -WebSession $s
```

## 9. Solução de problemas

| Problema | Solução |
|---|---|
| `Node.js 24+ nao encontrado` e `winget` falhou | Instale o Node LTS em <https://nodejs.org> e rode o `INSTALAR.bat` de novo |
| Porta em uso | O instalador escolhe uma porta livre (3000–3010) na primeira execução; se o `.env` já existir, ajuste `PORT=` e rode de novo |
| Login não mantém a sessão | Confirme que está acessando `http://localhost:<porta>` e que o `.env` tem `APP_URL` com esse endereço |
| Banco local corrompido/perdido | `npm run local:reset` recria o seed; o backup é o próprio `database_store.json` |
| Quero começar do zero | Feche o servidor, apague `database_store.json` e rode `INSTALAR.bat` (ou `npm run seed:local`) |
| Erro no build | Rode `npm run typecheck` e `npm test`; apague `dist/` e rode `npm run build` novamente |
| Bundle grande (~2 MB) com React DevTools | O build rodou em modo desenvolvimento. Defina `NODE_ENV=production` no terminal antes de `npm run build` (os `.bat` já fazem isso) |
| `npm start` cai no Vite de desenvolvimento | Use `npm run start:prod`, que força `NODE_ENV=production` (é o caminho usado por INSTALAR/INICIAR) |

## 10. Isolamento da versão de produção

- Este repositório tem histórico próprio e **não está conectado** ao projeto
  Vercel de produção.
- Não há `DATABASE_URL`, `SETUP_TOKEN`, chaves de IA ou outros segredos versionados.
- O `.env` gerado pelo instalador é local e está no `.gitignore`.
- Os docs de produção/segurança herdados ficam em `docs/` apenas como referência.
