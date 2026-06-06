//! Cœur natif PromptForge desktop.
//!
//! Sécurité : les clés d'API sont stockées dans le gestionnaire de secrets de l'OS via
//! `keyring-rs` (Windows Credential Manager / DPAPI). Aucune clé n'est écrite en fichier clair,
//! ni journalisée. Les commandes ci-dessous ne renvoient la valeur qu'à la demande explicite du front.

use std::collections::HashMap;

use futures_util::StreamExt;
use tauri::ipc::Channel;

const SERVICE: &str = "com.promptforge.dev";

/// Événement de flux émis vers le front pour `local_http_request`.
#[derive(Clone, serde::Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum HttpStreamEvent {
    /// Un fragment de corps (texte décodé en UTF-8 lossy).
    Data { chunk: String },
    /// Fin normale du flux.
    End,
    /// Erreur survenue pendant la lecture du corps.
    Error { message: String },
}

/// Métadonnées de la réponse, renvoyées dès réception des en-têtes (avant le corps).
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct HttpResponseMeta {
    status: u16,
    headers: HashMap<String, String>,
}

/// Vrai si l'URL pointe vers un hôte local (modèle local Ollama / LM Studio).
fn is_local_host(url: &str) -> bool {
    reqwest::Url::parse(url)
        .ok()
        .and_then(|u| u.host_str().map(str::to_string))
        .is_some_and(|h| matches!(h.as_str(), "localhost" | "127.0.0.1" | "0.0.0.0"))
}

/// Requête HTTP native (reqwest) réservée aux endpoints LOCAUX, streamée via `Channel`.
///
/// Raison d'être : le plugin-http force l'en-tête `Origin: http://tauri.localhost`, que les
/// versions récentes d'Ollama rejettent (403). reqwest n'ajoute aucun `Origin` → le modèle local
/// fonctionne sans configuration ni variable d'environnement (NF-R1, 100 % hors-ligne).
/// Sécurité : refuse tout hôte non local (pas de proxy ouvert vers l'extérieur).
#[tauri::command]
async fn local_http_request(
    url: String,
    method: String,
    headers: HashMap<String, String>,
    body: Option<String>,
    on_event: Channel<HttpStreamEvent>,
) -> Result<HttpResponseMeta, String> {
    if !is_local_host(&url) {
        return Err("local_http_request : hôte non local refusé".into());
    }

    let method = reqwest::Method::from_bytes(method.as_bytes())
        .map_err(|e| format!("méthode HTTP invalide : {e}"))?;

    let client = reqwest::Client::new();
    let mut builder = client.request(method, &url);
    for (key, value) in &headers {
        builder = builder.header(key, value);
    }
    if let Some(payload) = body {
        builder = builder.body(payload);
    }

    let response = builder.send().await.map_err(|e| e.to_string())?;
    let status = response.status().as_u16();
    let resp_headers = response
        .headers()
        .iter()
        .map(|(name, value)| (name.as_str().to_string(), value.to_str().unwrap_or("").to_string()))
        .collect::<HashMap<_, _>>();

    // Le corps est streamé en tâche de fond ; on rend la main au front avec le statut + en-têtes.
    tauri::async_runtime::spawn(async move {
        let mut stream = response.bytes_stream();
        while let Some(item) = stream.next().await {
            match item {
                Ok(bytes) => {
                    let chunk = String::from_utf8_lossy(&bytes).into_owned();
                    if on_event.send(HttpStreamEvent::Data { chunk }).is_err() {
                        return; // front parti : on stoppe.
                    }
                }
                Err(e) => {
                    let _ = on_event.send(HttpStreamEvent::Error { message: e.to_string() });
                    return;
                }
            }
        }
        let _ = on_event.send(HttpStreamEvent::End);
    });

    Ok(HttpResponseMeta { status, headers: resp_headers })
}

#[tauri::command]
fn secret_set(reference: String, value: String) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, &reference).map_err(|e| e.to_string())?;
    entry.set_password(&value).map_err(|e| e.to_string())
}

#[tauri::command]
fn secret_get(reference: String) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(SERVICE, &reference).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn secret_delete(reference: String) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, &reference).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn secret_has(reference: String) -> Result<bool, String> {
    let entry = keyring::Entry::new(SERVICE, &reference).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(e) => Err(e.to_string()),
    }
}

/// Ouvre une URL externe dans le navigateur système (export du prompt vers ChatGPT/Claude/Gemini).
/// Passe par l'API native du plugin opener (hors système de scope JS) ; aucune clé n'est en jeu.
#[tauri::command]
fn open_external(app: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            secret_set,
            secret_get,
            secret_delete,
            secret_has,
            local_http_request,
            open_external
        ])
        .run(tauri::generate_context!())
        .expect("erreur au démarrage de l'application Tauri");
}
