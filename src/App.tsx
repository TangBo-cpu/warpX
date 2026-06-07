import { TerminalView } from "./components/TerminalView";

export default function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">WrapX M1</p>
          <h1>Single Terminal</h1>
        </div>
        <p className="status-note">
          One embedded pwsh.exe terminal. No sidebar, sessions, status detection, or storage yet.
        </p>
      </header>
      <TerminalView />
    </main>
  );
}
