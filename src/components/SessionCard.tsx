import { useEffect, useRef, useState } from "react";
import type { AgentKind, Session } from "../types/session";
import {
  AGENT_DISPLAY,
  STATUS_DISPLAY,
  formatSessionActivityAge,
  getSessionAvatar,
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

const AGENT_OVERRIDE_OPTIONS: Array<{ value: AgentKind | "auto"; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "claude-code", label: "Claude Code" },
  { value: "codex", label: "Codex" },
  { value: "none", label: "PowerShell" },
  { value: "unknown", label: "Unknown" },
];

export function SessionCard({
  session,
  active,
  onSelect,
  onClose,
  onAgentOverride,
}: SessionCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLSpanElement | null>(null);
  const agent = AGENT_DISPLAY[session.agentKind];
  const status = STATUS_DISPLAY[session.status];
  const avatar = getSessionAvatar(session);
  const age = formatSessionActivityAge(session);
  const cwdLabel = getSessionCwdLabel(session.cwd);
  const message = getSessionStatusMessage(session);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [menuOpen]);

  function chooseAgentOverride(value: AgentKind | "auto") {
    onAgentOverride(value === "auto" ? undefined : value);
    setMenuOpen(false);
  }

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
      <span className={`session-avatar is-${avatar.key}`} title={avatar.label} aria-hidden="true">
        <img alt="" decoding="sync" loading="eager" src={avatar.imageUrl} />
      </span>

      <span className="session-card-main">
        <span className="session-card-topline">
          <span className="session-name">{session.name}</span>
          <span className="session-card-state">
            <span className={`session-status is-${session.status}`}>{status.label}</span>
            {age ? <span className="session-age">{age}</span> : null}
          </span>
        </span>

        <span className="session-card-meta">
          <span title={session.cwd}>{cwdLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{agent.label}</span>
        </span>

        <span className="session-card-message" title={message}>{message}</span>
      </span>

      <span
        ref={menuRef}
        className="session-card-menu"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <button
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={`Session actions for ${session.name}`}
          className="session-menu-trigger"
          title="Session actions"
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
        >
          ⋯
        </button>

        {menuOpen ? (
          <span className="session-menu-popover" role="menu">
            <span className="session-menu-label">Agent</span>
            {AGENT_OVERRIDE_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={
                  (session.agentKindOverride ?? "auto") === option.value ? "is-selected" : undefined
                }
                role="menuitem"
                type="button"
                onClick={() => chooseAgentOverride(option.value)}
              >
                {option.label}
              </button>
            ))}
            <button className="is-danger" role="menuitem" type="button" onClick={onClose}>
              Close session
            </button>
          </span>
        ) : null}
      </span>
    </article>
  );
}
