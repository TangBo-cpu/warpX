import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { FormEvent, useEffect, useRef, useState } from "react";

type PtyOutput = {
  sessionId: string;
  data: number[];
};

type PtyStarted = {
  sessionId: string;
  pid?: number;
};

const DEFAULT_CWD = "E:\\Code-All\\wrapx";

export function TerminalView() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [cwd, setCwd] = useState(DEFAULT_CWD);
  const [started, setStarted] = useState(false);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

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
    const fitAddon = new FitAddon();

    terminal.loadAddon(fitAddon);
    terminal.open(hostRef.current);
    fitAddon.fit();
    terminal.writeln("WrapX M1 Single Terminal");
    terminal.writeln("Click Start pwsh to launch a real PowerShell session.");

    terminal.onData((data) => {
      void invoke("pty_write", { data }).catch((error) => {
        terminal.writeln(`\r\n[wrapx] write failed: ${String(error)}`);
        setStatus("write failed");
      });
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      const { cols, rows } = terminal;
      void invoke("pty_resize", { cols, rows }).catch(() => {
        // Resize before PTY start is expected and harmless for a single terminal.
      });
    });
    resizeObserver.observe(hostRef.current);

    let unlisten: UnlistenFn | undefined;
    void listen<PtyOutput>("pty-output", (event) => {
      terminal.write(Uint8Array.from(event.payload.data));
    }).then((listener) => {
      unlisten = listener;
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    resizeObserverRef.current = resizeObserver;

    return () => {
      void unlisten?.();
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      resizeObserverRef.current = null;
    };
  }, []);

  async function startPty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (!terminal || !fitAddon) {
      return;
    }

    fitAddon.fit();
    setStatus("starting pwsh.exe...");

    try {
      const result = await invoke<PtyStarted>("pty_start", {
        options: {
          cwd,
          cols: terminal.cols,
          rows: terminal.rows,
        },
      });
      setStarted(true);
      setStatus(`running pwsh.exe${result.pid ? ` pid ${result.pid}` : ""}`);
      terminal.focus();
    } catch (error) {
      setStarted(false);
      setStatus("start failed");
      terminal.writeln(`\r\n[wrapx] start failed: ${String(error)}`);
    }
  }

  async function closePty() {
    const terminal = terminalRef.current;
    setStatus("closing...");

    try {
      await invoke("pty_close");
      setStarted(false);
      setStatus("closed");
      terminal?.writeln("\r\n[wrapx] PTY closed.");
    } catch (error) {
      setStatus("close failed");
      terminal?.writeln(`\r\n[wrapx] close failed: ${String(error)}`);
    }
  }

  return (
    <section className="terminal-card">
      <div className="terminal-toolbar">
        <form className="cwd-form" onSubmit={startPty}>
          <input
            aria-label="PowerShell cwd"
            disabled={started}
            value={cwd}
            onChange={(event) => setCwd(event.target.value)}
          />
          <button disabled={started} type="submit">
            Start pwsh
          </button>
          <button disabled={!started} type="button" onClick={closePty}>
            Close
          </button>
        </form>
        <span className="terminal-status">{status}</span>
      </div>
      <div ref={hostRef} className="terminal-host" />
    </section>
  );
}
