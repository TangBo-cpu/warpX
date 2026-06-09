import type { AgentKind, Session } from "../types/session";
import {
  AGENT_DISPLAY,
  STATUS_DISPLAY,
  formatSessionActivityAge,
  getSessionCwdLabel,
  getSessionStatusMessage,
} from "../sessionDisplay";

type SessionCardProps = {
  session: Session;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
  onAgentOverride: (override?: AgentKind) => void;
};

export function SessionCard({
  session,
  active,
  onSelect,
  onClose,
  onAgentOverride,
}: SessionCardProps) {
  const agent = AGENT_DISPLAY[session.agentKind];
  const autoAgent = AGENT_DISPLAY[session.autoAgentKind];
  const status = STATUS_DISPLAY[session.status];
  const age = formatSessionActivityAge(session);
  const cwdLabel = getSessionCwdLabel(session.cwd);
  const message = getSessionStatusMessage(session);

  return (
    <article
      className={`session-card is-${session.status}${active ? " is-active" : ""}`}
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
        <span className="session-card-topline">
          <span className={`session-agent-glyph is-${session.agentKind}`} aria-hidden="true">
            {agent.glyph}
          </span>
          <span className="session-name">{session.name}</span>
          <span className={`session-status is-${session.status}`}>{status.label}</span>
          {age ? <span className="session-age">{age}</span> : null}
        </span>

        <span className="session-card-meta">
          <span>{agent.label}</span>
          <span aria-hidden="true">·</span>
          <span title={session.cwd}>{cwdLabel}</span>
          {session.agentKindOverride ? <span className="override-badge">override</span> : null}
        </span>

        <span className="session-message" title={message}>
          {message}
        </span>

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
            <option value="auto">Auto ({autoAgent.label})</option>
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
