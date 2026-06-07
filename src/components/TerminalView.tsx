import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef, useState } from "react";
import { Sidebar } from "./Sidebar";
import type { Session } from "../types/session";

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

type TerminalRuntime = {
  terminal: Terminal;
  fitAddon: FitAddon;
};

const DEFAULT_CWD = "E:\\Code-All\\wrapx";
const MAX_LIVE_SESSIONS = 8;

export function TerminalView() {
  const hostsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const terminalRuntimesRef = useRef(new Map<string, TerminalRuntime>());
  const sessionsRef = useRef<Session[]>([]);
  const activeSessionIdRef = useRef<string | null>(null);
  const appCloseInProgressRef = useRef(false);
  const closedSessionIdsRef = useRef(new Set<string>());
  const sessionCounterRef = useRef(1);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null;

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

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
    const appWindow = getCurrentWindow();

    void appWindow.onCloseRequested(async (event) => {
      if (appCloseInProgressRef.current) {
        return;
      }

      const activeSessions = sessionsRef.current.filter(
        (session) => session.status === "starting" || session.status === "running",
      );
      if (activeSessions.length === 0) {
        return;
      }

      event.preventDefault();
      const label = activeSessions.length === 1 ? activeSessions[0].name : `${activeSessions.length} sessions`;
      if (!window.confirm(`Close WrapX and terminate ${label}?`)) {
        focusActiveTerminal();
        return;
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
        await invoke("pty_close_all");
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
        return;
      }

      await appWindow.destroy();
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
      updateSession(sessionId, {
        status: "running",
        statusMessage: "output received",
        lastActivityAt: new Date().toISOString(),
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
      status: "starting",
      statusMessage: "starting pwsh.exe...",
      createdAt: now,
      lastActivityAt: now,
    };

    const terminal = createTerminal(sessionId, name, () => canWriteToSession(sessionId));
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminalRuntimesRef.current.set(sessionId, { terminal, fitAddon });

    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown") {
        return true;
      }

      const key = event.key.toLowerCase();
      if (event.ctrlKey && !event.altKey && !event.metaKey && key === "l") {
        event.preventDefault();
        clearTerminal(sessionId);
        return false;
      }

      if (event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey && key === "c") {
        event.preventDefault();
        void copyTerminalSelection(sessionId);
        return false;
      }

      if (event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey && key === "v") {
        event.preventDefault();
        void pasteClipboardText(sessionId);
        return false;
      }

      return true;
    });

    replaceSessions([...sessionsRef.current, session]);
    setActiveSession(sessionId);

    requestAnimationFrame(async () => {
      const host = hostsRef.current[sessionId];
      const runtime = terminalRuntimesRef.current.get(sessionId);
      if (!host || !runtime || !hasSession(sessionId) || closedSessionIdsRef.current.has(sessionId)) {
        return;
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
          status: "running",
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
      (session) => session.id === sessionId && session.status === "running",
    );
  }

  function updateSession(sessionId: string, patch: Partial<Session>) {
    let changed = false;
    const nextSessions = sessionsRef.current.map((session) => {
      if (session.id !== sessionId) {
        return session;
      }

      changed = true;
      return { ...session, ...patch };
    });

    if (changed) {
      replaceSessions(nextSessions);
    }
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

  return (
    <section className="workspace-card">
      <section className="terminal-card">
        <div className="terminal-titlebar">
          <div className="window-controls" aria-hidden="true">
            <span className="window-dot is-red" />
            <span className="window-dot is-yellow" />
            <span className="window-dot is-green" />
          </div>
          <div className="terminal-title-main">
            <span className="terminal-project">WrapX</span>
            <span className="terminal-branch">main</span>
          </div>
          <span className={`terminal-pill is-${activeSession?.status ?? "idle"}`}>
            {activeSession ? activeSession.status : "idle"}
          </span>
        </div>

        <div className="terminal-subbar">
          <span>{activeSession?.name ?? "No active session"}</span>
          <span>
            {activeSession?.statusMessage ??
              "Create a session from the Sessions panel."}
          </span>
          <div className="terminal-actions">
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
        onCloseSession={closeSession}
        onCreateSession={createSession}
        onSelectSession={selectSession}
      />
    </section>
  );
}

function createTerminal(sessionId: string, name: string, canWrite: () => boolean) {
  let warnedReadonly = false;
  const terminal = new Terminal({
    cursorBlink: true,
    convertEol: true,
    fontFamily: 'Cascadia Mono, Consolas, "Courier New", monospace',
    fontSize: 14,
    scrollback: 10_000,
    theme: {
      background: "#05070a",
      foreground: "#f6f7fb",
    },
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
