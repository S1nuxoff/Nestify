const AUTH_TOKEN_KEY = "auth_token";
const AUTH_ACCOUNT_KEY = "current_account";
const CURRENT_USER_KEY = "current_user";

function readJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  if (value == null) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getAuthToken() {
  return window.localStorage.getItem(AUTH_TOKEN_KEY) || "";
}

export function getCurrentAccount() {
  return readJson(AUTH_ACCOUNT_KEY);
}

export function setCurrentAccount(account) {
  writeJson(AUTH_ACCOUNT_KEY, account);
}

export function getCurrentProfile() {
  return readJson(CURRENT_USER_KEY);
}

export function setCurrentProfile(profile) {
  writeJson(CURRENT_USER_KEY, profile);
}

export function hasAccountSession() {
  return Boolean(getAuthToken() && getCurrentAccount()?.id);
}

export function hasSelectedProfile() {
  return Boolean(getCurrentProfile()?.id);
}

export function setAuthSession({ token, account, profile = null }) {
  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  }
  writeJson(AUTH_ACCOUNT_KEY, account);
  writeJson(CURRENT_USER_KEY, profile);
}

export function clearAuthSession() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_ACCOUNT_KEY);
  window.localStorage.removeItem(CURRENT_USER_KEY);
}

export { AUTH_TOKEN_KEY, AUTH_ACCOUNT_KEY, CURRENT_USER_KEY };
