/**
 * Stashes the in-progress save/load intent right before making a REST API
 * call that might require a fresh OIDC login (see `auth.ts`'s
 * `beginLogin`). A login redirect is a full page navigation, so any
 * in-memory state (including this call's own stack) is lost — but
 * `sessionStorage` survives the round-trip to the OIDC provider and back
 * (same tab, same origin once we return), letting the app resume the
 * action automatically after re-authenticating instead of silently
 * dropping it.
 */
import { STORAGE_KEYS } from "../../app_constants";

export type PendingRestApiAction =
  | { type: "save"; name: string }
  | { type: "load"; objectId: string; name: string }
  // stashed when the "Load from server" dialog triggers its initial object
  // listing, so a mid-flight OIDC login redirect (triggered by
  // getAccessToken() inside listRestApiObjects) reopens the dialog instead
  // of silently dropping it — otherwise the user has to retry the "Load
  // from server" action to see the dialog again after re-authenticating
  | { type: "openLoadDialog" };

export const setPendingRestApiAction = (action: PendingRestApiAction): void => {
  try {
    sessionStorage.setItem(
      STORAGE_KEYS.SESSION_STORAGE_REST_API_PENDING_ACTION,
      JSON.stringify(action),
    );
  } catch {
    // if sessionStorage isn't available, a login redirect simply won't be
    // able to resume the action afterwards
  }
};

export const clearPendingRestApiAction = (): void => {
  try {
    sessionStorage.removeItem(
      STORAGE_KEYS.SESSION_STORAGE_REST_API_PENDING_ACTION,
    );
  } catch {
    // ignore
  }
};

/** Reads and clears the stashed action (one-shot: resuming it again on a
 * subsequent refresh would be surprising). */
export const takePendingRestApiAction = (): PendingRestApiAction | null => {
  try {
    const raw = sessionStorage.getItem(
      STORAGE_KEYS.SESSION_STORAGE_REST_API_PENDING_ACTION,
    );
    if (!raw) {
      return null;
    }
    sessionStorage.removeItem(
      STORAGE_KEYS.SESSION_STORAGE_REST_API_PENDING_ACTION,
    );
    return JSON.parse(raw) as PendingRestApiAction;
  } catch {
    return null;
  }
};
