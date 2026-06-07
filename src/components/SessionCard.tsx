import type { Session } from "../types/session";

type SessionCardProps = {
  session: Session;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
};

export function SessionCard({ session, active, onSelect, onClose }: SessionCardProps) {
  return (
    <button
      className={`session-card${active ? " is-active" : ""}`}
      type="button"
      onClick={onSelect}
    >
      <span className="session-card-main">
        <span className="session-name">{session.name}</span>
        <span className={`session-status is-${session.status}`}>{session.status}</span>
        <span className="session-cwd" title={session.cwd}>
          {session.cwd}
        </span>
        {session.statusMessage ? (
          <span className="session-message">{session.statusMessage}</span>
        ) : null}
      </span>
      <span
        className="session-close"
        role="button"
        tabIndex={0}
        title="Close session"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
        }}
      >
        ×
      </span>
    </button>
  );
}
