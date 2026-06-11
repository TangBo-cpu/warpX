import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  DEFAULT_APPEARANCE_SETTINGS,
  getInitialAppearanceSettings,
  normalizeAppearanceSettings,
  resolveAppearanceCssVariables,
  saveAppearanceSettings,
  type AppearanceSettings,
} from "./appearance";
import { AppearancePanel } from "./components/AppearancePanel";
import { TerminalView } from "./components/TerminalView";
import type { ActiveSessionSummary } from "./sessionDisplay";

type ThemeMode = "light" | "dark";

type ImportedBackgroundImage = {
  path: string;
};

const THEME_STORAGE_KEY = "wrapx-theme";
const MAX_BACKGROUND_IMAGE_BYTES = 20 * 1024 * 1024;
const SUPPORTED_BACKGROUND_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);
const SUPPORTED_BACKGROUND_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function getInitialTheme(): ThemeMode {
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return storedTheme === "dark" || storedTheme === "light" ? storedTheme : "light";
}

function setNativeWindowTitle(title: string) {
  try {
    void getCurrentWindow().setTitle(title).catch(() => undefined);
  } catch {
    // Running in a browser preview without the Tauri window API is harmless.
  }
}

function backgroundImageValidationError(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const mimeType = file.type.toLowerCase();
  const hasSupportedExtension = extension ? SUPPORTED_BACKGROUND_IMAGE_EXTENSIONS.has(extension) : false;
  const hasSupportedMimeType = mimeType ? SUPPORTED_BACKGROUND_IMAGE_MIME_TYPES.has(mimeType) : false;

  if (file.size > MAX_BACKGROUND_IMAGE_BYTES) {
    return "背景图片不能超过 20MB。";
  }

  if (!hasSupportedExtension || (mimeType && !hasSupportedMimeType)) {
    return "请选择 PNG、JPG 或 WebP 图片。";
  }

  return undefined;
}

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [appearance, setAppearance] = useState<AppearanceSettings>(getInitialAppearanceSettings);
  const [appearancePanelOpen, setAppearancePanelOpen] = useState(false);
  const [appearanceStatus, setAppearanceStatus] = useState<string | undefined>();
  const [activeSessionSummary, setActiveSessionSummary] = useState<ActiveSessionSummary | null>(null);
  const backgroundImageUrl = appearance.backgroundImagePath
    ? convertFileSrc(appearance.backgroundImagePath)
    : undefined;
  const appearanceStyle = useMemo(
    () => resolveAppearanceCssVariables(appearance, backgroundImageUrl) as CSSProperties,
    [appearance, backgroundImageUrl],
  );

  useEffect(() => {
    const title = activeSessionSummary
      ? `WrapX — ${activeSessionSummary.name} · ${activeSessionSummary.statusLabel} · ${activeSessionSummary.cwdLabel}`
      : "WrapX";

    setNativeWindowTitle(title);
  }, [activeSessionSummary]);

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
    const validationError = backgroundImageValidationError(file);

    if (validationError) {
      setAppearanceStatus(validationError);
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
      <TerminalView
        theme={theme}
        onOpenAppearance={() => setAppearancePanelOpen(true)}
        onSessionSummaryChange={setActiveSessionSummary}
        onToggleTheme={toggleTheme}
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
