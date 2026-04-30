/**
 * Контроль доступа к редактору планировок (F11.1.x).
 *
 * Чистая логика без DOM — пригодна для unit-тестов. Редактор открывается только когда:
 *   1. В URL есть query-параметр `editor=1`
 *   2. В URL есть query-параметр `token=<value>`
 *   3. `<value>` совпадает с build-time переменной `VITE_LAYOUT_EDITOR_TOKEN`
 *      (она должна быть непустой строкой).
 *
 * Токен — это «security through obscurity» — Тая знает, в v2.0 будет server
 * auth (см. SEC-7).
 */
export function isEditorAuthorized(search: string, expectedToken: string | undefined): boolean {
  if (!expectedToken || expectedToken.length === 0) return false;

  const params = new URLSearchParams(search);
  if (params.get('editor') !== '1') return false;

  const provided = params.get('token');
  if (provided === null) return false;

  return provided === expectedToken;
}
