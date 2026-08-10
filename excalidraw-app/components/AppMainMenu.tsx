import {
  eyeIcon,
  saveAs as saveIcon,
  LoadIcon,
  TrashIcon,
  downloadIcon,
  stackPushIcon,
} from "@excalidraw/excalidraw/components/icons";
import { MainMenu } from "@excalidraw/excalidraw/index";
import { getShortcutFromShortcutName } from "@excalidraw/excalidraw/actions/shortcuts";
import React from "react";

import { isDevEnv } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { LanguageList } from "../app-language/LanguageList";

import { saveDebugState } from "./DebugCanvas";

export const AppMainMenu: React.FC<{
  onCollabDialogOpen: () => any;
  isCollaborating: boolean;
  isCollabEnabled: boolean;
  theme: Theme | "system";
  refresh: () => void;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onSaveToServer: () => void;
  onLoadFromServerOpen: () => void;
  onResetCanvasOpen: () => void;
  onExportEncryptionKey: () => void;
  onImportEncryptionKeyFile: () => void;
}> = React.memo((props) => {
  return (
    <MainMenu>
      <MainMenu.Item
        icon={LoadIcon}
        onSelect={props.onLoadFromServerOpen}
        shortcut={getShortcutFromShortcutName("loadScene")}
      >
        Open
      </MainMenu.Item>
      <MainMenu.Item
        icon={saveIcon}
        onSelect={props.onSaveToServer}
        shortcut={getShortcutFromShortcutName("saveScene")}
      >
        Save to...
      </MainMenu.Item>
      <MainMenu.DefaultItems.SaveAsImage />
      {props.isCollabEnabled && (
        <MainMenu.DefaultItems.LiveCollaborationTrigger
          isCollaborating={props.isCollaborating}
          onSelect={() => props.onCollabDialogOpen()}
        />
      )}
      <MainMenu.DefaultItems.CommandPalette className="highlighted" />
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.Help />
      <MainMenu.Item icon={TrashIcon} onSelect={props.onResetCanvasOpen}>
        Reset the canvas
      </MainMenu.Item>
      <MainMenu.Item icon={downloadIcon} onSelect={props.onExportEncryptionKey}>
        Export encryption key
      </MainMenu.Item>
      <MainMenu.Item
        icon={stackPushIcon}
        onSelect={props.onImportEncryptionKeyFile}
      >
        Import encryption key
      </MainMenu.Item>
      {isDevEnv() && (
        <MainMenu.Item
          icon={eyeIcon}
          onSelect={() => {
            if (window.visualDebug) {
              delete window.visualDebug;
              saveDebugState({ enabled: false });
            } else {
              window.visualDebug = { data: [] };
              saveDebugState({ enabled: true });
            }
            props?.refresh();
          }}
        >
          Visual Debug
        </MainMenu.Item>
      )}
      <MainMenu.Separator />
      <MainMenu.DefaultItems.Preferences />
      <MainMenu.DefaultItems.ToggleTheme allowSystemTheme theme={props.theme} />
      <MainMenu.ItemCustom>
        <LanguageList style={{ width: "100%" }} />
      </MainMenu.ItemCustom>
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
});
