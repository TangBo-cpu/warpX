import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { Sidebar } from "./Sidebar";
import { WindowTitlebar } from "./WindowTitlebar";
import {
  STATUS_DISPLAY,
  formatSessionActivityAge,
  getSessionAvatar,
  getSessionCwdLabel,
  type ActiveSessionSummary,
} from "../sessionDisplay";
import type { AgentKind, Session, SessionStatus } from "../types/session";

type PtyOutput = {
  sessionId: string;
  data: number[];
};

type PtyStarted = {
  sessionId: string;
  pid?: number;
};

type PtyLifecycleEvent = {
  sessionId: string;
};

type AgentDetected = {
  sessionId: string;
  autoAgentKind: AgentKind;
  activeAgentPid?: number;
  reason: string;
};

type SessionStatusDetected = {
  sessionId: string;
  status: "shell" | "running" | "waiting-input" | "approval-needed" | "unknown" | "error";
  reason: string;
  detectedAtMs: number;
};

type TerminalRuntime = {
  terminal: Terminal;
  fitAddon: FitAddon;
};

type TerminalModules = {
  Terminal: typeof import("@xterm/xterm").Terminal;
  FitAddon: typeof import("@xterm/addon-fit").FitAddon;
};

type TerminalOptions = NonNullable<ConstructorParameters<TerminalModules["Terminal"]>[0]>;
type TerminalFontWeight = TerminalOptions["fontWeight"];

const DEFAULT_CWD = "E:\\Code-All\\wrapx";
const MAX_LIVE_SESSIONS = 8;
const DEFAULT_TERMINAL_FONT_FAMILY = "Cascadia Mono";
const TERMINAL_FONT_FALLBACKS = [
  "JetBrainsMono NFM",
  "JetBrainsMono NF",
  "JetBrainsMono Nerd Font Mono",
  "JetBrainsMono Nerd Font",
  "CaskaydiaCove Nerd Font Mono",
  "CaskaydiaCove Nerd Font",
  "Cascadia Code PL",
  "Cascadia Mono PL",
  "MesloLGM Nerd Font Mono",
  "MesloLGM Nerd Font",
  "MesloLGS Nerd Font Mono",
  "MesloLGS Nerd Font",
  "Consolas",
  "Courier New",
  "Segoe UI Symbol",
  "Segoe UI Emoji",
  "monospace",
];
const DEFAULT_TERMINAL_FONT_SIZE = 14;
const MIN_TERMINAL_FONT_SIZE = 6;
const MAX_TERMINAL_FONT_SIZE = 72;
const DEFAULT_TERMINAL_LINE_HEIGHT = 1;
const MIN_TERMINAL_LINE_HEIGHT = 0.8;
const MAX_TERMINAL_LINE_HEIGHT = 2;
const SIDEBAR_STORAGE_KEY = "wrapx-sidebar-width";
const SIDEBAR_MIN_WIDTH = 280;
const SIDEBAR_MAX_WIDTH = 560;
const SIDEBAR_FALLBACK_WIDTH = 320;
const SIDEBAR_RESIZER_WIDTH = 10;
const SIDEBAR_KEYBOARD_STEP = 16;
const TERMINAL_MIN_WIDTH = 420;

const DARK_TERMINAL_THEME: TerminalColorTheme = {
  background: "rgba(7, 10, 15, 0.62)",
  foreground: "#f6f7fb",
  cursor: "#ffd082",
  selectionBackground: "rgba(130, 199, 255, 0.28)",
  black: "#0b0d12",
  red: "#ff8d82",
  green: "#54d38f",
  yellow: "#ffd082",
  blue: "#82c7ff",
  magenta: "#d7c2ff",
  cyan: "#8be9fd",
  white: "#d9dde7",
  brightBlack: "#6b7280",
  brightRed: "#ffb4aa",
  brightGreen: "#86efac",
  brightYellow: "#fde68a",
  brightBlue: "#bfdbfe",
  brightMagenta: "#e9d5ff",
  brightCyan: "#a5f3fc",
  brightWhite: "#ffffff",
};

const LIGHT_TERMINAL_THEME: TerminalColorTheme = {
  background: "rgba(255, 255, 255, 0.38)",
  foreground: "#1f2937",
  cursor: "#1d4ed8",
  selectionBackground: "rgba(37, 99, 235, 0.18)",
  black: "#111827",
  red: "#b91c1c",
  green: "#217247",
  yellow: "#b45309",
  blue: "#1d4ed8",
  magenta: "#7c3aed",
  cyan: "#0f766e",
  white: "#f3f4f6",
  brightBlack: "#6b7280",
  brightRed: "#dc2626",
  brightGreen: "#15803d",
  brightYellow: "#d97706",
  brightBlue: "#2563eb",
  brightMagenta: "#9333ea",
  brightCyan: "#0891b2",
  brightWhite: "#ffffff",
};

type TerminalColorTheme = {
  background?: string;
  foreground?: string;
  cursor?: string;
  selectionBackground?: string;
  black?: string;
  red?: string;
  green?: string;
  yellow?: string;
  blue?: string;
  magenta?: string;
  cyan?: string;
  white?: string;
  brightBlack?: string;
  brightRed?: string;
  brightGreen?: string;
  brightYellow?: string;
  brightBlue?: string;
  brightMagenta?: string;
  brightCyan?: string;
  brightWhite?: string;
};

type TerminalProfileAppearance = {
  profileName?: string;
  colorScheme?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  lineHeight?: number;
  theme: TerminalColorTheme;
};

type ThemeMode = "light" | "dark";

type TerminalViewProps = {
  hasBackgroundImage: boolean;
  theme: ThemeMode;
  onOpenAppearance: () => void;
  onSessionSummaryChange: (summary: ActiveSessionSummary | null) => void;
  onToggleTheme: () => void;
};

let terminalModulesPromise: Promise<TerminalModules> | null = null;

function loadTerminalModules() {
  terminalModulesPromise ??= Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]).then(
    ([xterm, fit]) => ({ Terminal: xterm.Terminal, FitAddon: fit.FitAddon }),
  );
  return terminalModulesPromise;
}

function getTauriWindow(): ReturnType<typeof getCurrentWindow> | null {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

function getInitialSidebarWidth() {
  try {
    const storedWidth = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (!storedWidth) {
      return null;
    }

    const parsedWidth = Number(storedWidth);
    return Number.isFinite(parsedWidth) ? clampSidebarWidth(parsedWidth) : null;
  } catch {
    return null;
  }
}

function clampSidebarWidth(width: number, maxWidth = SIDEBAR_MAX_WIDTH) {
  const safeMaxWidth = Number.isFinite(maxWidth)
    ? Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, maxWidth))
    : SIDEBAR_MAX_WIDTH;
  const safeWidth = Number.isFinite(width) ? width : SIDEBAR_FALLBACK_WIDTH;
  return Math.round(Math.min(Math.max(safeWidth, SIDEBAR_MIN_WIDTH), safeMaxWidth));
}

export function TerminalView({
  hasBackgroundImage,
  theme,
  onOpenAppearance,
  onSessionSummaryChange,
  onToggleTheme,
}: TerminalViewProps) {
  const hostsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const terminalRuntimesRef = useRef(new Map<string, TerminalRuntime>());
  const sessionsRef = useRef<Session[]>([]);
  const activeSessionIdRef = useRef<string | null>(null);
  const terminalAppearanceRef = useRef<TerminalProfileAppearance | null>(null);
  const appThemeRef = useRef<ThemeMode>(theme);
  const hasBackgroundImageRef = useRef(hasBackgroundImage);
  const appCloseInProgressRef = useRef(false);
  const closedSessionIdsRef = useRef(new Set<string>());
  const sessionCounterRef = useRef(1);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const sidebarResizeFrameRef = useRef<number | null>(null);
  const isResizingSidebarRef = useRef(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [terminalAppearance, setTerminalAppearance] = useState<TerminalProfileAppearance | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number | null>(getInitialSidebarWidth);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null;

  useEffect(() => {
    if (!activeSession) {
      onSessionSummaryChange(null);
      return;
    }

    onSessionSummaryChange({
      name: activeSession.name,
      statusLabel: STATUS_DISPLAY[activeSession.status].label,
      cwdLabel: getSessionCwdLabel(activeSession.cwd),
      age: formatSessionActivityAge(activeSession),
      avatar: getSessionAvatar(activeSession),
    });
  }, [activeSession, onSessionSummaryChange]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    appThemeRef.current = theme;
    hasBackgroundImageRef.current = hasBackgroundImage;
    terminalRuntimesRef.current.forEach(({ terminal }) => {
      applyTerminalAppearance(terminal, terminalAppearanceRef.current, theme, hasBackgroundImage);
    });
  }, [hasBackgroundImage, theme]);

  useEffect(() => {
    let cancelled = false;

    void invoke<TerminalProfileAppearance | null>("terminal_profile_appearance")
      .then((appearance) => {
        if (!cancelled && appearance) {
          terminalAppearanceRef.current = appearance;
          setTerminalAppearance(appearance);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!terminalAppearance) {
      return;
    }

    terminalRuntimesRef.current.forEach(({ terminal }) => {
      applyTerminalAppearance(
        terminal,
        terminalAppearance,
        appThemeRef.current,
        hasBackgroundImageRef.current,
      );
    });

    const sessionId = activeSessionIdRef.current;
    if (sessionId) {
      requestAnimationFrame(() => fitAndResize(sessionId));
    }
  }, [terminalAppearance]);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
    if (activeSessionId) {
      requestAnimationFrame(() => fitAndResize(activeSessionId));
    }
  }, [activeSessionId]);

  useEffect(() => {
    const sessionId = activeSessionIdRef.current;
    if (sessionId) {
      requestAnimationFrame(() => fitAndResize(sessionId));
    }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const resize = () => {
      setSidebarWidth((currentWidth) => {
        if (currentWidth === null) {
          return currentWidth;
        }

        return clampSidebarWidth(currentWidth, getSidebarMaxWidth());
      });

      const sessionId = activeSessionIdRef.current;
      if (sessionId) {
        fitAndResize(sessionId);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    return () => {
      if (sidebarResizeFrameRef.current !== null) {
        cancelAnimationFrame(sidebarResizeFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const unlisteners: UnlistenFn[] = [];
    const appWindow = getTauriWindow();

    void Promise.all([
      appWindow?.setClosable(true),
      appWindow?.setMinimizable(true),
      appWindow?.setMaximizable(true),
    ]).catch(() => undefined);

    void appWindow?.onCloseRequested((event) => {
      event.preventDefault();
      if (appCloseInProgressRef.current) {
        return;
      }

      const activeSessions = sessionsRef.current.filter((session) => isLiveSessionStatus(session.status));
      void handleAppCloseRequest(activeSessions);
    }).then((unlisten) => {
      if (cancelled) {
        unlisten();
      } else {
        unlisteners.push(unlisten);
      }
    });

    void listen<PtyOutput>("pty-output", (event) => {
      const { sessionId, data } = event.payload;
      const runtime = terminalRuntimesRef.current.get(sessionId);
      if (!runtime || closedSessionIdsRef.current.has(sessionId)) {
        return;
      }

      runtime.terminal.write(Uint8Array.from(data));
      updateSessionWith(sessionId, (session) => ({
        ...session,
        status: session.status === "starting" ? statusFromAgentKind(session.agentKind) : session.status,
        statusMessage: session.statusMessage ?? "output received",
        lastActivityAt: new Date().toISOString(),
      }));
    }).then((unlisten) => {
      if (cancelled) {
        unlisten();
      } else {
        unlisteners.push(unlisten);
      }
    });

    void listen<SessionStatusDetected>("session-status", (event) => {
      const { sessionId, status, reason, detectedAtMs } = event.payload;
      updateSessionWith(sessionId, (session) => {
        if (isTerminalSessionStatus(session.status)) {
          return session;
        }

        const detectedAt = new Date(detectedAtMs).toISOString();
        return {
          ...session,
          status,
          statusReason: reason,
          statusReasonAt: detectedAt,
          statusMessage: reason,
          lastActivityAt: detectedAt,
        };
      });
    }).then((unlisten) => {
      if (cancelled) {
        unlisten();
      } else {
        unlisteners.push(unlisten);
      }
    });

    void listen<AgentDetected>("agent-detected", (event) => {
      const { sessionId, autoAgentKind, activeAgentPid, reason } = event.payload;
      updateSessionWith(sessionId, (session) => {
        if (!isLiveSessionStatus(session.status)) {
          return session;
        }

        const agentKind = session.agentKindOverride ?? autoAgentKind;
        const status = canAgentDetectionSetStatus(session.status, agentKind)
          ? statusFromAgentKind(agentKind)
          : session.status;
        return {
          ...session,
          autoAgentKind,
          agentKind,
          activeAgentPid,
          agentReason: reason,
          agentDetectedAt: new Date().toISOString(),
          status,
          statusMessage: session.statusMessage ?? reason,
          lastActivityAt: new Date().toISOString(),
        };
      });
    }).then((unlisten) => {
      if (cancelled) {
        unlisten();
      } else {
        unlisteners.push(unlisten);
      }
    });

    void listen<PtyLifecycleEvent>("pty-exit", (event) => {
      updateSession(event.payload.sessionId, {
        status: "exited",
        statusMessage: "shell exited",
        lastActivityAt: new Date().toISOString(),
      });
      terminalRuntimesRef.current
        .get(event.payload.sessionId)
        ?.terminal.writeln("\r\n[wrapx] pwsh.exe exited.");
    }).then((unlisten) => {
      if (cancelled) {
        unlisten();
      } else {
        unlisteners.push(unlisten);
      }
    });

    void listen<PtyLifecycleEvent>("pty-closed", (event) => {
      updateSession(event.payload.sessionId, {
        status: "closed",
        statusMessage: "session closed",
        lastActivityAt: new Date().toISOString(),
      });
    }).then((unlisten) => {
      if (cancelled) {
        unlisten();
      } else {
        unlisteners.push(unlisten);
      }
    });

    return () => {
      cancelled = true;
      unlisteners.forEach((unlisten) => unlisten());
      terminalRuntimesRef.current.forEach(({ terminal }) => terminal.dispose());
      terminalRuntimesRef.current.clear();
    };
  }, []);

  function createDefaultSession() {
    void createSession(`PowerShell ${sessionCounterRef.current}`, DEFAULT_CWD);
  }

  async function createSession(name: string, cwd: string) {
    if (sessionsRef.current.length >= MAX_LIVE_SESSIONS) {
      return;
    }

    const sessionId = `session-${Date.now()}-${sessionCounterRef.current}`;
    sessionCounterRef.current += 1;
    closedSessionIdsRef.current.delete(sessionId);
    const now = new Date().toISOString();
    const session: Session = {
      id: sessionId,
      name,
      cwd,
      autoAgentKind: "none",
      agentKind: "none",
      status: "starting",
      statusMessage: "starting pwsh.exe...",
      createdAt: now,
      lastActivityAt: now,
    };

    replaceSessions([...sessionsRef.current, session]);
    setActiveSession(sessionId);

    requestAnimationFrame(async () => {
      const host = hostsRef.current[sessionId];
      if (!host || !hasSession(sessionId) || closedSessionIdsRef.current.has(sessionId)) {
        return;
      }

      let runtime = terminalRuntimesRef.current.get(sessionId);
      if (!runtime) {
        try {
          const { Terminal, FitAddon } = await loadTerminalModules();
          if (!hasSession(sessionId) || closedSessionIdsRef.current.has(sessionId)) {
            return;
          }

          const terminal = createTerminal(
            Terminal,
            sessionId,
            name,
            terminalAppearanceRef.current,
            appThemeRef.current,
            hasBackgroundImageRef.current,
            () => canWriteToSession(sessionId),
          );
          const fitAddon = new FitAddon();
          terminal.loadAddon(fitAddon);
          attachTerminalKeys(terminal, sessionId, {
            clearTerminal,
            copyTerminalSelection,
            pasteClipboardText,
          });
          terminalRuntimesRef.current.set(sessionId, { terminal, fitAddon });
          runtime = { terminal, fitAddon };
        } catch (error) {
          updateSession(sessionId, {
            status: "error",
            statusMessage: "terminal load failed",
            lastActivityAt: new Date().toISOString(),
          });
          return;
        }
      }

      runtime.terminal.open(host);
      runtime.fitAddon.fit();

      try {
        const result = await invoke<PtyStarted>("pty_start", {
          options: {
            sessionId,
            cwd,
            cols: runtime.terminal.cols,
            rows: runtime.terminal.rows,
          },
        });

        if (!hasSession(sessionId) || closedSessionIdsRef.current.has(sessionId)) {
          await invoke("pty_close", { sessionId }).catch(() => undefined);
          return;
        }

        updateSession(sessionId, {
          shellPid: result.pid,
          status: "shell",
          statusMessage: result.pid ? `pwsh.exe pid ${result.pid}` : "pwsh.exe running",
          lastActivityAt: new Date().toISOString(),
        });
        runtime.terminal.focus();
      } catch (error) {
        if (!hasSession(sessionId) || closedSessionIdsRef.current.has(sessionId)) {
          return;
        }

        updateSession(sessionId, {
          status: "error",
          statusMessage: "start failed",
          lastActivityAt: new Date().toISOString(),
        });
        runtime.terminal.writeln(`\r\n[wrapx] start failed: ${String(error)}`);
      }
    });
  }

  async function closeSession(sessionId: string) {
    const session = sessionsRef.current.find((candidate) => candidate.id === sessionId);
    if (!session) {
      return;
    }

    if (
      session.status !== "closed" &&
      !window.confirm(`Close ${session.name} and kill its PowerShell process tree?`)
    ) {
      focusActiveTerminal();
      return;
    }

    closedSessionIdsRef.current.add(sessionId);
    updateSession(sessionId, { status: "closed", statusMessage: "closing..." });

    try {
      await invoke("pty_close", { sessionId });
    } catch (error) {
      closedSessionIdsRef.current.delete(sessionId);
      updateSession(sessionId, {
        status: "error",
        statusMessage: "close failed",
        lastActivityAt: new Date().toISOString(),
      });
      terminalRuntimesRef.current
        .get(sessionId)
        ?.terminal.writeln(`\r\n[wrapx] close failed: ${String(error)}`);
      return;
    }

    terminalRuntimesRef.current.get(sessionId)?.terminal.dispose();
    terminalRuntimesRef.current.delete(sessionId);
    delete hostsRef.current[sessionId];

    const remainingSessions = sessionsRef.current.filter((candidate) => candidate.id !== sessionId);
    replaceSessions(remainingSessions);
    if (activeSessionIdRef.current === sessionId) {
      setActiveSession(
        remainingSessions.length > 0 ? remainingSessions[remainingSessions.length - 1].id : null,
      );
    }
  }

  function selectSession(sessionId: string) {
    setActiveSession(sessionId);
    requestAnimationFrame(() => {
      fitAndResize(sessionId);
      terminalRuntimesRef.current.get(sessionId)?.terminal.focus();
    });
  }

  function replaceSessions(nextSessions: Session[]) {
    sessionsRef.current = nextSessions;
    setSessions(nextSessions);
  }

  function setActiveSession(sessionId: string | null) {
    activeSessionIdRef.current = sessionId;
    setActiveSessionId(sessionId);
  }

  function hasSession(sessionId: string) {
    return sessionsRef.current.some((session) => session.id === sessionId);
  }

  function canWriteToSession(sessionId: string) {
    return sessionsRef.current.some(
      (session) => session.id === sessionId && isLiveSessionStatus(session.status),
    );
  }

  function updateSession(sessionId: string, patch: Partial<Session>) {
    updateSessionWith(sessionId, (session) => ({ ...session, ...patch }));
  }

  function updateSessionWith(sessionId: string, update: (session: Session) => Session) {
    let changed = false;
    const nextSessions = sessionsRef.current.map((session) => {
      if (session.id !== sessionId) {
        return session;
      }

      changed = true;
      return update(session);
    });

    if (changed) {
      replaceSessions(nextSessions);
    }
  }

  function setAgentOverride(sessionId: string, override?: AgentKind) {
    updateSessionWith(sessionId, (session) => {
      if (!isLiveSessionStatus(session.status)) {
        return session;
      }

      const agentKind = override ?? session.autoAgentKind;
      return {
        ...session,
        agentKindOverride: override,
        agentKind,
        status: canAgentDetectionSetStatus(session.status, agentKind)
          ? statusFromAgentKind(agentKind)
          : session.status,
        statusMessage: override ? `manual override: ${agentKind}` : session.agentReason,
      };
    });
    focusActiveTerminal();
  }

  function getSidebarMaxWidth() {
    const workspace = workspaceRef.current;
    if (!workspace) {
      return SIDEBAR_MAX_WIDTH;
    }

    const availableWidth = workspace.getBoundingClientRect().width - TERMINAL_MIN_WIDTH - SIDEBAR_RESIZER_WIDTH;
    return Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, availableWidth));
  }

  function getCurrentSidebarWidth() {
    if (sidebarWidth !== null) {
      return sidebarWidth;
    }

    const sidebar = workspaceRef.current?.querySelector<HTMLElement>(".sidebar");
    return sidebar?.getBoundingClientRect().width ?? SIDEBAR_FALLBACK_WIDTH;
  }

  function getSidebarWidthFromPointer(clientX: number) {
    const workspace = workspaceRef.current;
    if (!workspace) {
      return getCurrentSidebarWidth();
    }

    return workspace.getBoundingClientRect().right - clientX;
  }

  function updateSidebarWidth(width: number) {
    const nextWidth = clampSidebarWidth(width, getSidebarMaxWidth());
    setSidebarWidth(nextWidth);
    scheduleSidebarResizeFit();
    return nextWidth;
  }

  function persistSidebarWidth(width: number) {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(width));
    } catch {
      // Sidebar width persistence is a convenience; the resize itself should still work.
    }
  }

  function scheduleSidebarResizeFit() {
    if (sidebarResizeFrameRef.current !== null) {
      return;
    }

    sidebarResizeFrameRef.current = requestAnimationFrame(() => {
      sidebarResizeFrameRef.current = null;
      const sessionId = activeSessionIdRef.current;
      if (sessionId) {
        fitAndResize(sessionId);
      }
    });
  }

  function finishSidebarResize(event: PointerEvent<HTMLDivElement>) {
    if (!isResizingSidebarRef.current) {
      return;
    }

    event.preventDefault();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    isResizingSidebarRef.current = false;
    setIsResizingSidebar(false);
    persistSidebarWidth(updateSidebarWidth(getSidebarWidthFromPointer(event.clientX)));
    scheduleSidebarResizeFit();
  }

  function handleSidebarResizePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    isResizingSidebarRef.current = true;
    setIsResizingSidebar(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    updateSidebarWidth(getSidebarWidthFromPointer(event.clientX));
  }

  function handleSidebarResizePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!isResizingSidebarRef.current) {
      return;
    }

    event.preventDefault();
    updateSidebarWidth(getSidebarWidthFromPointer(event.clientX));
  }

  function handleSidebarResizeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentWidth = clampSidebarWidth(getCurrentSidebarWidth(), getSidebarMaxWidth());
    let nextWidth: number;

    if (event.key === "ArrowLeft") {
      nextWidth = currentWidth + SIDEBAR_KEYBOARD_STEP;
    } else if (event.key === "ArrowRight") {
      nextWidth = currentWidth - SIDEBAR_KEYBOARD_STEP;
    } else if (event.key === "Home") {
      nextWidth = SIDEBAR_MIN_WIDTH;
    } else if (event.key === "End") {
      nextWidth = getSidebarMaxWidth();
    } else {
      return;
    }

    event.preventDefault();
    persistSidebarWidth(updateSidebarWidth(nextWidth));
  }

  function fitAndResize(sessionId: string) {
    const runtime = terminalRuntimesRef.current.get(sessionId);
    const host = hostsRef.current[sessionId];
    if (!runtime || !host || host.offsetParent === null) {
      return;
    }

    runtime.fitAddon.fit();
    void invoke("pty_resize", {
      sessionId,
      cols: runtime.terminal.cols,
      rows: runtime.terminal.rows,
    }).catch(() => {
      // Resize before PTY start or after close is harmless for M2 runtime switching.
    });
  }

  function clearActiveTerminal() {
    const sessionId = activeSessionIdRef.current;
    if (!sessionId) {
      return;
    }

    clearTerminal(sessionId);
    terminalRuntimesRef.current.get(sessionId)?.terminal.focus();
  }

  function clearTerminal(sessionId: string) {
    const runtime = terminalRuntimesRef.current.get(sessionId);
    if (!runtime) {
      return;
    }

    runtime.terminal.clear();
    if (canWriteToSession(sessionId)) {
      void invoke("pty_write", { sessionId, data: "\f" }).catch((error) => {
        runtime.terminal.writeln(`\r\n[wrapx] clear failed: ${String(error)}`);
        updateSession(sessionId, { statusMessage: "clear failed" });
      });
    }
    updateSession(sessionId, { statusMessage: "screen cleared" });
  }

  async function copyActiveSelection() {
    const sessionId = activeSessionIdRef.current;
    if (!sessionId) {
      return;
    }

    await copyTerminalSelection(sessionId);
    terminalRuntimesRef.current.get(sessionId)?.terminal.focus();
  }

  async function copyTerminalSelection(sessionId: string) {
    const terminal = terminalRuntimesRef.current.get(sessionId)?.terminal;
    if (!terminal) {
      return;
    }

    const selection = terminal.getSelection();
    if (!selection) {
      updateSession(sessionId, { statusMessage: "nothing selected" });
      return;
    }

    if (!navigator.clipboard?.writeText) {
      updateSession(sessionId, { statusMessage: "clipboard unavailable" });
      terminal.writeln("\r\n[wrapx] clipboard copy is unavailable in this WebView.");
      return;
    }

    try {
      await navigator.clipboard.writeText(selection);
      updateSession(sessionId, { statusMessage: "copied selection" });
    } catch (error) {
      updateSession(sessionId, { statusMessage: "copy failed" });
      terminal.writeln(`\r\n[wrapx] copy failed: ${String(error)}`);
    }
  }

  async function pasteActiveClipboard() {
    const sessionId = activeSessionIdRef.current;
    if (!sessionId) {
      return;
    }

    await pasteClipboardText(sessionId);
    terminalRuntimesRef.current.get(sessionId)?.terminal.focus();
  }

  async function pasteClipboardText(sessionId: string) {
    const terminal = terminalRuntimesRef.current.get(sessionId)?.terminal;
    if (!terminal) {
      return;
    }

    if (!navigator.clipboard?.readText) {
      updateSession(sessionId, { statusMessage: "clipboard unavailable" });
      terminal.writeln("\r\n[wrapx] clipboard paste is unavailable in this WebView.");
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        updateSession(sessionId, { statusMessage: "clipboard empty" });
        return;
      }

      terminal.paste(text);
      updateSession(sessionId, { statusMessage: "pasted clipboard" });
    } catch (error) {
      updateSession(sessionId, { statusMessage: "paste failed" });
      terminal.writeln(`\r\n[wrapx] paste failed: ${String(error)}`);
    }
  }

  function focusActiveTerminal() {
    const sessionId = activeSessionIdRef.current;
    if (sessionId) {
      terminalRuntimesRef.current.get(sessionId)?.terminal.focus();
    }
  }

  async function handleAppCloseRequest(activeSessions: Session[]) {
    if (activeSessions.length > 0) {
      const label = activeSessions.length === 1 ? activeSessions[0].name : `${activeSessions.length} sessions`;
      if (!window.confirm(`Close WrapX and terminate ${label}?`)) {
        focusActiveTerminal();
        return;
      }
    }

    appCloseInProgressRef.current = true;
    activeSessions.forEach((session) => closedSessionIdsRef.current.add(session.id));
    replaceSessions(
      sessionsRef.current.map((session) =>
        activeSessions.some((activeSession) => activeSession.id === session.id)
          ? { ...session, status: "closed", statusMessage: "closing..." }
          : session,
      ),
    );

    try {
      await invoke("app_exit");
    } catch {
      appCloseInProgressRef.current = false;
      activeSessions.forEach((session) => closedSessionIdsRef.current.delete(session.id));
      replaceSessions(
        sessionsRef.current.map((session) =>
          activeSessions.some((activeSession) => activeSession.id === session.id)
            ? { ...session, status: "error", statusMessage: "close failed" }
            : session,
        ),
      );
      focusActiveTerminal();
    }
  }

  const workspaceClassName = `workspace-card${isResizingSidebar ? " is-sidebar-resizing" : ""}${
    isSidebarCollapsed ? " is-sidebar-collapsed" : ""
  }`;
  const workspaceStyle = sidebarWidth === null
    ? undefined
    : ({ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties);
  const sidebarValueNow = Math.round(getCurrentSidebarWidth());

  return (
    <>
      <WindowTitlebar
        isSidebarCollapsed={isSidebarCollapsed}
        newSessionDisabled={sessions.length >= MAX_LIVE_SESSIONS}
        theme={theme}
        onNewSession={createDefaultSession}
        onOpenAppearance={onOpenAppearance}
        onToggleSidebar={() => setIsSidebarCollapsed((value) => !value)}
        onToggleTheme={onToggleTheme}
      />
      <section ref={workspaceRef} className={workspaceClassName} style={workspaceStyle}>
        <section className="terminal-card">
          <div className="terminal-host-stack">
            {sessions.length === 0 ? (
              <div className="empty-terminal">
                <p>Start a session to open a terminal.</p>
                <button type="button" onClick={createDefaultSession}>
                  New session
                </button>
              </div>
            ) : null}
            {sessions.map((session) => (
              <div
                key={session.id}
                ref={(element) => {
                  hostsRef.current[session.id] = element;
                }}
                className={`terminal-host${session.id === activeSessionId ? " is-active" : ""}`}
              />
            ))}
          </div>
        </section>

        {isSidebarCollapsed ? null : (
          <>
            <div
              aria-label="Resize sidebar"
              aria-orientation="vertical"
              aria-valuemax={SIDEBAR_MAX_WIDTH}
              aria-valuemin={SIDEBAR_MIN_WIDTH}
              aria-valuenow={sidebarValueNow}
              className="sidebar-resizer"
              role="separator"
              tabIndex={0}
              onKeyDown={handleSidebarResizeKeyDown}
              onPointerCancel={finishSidebarResize}
              onPointerDown={handleSidebarResizePointerDown}
              onPointerMove={handleSidebarResizePointerMove}
              onPointerUp={finishSidebarResize}
            />

            <Sidebar
              activeSessionId={activeSessionId}
              disabled={sessions.length >= MAX_LIVE_SESSIONS}
              sessions={sessions}
              onAgentOverride={setAgentOverride}
              onCloseSession={closeSession}
              onCreateDefaultSession={createDefaultSession}
              onSelectSession={selectSession}
            />
          </>
        )}
      </section>
    </>
  );
}

function attachTerminalKeys(
  terminal: Terminal,
  sessionId: string,
  handlers: {
    clearTerminal: (sessionId: string) => void;
    copyTerminalSelection: (sessionId: string) => Promise<void>;
    pasteClipboardText: (sessionId: string) => Promise<void>;
  },
) {
  terminal.attachCustomKeyEventHandler((event) => {
    if (event.type !== "keydown") {
      return true;
    }

    const key = event.key.toLowerCase();
    if (event.ctrlKey && !event.altKey && !event.metaKey && key === "l") {
      event.preventDefault();
      handlers.clearTerminal(sessionId);
      return false;
    }

    if (event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey && key === "c") {
      event.preventDefault();
      void handlers.copyTerminalSelection(sessionId);
      return false;
    }

    if (event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey && key === "v") {
      event.preventDefault();
      void handlers.pasteClipboardText(sessionId);
      return false;
    }

    return true;
  });
}

function createTerminal(
  TerminalConstructor: TerminalModules["Terminal"],
  sessionId: string,
  name: string,
  appearance: TerminalProfileAppearance | null,
  theme: ThemeMode,
  hasBackgroundImage: boolean,
  canWrite: () => boolean,
) {
  let warnedReadonly = false;
  const terminal = new TerminalConstructor({
    allowTransparency: true,
    cursorBlink: true,
    convertEol: true,
    fontFamily: formatTerminalFontFamily(appearance?.fontFamily),
    fontSize: terminalFontSize(appearance?.fontSize),
    fontWeight: terminalFontWeight(appearance?.fontWeight),
    lineHeight: terminalLineHeight(appearance?.lineHeight),
    scrollback: 10_000,
    theme: terminalTheme(appearance, theme, hasBackgroundImage),
  });

  terminal.writeln(`WrapX M2 Session: ${name}`);
  terminal.writeln("Starting pwsh.exe...");
  terminal.onData((data) => {
    if (!canWrite()) {
      if (!warnedReadonly) {
        terminal.writeln("\r\n[wrapx] session has exited. Create a new session to continue.");
        warnedReadonly = true;
      }
      return;
    }

    warnedReadonly = false;
    void invoke("pty_write", { sessionId, data }).catch((error) => {
      terminal.writeln(`\r\n[wrapx] write failed: ${String(error)}`);
    });
  });

  return terminal;
}

function applyTerminalAppearance(
  terminal: Terminal,
  appearance: TerminalProfileAppearance | null,
  theme: ThemeMode,
  hasBackgroundImage: boolean,
) {
  terminal.options.theme = terminalTheme(appearance, theme, hasBackgroundImage);
  terminal.options.fontFamily = formatTerminalFontFamily(appearance?.fontFamily);
  terminal.options.fontSize = terminalFontSize(appearance?.fontSize);
  terminal.options.fontWeight = terminalFontWeight(appearance?.fontWeight);
  terminal.options.lineHeight = terminalLineHeight(appearance?.lineHeight);
}

function terminalTheme(
  appearance: TerminalProfileAppearance | null,
  theme: ThemeMode,
  hasBackgroundImage: boolean,
): TerminalColorTheme {
  const profileTheme = appearance?.theme ?? {};
  const appTheme = hasBackgroundImage
    ? DARK_TERMINAL_THEME
    : theme === "dark"
      ? DARK_TERMINAL_THEME
      : LIGHT_TERMINAL_THEME;

  return {
    ...profileTheme,
    ...appTheme,
    ...(hasBackgroundImage ? { background: "rgba(0, 0, 0, 0)" } : {}),
  };
}

function terminalFontSize(fontSize?: number) {
  return typeof fontSize === "number" &&
    Number.isFinite(fontSize) &&
    fontSize >= MIN_TERMINAL_FONT_SIZE &&
    fontSize <= MAX_TERMINAL_FONT_SIZE
    ? fontSize
    : DEFAULT_TERMINAL_FONT_SIZE;
}

function terminalLineHeight(lineHeight?: number) {
  return typeof lineHeight === "number" &&
    Number.isFinite(lineHeight) &&
    lineHeight >= MIN_TERMINAL_LINE_HEIGHT &&
    lineHeight <= MAX_TERMINAL_LINE_HEIGHT
    ? lineHeight
    : DEFAULT_TERMINAL_LINE_HEIGHT;
}

function terminalFontWeight(fontWeight?: string): TerminalFontWeight {
  if (!fontWeight) {
    return undefined;
  }

  const normalizedFontWeight = fontWeight.trim().toLowerCase();
  if (normalizedFontWeight === "normal" || normalizedFontWeight === "bold") {
    return normalizedFontWeight;
  }

  const numericFontWeight = Number(normalizedFontWeight);
  if (Number.isInteger(numericFontWeight) && numericFontWeight >= 100 && numericFontWeight <= 900) {
    return numericFontWeight as TerminalFontWeight;
  }

  return undefined;
}

function formatTerminalFontFamily(fontFamily?: string) {
  const preferredFont = fontFamily?.trim() || DEFAULT_TERMINAL_FONT_FAMILY;
  const fontFamilies = preferredFont.includes(",")
    ? preferredFont.split(",").map((font) => font.trim()).filter(Boolean)
    : [preferredFont];
  return uniqueFontFamilies([...fontFamilies, ...TERMINAL_FONT_FALLBACKS]).map(quoteFontFamily).join(", ");
}

function uniqueFontFamilies(fontFamilies: string[]) {
  const seen = new Set<string>();
  return fontFamilies.filter((fontFamily) => {
    const normalized = fontFamily.replace(/^['\"]|['\"]$/g, "").toLowerCase();
    if (seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

function quoteFontFamily(fontFamily: string) {
  if (!fontFamily.includes(" ") || (fontFamily.startsWith('"') && fontFamily.endsWith('"'))) {
    return fontFamily;
  }

  return `"${fontFamily.replace(/"/g, '\\"')}"`;
}

function statusFromAgentKind(agentKind: AgentKind): SessionStatus {
  if (agentKind === "none") {
    return "shell";
  }

  if (agentKind === "unknown") {
    return "unknown";
  }

  return "running";
}

function canAgentDetectionSetStatus(status: SessionStatus, agentKind: AgentKind) {
  if (status === "starting" || status === "unknown") {
    return true;
  }

  return status === "shell" && agentKind !== "none";
}

function isTerminalSessionStatus(status: SessionStatus) {
  return status === "exited" || status === "closed";
}

function isLiveSessionStatus(status: SessionStatus) {
  return !isTerminalSessionStatus(status);
}
