import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { TextField } from "@excalidraw/excalidraw/components/TextField";
import { KEYS } from "@excalidraw/common";
import React, { useState } from "react";

export const SaveToServerNameDialog: React.FC<{
  onClose: () => void;
  onConfirm: (name: string) => void;
}> = ({ onClose, onConfirm }) => {
  const [name, setName] = useState("");

  const handleConfirm = () => {
    const trimmed = name.trim();
    if (trimmed) {
      onConfirm(trimmed);
    }
  };

  return (
    <Dialog size="small" onCloseRequest={onClose} title="Save to server">
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <TextField
          value={name}
          onChange={setName}
          placeholder="Scene name"
          selectOnRender
          fullWidth
          onKeyDown={(event) => {
            if (event.key === KEYS.ENTER) {
              handleConfirm();
            }
          }}
        />
        <button
          type="button"
          disabled={!name.trim()}
          onClick={handleConfirm}
          style={{ alignSelf: "flex-end", padding: "0.5rem 1rem" }}
        >
          Save
        </button>
      </div>
    </Dialog>
  );
};
