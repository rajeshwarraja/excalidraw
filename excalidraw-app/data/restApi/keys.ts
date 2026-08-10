/**
 * Manages the OpenPGP keypair used to wrap (encrypt) each object's
 * per-object AES data key ("envelope encryption"). The keypair is generated
 * once per browser profile and the private key never leaves IndexedDB —
 * objects are always encrypted to, and decrypted by, this same identity
 * ("encrypt-to-self").
 */
import * as openpgp from "openpgp";
import { createStore, get, set } from "idb-keyval";

import { STORAGE_KEYS } from "../../app_constants";

export type PGPKeypair = {
  publicKey: string;
  privateKey: string;
};

const keysStore = createStore(
  `${STORAGE_KEYS.IDB_PGP_KEYPAIR}-db`,
  `${STORAGE_KEYS.IDB_PGP_KEYPAIR}-store`,
);

const KEYPAIR_KEY = "keypair";

let cachedKeypair: PGPKeypair | null = null;

const generateKeypair = async (): Promise<PGPKeypair> => {
  const { privateKey, publicKey } = await openpgp.generateKey({
    type: "curve25519",
    userIDs: [{ name: "excalidraw-local-user" }],
    format: "armored",
  });

  return { publicKey, privateKey };
};

/** Returns the existing keypair, generating and persisting one if needed. */
export const getOrCreateKeypair = async (): Promise<PGPKeypair> => {
  if (cachedKeypair) {
    return cachedKeypair;
  }

  const stored = await get<PGPKeypair>(KEYPAIR_KEY, keysStore);
  if (stored) {
    cachedKeypair = stored;
    return stored;
  }

  const generated = await generateKeypair();
  await set(KEYPAIR_KEY, generated, keysStore);
  cachedKeypair = generated;
  return generated;
};

/**
 * Serializes the current keypair for backup/porting to another browser
 * profile or system. The private key is included in cleartext (it's
 * already unprotected at rest in IndexedDB) — treat the exported file like
 * a password: whoever holds it can decrypt every scene saved to this
 * identity.
 */
export const exportKeypairAsJSON = async (): Promise<string> => {
  const keypair = await getOrCreateKeypair();
  return JSON.stringify(keypair, null, 2);
};

const isPGPKeypair = (value: unknown): value is PGPKeypair =>
  !!value &&
  typeof value === "object" &&
  typeof (value as any).publicKey === "string" &&
  typeof (value as any).privateKey === "string" &&
  (value as any).privateKey.includes("BEGIN PGP PRIVATE KEY") &&
  (value as any).publicKey.includes("BEGIN PGP PUBLIC KEY");

/**
 * Restores a previously-exported keypair, overwriting whatever is
 * currently stored (including an auto-generated one). Scenes previously
 * saved to a *different* key will no longer be decryptable unless that key
 * is re-imported.
 */
export const importKeypairFromJSON = async (json: string): Promise<void> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid encryption key file: not valid JSON");
  }

  if (!isPGPKeypair(parsed)) {
    throw new Error(
      "Invalid encryption key file: missing or malformed publicKey/privateKey",
    );
  }

  await set(KEYPAIR_KEY, parsed, keysStore);
  cachedKeypair = parsed;
};
