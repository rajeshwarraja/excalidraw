// time constants (ms)
export const SAVE_TO_LOCAL_STORAGE_TIMEOUT = 300;
export const INITIAL_SCENE_UPDATE_TIMEOUT = 5000;
export const FILE_UPLOAD_TIMEOUT = 300;
export const LOAD_IMAGES_TIMEOUT = 500;
export const SYNC_FULL_SCENE_INTERVAL_MS = 20000;
export const SYNC_BROWSER_TABS_TIMEOUT = 50;
export const CURSOR_SYNC_TIMEOUT = 33; // ~30fps
export const DELETED_ELEMENT_TIMEOUT = 24 * 60 * 60 * 1000; // 1 day

// should be aligned with MAX_ALLOWED_FILE_BYTES
export const FILE_UPLOAD_MAX_BYTES = 4 * 1024 * 1024; // 4 MiB
// 1 year (https://stackoverflow.com/a/25201898/927631)
export const FILE_CACHE_MAX_AGE_SEC = 31536000;

export const WS_EVENTS = {
  SERVER_VOLATILE: "server-volatile-broadcast",
  SERVER: "server-broadcast",
  USER_FOLLOW_CHANGE: "user-follow",
  USER_FOLLOW_ROOM_CHANGE: "user-follow-room-change",
} as const;

export enum WS_SUBTYPES {
  INVALID_RESPONSE = "INVALID_RESPONSE",
  INIT = "SCENE_INIT",
  UPDATE = "SCENE_UPDATE",
  MOUSE_LOCATION = "MOUSE_LOCATION",
  IDLE_STATUS = "IDLE_STATUS",
  USER_VISIBLE_SCENE_BOUNDS = "USER_VISIBLE_SCENE_BOUNDS",
}

export const FIREBASE_STORAGE_PREFIXES = {
  shareLinkFiles: `/files/shareLinks`,
  collabFiles: `/files/rooms`,
};

export const ROOM_ID_BYTES = 10;

// REST object storage — Authorization Code + PKCE auth against an OIDC
// provider (e.g. Authentik). `AUTHORIZE_URL`/`TOKEN_URL` point at the
// provider's `/application/o/authorize/` and `/application/o/token/`
// endpoints; `CLIENT_ID` must be a "Public" client configured with those
// same redirect URI(s) in the provider.
export const REST_API = {
  AUTHORIZE_URL:
    import.meta.env.VITE_APP_REST_AUTHORIZE_URL ??
    "http://localhost:9000/application/o/authorize/",
  TOKEN_URL:
    import.meta.env.VITE_APP_REST_TOKEN_URL ??
    "http://localhost:9000/application/o/token/",
  CLIENT_ID: import.meta.env.VITE_APP_REST_CLIENT_ID ?? "excalidraw",
  SCOPE: import.meta.env.VITE_APP_REST_SCOPE ?? "openid profile email",
  OBJECTS_BASE_URL:
    import.meta.env.VITE_APP_REST_OBJECTS_URL ?? "http://localhost:8080",
} as const;

export const STORAGE_KEYS = {
  LOCAL_STORAGE_ELEMENTS: "excalidraw",
  LOCAL_STORAGE_APP_STATE: "excalidraw-state",
  LOCAL_STORAGE_COLLAB: "excalidraw-collab",
  LOCAL_STORAGE_THEME: "excalidraw-theme",
  LOCAL_STORAGE_DEBUG: "excalidraw-debug",
  VERSION_DATA_STATE: "version-dataState",
  VERSION_FILES: "version-files",

  IDB_LIBRARY: "excalidraw-library",
  IDB_TTD_CHATS: "excalidraw-ttd-chats",
  IDB_PGP_KEYPAIR: "excalidraw-rest-api-pgp-keypair",
  LOCAL_STORAGE_REST_API_OBJECT_ID: "excalidraw-rest-api-object-id",
  LOCAL_STORAGE_REST_API_SYNCED_HASH: "excalidraw-rest-api-synced-hash",
  SESSION_STORAGE_REST_API_TOKENS: "excalidraw-rest-api-tokens",
  SESSION_STORAGE_REST_API_PKCE: "excalidraw-rest-api-pkce",
  SESSION_STORAGE_REST_API_PENDING_ACTION: "excalidraw-rest-api-pending-action",

  // do not use apart from migrations
  __LEGACY_LOCAL_STORAGE_LIBRARY: "excalidraw-library",
} as const;

export const COOKIES = {
  AUTH_STATE_COOKIE: "excplus-auth",
} as const;

export const isExcalidrawPlusSignedUser = document.cookie.includes(
  COOKIES.AUTH_STATE_COOKIE,
);
