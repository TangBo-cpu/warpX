mod commands;
mod process_inspector;
mod pty_manager;
mod status_detector;
mod terminal_appearance;

fn main() {
    tauri::Builder::default()
        .manage(pty_manager::PtyState::default())
        .manage(status_detector::StatusDetectorState::default())
        .setup(|app| {
            process_inspector::spawn_agent_detector(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::pty_start,
            commands::pty_write,
            commands::pty_resize,
            commands::pty_close,
            commands::pty_close_all,
            commands::terminal_profile_appearance,
            commands::app_exit,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run WrapX");
}
