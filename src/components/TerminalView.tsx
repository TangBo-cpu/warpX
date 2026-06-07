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
  const startedRef = useRef(false);
  const [cwd, setCwd] = useState(DEFAULT_CWD);
  const [started, setStarted] = useState(false);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    startedRef.current = started;
  }, [started]);

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

    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown") {
        return true;
      }

      const key = event.key.toLowerCase();
      if (event.ctrlKey && !event.altKey && !event.metaKey && key === "l") {
        event.preventDefault();
        clearTerminalScreen(terminal);
        return false;
      }

      if (event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey && key === "c") {
        event.preventDefault();
        void copyTerminalSelection(terminal);
        return false;
      }

      if (event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey && key === "v") {
        event.preventDefault();
        void pasteClipboardText(terminal);
        return false;
      }

      return true;
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
    if (started && !window.confirm("Close this PowerShell session and kill its process tree?")) {
      terminal?.focus();
      return;
    }

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

  function clearTerminal() {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }

    clearTerminalScreen(terminal);
    terminal.focus();
  }

  function clearTerminalScreen(terminal: Terminal) {
    terminal.clear();
    if (startedRef.current) {
      void invoke("pty_write", { data: "\f" }).catch((error) => {
        terminal.writeln(`\r\n[wrapx] clear failed: ${String(error)}`);
        setStatus("clear failed");
      });
    }
    setStatus("screen cleared");
  }

  async function copySelection() {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }

    await copyTerminalSelection(terminal);
    terminal.focus();
  }

  async function copyTerminalSelection(terminal: Terminal) {
    const selection = terminal.getSelection();
    if (!selection) {
      setStatus("nothing selected");
      return;
    }

    if (!navigator.clipboard?.writeText) {
      setStatus("clipboard unavailable");
      terminal.writeln("\r\n[wrapx] clipboard copy is unavailable in this WebView.");
      return;
    }

    try {
      await navigator.clipboard.writeText(selection);
      setStatus("copied selection");
    } catch (error) {
      setStatus("copy failed");
      terminal.writeln(`\r\n[wrapx] copy failed: ${String(error)}`);
    }
  }

  async function pasteClipboard() {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }

    await pasteClipboardText(terminal);
    terminal.focus();
  }

  async function pasteClipboardText(terminal: Terminal) {
    if (!navigator.clipboard?.readText) {
      setStatus("clipboard unavailable");
      terminal.writeln("\r\n[wrapx] clipboard paste is unavailable in this WebView.");
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        setStatus("clipboard empty");
        return;
      }

      terminal.paste(text);
      setStatus("pasted clipboard");
    } catch (error) {
      setStatus("paste failed");
      terminal.writeln(`\r\n[wrapx] paste failed: ${String(error)}`);
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
        <div className="terminal-actions">
          <button type="button" onClick={clearTerminal}>
            Clear
          </button>
          <button type="button" onClick={copySelection}>
            Copy
          </button>
          <button type="button" onClick={pasteClipboard}>
            Paste
          </button>
        </div>
        <span className="terminal-status">{status}</span>
      </div>
      <div ref={hostRef} className="terminal-host" />
    </section>
  );
}
