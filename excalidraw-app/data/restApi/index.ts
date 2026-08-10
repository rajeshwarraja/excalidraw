/**
 * Manual "save"/"load" commands against the REST object storage API.
 * Triggered on-demand only — never on scene-change — and independent of
 * both the native disk-save actions (File System Access API) and the
 * localStorage/IndexedDB autosave handled by `LocalData`.
 */
import { MIME_TYPES } from "@excalidraw/common";
import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "../../app_constants";
import { atom, appJotaiStore } from "../../app-jotai";

import { decryptDownload, encryptForUpload } from "./crypto";
import {
  createObject,
  createObjectVersion,
  deleteObject,
  getObjectContent,
  listObjects,
} from "./objectsApi";

import type { ObjectSummary } from "./objectsApi";

const getPersistedObjectId = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_REST_API_OBJECT_ID);
  } catch {
    return null;
  }
};

const setPersistedObjectId = (objectId: string | null): void => {
  try {
    if (objectId) {
      localStorage.setItem(
        STORAGE_KEYS.LOCAL_STORAGE_REST_API_OBJECT_ID,
        objectId,
      );
    } else {
      localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_REST_API_OBJECT_ID);
    }
  } catch {
    // localStorage may be unavailable (e.g. private browsing); the object id
    // just won't survive a reload in that case.
  }
};

// tracks the object created for the current scene; persisted to
// localStorage (in sync with the autosaved local scene) so a browser
// refresh continues versioning the same object instead of creating a new
// one every time "Save to server" is used (loading an object below also
// sets it, so subsequent saves correctly create new versions of the loaded
// object instead).
const currentObjectIdAtom = atom<string | null>(getPersistedObjectId());

/** Forgets the object associated with the current scene, so the next save
 * creates a brand-new object instead of a new version of a stale one.
 * Should be called whenever the scene is reset to a blank/new state
 * (e.g. "Reset the canvas"), since that clears `appState.name` but doesn't
 * know anything about our REST API session tracking. */
export const resetRestApiSession = (): void => {
  appJotaiStore.set(currentObjectIdAtom, null);
  setPersistedObjectId(null);
};

export type SaveToRestApiResult = {
  objectId: string;
  isNewObject: boolean;
};

export const saveSceneToRestApi = async (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
  name: string,
): Promise<SaveToRestApiResult> => {
  const serialized = serializeAsJSON(elements, appState, files, "local");
  const plaintext = new TextEncoder().encode(serialized);
  const envelope = await encryptForUpload(plaintext);

  const existingObjectId = appJotaiStore.get(currentObjectIdAtom);

  if (existingObjectId) {
    await createObjectVersion(existingObjectId, envelope);
    return { objectId: existingObjectId, isNewObject: false };
  }

  const { id } = await createObject(envelope, {
    name,
    mimeType: MIME_TYPES.excalidraw,
  });
  appJotaiStore.set(currentObjectIdAtom, id);
  setPersistedObjectId(id);
  return { objectId: id, isNewObject: true };
};

/** Lists objects available to pick from when loading. */
export const listRestApiObjects = (): Promise<ObjectSummary[]> => listObjects();

/** Deletes an object from the server; forgets it if it was the active one. */
export const deleteRestApiObject = async (objectId: string): Promise<void> => {
  await deleteObject(objectId);
  if (appJotaiStore.get(currentObjectIdAtom) === objectId) {
    appJotaiStore.set(currentObjectIdAtom, null);
    setPersistedObjectId(null);
  }
};

/**
 * Downloads and decrypts an object's current version, restoring it into
 * scene data ready for `excalidrawAPI.updateScene(...)`.
 */
export const loadSceneFromRestApi = async (
  objectId: string,
  localAppState: AppState | null,
  localElements: readonly ExcalidrawElement[] | null,
) => {
  const { ciphertext, wrappedKeyB64, nonceB64 } = await getObjectContent(
    objectId,
  );
  const decrypted = await decryptDownload(ciphertext, wrappedKeyB64, nonceB64);
  const json = new TextDecoder().decode(decrypted);

  const blob = new Blob([json], { type: MIME_TYPES.excalidraw });
  const data = await loadFromBlob(blob, localAppState, localElements, null);

  // subsequent saves should create new versions of the object we just
  // loaded, rather than a brand new object (persisted so this survives a
  // browser refresh too)
  appJotaiStore.set(currentObjectIdAtom, objectId);
  setPersistedObjectId(objectId);

  return data;
};
