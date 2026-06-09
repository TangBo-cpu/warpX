import { FormEvent, useState } from "react";

type NewSessionDialogProps = {
  defaultCwd: string;
  disabled: boolean;
  nextSessionNumber: number;
  onCreate: (name: string, cwd: string) => void;
};

export function NewSessionDialog({
  defaultCwd,
  disabled,
  nextSessionNumber,
  onCreate,
}: NewSessionDialogProps) {
  const [name, setName] = useState("");
  const [cwd, setCwd] = useState(defaultCwd);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) {
      return;
    }

    const fallbackName = `PowerShell ${nextSessionNumber}`;
    onCreate(name.trim() || fallbackName, cwd.trim() || defaultCwd);
    setName("");
  }

  return (
    <form className="new-session-form" onSubmit={submit}>
      <label>
        <span>Session name</span>
        <input
          disabled={disabled}
          placeholder={`PowerShell ${nextSessionNumber}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label>
        <span>Working directory</span>
        <input
          disabled={disabled}
          value={cwd}
          onChange={(event) => setCwd(event.target.value)}
        />
      </label>
      <button disabled={disabled} type="submit">
        New Session
      </button>
    </form>
  );
}
