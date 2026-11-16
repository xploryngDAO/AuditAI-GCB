/**
 * DDL idempotente ainda pode colidir quando duas instâncias sobem juntas:
 * `create table if not exists` não é atômico no catálogo do Postgres e pode
 * falhar com 23505/42P07/42710/42701. Nesses casos a tabela/coluna já existe
 * (foi a outra instância que criou), então seguimos em frente.
 */
export function isConcurrentDdlError(error: unknown): boolean {
  const code = (error as any)?.code;
  return code === "23505" || code === "42P07" || code === "42710" || code === "42701";
}

export async function ignoreConcurrentDdl<T>(operation: () => Promise<T>): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    if (isConcurrentDdlError(error)) return null;
    throw error;
  }
}
