/**
 * Envelope encryption used when uploading/downloading objects to/from the
 * REST API:
 *
 *  1. A random AES-256-GCM data key + 12-byte nonce encrypts the payload.
 *  2. The raw AES data key bytes are themselves encrypted ("wrapped") with
 *     the user's OpenPGP public key, so only the holder of the matching
 *     private key can recover it.
 *
 * The wrapped key and nonce are sent as the `x-wrapped-key`/`x-nonce`
 * request headers on upload, and the server echoes them back as response
 * headers of the same name on download (GET .../content).
 */
import * as openpgp from "openpgp";

import { getOrCreateKeypair } from "./keys";

const AES_KEY_LENGTH_BITS = 256;
const NONCE_LENGTH_BYTES = 12;

export type EncryptedEnvelope = {
  ciphertext: Uint8Array<ArrayBuffer>;
  wrappedKeyB64: string;
  nonceB64: string;
};

const toBase64 = (bytes: Uint8Array<ArrayBufferLike>): string =>
  btoa(String.fromCharCode(...bytes));

const fromBase64 = (b64: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;

/** Encrypts `plaintext` with a fresh AES key, wrapping that key with OpenPGP. */
export const encryptForUpload = async (
  plaintext: Uint8Array<ArrayBuffer>,
): Promise<EncryptedEnvelope> => {
  const { publicKey } = await getOrCreateKeypair();

  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH_BYTES));
  const aesKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: AES_KEY_LENGTH_BITS },
    true,
    ["encrypt"],
  );

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    aesKey,
    plaintext,
  );

  const rawAesKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", aesKey),
  );

  const publicKeyObj = await openpgp.readKey({ armoredKey: publicKey });
  const wrappedKeyMessage = (await openpgp.encrypt({
    message: await openpgp.createMessage({ binary: rawAesKey }),
    encryptionKeys: publicKeyObj,
    format: "binary",
  })) as Uint8Array;

  return {
    ciphertext: new Uint8Array(encryptedBuffer),
    wrappedKeyB64: toBase64(wrappedKeyMessage),
    nonceB64: toBase64(nonce),
  };
};

/** Reverses `encryptForUpload`, given the ciphertext plus the wrapped key/nonce returned by the server. */
export const decryptDownload = async (
  ciphertext: Uint8Array<ArrayBuffer>,
  wrappedKeyB64: string,
  nonceB64: string,
): Promise<Uint8Array<ArrayBuffer>> => {
  const { privateKey } = await getOrCreateKeypair();

  const wrappedKey = fromBase64(wrappedKeyB64);
  const nonce = fromBase64(nonceB64);

  const privateKeyObj = await openpgp.readPrivateKey({
    armoredKey: privateKey,
  });
  const { data: rawAesKey } = await openpgp.decrypt({
    message: await openpgp.readMessage({ binaryMessage: wrappedKey }),
    decryptionKeys: privateKeyObj,
    format: "binary",
  });

  const aesKey = await crypto.subtle.importKey(
    "raw",
    rawAesKey as Uint8Array<ArrayBuffer>,
    { name: "AES-GCM", length: AES_KEY_LENGTH_BITS },
    false,
    ["decrypt"],
  );

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce },
    aesKey,
    ciphertext,
  );

  return new Uint8Array(decryptedBuffer) as Uint8Array<ArrayBuffer>;
};
