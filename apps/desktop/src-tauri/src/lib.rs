//! Cœur natif PromptForge desktop.
//!
//! Sécurité : les clés d'API sont stockées dans le gestionnaire de secrets de l'OS via
//! `keyring-rs` (Windows Credential Manager / DPAPI). Aucune clé n'est écrite en fichier clair,
//! ni journalisée. Les commandes ci-dessous ne renvoient la valeur qu'à la demande explicite du front.

const SERVICE: &str = "com.promptforge.dev";

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            secret_set,
            secret_get,
            secret_delete,
            secret_has
        ])
        .run(tauri::generate_context!())
        .expect("erreur au démarrage de l'application Tauri");
}
