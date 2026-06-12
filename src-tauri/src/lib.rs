use tauri::Manager;

mod commands;
mod db;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // Bring existing window to focus if another instance is launched
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            commands::ai::stream_ollama,
            commands::ai::fetch_ollama_models,
            commands::ai::pull_ollama_model,
            commands::files::read_file_bytes,
            commands::files::write_file_bytes,
            commands::files::get_app_data_dir,
            commands::audio::start_recording,
            commands::audio::stop_recording,
            commands::notifications::schedule_notification,
            commands::notifications::cancel_notification,
        ])
        .setup(|app| {
            // Initialize database on first launch
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = db::initialize(&app_handle).await {
                    eprintln!("Failed to initialize database: {}", e);
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running StudyOS application");
}
