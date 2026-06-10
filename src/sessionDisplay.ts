import avatarCodeRanger from "./assets/status-avatars/avatar-code-ranger.png";
import avatarHelperAlchemist from "./assets/status-avatars/avatar-helper-alchemist.png";
import avatarNightArchivist from "./assets/status-avatars/avatar-night-archivist.png";
import avatarTerminalMage from "./assets/status-avatars/avatar-terminal-mage.png";
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
  | "terminal-mage"
  | "helper-alchemist"
  | "code-ranger"
  | "night-archivist";

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
  "terminal-mage": {
    key: "terminal-mage",
    label: "terminal-mage",
    glyph: "TM",
    imageUrl: avatarTerminalMage,
  },
  "helper-alchemist": {
    key: "helper-alchemist",
    label: "helper-alchemist",
    glyph: "HA",
    imageUrl: avatarHelperAlchemist,
  },
  "code-ranger": {
    key: "code-ranger",
    label: "code-ranger",
    glyph: "CR",
    imageUrl: avatarCodeRanger,
  },
  "night-archivist": {
    key: "night-archivist",
    label: "night-archivist",
    glyph: "NA",
    imageUrl: avatarNightArchivist,
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
