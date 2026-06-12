use tauri::AppHandle;

/// Initialize the SQLite database with all migrations on first launch.
/// Called once at app startup.
pub async fn initialize(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // The actual schema initialization is handled by the TypeScript migration
    // system via tauri-plugin-sql. This Rust function handles any native-side
    // initialization needed before the frontend boots.
    let _ = app;
    Ok(())
}
