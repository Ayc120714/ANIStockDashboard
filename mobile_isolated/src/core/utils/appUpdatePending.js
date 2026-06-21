/** Whether a pending update should auto-resume after returning from Settings. */
export function shouldAutoResumePendingUpdate({pendingUpdate, canInstall, updating}) {
  return Boolean(pendingUpdate && canInstall && !updating);
}
