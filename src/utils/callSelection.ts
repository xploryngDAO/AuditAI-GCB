/**
 * Mantém o chamado selecionado durante o polling de atendimentos.
 *
 * O fetch periódico é criado uma vez e pode carregar um `activeCallId`
 * defasado. A decisão precisa ser feita com o valor mais recente do estado:
 * se o chamado selecionado continua na lista, ele permanece selecionado.
 */
export function nextActiveCallId(
  previousId: string | null,
  calls: Array<{ id: string }>
): string | null {
  if (calls.length === 0) return null;
  if (previousId && calls.some((call) => call.id === previousId)) return previousId;
  return calls[0].id;
}
