import { actionClearCanvas } from "@excalidraw/excalidraw/actions";
import { useExcalidrawActionManager } from "@excalidraw/excalidraw/components/App";
import ConfirmDialog from "@excalidraw/excalidraw/components/ConfirmDialog";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import React from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { resetRestApiSession } from "../data/restApi";

/**
 * Reimplements the built-in "Reset the canvas" confirm dialog so we can
 * additionally forget the REST API object tied to this session, and work
 * around a core-library quirk: `actionClearCanvas` resets `appState.name` to
 * `null`, but `App.syncActionResult` merges the next name via
 * `actionResult?.appState?.name ?? this.state.name` — since `null ?? x`
 * evaluates to `x`, the explicit null reset is silently discarded and the
 * old name sticks around. Following up with an empty string (not nullish)
 * bypasses that and actually clears it.
 */
export const ResetCanvasConfirmDialog: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  hasUnsavedChanges: boolean;
  onClose: () => void;
  onReset: () => void;
}> = ({ excalidrawAPI, hasUnsavedChanges, onClose, onReset }) => {
  const actionManager = useExcalidrawActionManager();

  return (
    <ConfirmDialog
      title="Clear canvas"
      confirmText={hasUnsavedChanges ? "Discard and clear" : undefined}
      onConfirm={() => {
        actionManager.executeAction(actionClearCanvas);
        excalidrawAPI?.updateScene({
          appState: { name: "" },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        resetRestApiSession();
        onReset();
        onClose();
      }}
      onCancel={onClose}
    >
      <p className="clear-canvas__content">
        {hasUnsavedChanges
          ? "You have unsaved changes that have not been saved to the server. This will clear the whole canvas and those changes will be lost. Are you sure?"
          : "This will clear the whole canvas. Are you sure?"}
      </p>
    </ConfirmDialog>
  );
};
