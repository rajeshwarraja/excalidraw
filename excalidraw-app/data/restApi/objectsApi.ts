import { MIME_TYPES } from "@excalidraw/common";

import { REST_API } from "../../app_constants";

import { getAccessToken } from "./auth";

import type { EncryptedEnvelope } from "./crypto";

type CreateObjectResult = { id: string };

export type ObjectSummary = {
  id: string;
  name: string;
  mime_type: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type DownloadedObject = {
  ciphertext: Uint8Array<ArrayBuffer>;
  wrappedKeyB64: string;
  nonceB64: string;
};

const authHeaders = async () => {
  const accessToken = await getAccessToken();
  return { Authorization: `Bearer ${accessToken}` };
};

const buildUploadHeaders = async (envelope: EncryptedEnvelope) => ({
  ...(await authHeaders()),
  "x-wrapped-key": envelope.wrappedKeyB64,
  "x-nonce": envelope.nonceB64,
  "Content-Type": "application/octet-stream",
});

/** Creates a new object (first version) at POST /v1/objects. */
export const createObject = async (
  envelope: EncryptedEnvelope,
  opts: { name: string; mimeType: string },
): Promise<CreateObjectResult> => {
  const headers = await buildUploadHeaders(envelope);
  const params = new URLSearchParams({
    name: opts.name,
    mime_type: opts.mimeType,
  });

  const response = await fetch(
    `${REST_API.OBJECTS_BASE_URL}/v1/objects?${params.toString()}`,
    {
      method: "POST",
      headers,
      body: envelope.ciphertext,
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to create object (${response.status} ${response.statusText})`,
    );
  }

  return response.json();
};

/** Uploads a new version of an existing object at POST /v1/objects/{id}/versions. */
export const createObjectVersion = async (
  objectId: string,
  envelope: EncryptedEnvelope,
): Promise<void> => {
  const headers = await buildUploadHeaders(envelope);

  const response = await fetch(
    `${REST_API.OBJECTS_BASE_URL}/v1/objects/${objectId}/versions`,
    {
      method: "POST",
      headers,
      body: envelope.ciphertext,
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to upload new object version (${response.status} ${response.statusText})`,
    );
  }
};

/**
 * Lists objects owned by/shared with the caller at GET /v1/objects.
 *
 * The server doesn't support filtering by mime type or excluding
 * soft-deleted objects (`status: "deleted"` items are still returned), so
 * both are filtered client-side.
 */
export const listObjects = async (): Promise<ObjectSummary[]> => {
  const headers = await authHeaders();

  const response = await fetch(`${REST_API.OBJECTS_BASE_URL}/v1/objects`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to list objects (${response.status} ${response.statusText})`,
    );
  }

  const json = await response.json();
  const items: ObjectSummary[] = json.items ?? [];

  return items.filter(
    (object) =>
      object.mime_type === MIME_TYPES.excalidraw && object.status === "active",
  );
};

/** Deletes an object (soft delete) at DELETE /v1/objects/{id}. */
export const deleteObject = async (objectId: string): Promise<void> => {
  const headers = await authHeaders();

  const response = await fetch(
    `${REST_API.OBJECTS_BASE_URL}/v1/objects/${objectId}`,
    {
      method: "DELETE",
      headers,
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to delete object (${response.status} ${response.statusText})`,
    );
  }
};

/**
 * Downloads the current version's ciphertext body at
 * GET /v1/objects/{id}/content, along with the `x-wrapped-key`/`x-nonce`
 * response headers needed to decrypt it.
 */
export const getObjectContent = async (
  objectId: string,
): Promise<DownloadedObject> => {
  const headers = await authHeaders();

  const response = await fetch(
    `${REST_API.OBJECTS_BASE_URL}/v1/objects/${objectId}/content`,
    {
      method: "GET",
      headers,
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to download object (${response.status} ${response.statusText})`,
    );
  }

  const wrappedKeyB64 = response.headers.get("x-wrapped-key");
  const nonceB64 = response.headers.get("x-nonce");
  if (!wrappedKeyB64 || !nonceB64) {
    throw new Error(
      "Download response is missing x-wrapped-key/x-nonce headers",
    );
  }

  const ciphertext = new Uint8Array(
    await response.arrayBuffer(),
  ) as Uint8Array<ArrayBuffer>;

  return { ciphertext, wrappedKeyB64, nonceB64 };
};
