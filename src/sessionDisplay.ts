import type { AgentKind, Session, SessionStatus } from "./types/session";

type AgentDisplay = {
  label: string;
  glyph: string;
};

type StatusDisplay = {
  label: string;
  message: string;
};

export const AGENT_DISPLAY: Record<AgentKind, AgentDisplay> = {
  none: {
    label: "PowerShell",
    glyph: ">",
  },
  "claude-code": {
    label: "Claude Code",
    glyph: "🤖",
  },
  codex: {
    label: "Codex",
    glyph: "◇",
  },
  unknown: {
    label: "Unknown agent",
    glyph: "?",
  },
};

export const STATUS_DISPLAY: Record<SessionStatus, StatusDisplay> = {
  starting: {
    label: "Starting",
    message: "Starting pwsh.exe...",
  },
  shell: {
    label: "Shell",
    message: "Ready for commands",
  },
  running: {
    label: "Working",
    message: "Output received recently",
  },
  "waiting-input": {
    label: "Waiting for you",
    message: "Continue in the terminal",
  },
  "approval-needed": {
    label: "Needs approval",
    message: "Review the command in the terminal",
  },
  unknown: {
    label: "Unknown",
    message: "Not enough signal yet",
  },
  exited: {
    label: "Exited",
    message: "Session has stopped",
  },
  closed: {
    label: "Closed",
    message: "Session closed",
  },
  error: {
    label: "Error",
    message: "Check the terminal output",
  },
};

export function getSessionStatusMessage(session: Session) {
  return (
    session.statusReason ?? session.agentReason ?? session.statusMessage ?? STATUS_DISPLAY[session.status].message
  );
}

export function getSessionCwdLabel(cwd: string) {
  const parts = cwd.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? cwd;
}

export function formatSessionActivityAge(session: Session) {
  return formatAge(session.statusReasonAt ?? session.lastActivityAt ?? session.createdAt);
}

function formatAge(value?: string) {
  if (!value) {
    return undefined;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  const ageSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (ageSeconds < 5) {
    return "now";
  }

  if (ageSeconds < 60) {
    return `${ageSeconds}s`;
  }

  const ageMinutes = Math.floor(ageSeconds / 60);
  if (ageMinutes < 60) {
    return `${ageMinutes}m`;
  }

  const ageHours = Math.floor(ageMinutes / 60);
  if (ageHours < 24) {
    return `${ageHours}h`;
  }

  return `${Math.floor(ageHours / 24)}d`;
}
