import ConfirmDialog from "@excalidraw/excalidraw/components/ConfirmDialog";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { TrashIcon } from "@excalidraw/excalidraw/components/icons";
import { IconButton } from "@excalidraw/excalidraw/components/IconButton";
import React, { useEffect, useState } from "react";

import { deleteRestApiObject, listRestApiObjects } from "../data/restApi";
import {
  clearPendingRestApiAction,
  setPendingRestApiAction,
} from "../data/restApi/pendingAction";

import type { ObjectSummary } from "../data/restApi/objectsApi";

export const LoadFromServerDialog: React.FC<{
  onClose: () => void;
  onSelect: (objectId: string, name: string) => void;
}> = ({ onClose, onSelect }) => {
  const [objects, setObjects] = useState<ObjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ObjectSummary | null>(
    null,
  );

  useEffect(() => {
    // stashed so a mid-flight OIDC login redirect (triggered by
    // getAccessToken() inside listRestApiObjects) can reopen this dialog
    // automatically once the user is back and re-authenticated, instead
    // of silently dropping the "Load from server" action
    setPendingRestApiAction({ type: "openLoadDialog" });
    listRestApiObjects()
      .then((result) => {
        clearPendingRestApiAction();
        setObjects(result);
      })
      .catch((err) => {
        clearPendingRestApiAction();
        console.error(err);
        setError("Failed to load objects from server");
      });
  }, []);

  const handleDelete = async (object: ObjectSummary) => {
    setDeletingId(object.id);
    try {
      await deleteRestApiObject(object.id);
      setObjects((prev) => prev?.filter((o) => o.id !== object.id) ?? prev);
    } catch (err) {
      console.error(err);
      setError("Failed to delete object from server");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog size="small" onCloseRequest={onClose} title="Load from server">
      {error && <div>{error}</div>}
      {!error && !objects && <div>Loading…</div>}
      {!error && objects && objects.length === 0 && (
        <div>No saved objects found.</div>
      )}
      {!error && objects && objects.length > 0 && (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          {objects.map((object) => (
            <div
              key={object.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <button
                type="button"
                onClick={() => onSelect(object.id, object.name)}
                style={{
                  display: "flex",
                  flex: 1,
                  justifyContent: "space-between",
                  textAlign: "left",
                  padding: "0.5rem",
                }}
              >
                <span>{object.name}</span>
                <span>{new Date(object.updated_at).toLocaleString()}</span>
              </button>
              <IconButton
                type="icon"
                icon={TrashIcon}
                aria-label={`Delete ${object.name}`}
                title="Delete"
                disabled={deletingId === object.id}
                onClick={() => setPendingDelete(object)}
              />
            </div>
          ))}
        </div>
      )}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete from server"
          onConfirm={() => {
            const object = pendingDelete;
            setPendingDelete(null);
            handleDelete(object);
          }}
          onCancel={() => setPendingDelete(null)}
        >
          <p>{`Delete "${pendingDelete.name}" from the server? This cannot be undone.`}</p>
        </ConfirmDialog>
      )}
    </Dialog>
  );
};
