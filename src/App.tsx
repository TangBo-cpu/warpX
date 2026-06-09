import { useState } from "react";
import { TerminalView } from "./components/TerminalView";

type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "wrapx-theme";

function getInitialTheme(): ThemeMode {
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return storedTheme === "dark" || storedTheme === "light" ? storedTheme : "light";
}

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  function toggleTheme() {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === "light" ? "dark" : "light";
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      return nextTheme;
    });
  }

  return (
    <main className="app-shell" data-theme={theme}>
      <TerminalView theme={theme} onToggleTheme={toggleTheme} />
    </main>
  );
}
