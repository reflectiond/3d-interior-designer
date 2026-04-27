/**
 * Layout editor access gating (F11.1.x).
 *
 * Pure logic, no DOM access — so it can be unit-tested. The editor opens
 * only when:
 *   1. URL has `editor=1` query param
 *   2. URL has `token=<value>` query param
 *   3. `<value>` matches the build-time `VITE_LAYOUT_EDITOR_TOKEN` env var
 *      (which must be a non-empty string)
 *
 * The token is "security through obscurity" — Тая знает, в v2.0 будет server
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
