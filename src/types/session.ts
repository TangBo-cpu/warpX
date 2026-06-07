export type SessionStatus = "starting" | "running" | "exited" | "closed" | "error";

export type Session = {
  id: string;
  name: string;
  cwd: string;
  shellPid?: number;
  status: SessionStatus;
  statusMessage?: string;
  createdAt: string;
  lastActivityAt?: string;
};
