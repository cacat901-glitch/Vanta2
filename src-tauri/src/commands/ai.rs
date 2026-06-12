use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use futures_util::StreamExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StreamChunk {
    pub text: String,
    pub done: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaModel {
    pub name: String,
    pub size: u64,
    pub modified_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaTagsResponse {
    pub models: Vec<OllamaModel>,
}

/// Stream Ollama chat completions to the frontend via Tauri channels
#[tauri::command]
pub async fn stream_ollama(
    url: String,
    model: String,
    messages: serde_json::Value,
    options: Option<serde_json::Value>,
    on_chunk: Channel<StreamChunk>,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    
    let mut body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": true,
    });
    
    if let Some(opts) = options {
        if let serde_json::Value::Object(ref mut map) = body {
            if let serde_json::Value::Object(opts_map) = opts {
                map.extend(opts_map);
            }
        }
    }

    let response = client
        .post(format!("{}/api/chat", url))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Ollama returned status: {}", response.status()));
    }

    let mut stream = response.bytes_stream();
    
    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Stream error: {}", e))?;
        let text = String::from_utf8_lossy(&chunk);
        
        for line in text.lines() {
            if line.is_empty() {
                continue;
            }
            
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                let done = json.get("done").and_then(|v| v.as_bool()).unwrap_or(false);
                let content = json
                    .get("message")
                    .and_then(|m| m.get("content"))
                    .and_then(|c| c.as_str())
                    .unwrap_or("");
                
                on_chunk
                    .send(StreamChunk {
                        text: content.to_string(),
                        done,
                    })
                    .map_err(|e| format!("Channel send error: {}", e))?;
                
                if done {
                    return Ok(());
                }
            }
        }
    }
    
    on_chunk
        .send(StreamChunk {
            text: String::new(),
            done: true,
        })
        .map_err(|e| format!("Channel send error: {}", e))?;
    
    Ok(())
}

/// Fetch list of locally installed Ollama models
#[tauri::command]
pub async fn fetch_ollama_models(url: String) -> Result<Vec<OllamaModel>, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/tags", url))
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama: {}", e))?;

    let tags: OllamaTagsResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    Ok(tags.models)
}

/// Pull a new Ollama model with progress streaming
#[tauri::command]
pub async fn pull_ollama_model(
    url: String,
    model: String,
    on_progress: Channel<serde_json::Value>,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({ "name": model, "stream": true });
    
    let response = client
        .post(format!("{}/api/pull", url))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to start model pull: {}", e))?;

    let mut stream = response.bytes_stream();
    
    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Stream error: {}", e))?;
        let text = String::from_utf8_lossy(&chunk);
        
        for line in text.lines() {
            if line.is_empty() {
                continue;
            }
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                on_progress
                    .send(json)
                    .map_err(|e| format!("Channel error: {}", e))?;
            }
        }
    }
    
    Ok(())
}
