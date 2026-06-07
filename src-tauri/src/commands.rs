use crate::pty_manager::PtyState;
use serde::{Deserialize, Serialize};
use std::io::Read;
use std::path::PathBuf;
use std::thread;
use tauri::{AppHandle, Emitter, State};

const PRIMARY_SESSION_ID: &str = "primary";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartPtyOptions {
    cwd: String,
    cols: u16,
    rows: u16,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PtyStarted {
    session_id: &'static str,
    pid: Option<u32>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PtyOutput {
    session_id: &'static str,
    data: Vec<u8>,
}

#[tauri::command]
pub fn pty_start(
    app: AppHandle,
    state: State<'_, PtyState>,
    options: StartPtyOptions,
) -> Result<PtyStarted, String> {
    let started = state.start(PathBuf::from(options.cwd.trim()), options.cols, options.rows)?;
    let pid = started.pid;
    spawn_output_reader(app, started.reader);

    Ok(PtyStarted {
        session_id: PRIMARY_SESSION_ID,
        pid,
    })
}

#[tauri::command]
pub fn pty_write(state: State<'_, PtyState>, data: String) -> Result<(), String> {
    state.write(&data)
}

#[tauri::command]
pub fn pty_resize(state: State<'_, PtyState>, cols: u16, rows: u16) -> Result<(), String> {
    state.resize(cols, rows)
}

#[tauri::command]
pub fn pty_close(state: State<'_, PtyState>) -> Result<(), String> {
    state.close()
}

fn spawn_output_reader(app: AppHandle, mut reader: Box<dyn Read + Send>) {
    thread::spawn(move || {
        let mut buffer = [0_u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(read) => {
                    let payload = PtyOutput {
                        session_id: PRIMARY_SESSION_ID,
                        data: buffer[..read].to_vec(),
                    };
                    if app.emit("pty-output", payload).is_err() {
                        break;
                    }
                }
                Err(error) => {
                    let payload = PtyOutput {
                        session_id: PRIMARY_SESSION_ID,
                        data: format!("\r\n[wrapx] PTY read failed: {error}\r\n").into_bytes(),
                    };
                    let _ = app.emit("pty-output", payload);
                    break;
                }
            }
        }
    });
}
