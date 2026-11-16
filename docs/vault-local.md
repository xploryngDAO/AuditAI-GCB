# Cofre local (dados sensíveis)

Cofre criptografado com **AES-256-GCM** (chave derivada por scrypt de uma passphrase) para guardar artefatos sensíveis fora do banco de produção e em um único arquivo protegido.

## O que está no cofre

- Backup lógico completo da produção **antes da limpeza** (`platform_state` v831 + `interactions` 275 registros + `app_users` + `tenants`) com hashes.
- Backups locais anteriores (`database_store.json`).
- Relatórios que continham credenciais/senhas temporárias (`prod-cleanup-*`, `prod-superadmin-rotation-*`, `prod-post-deploy-smoke-*`).
- Cópia do `.env` local (inclui `SESSION_SECRET`, `SETUP_TOKEN` de dev e `STAGE3_DATABASE_URL`).
- DSN do banco de staging (`stage3-dsn.txt`).

> Os arquivos originais em texto puro foram removidos do disco após a verificação de roundtrip (restauração + comparação de SHA-256 de cada arquivo).

## Estrutura

```
vault/
  auditai-vault-<timestamp>.aiv    # conteúdo cifrado (gitignored/vercelignored)
  manifest-<timestamp>.json        # metadados públicos: caminhos, tamanhos e hashes (sem conteúdo)
scripts/vault.mjs                  # create | open | list
```

## Como abrir / restaurar

```powershell
$env:VAULT_PASSPHRASE = "<a passphrase do cofre>"
node scripts/vault.mjs list
node scripts/vault.mjs open --vault vault/auditai-vault-<timestamp>.aiv --out restore/
```

O `open` valida o SHA-256 de **cada** arquivo restaurado contra o bundle antes de escrever. Se um byte estiver diferente, aborta.

## Regras de segurança

1. **A passphrase não fica armazenada em lugar nenhum.** Guarde-a em gerenciador de senhas. Perda = cofre irrecuperável (não há backdoor).
2. `vault/` está no `.gitignore` e no `.vercelignore` — nunca vai para o repositório nem para a Vercel.
3. Restaure para um diretório fora do projeto se for reinspecionar PII antiga.
4. O backup contém dados pessoais de produção (LGPD): use apenas para rollback/auditoria e defina a retenção (ex.: purgar após o cliente validar a operação).
5. Não inclua o cofre em backups de nuvem sem antes criptografar novamente com outra camada (a passphrase já cobre o arquivo, mas evite versioná-lo).
6. Para rotação: crie um novo cofre com passphrase nova e destrua o antigo (as chaves derivadas mudam por salt).
