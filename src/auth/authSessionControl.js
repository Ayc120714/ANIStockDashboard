/** Guards in-flight auth refresh/hydrate while sign-out clears local session. */
let logoutActive = false;

export function beginLogout() {
  logoutActive = true;
}

export function isLogoutActive() {
  return logoutActive;
}

export function resetLogoutState() {
  logoutActive = false;
}
