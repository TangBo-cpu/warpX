import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { useMemo, useState, type CSSProperties } from "react";
import {
  DEFAULT_APPEARANCE_SETTINGS,
  getInitialAppearanceSettings,
  normalizeAppearanceSettings,
  resolveAppearanceCssVariables,
  saveAppearanceSettings,
  type AppearanceSettings,
} from "./appearance";
import { AppMenu } from "./components/AppMenu";
import { AppearancePanel } from "./components/AppearancePanel";
import { TerminalView, type TerminalShellApi } from "./components/TerminalView";
import type { ActiveSessionSummary } from "./sessionDisplay";

type ThemeMode = "light" | "dark";

type ImportedBackgroundImage = {
  path: string;
};

const THEME_STORAGE_KEY = "wrapx-theme";

function getInitialTheme(): ThemeMode {
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return storedTheme === "dark" || storedTheme === "light" ? storedTheme : "light";
}

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [appearance, setAppearance] = useState<AppearanceSettings>(getInitialAppearanceSettings);
  const [appearancePanelOpen, setAppearancePanelOpen] = useState(false);
  const [appearanceStatus, setAppearanceStatus] = useState<string | undefined>();
  const [activeSessionSummary, setActiveSessionSummary] = useState<ActiveSessionSummary | null>(null);
  const [terminalShellApi, setTerminalShellApi] = useState<TerminalShellApi | null>(null);
  const backgroundImageUrl = appearance.backgroundImagePath
    ? convertFileSrc(appearance.backgroundImagePath)
    : undefined;
  const appearanceStyle = useMemo(
    () => resolveAppearanceCssVariables(appearance, backgroundImageUrl) as CSSProperties,
    [appearance, backgroundImageUrl],
  );

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    const nextPreset = nextTheme === "dark" ? "midnight-glass" : "ivory-glass";

    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setTheme(nextTheme);
    updateAppearance({ preset: nextPreset });
  }

  function updateAppearance(patch: Partial<AppearanceSettings>) {
    setAppearance((currentAppearance) => {
      const nextAppearance = normalizeAppearanceSettings({ ...currentAppearance, ...patch });
      saveAppearanceSettings(nextAppearance);
      return nextAppearance;
    });
    setAppearanceStatus(undefined);
  }

  async function importBackgroundImage(file: File) {
    if (!file.type.startsWith("image/")) {
      setAppearanceStatus("请选择图片文件。");
      return;
    }

    setAppearanceStatus("Importing background image...");

    try {
      const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
      const result = await invoke<ImportedBackgroundImage>("appearance_import_background_image", {
        fileName: file.name,
        bytes,
      });
      updateAppearance({ backgroundImagePath: result.path });
      setAppearanceStatus("Background image imported.");
    } catch (error) {
      setAppearanceStatus(`Background image import failed: ${String(error)}`);
    }
  }

  function clearBackgroundImage() {
    updateAppearance({ backgroundImagePath: undefined });
  }

  function resetAppearance() {
    saveAppearanceSettings(DEFAULT_APPEARANCE_SETTINGS);
    setAppearance(DEFAULT_APPEARANCE_SETTINGS);
    setAppearanceStatus("Appearance reset.");
  }

  return (
    <main className="app-shell" data-theme={theme} style={appearanceStyle}>
      <AppMenu
        activeSessionSummary={activeSessionSummary}
        canUseSessionActions={Boolean(activeSessionSummary)}
        theme={theme}
        workspaceLabel="E:\\Code-All\\wrapx"
        onClearTerminal={() => terminalShellApi?.clearActiveTerminal()}
        onCopySelection={() => void terminalShellApi?.copyActiveSelection()}
        onOpenAppearance={() => setAppearancePanelOpen(true)}
        onPasteClipboard={() => void terminalShellApi?.pasteActiveClipboard()}
        onToggleTheme={toggleTheme}
      />
      <TerminalView
        theme={theme}
        onReady={setTerminalShellApi}
        onSessionSummaryChange={setActiveSessionSummary}
      />
      {appearancePanelOpen ? (
        <AppearancePanel
          settings={appearance}
          statusMessage={appearanceStatus}
          onChange={updateAppearance}
          onClearImage={clearBackgroundImage}
          onClose={() => setAppearancePanelOpen(false)}
          onImportImage={importBackgroundImage}
          onReset={resetAppearance}
        />
      ) : null}
    </main>
  );
}
