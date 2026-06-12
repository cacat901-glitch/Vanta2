use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct NotificationPayload {
    pub id: String,
    pub title: String,
    pub body: String,
    pub schedule_at: Option<String>, // ISO 8601
    pub action_url: Option<String>,
}

#[tauri::command]
pub async fn schedule_notification(
    payload: NotificationPayload,
) -> Result<(), String> {
    // Full implementation uses tauri-plugin-notification with scheduling
    // For now, this is a placeholder - the web layer handles scheduling via
    // the NotificationAdapter
    let _ = payload;
    Ok(())
}

#[tauri::command]
pub async fn cancel_notification(id: String) -> Result<(), String> {
    let _ = id;
    Ok(())
}
