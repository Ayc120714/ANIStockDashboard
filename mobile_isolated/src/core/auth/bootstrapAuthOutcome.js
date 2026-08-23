/**
 * Pure helpers for AuthProvider session recovery — kept separate so Jest can
 * guard the "dead token → forever loading" regression without RN context.
 */

/** After bootstrap finds stored tokens, decide whether the session is usable. */
export function resolveBootstrapAuthOutcome({meOk, refreshOk}) {
  if (meOk) return 'authenticated';
  if (refreshOk) return 'authenticated';
  return 'logout';
}
