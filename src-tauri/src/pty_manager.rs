use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::env;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::Mutex;

#[cfg(windows)]
use std::mem;
#[cfg(windows)]
use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
#[cfg(windows)]
use windows_sys::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
    TH32CS_SNAPPROCESS,
};
#[cfg(windows)]
use windows_sys::Win32::System::Threading::{OpenProcess, TerminateProcess, PROCESS_TERMINATE};

#[derive(Default)]
pub struct PtyState {
    session: Mutex<Option<PtySession>>,
}

pub struct StartedPty {
    pub pid: Option<u32>,
    pub reader: Box<dyn Read + Send>,
}

struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send>,
}

impl PtySession {
    fn kill(&mut self) {
        if let Some(pid) = self.child.process_id() {
            kill_process_tree(pid);
        }
        let _ = self.child.kill();
    }
}

impl PtyState {
    pub fn start(&self, cwd: PathBuf, cols: u16, rows: u16) -> Result<StartedPty, String> {
        if cwd.as_os_str().is_empty() {
            return Err("cwd is required".to_string());
        }
        if !cwd.is_dir() {
            return Err(format!("cwd does not exist: {}", cwd.display()));
        }

        let shell = resolve_pwsh()?;
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: rows.max(1),
                cols: cols.max(1),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(to_error_string)?;

        let mut command = CommandBuilder::new(shell);
        command.cwd(cwd);

        let child = pair
            .slave
            .spawn_command(command)
            .map_err(|error| format!("failed to start pwsh.exe: {error}"))?;
        let pid = child.process_id();
        let reader = pair.master.try_clone_reader().map_err(to_error_string)?;
        let writer = pair.master.take_writer().map_err(to_error_string)?;

        let session = PtySession {
            master: pair.master,
            writer,
            child,
        };

        let mut guard = self
            .session
            .lock()
            .map_err(|_| "PTY state lock poisoned".to_string())?;
        if let Some(mut existing) = guard.take() {
            existing.kill();
        }
        *guard = Some(session);

        Ok(StartedPty { pid, reader })
    }

    pub fn write(&self, data: &str) -> Result<(), String> {
        let mut guard = self
            .session
            .lock()
            .map_err(|_| "PTY state lock poisoned".to_string())?;
        let session = guard
            .as_mut()
            .ok_or_else(|| "PTY session is not running".to_string())?;

        session
            .writer
            .write_all(data.as_bytes())
            .and_then(|_| session.writer.flush())
            .map_err(to_error_string)
    }

    pub fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        let guard = self
            .session
            .lock()
            .map_err(|_| "PTY state lock poisoned".to_string())?;
        let session = guard
            .as_ref()
            .ok_or_else(|| "PTY session is not running".to_string())?;

        session
            .master
            .resize(PtySize {
                rows: rows.max(1),
                cols: cols.max(1),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(to_error_string)
    }

    pub fn close(&self) -> Result<(), String> {
        let mut guard = self
            .session
            .lock()
            .map_err(|_| "PTY state lock poisoned".to_string())?;
        if let Some(mut session) = guard.take() {
            session.kill();
        }

        Ok(())
    }
}

fn resolve_pwsh() -> Result<PathBuf, String> {
    let program = if cfg!(windows) { "pwsh.exe" } else { "pwsh" };
    let path = env::var_os("PATH").ok_or_else(|| {
        format!("{program} was not found because PATH is not set. Install PowerShell 7 or add {program} to PATH.")
    })?;

    for directory in env::split_paths(&path) {
        let candidate = directory.join(program);
        if candidate.is_file() {
            return Ok(candidate);
        }
    }

    Err(format!(
        "{program} was not found on PATH. Install PowerShell 7 or add {program} to PATH."
    ))
}

fn to_error_string(error: impl std::fmt::Display) -> String {
    error.to_string()
}

#[cfg(windows)]
pub(crate) fn kill_process_tree(root_pid: u32) {
    let mut descendants = collect_descendants(root_pid);
    descendants.reverse();

    for pid in descendants {
        terminate_pid(pid);
    }
    terminate_pid(root_pid);
}

#[cfg(windows)]
fn collect_descendants(root_pid: u32) -> Vec<u32> {
    let mut parent_child_pairs = Vec::new();

    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot == INVALID_HANDLE_VALUE {
            return Vec::new();
        }

        let mut entry: PROCESSENTRY32W = mem::zeroed();
        entry.dwSize = mem::size_of::<PROCESSENTRY32W>() as u32;

        if Process32FirstW(snapshot, &mut entry) != 0 {
            loop {
                parent_child_pairs.push((entry.th32ParentProcessID, entry.th32ProcessID));
                if Process32NextW(snapshot, &mut entry) == 0 {
                    break;
                }
            }
        }

        CloseHandle(snapshot);
    }

    let mut descendants = Vec::new();
    let mut stack = vec![root_pid];

    while let Some(parent) = stack.pop() {
        for (candidate_parent, child) in parent_child_pairs.iter().copied() {
            if candidate_parent == parent && child != root_pid && !descendants.contains(&child) {
                descendants.push(child);
                stack.push(child);
            }
        }
    }

    descendants
}

#[cfg(windows)]
fn terminate_pid(pid: u32) {
    unsafe {
        let handle = OpenProcess(PROCESS_TERMINATE, 0, pid);
        if !handle.is_null() {
            let _ = TerminateProcess(handle, 1);
            CloseHandle(handle);
        }
    }
}

#[cfg(not(windows))]
pub(crate) fn kill_process_tree(_root_pid: u32) {}
