import { getCurrentWindow } from "@tauri-apps/api/window";
import type { MouseEvent } from "react";

export function WindowTitlebar() {
  return (
    <header
      className="window-titlebar"
      data-tauri-drag-region
      onDoubleClick={toggleMaximize}
      onMouseDown={startWindowDrag}
    >
      <div className="window-titlebar-brand" data-tauri-drag-region title="WrapX">
        <span className="app-mark" data-tauri-drag-region aria-hidden="true">
          W
        </span>
        <span className="window-titlebar-brand-copy" data-tauri-drag-region>
          <strong data-tauri-drag-region>WrapX</strong>
        </span>
      </div>

      <div className="window-titlebar-drag-space" data-tauri-drag-region />

      <div className="window-titlebar-controls">
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

  if ((event.target as HTMLElement).closest(".window-titlebar-controls")) {
    return;
  }

  void getCurrentWindow().startDragging().catch(() => undefined);
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
