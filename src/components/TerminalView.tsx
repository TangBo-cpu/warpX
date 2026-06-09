import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";
import { useEffect, useRef, useState } from "react";
import { Sidebar } from "./Sidebar";
import {
  AGENT_DISPLAY,
  STATUS_DISPLAY,
  formatSessionActivityAge,
  getSessionCwdLabel,
  getSessionStatusMessage,
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

type ThemeMode = "light" | "dark";

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

type TerminalViewProps = {
  theme: ThemeMode;
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

export function TerminalView({ theme, onToggleTheme }: TerminalViewProps) {
  const hostsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const terminalRuntimesRef = useRef(new Map<string, TerminalRuntime>());
  const sessionsRef = useRef<Session[]>([]);
  const activeSessionIdRef = useRef<string | null>(null);
  const terminalAppearanceRef = useRef<TerminalProfileAppearance | null>(null);
  const appCloseInProgressRef = useRef(false);
  const closedSessionIdsRef = useRef(new Set<string>());
  const sessionCounterRef = useRef(1);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [terminalAppearance, setTerminalAppearance] = useState<TerminalProfileAppearance | null>(null);
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null;

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

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
      applyTerminalAppearance(terminal, terminalAppearance);
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
    const resize = () => {
      const sessionId = activeSessionIdRef.current;
      if (sessionId) {
        fitAndResize(sessionId);
      }
    };

    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
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

          const terminal = createTerminal(Terminal, sessionId, name, terminalAppearanceRef.current, () => canWriteToSession(sessionId));
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

  const activeAgent = activeSession ? AGENT_DISPLAY[activeSession.agentKind] : null;
  const activeStatus = activeSession ? STATUS_DISPLAY[activeSession.status] : null;
  const activeAge = activeSession ? formatSessionActivityAge(activeSession) : undefined;
  const activeCwd = activeSession ? getSessionCwdLabel(activeSession.cwd) : "No session";
  const activeMessage = activeSession
    ? getSessionStatusMessage(activeSession)
    : "Create a session from the Sessions panel.";

  return (
    <section className="workspace-card">
      <section className="terminal-card">
        <div className={`terminal-status-widget is-${activeSession?.status ?? "idle"}`}>
          <span className={`terminal-status-glyph is-${activeSession?.agentKind ?? "none"}`} aria-hidden="true">
            {activeAgent?.glyph ?? ">"}
          </span>
          <span className="terminal-status-copy">
            <span className="terminal-status-line">
              <strong>{activeSession?.name ?? "No active session"}</strong>
              <span>{activeCwd}</span>
              <span>{activeAgent?.label ?? "PowerShell"}</span>
              <span>{activeStatus?.label ?? "Idle"}</span>
            </span>
            <span className="terminal-status-message">{activeMessage}</span>
          </span>
          {activeAge ? <span className="terminal-status-age">{activeAge}</span> : null}
          <div className="terminal-actions">
            <button type="button" className="theme-toggle" onClick={onToggleTheme}>
              {theme === "light" ? "Dark" : "Light"}
            </button>
            <button disabled={!activeSession} type="button" onClick={clearActiveTerminal}>
              Clear
            </button>
            <button disabled={!activeSession} type="button" onClick={copyActiveSelection}>
              Copy
            </button>
            <button disabled={!activeSession} type="button" onClick={pasteActiveClipboard}>
              Paste
            </button>
          </div>
        </div>

        <div className="terminal-host-stack">
          {sessions.length === 0 ? (
            <div className="empty-terminal">
              <p>New Session starts a real pwsh.exe terminal.</p>
              <p>Each session keeps its own PTY and xterm.js instance.</p>
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

      <Sidebar
        activeSessionId={activeSessionId}
        defaultCwd={DEFAULT_CWD}
        disabled={sessions.length >= MAX_LIVE_SESSIONS}
        nextSessionNumber={sessionCounterRef.current}
        sessions={sessions}
        onAgentOverride={setAgentOverride}
        onCloseSession={closeSession}
        onCreateSession={createSession}
        onSelectSession={selectSession}
      />
    </section>
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
  canWrite: () => boolean,
) {
  let warnedReadonly = false;
  const terminal = new TerminalConstructor({
    cursorBlink: true,
    convertEol: true,
    fontFamily: formatTerminalFontFamily(appearance?.fontFamily),
    fontSize: terminalFontSize(appearance?.fontSize),
    fontWeight: terminalFontWeight(appearance?.fontWeight),
    lineHeight: terminalLineHeight(appearance?.lineHeight),
    scrollback: 10_000,
    theme: terminalTheme(appearance),
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

function applyTerminalAppearance(terminal: Terminal, appearance: TerminalProfileAppearance) {
  terminal.options.theme = terminalTheme(appearance);
  terminal.options.fontFamily = formatTerminalFontFamily(appearance.fontFamily);
  terminal.options.fontSize = terminalFontSize(appearance.fontSize);
  terminal.options.fontWeight = terminalFontWeight(appearance.fontWeight);
  terminal.options.lineHeight = terminalLineHeight(appearance.lineHeight);
}

function terminalTheme(appearance: TerminalProfileAppearance | null): TerminalColorTheme {
  const theme = appearance?.theme ?? {};

  return {
    ...theme,
    background: theme.background ?? "#05070a",
    foreground: theme.foreground ?? "#f6f7fb",
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
