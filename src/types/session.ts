export type AgentKind = "none" | "claude-code" | "codex" | "unknown";

export type SessionStatus =
  | "starting"
  | "shell"
  | "running"
  | "unknown"
  | "exited"
  | "closed"
  | "error";

export type Session = {
  id: string;
  name: string;
  cwd: string;
  shellPid?: number;
  activeAgentPid?: number;
  autoAgentKind: AgentKind;
  agentKind: AgentKind;
  agentKindOverride?: AgentKind;
  agentReason?: string;
  agentDetectedAt?: string;
  status: SessionStatus;
  statusMessage?: string;
  createdAt: string;
  lastActivityAt?: string;
};
