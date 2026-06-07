mod commands;
mod pty_manager;

fn main() {
    tauri::Builder::default()
        .manage(pty_manager::PtyState::default())
        .invoke_handler(tauri::generate_handler![
            commands::pty_start,
            commands::pty_write,
            commands::pty_resize,
            commands::pty_close,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run WrapX");
}
