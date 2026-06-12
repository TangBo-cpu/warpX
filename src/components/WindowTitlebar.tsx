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
          <GearIcon />
        </button>
        <button
          aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
          className="titlebar-action"
          title={theme === "light" ? "Dark theme" : "Light theme"}
          type="button"
          onClick={(event) => runTitlebarAction(event, onToggleTheme)}
        >
          {theme === "light" ? <MoonIcon /> : <SunIcon />}
        </button>
        <button
          aria-label="New PowerShell session"
          className="titlebar-action"
          disabled={newSessionDisabled}
          title="New PowerShell session"
          type="button"
          onClick={(event) => runTitlebarAction(event, onNewSession)}
        >
          <PlusIcon />
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

function GearIcon() {
  return (
    <svg aria-hidden="true" className="titlebar-action-icon" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="2.7" />
      <path d="M10 3.2v1.7M10 15.1v1.7M4.9 4.9l1.2 1.2M13.9 13.9l1.2 1.2M3.2 10h1.7M15.1 10h1.7M4.9 15.1l1.2-1.2M13.9 6.1l1.2-1.2" />
      <path d="M7.2 4.6 8 3.4h4l.8 1.2M15.4 7.2l1.2.8v4l-1.2.8M12.8 15.4l-.8 1.2H8l-.8-1.2M4.6 12.8 3.4 12V8l1.2-.8" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" className="titlebar-action-icon" viewBox="0 0 20 20">
      <path d="M14.7 13.7A6.8 6.8 0 0 1 6.3 5.3 6.9 6.9 0 1 0 14.7 13.7Z" />
      <path d="M13.5 4.1v1.6M12.7 4.9h1.6" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg aria-hidden="true" className="titlebar-action-icon" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="3.2" />
      <path d="M10 2.8v2M10 15.2v2M2.8 10h2M15.2 10h2M4.9 4.9l1.4 1.4M13.7 13.7l1.4 1.4M4.9 15.1l1.4-1.4M13.7 6.3l1.4-1.4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="titlebar-action-icon" viewBox="0 0 20 20">
      <path d="M10 4.6v10.8M4.6 10h10.8" />
    </svg>
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
