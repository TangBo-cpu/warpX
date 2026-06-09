import { useEffect, useRef, useState } from "react";

type ThemeMode = "light" | "dark";

type AppMenuProps = {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenAppearance: () => void;
};

export function AppMenu({ theme, onToggleTheme, onOpenAppearance }: AppMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  function openAppearance() {
    setOpen(false);
    onOpenAppearance();
  }

  function toggleTheme() {
    setOpen(false);
    onToggleTheme();
  }

  return (
    <header className="app-topbar">
      <div ref={menuRef} className="app-menu">
        <button
          aria-expanded={open}
          aria-haspopup="menu"
          className="app-menu-trigger"
          type="button"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="app-menu-icon" aria-hidden="true">☰</span>
          <span>WrapX</span>
          <span aria-hidden="true">⌄</span>
        </button>

        {open ? (
          <div className="app-menu-popover" role="menu">
            <button role="menuitem" type="button" onClick={openAppearance}>
              Appearance...
            </button>
            <button role="menuitem" type="button" onClick={toggleTheme}>
              {theme === "light" ? "Switch to dark" : "Switch to light"}
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
