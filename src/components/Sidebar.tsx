import { useState } from "react";
import type { AgentKind, Session } from "../types/session";
import { NewSessionDialog } from "./NewSessionDialog";
import { SessionCard } from "./SessionCard";

type ThemeMode = "light" | "dark";

type SidebarProps = {
  sessions: Session[];
  activeSessionId: string | null;
  defaultCwd: string;
  disabled: boolean;
  nextSessionNumber: number;
  theme: ThemeMode;
  onCreateSession: (name: string, cwd: string) => void;
  onSelectSession: (sessionId: string) => void;
  onCloseSession: (sessionId: string) => void;
  onAgentOverride: (sessionId: string, override?: AgentKind) => void;
  onOpenAppearance: () => void;
  onToggleTheme: () => void;
};

export function Sidebar({
  sessions,
  activeSessionId,
  defaultCwd,
  disabled,
  nextSessionNumber,
  theme,
  onCreateSession,
  onSelectSession,
  onCloseSession,
  onAgentOverride,
  onOpenAppearance,
  onToggleTheme,
}: SidebarProps) {
  const [showNewSessionForm, setShowNewSessionForm] = useState(false);

  function createSession(name: string, cwd: string) {
    onCreateSession(name, cwd);
    setShowNewSessionForm(false);
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-actions">
          <button
            aria-label="Open appearance settings"
            className="sidebar-action"
            title="Appearance"
            type="button"
            onClick={onOpenAppearance}
          >
            ⚙
          </button>
          <button
            aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
            className="sidebar-action"
            title={theme === "light" ? "Dark theme" : "Light theme"}
            type="button"
            onClick={onToggleTheme}
          >
            {theme === "light" ? "☾" : "☀"}
          </button>
          <button
            aria-label="New session"
            className="sidebar-action"
            disabled={disabled}
            title="New session"
            type="button"
            onClick={() => setShowNewSessionForm((value) => !value)}
          >
            +
          </button>
        </div>
      </div>

      {showNewSessionForm ? (
        <NewSessionDialog
          defaultCwd={defaultCwd}
          disabled={disabled}
          nextSessionNumber={nextSessionNumber}
          onCreate={createSession}
        />
      ) : null}

      <div className="session-list">
        {sessions.length === 0 ? (
          <div className="empty-sidebar">
            <strong>No sessions</strong>
            <span>Start a terminal session.</span>
            <button
              disabled={disabled}
              type="button"
              onClick={() => setShowNewSessionForm(true)}
            >
              New session
            </button>
          </div>
        ) : (
          sessions.map((session) => (
            <SessionCard
              key={session.id}
              active={session.id === activeSessionId}
              session={session}
              onAgentOverride={(override) => onAgentOverride(session.id, override)}
              onSelect={() => onSelectSession(session.id)}
              onClose={() => onCloseSession(session.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}
