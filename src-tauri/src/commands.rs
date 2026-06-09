use crate::pty_manager::PtyState;
use crate::status_detector::StatusDetectorState;
use crate::terminal_appearance::{load_windows_terminal_appearance, TerminalProfileAppearance};
use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartPtyOptions {
    session_id: String,
    cwd: String,
    cols: u16,
    rows: u16,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PtyStarted {
    session_id: String,
    pid: Option<u32>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PtyOutput {
    session_id: String,
    data: Vec<u8>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PtyLifecycleEvent {
    session_id: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImportedBackgroundImage {
    path: String,
}

#[tauri::command]
pub fn pty_start(
    app: AppHandle,
    state: State<'_, PtyState>,
    options: StartPtyOptions,
) -> Result<PtyStarted, String> {
    let session_id = options.session_id.trim().to_string();
    let started = state.start(
        session_id.clone(),
        PathBuf::from(options.cwd.trim()),
        options.cols,
        options.rows,
    )?;
    let pid = started.pid;
    spawn_output_reader(app.clone(), session_id.clone(), started.reader);
    spawn_exit_watcher(app, session_id.clone());

    Ok(PtyStarted { session_id, pid })
}

#[tauri::command]
pub fn pty_write(
    state: State<'_, PtyState>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    state.write(&session_id, &data)
}

#[tauri::command]
pub fn pty_resize(
    state: State<'_, PtyState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    state.resize(&session_id, cols, rows)
}

#[tauri::command]
pub fn pty_close(
    app: AppHandle,
    state: State<'_, PtyState>,
    session_id: String,
) -> Result<(), String> {
    state.close(&session_id)?;
    app.state::<StatusDetectorState>().forget(&session_id);
    let _ = app.emit("pty-closed", PtyLifecycleEvent { session_id });
    Ok(())
}

#[tauri::command]
pub fn pty_close_all(app: AppHandle, state: State<'_, PtyState>) -> Result<Vec<String>, String> {
    let session_ids = state.close_all()?;
    for session_id in session_ids.iter() {
        app.state::<StatusDetectorState>().forget(session_id);
        let _ = app.emit(
            "pty-closed",
            PtyLifecycleEvent {
                session_id: session_id.clone(),
            },
        );
    }
    Ok(session_ids)
}

#[tauri::command]
pub fn terminal_profile_appearance() -> Option<TerminalProfileAppearance> {
    load_windows_terminal_appearance()
}

#[tauri::command]
pub fn appearance_import_background_image(
    file_name: String,
    bytes: Vec<u8>,
) -> Result<ImportedBackgroundImage, String> {
    let extension = image_extension(&file_name)?;
    let backgrounds_dir = appearance_backgrounds_dir()?;
    fs::create_dir_all(&backgrounds_dir)
        .map_err(|error| format!("failed to create backgrounds directory: {error}"))?;

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("system clock error: {error}"))?
        .as_millis();
    let path = backgrounds_dir.join(format!("background-{timestamp}.{extension}"));
    fs::write(&path, bytes).map_err(|error| format!("failed to save background image: {error}"))?;

    Ok(ImportedBackgroundImage {
        path: path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn app_exit(app: AppHandle, state: State<'_, PtyState>) -> Result<(), String> {
    for session_id in state.close_all()? {
        app.state::<StatusDetectorState>().forget(&session_id);
    }
    app.exit(0);
    Ok(())
}

fn appearance_backgrounds_dir() -> Result<PathBuf, String> {
    env::var_os("APPDATA")
        .map(PathBuf::from)
        .map(|app_data| app_data.join("WrapX").join("backgrounds"))
        .ok_or_else(|| "APPDATA is unavailable".to_string())
}

fn image_extension(file_name: &str) -> Result<&'static str, String> {
    let extension = Path::new(file_name)
        .extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_ascii_lowercase)
        .ok_or_else(|| "background image must have an extension".to_string())?;

    match extension.as_str() {
        "png" => Ok("png"),
        "jpg" | "jpeg" => Ok("jpg"),
        "webp" => Ok("webp"),
        _ => Err("supported background formats: png, jpg, jpeg, webp".to_string()),
    }
}

fn spawn_output_reader(app: AppHandle, session_id: String, mut reader: Box<dyn Read + Send>) {
    thread::spawn(move || {
        let mut buffer = [0_u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => {
                    emit_exit_once(&app, &session_id);
                    break;
                }
                Ok(read) => {
                    let data = buffer[..read].to_vec();
                    let payload = PtyOutput {
                        session_id: session_id.clone(),
                        data: data.clone(),
                    };
                    if app.emit("pty-output", payload).is_err() {
                        break;
                    }

                    if let Some(status) = app
                        .state::<StatusDetectorState>()
                        .observe_output(&session_id, &data)
                    {
                        let _ = app.emit("session-status", status);
                    }
                }
                Err(error) => {
                    let payload = PtyOutput {
                        session_id: session_id.clone(),
                        data: format!("\r\n[wrapx] PTY read failed: {error}\r\n").into_bytes(),
                    };
                    let _ = app.emit("pty-output", payload);
                    emit_exit_once(&app, &session_id);
                    break;
                }
            }
        }
    });
}

fn spawn_exit_watcher(app: AppHandle, session_id: String) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_millis(250));
        match app.state::<PtyState>().is_exited(&session_id) {
            Ok(Some(true)) => {
                emit_exit_once(&app, &session_id);
                break;
            }
            Ok(Some(false)) => {}
            Ok(None) | Err(_) => break,
        }
    });
}

fn emit_exit_once(app: &AppHandle, session_id: &str) {
    if app.state::<PtyState>().forget(session_id).unwrap_or(false) {
        app.state::<StatusDetectorState>().forget(session_id);
        let _ = app.emit(
            "pty-exit",
            PtyLifecycleEvent {
                session_id: session_id.to_string(),
            },
        );
    }
}
