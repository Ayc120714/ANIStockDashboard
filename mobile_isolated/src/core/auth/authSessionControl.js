/** Shared logout flag so in-flight API/auth work cannot delay or undo sign-out. */
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
