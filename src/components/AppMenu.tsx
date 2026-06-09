import { useEffect, useRef, useState } from "react";
import type { ActiveSessionSummary } from "../sessionDisplay";

type ThemeMode = "light" | "dark";

type AppMenuProps = {
  activeSessionSummary: ActiveSessionSummary | null;
  canUseSessionActions: boolean;
  theme: ThemeMode;
  workspaceLabel: string;
  onClearTerminal: () => void;
  onCopySelection: () => void;
  onPasteClipboard: () => void;
  onToggleTheme: () => void;
  onOpenAppearance: () => void;
};

export function AppMenu({
  activeSessionSummary,
  canUseSessionActions,
  theme,
  workspaceLabel,
  onClearTerminal,
  onCopySelection,
  onPasteClipboard,
  onToggleTheme,
  onOpenAppearance,
}: AppMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  function openAppearance() {
    setOpen(false);
    onOpenAppearance();
  }

  return (
    <header className="app-topbar">
      <div className="app-topbar-brand" title={workspaceLabel}>
        <span className="app-mark" aria-hidden="true">
          W
        </span>
        <span className="app-workspace-copy">
          <strong>WrapX</strong>
          <span>{workspaceLabel}</span>
        </span>
      </div>

      <div className="app-topbar-session" aria-live="polite">
        {activeSessionSummary ? (
          <>
            <span
              className={`session-avatar is-${activeSessionSummary.avatar.key}`}
              title={activeSessionSummary.avatar.label}
              aria-hidden="true"
            >
              {activeSessionSummary.avatar.glyph}
            </span>
            <span className="app-topbar-session-copy">
              <strong>{activeSessionSummary.name}</strong>
              <span>
                {activeSessionSummary.statusLabel} · {activeSessionSummary.cwdLabel}
              </span>
            </span>
            {activeSessionSummary.age ? (
              <span className="app-topbar-session-age">{activeSessionSummary.age}</span>
            ) : null}
          </>
        ) : (
          <span className="app-topbar-session-empty">No active session</span>
        )}
      </div>

      <div className="app-topbar-actions">
        <button
          aria-label="Clear terminal"
          className="icon-button"
          disabled={!canUseSessionActions}
          title="Clear"
          type="button"
          onClick={onClearTerminal}
        >
          ⌫
        </button>
        <button
          aria-label="Copy terminal selection"
          className="icon-button"
          disabled={!canUseSessionActions}
          title="Copy"
          type="button"
          onClick={onCopySelection}
        >
          ⧉
        </button>
        <button
          aria-label="Paste clipboard text"
          className="icon-button"
          disabled={!canUseSessionActions}
          title="Paste"
          type="button"
          onClick={onPasteClipboard}
        >
          ▣
        </button>
        <button
          aria-label="Open appearance settings"
          className="icon-button"
          title="Appearance"
          type="button"
          onClick={onOpenAppearance}
        >
          ⚙
        </button>
        <button
          aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
          className="icon-button"
          title={theme === "light" ? "Dark theme" : "Light theme"}
          type="button"
          onClick={onToggleTheme}
        >
          {theme === "light" ? "☾" : "☀"}
        </button>

        <div ref={menuRef} className="app-menu">
          <button
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label="Open menu"
            className="icon-button"
            title="Menu"
            type="button"
            onClick={() => setOpen((value) => !value)}
          >
            ☰
          </button>

          {open ? (
            <div className="app-menu-popover" role="menu">
              <button role="menuitem" type="button" onClick={openAppearance}>
                Appearance...
              </button>
              <button role="menuitem" type="button" onClick={() => setOpen(false)}>
                About WrapX
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
