import { getCurrentWindow } from "@tauri-apps/api/window";
import type { MouseEvent } from "react";

type ThemeMode = "light" | "dark";

type WindowTitlebarProps = {
  isSidebarCollapsed: boolean;
  newSessionDisabled: boolean;
  theme: ThemeMode;
  onNewSession: () => void;
  onOpenAppearance: () => void;
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
};

export function WindowTitlebar({
  isSidebarCollapsed,
  newSessionDisabled,
  theme,
  onNewSession,
  onOpenAppearance,
  onToggleSidebar,
  onToggleTheme,
}: WindowTitlebarProps) {
  return (
    <header
      className="window-titlebar"
      data-tauri-drag-region
      onDoubleClick={toggleMaximize}
      onMouseDown={startWindowDrag}
    >
      <div className="window-titlebar-drag-space" data-tauri-drag-region />

      <div className="window-titlebar-actions">
        <button
          aria-label="Open appearance settings"
          className="titlebar-action"
          title="Appearance"
          type="button"
          onClick={(event) => runTitlebarAction(event, onOpenAppearance)}
        >
          ⚙
        </button>
        <button
          aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
          className="titlebar-action"
          title={theme === "light" ? "Dark theme" : "Light theme"}
          type="button"
          onClick={(event) => runTitlebarAction(event, onToggleTheme)}
        >
          {theme === "light" ? "☾" : "☀"}
        </button>
        <button
          aria-label="New PowerShell session"
          className="titlebar-action"
          disabled={newSessionDisabled}
          title="New PowerShell session"
          type="button"
          onClick={(event) => runTitlebarAction(event, onNewSession)}
        >
          +
        </button>
      </div>

      <div className="window-titlebar-controls">
        <button
          aria-label={isSidebarCollapsed ? "Show sessions sidebar" : "Hide sessions sidebar"}
          className="window-control sidebar-toggle"
          title={isSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
          type="button"
          onClick={(event) => runTitlebarAction(event, onToggleSidebar)}
        >
          <span
            aria-hidden="true"
            className={`sidebar-toggle-icon${isSidebarCollapsed ? " is-show" : " is-hide"}`}
          />
        </button>
        <button aria-label="Minimize" className="window-control" type="button" onClick={minimizeWindow}>
          −
        </button>
        <button aria-label="Maximize" className="window-control" type="button" onClick={toggleMaximize}>
          □
        </button>
        <button aria-label="Close" className="window-control is-close" type="button" onClick={closeWindow}>
          ×
        </button>
      </div>
    </header>
  );
}

function startWindowDrag(event: MouseEvent<HTMLElement>) {
  if (event.button !== 0 || event.detail > 1) {
    return;
  }

  if ((event.target as HTMLElement).closest(".window-titlebar-actions, .window-titlebar-controls")) {
    return;
  }

  void getCurrentWindow().startDragging().catch(() => undefined);
}

function runTitlebarAction(event: MouseEvent<HTMLButtonElement>, action: () => void) {
  event.preventDefault();
  event.stopPropagation();
  action();
}

function minimizeWindow(event: MouseEvent<HTMLButtonElement>) {
  event.preventDefault();
  event.stopPropagation();
  void getCurrentWindow().minimize().catch(() => undefined);
}

function toggleMaximize(event: MouseEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();
  void getCurrentWindow().toggleMaximize().catch(() => undefined);
}

function closeWindow(event: MouseEvent<HTMLButtonElement>) {
  event.preventDefault();
  event.stopPropagation();
  void getCurrentWindow().close().catch(() => undefined);
}
