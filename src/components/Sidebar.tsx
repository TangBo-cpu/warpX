import type { AgentKind, Session } from "../types/session";
import { SessionCard } from "./SessionCard";

type SidebarProps = {
  sessions: Session[];
  activeSessionId: string | null;
  disabled: boolean;
  onSelectSession: (sessionId: string) => void;
  onCloseSession: (sessionId: string) => void;
  onAgentOverride: (sessionId: string, override?: AgentKind) => void;
  onCreateDefaultSession: () => void;
};

export function Sidebar({
  sessions,
  activeSessionId,
  disabled,
  onSelectSession,
  onCloseSession,
  onAgentOverride,
  onCreateDefaultSession,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="session-list">
        {sessions.length === 0 ? (
          <div className="empty-sidebar">
            <strong>No sessions</strong>
            <span>Start a terminal session.</span>
            <button disabled={disabled} type="button" onClick={onCreateDefaultSession}>
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
