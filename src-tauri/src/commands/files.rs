use std::path::PathBuf;
use tauri::Manager;
use base64::{engine::general_purpose, Engine as _};

#[tauri::command]
pub async fn read_file_bytes(path: String) -> Result<String, String> {
    let bytes = tokio::fs::read(&path)
        .await
        .map_err(|e| format!("Failed to read file '{}': {}", path, e))?;
    Ok(general_purpose::STANDARD.encode(bytes))
}

#[tauri::command]
pub async fn write_file_bytes(path: String, data: String) -> Result<(), String> {
    let bytes = general_purpose::STANDARD
        .decode(&data)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    
    // Ensure parent directory exists
    if let Some(parent) = PathBuf::from(&path).parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create directories: {}", e))?;
    }
    
    tokio::fs::write(&path, bytes)
        .await
        .map_err(|e| format!("Failed to write file '{}': {}", path, e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn get_app_data_dir(app_handle: tauri::AppHandle) -> Result<String, String> {
    app_handle
        .path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| format!("Failed to get app data dir: {}", e))
}
