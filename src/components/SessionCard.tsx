import type { AgentKind, Session } from "../types/session";

type SessionCardProps = {
  session: Session;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
  onAgentOverride: (override?: AgentKind) => void;
};

const AGENT_LABELS: Record<AgentKind, string> = {
  none: "PowerShell",
  "claude-code": "Claude Code",
  codex: "Codex",
  unknown: "Unknown agent",
};

function formatStatusReason(session: Session) {
  if (!session.statusReason) {
    return undefined;
  }

  if (!session.statusReasonAt) {
    return session.statusReason;
  }

  const detectedAt = Date.parse(session.statusReasonAt);
  if (Number.isNaN(detectedAt)) {
    return session.statusReason;
  }

  const ageSeconds = Math.max(0, Math.floor((Date.now() - detectedAt) / 1000));
  const age = ageSeconds < 60 ? `${ageSeconds}s ago` : `${Math.floor(ageSeconds / 60)}m ago`;
  return `${session.statusReason} · ${age}`;
}

export function SessionCard({
  session,
  active,
  onSelect,
  onClose,
  onAgentOverride,
}: SessionCardProps) {
  const statusReason = formatStatusReason(session);

  return (
    <article
      className={`session-card${active ? " is-active" : ""}`}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <span className="session-card-main">
        <span className="session-card-header">
          <span className="session-name">{session.name}</span>
          <span className={`agent-badge is-${session.agentKind}`}>
            {AGENT_LABELS[session.agentKind]}
          </span>
        </span>
        <span className="session-card-status-row">
          <span className={`session-status is-${session.status}`}>{session.status}</span>
          {session.agentKindOverride ? <span className="override-badge">override</span> : null}
        </span>
        <span className="session-cwd" title={session.cwd}>
          {session.cwd}
        </span>
        {statusReason ? (
          <span className="session-message" title={session.statusReason}>
            {statusReason}
          </span>
        ) : session.agentReason ? (
          <span className="session-message" title={session.agentReason}>
            {session.agentReason}
          </span>
        ) : session.statusMessage ? (
          <span className="session-message">{session.statusMessage}</span>
        ) : null}
        <label
          className="agent-override"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <span>Agent</span>
          <select
            value={session.agentKindOverride ?? "auto"}
            onChange={(event) => {
              const value = event.target.value as AgentKind | "auto";
              onAgentOverride(value === "auto" ? undefined : value);
            }}
          >
            <option value="auto">Auto ({AGENT_LABELS[session.autoAgentKind]})</option>
            <option value="claude-code">Claude Code</option>
            <option value="codex">Codex</option>
            <option value="unknown">Unknown</option>
            <option value="none">None</option>
          </select>
        </label>
      </span>
      <button
        className="session-close"
        title="Close session"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        ×
      </button>
    </article>
  );
}
