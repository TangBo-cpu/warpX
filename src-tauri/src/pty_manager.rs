use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::Mutex;

#[cfg(windows)]
use std::mem;
#[cfg(windows)]
use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
#[cfg(windows)]
use windows_sys::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS,
};
#[cfg(windows)]
use windows_sys::Win32::System::Threading::{OpenProcess, TerminateProcess, PROCESS_TERMINATE};

#[derive(Default)]
pub struct PtyState {
    sessions: Mutex<HashMap<String, PtySession>>,
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
    pub fn start(
        &self,
        session_id: String,
        cwd: PathBuf,
        cols: u16,
        rows: u16,
    ) -> Result<StartedPty, String> {
        if session_id.trim().is_empty() {
            return Err("session id is required".to_string());
        }
        if !cwd.is_dir() {
            return Err(format!("cwd does not exist: {}", cwd.display()));
        }

        let mut guard = self
            .sessions
            .lock()
            .map_err(|_| "PTY state lock poisoned".to_string())?;
        if guard.contains_key(&session_id) {
            return Err(format!("PTY session already exists: {session_id}"));
        }

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: rows.max(1),
                cols: cols.max(1),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(to_error_string)?;

        let mut command = CommandBuilder::new("pwsh.exe");
        command.cwd(cwd);

        let child = pair.slave.spawn_command(command).map_err(to_error_string)?;
        let pid = child.process_id();
        let reader = pair.master.try_clone_reader().map_err(to_error_string)?;
        let writer = pair.master.take_writer().map_err(to_error_string)?;

        guard.insert(
            session_id,
            PtySession {
                master: pair.master,
                writer,
                child,
            },
        );

        Ok(StartedPty { pid, reader })
    }

    pub fn write(&self, session_id: &str, data: &str) -> Result<(), String> {
        let mut guard = self
            .sessions
            .lock()
            .map_err(|_| "PTY state lock poisoned".to_string())?;
        let session = guard
            .get_mut(session_id)
            .ok_or_else(|| format!("PTY session is not running: {session_id}"))?;

        session
            .writer
            .write_all(data.as_bytes())
            .and_then(|_| session.writer.flush())
            .map_err(to_error_string)
    }

    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let guard = self
            .sessions
            .lock()
            .map_err(|_| "PTY state lock poisoned".to_string())?;
        let session = guard
            .get(session_id)
            .ok_or_else(|| format!("PTY session is not running: {session_id}"))?;

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

    pub fn close(&self, session_id: &str) -> Result<(), String> {
        let mut guard = self
            .sessions
            .lock()
            .map_err(|_| "PTY state lock poisoned".to_string())?;
        if let Some(mut session) = guard.remove(session_id) {
            session.kill();
        }

        Ok(())
    }

    pub fn close_all(&self) -> Result<Vec<String>, String> {
        let mut guard = self
            .sessions
            .lock()
            .map_err(|_| "PTY state lock poisoned".to_string())?;
        let mut sessions = guard.drain().collect::<Vec<_>>();
        drop(guard);

        let session_ids = sessions
            .iter()
            .map(|(session_id, _)| session_id.clone())
            .collect();
        for (_, session) in sessions.iter_mut() {
            session.kill();
        }

        Ok(session_ids)
    }

    pub fn forget(&self, session_id: &str) -> Result<bool, String> {
        let mut guard = self
            .sessions
            .lock()
            .map_err(|_| "PTY state lock poisoned".to_string())?;
        Ok(guard.remove(session_id).is_some())
    }

    pub fn is_exited(&self, session_id: &str) -> Result<Option<bool>, String> {
        let mut guard = self
            .sessions
            .lock()
            .map_err(|_| "PTY state lock poisoned".to_string())?;
        let Some(session) = guard.get_mut(session_id) else {
            return Ok(None);
        };

        session
            .child
            .try_wait()
            .map(|status| Some(status.is_some()))
            .map_err(to_error_string)
    }
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
