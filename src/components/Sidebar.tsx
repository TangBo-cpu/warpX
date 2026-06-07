import { useState } from "react";
import type { Session } from "../types/session";
import { NewSessionDialog } from "./NewSessionDialog";
import { SessionCard } from "./SessionCard";

type SidebarProps = {
  sessions: Session[];
  activeSessionId: string | null;
  defaultCwd: string;
  disabled: boolean;
  nextSessionNumber: number;
  onCreateSession: (name: string, cwd: string) => void;
  onSelectSession: (sessionId: string) => void;
  onCloseSession: (sessionId: string) => void;
};

export function Sidebar({
  sessions,
  activeSessionId,
  defaultCwd,
  disabled,
  nextSessionNumber,
  onCreateSession,
  onSelectSession,
  onCloseSession,
}: SidebarProps) {
  const [showNewSessionForm, setShowNewSessionForm] = useState(false);
  const shouldShowForm = sessions.length === 0 || showNewSessionForm;

  function createSession(name: string, cwd: string) {
    onCreateSession(name, cwd);
    setShowNewSessionForm(false);
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-tabs" aria-label="Session views">
          <span className="sidebar-tab is-active">Sessions</span>
          <span className="sidebar-tab">Activity</span>
        </div>
        <div className="sidebar-actions">
          <span className="sidebar-count">{sessions.length}/8</span>
          <button
            aria-label="New session"
            className="sidebar-action"
            disabled={disabled}
            type="button"
            onClick={() => setShowNewSessionForm((value) => !value)}
          >
            +
          </button>
        </div>
      </div>

      {shouldShowForm ? (
        <NewSessionDialog
          defaultCwd={defaultCwd}
          disabled={disabled}
          nextSessionNumber={nextSessionNumber}
          onCreate={createSession}
        />
      ) : null}

      <div className="session-list">
        {sessions.length === 0 ? (
          <p className="empty-sidebar">Create a session to start pwsh.exe.</p>
        ) : (
          sessions.map((session) => (
            <SessionCard
              key={session.id}
              active={session.id === activeSessionId}
              session={session}
              onSelect={() => onSelectSession(session.id)}
              onClose={() => onCloseSession(session.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}
