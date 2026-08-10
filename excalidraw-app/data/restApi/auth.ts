/**
 * Authorization Code + PKCE login against an OIDC provider (e.g. Authentik).
 * Tokens are cached in-memory and mirrored to `sessionStorage` (so they
 * survive a page refresh but not a browser restart), together with a
 * refresh token used to silently renew the access token. If there's no
 * valid session and no way to refresh, `getAccessToken()` redirects the
 * browser to the provider's login page — the caller's promise never
 * resolves in that case since the page navigates away.
 */
import { REST_API, STORAGE_KEYS } from "../../app_constants";

type StoredTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number; // epoch ms
};

let cachedTokens: StoredTokens | null = null;

const base64UrlEncode = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

const generateCodeVerifier = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
};

const generateCodeChallenge = async (verifier: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64UrlEncode(new Uint8Array(digest));
};

const generateState = (): string =>
  base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));

// PKCE requires exchanging the code at the exact same redirect_uri used to
// request it; using the current path (stripped of query/hash) means no
// dedicated callback route is needed, as long as this URI is registered
// with the OIDC provider.
const getRedirectUri = (): string =>
  `${window.location.origin}${window.location.pathname}`;

const readStoredTokens = (): StoredTokens | null => {
  try {
    const raw = sessionStorage.getItem(
      STORAGE_KEYS.SESSION_STORAGE_REST_API_TOKENS,
    );
    return raw ? (JSON.parse(raw) as StoredTokens) : null;
  } catch {
    return null;
  }
};

const persistTokens = (tokens: StoredTokens): void => {
  cachedTokens = tokens;
  try {
    sessionStorage.setItem(
      STORAGE_KEYS.SESSION_STORAGE_REST_API_TOKENS,
      JSON.stringify(tokens),
    );
  } catch {
    // sessionStorage may be unavailable (e.g. private browsing); tokens
    // just won't survive a reload in that case.
  }
};

const clearTokens = (): void => {
  cachedTokens = null;
  try {
    sessionStorage.removeItem(STORAGE_KEYS.SESSION_STORAGE_REST_API_TOKENS);
  } catch {
    // ignore
  }
};

const requestTokens = async (body: URLSearchParams): Promise<StoredTokens> => {
  const response = await fetch(REST_API.TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to obtain access token (${response.status} ${response.statusText})`,
    );
  }

  const json = await response.json();
  if (!json.access_token) {
    throw new Error("Token response did not contain an access_token");
  }

  return {
    accessToken: json.access_token as string,
    refreshToken: (json.refresh_token as string | undefined) ?? null,
    // renew a bit early to avoid races with in-flight requests
    expiresAt: Date.now() + Math.max(0, (json.expires_in ?? 60) - 30) * 1000,
  };
};

const exchangeCodeForTokens = (
  code: string,
  verifier: string,
): Promise<StoredTokens> =>
  requestTokens(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
      client_id: REST_API.CLIENT_ID,
      code_verifier: verifier,
    }),
  );

const refreshAccessToken = (refreshToken: string): Promise<StoredTokens> =>
  requestTokens(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: REST_API.CLIENT_ID,
    }),
  );

/** Redirects the browser to the OIDC provider's authorize endpoint, kicking
 * off the Authorization Code + PKCE flow. Never resolves — the browser
 * navigates away before the returned promise could settle. */
const beginLogin = async (): Promise<never> => {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateState();

  try {
    sessionStorage.setItem(
      STORAGE_KEYS.SESSION_STORAGE_REST_API_PKCE,
      JSON.stringify({ verifier, state }),
    );
  } catch {
    // if sessionStorage isn't available the callback exchange will fail
    // fast with a clear error rather than silently looping
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: REST_API.CLIENT_ID,
    redirect_uri: getRedirectUri(),
    scope: REST_API.SCOPE,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  window.location.assign(`${REST_API.AUTHORIZE_URL}?${params.toString()}`);
  return new Promise<never>(() => {});
};

/** Completes the PKCE redirect round-trip if the current URL carries an
 * OIDC `code`/`state` (i.e. we just got redirected back from the
 * provider). Strips those query params from the URL once handled — whether
 * or not the exchange succeeds — so a page refresh doesn't try to replay a
 * spent authorization code. Safe to call unconditionally; runs at most
 * once per page load. */
let callbackHandled = false;
const handleAuthCallback = async (): Promise<void> => {
  if (callbackHandled) {
    return;
  }
  callbackHandled = true;

  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return;
  }

  url.searchParams.delete("code");
  url.searchParams.delete("state");
  window.history.replaceState(null, "", url.toString());

  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(STORAGE_KEYS.SESSION_STORAGE_REST_API_PKCE);
    sessionStorage.removeItem(STORAGE_KEYS.SESSION_STORAGE_REST_API_PKCE);
  } catch {
    // ignore
  }
  if (!stored) {
    console.error("Missing PKCE verifier for OIDC callback");
    return;
  }

  const { verifier, state: expectedState } = JSON.parse(stored) as {
    verifier: string;
    state: string;
  };
  if (state !== expectedState) {
    console.error("OIDC state mismatch; ignoring auth callback");
    return;
  }

  persistTokens(await exchangeCodeForTokens(code, verifier));
};

/** Returns a valid access token, transparently refreshing it if needed, and
 * redirecting to the OIDC provider's login page if there's no usable
 * session at all (see `beginLogin`). */
export const getAccessToken = async (): Promise<string> => {
  await handleAuthCallback();

  if (!cachedTokens) {
    cachedTokens = readStoredTokens();
  }

  const now = Date.now();
  if (cachedTokens && cachedTokens.expiresAt > now) {
    return cachedTokens.accessToken;
  }

  if (cachedTokens?.refreshToken) {
    try {
      const tokens = await refreshAccessToken(cachedTokens.refreshToken);
      persistTokens(tokens);
      return tokens.accessToken;
    } catch (error) {
      console.error("Failed to refresh access token", error);
      clearTokens();
    }
  }

  return beginLogin();
};

/** Clears the local session (does not revoke tokens server-side). The next
 * `getAccessToken()` call will redirect to the login page again. */
export const logout = (): void => {
  clearTokens();
};
