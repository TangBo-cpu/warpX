import avatarRezeModern1 from "./assets/status-avatars/reze-modern/thumbs/reze-modern-1-thumb.jpg";
import avatarRezeModern2 from "./assets/status-avatars/reze-modern/thumbs/reze-modern-2-thumb.jpg";
import avatarRezeModern3 from "./assets/status-avatars/reze-modern/thumbs/reze-modern-3-thumb.jpg";
import avatarRezeModern4 from "./assets/status-avatars/reze-modern/thumbs/reze-modern-4-thumb.jpg";
import avatarRezeModern5 from "./assets/status-avatars/reze-modern/thumbs/reze-modern-5-thumb.jpg";
import type { AgentKind, Session, SessionStatus } from "./types/session";

type AgentDisplay = {
  label: string;
  glyph: string;
};

type StatusDisplay = {
  label: string;
  message: string;
};

export type SessionAvatarKey =
  | "reze-modern-1"
  | "reze-modern-2"
  | "reze-modern-3"
  | "reze-modern-4"
  | "reze-modern-5";

export type SessionAvatarDisplay = {
  key: SessionAvatarKey;
  label: string;
  glyph: string;
  imageUrl: string;
};

export type ActiveSessionSummary = {
  name: string;
  statusLabel: string;
  cwdLabel: string;
  age?: string;
  avatar: SessionAvatarDisplay;
};

export const AGENT_DISPLAY: Record<AgentKind, AgentDisplay> = {
  none: {
    label: "PowerShell",
    glyph: "PS",
  },
  "claude-code": {
    label: "Claude Code",
    glyph: "CC",
  },
  codex: {
    label: "Codex",
    glyph: "CX",
  },
  unknown: {
    label: "Unknown agent",
    glyph: "??",
  },
};

export const SESSION_AVATAR_DISPLAY: Record<SessionAvatarKey, SessionAvatarDisplay> = {
  "reze-modern-1": {
    key: "reze-modern-1",
    label: "reze-modern-1",
    glyph: "R1",
    imageUrl: avatarRezeModern1,
  },
  "reze-modern-2": {
    key: "reze-modern-2",
    label: "reze-modern-2",
    glyph: "R2",
    imageUrl: avatarRezeModern2,
  },
  "reze-modern-3": {
    key: "reze-modern-3",
    label: "reze-modern-3",
    glyph: "R3",
    imageUrl: avatarRezeModern3,
  },
  "reze-modern-4": {
    key: "reze-modern-4",
    label: "reze-modern-4",
    glyph: "R4",
    imageUrl: avatarRezeModern4,
  },
  "reze-modern-5": {
    key: "reze-modern-5",
    label: "reze-modern-5",
    glyph: "R5",
    imageUrl: avatarRezeModern5,
  },
};

const SESSION_AVATAR_KEYS = Object.keys(SESSION_AVATAR_DISPLAY) as SessionAvatarKey[];

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

export function getSessionAvatar(session: Session): SessionAvatarDisplay {
  const avatarKey = SESSION_AVATAR_KEYS[stableIndex(session.id, SESSION_AVATAR_KEYS.length)];
  return SESSION_AVATAR_DISPLAY[avatarKey];
}

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

function stableIndex(value: string, modulo: number) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash % modulo;
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
