use serde::Serialize;
use serde_json::Value;
use tauri::Emitter;

use super::blocking;
use crate::config;
use crate::error::AppResult;

/// Reads `~/.gitmanager/<config_name>.json`; None when it does not exist yet.
#[tauri::command]
pub async fn load_config(config_name: String) -> AppResult<Option<Value>> {
    blocking(move || config::load_in(&config::config_dir_in(&config::home_dir()?), &config_name)).await
}

/// Replaces a whole config file: only for resetting one that could not be read, and the one-time migration.
#[tauri::command]
pub async fn save_config(config_name: String, value: Value) -> AppResult<()> {
    blocking(move || config::save_in(&config::config_dir_in(&config::home_dir()?), &config_name, &value)).await
}

/// What another window changed in a config file, for the windows to apply.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigChanged {
    pub config_name: String,
    pub patch: config::ConfigPatch,
}

/// Writes what one window changed into the file as it is on disk now (see config.rs), then
/// tells the other windows, so a setting changed in one window reaches every window.
#[tauri::command]
pub async fn update_config(
    app: tauri::AppHandle,
    window: tauri::Window,
    config_name: String,
    patch: config::ConfigPatch,
) -> AppResult<()> {
    let name = config_name.clone();
    let sent = patch.clone();
    let wrote = blocking(move || config::update_in(&config::config_dir_in(&config::home_dir()?), &name, &sent)).await?;
    if wrote {
        let source = window.label().to_string();
        let _ = app.emit_filter("config-changed", ConfigChanged { config_name, patch }, |target| {
            matches!(target, tauri::EventTarget::WebviewWindow { label } if *label != source)
        });
    }
    Ok(())
}

/// Memory of the app and its web view helper processes, for the status bar.
#[tauri::command]
pub async fn memory_usage() -> AppResult<crate::memory::MemoryUsage> {
    blocking(|| Ok(crate::memory::usage())).await
}

/// The debug memory log (Settings > Automation): on or off, its interval and change threshold.
#[tauri::command]
pub async fn memory_log_configure(
    state: tauri::State<'_, crate::state::AppState>,
    enabled: bool,
    interval_ms: u64,
    threshold_mb: f64,
) -> AppResult<crate::memory_log::MemoryLogStatus> {
    let config_dir = crate::config::config_dir_in(&crate::config::home_dir()?);
    Ok(state.memory_log.configure(&config_dir, enabled, interval_ms, threshold_mb))
}

/// A UI event (tab, view, scrolling) logged next to the following memory reading.
#[tauri::command]
pub fn memory_log_event(state: tauri::State<'_, crate::state::AppState>, label: String) {
    state.memory_log.event(&label);
}

/// The config folder, for showing in the settings dialog.
#[tauri::command]
pub fn config_dir() -> AppResult<String> {
    Ok(config::config_dir_in(&config::home_dir()?).to_string_lossy().into_owned())
}

/// The operating system for bug reports. The web view cannot tell: WebKit
/// freezes the macOS version in its user agent at 10.15.7.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OsInfo {
    /// "macOS", "Windows", or the Linux distribution name.
    pub name: String,
    /// "15.4.1", "24.04"; None when it could not be read.
    pub version: Option<String>,
}

#[tauri::command]
pub async fn os_info() -> AppResult<OsInfo> {
    blocking(|| Ok(current_os())).await
}

fn current_os() -> OsInfo {
    match std::env::consts::OS {
        "macos" => OsInfo {
            name: "macOS".to_string(),
            version: std::process::Command::new("/usr/bin/sw_vers")
                .arg("-productVersion")
                .output()
                .ok()
                .filter(|output| output.status.success())
                .and_then(|output| parse_product_version(&String::from_utf8_lossy(&output.stdout))),
        },
        "linux" => parse_os_release(
            &std::fs::read_to_string("/etc/os-release")
                .or_else(|_| std::fs::read_to_string("/usr/lib/os-release"))
                .unwrap_or_default(),
        ),
        "windows" => OsInfo {
            name: "Windows".to_string(),
            version: None,
        },
        other => OsInfo {
            name: other.to_string(),
            version: None,
        },
    }
}

/// `sw_vers -productVersion` output, e.g. "15.4.1\n".
fn parse_product_version(output: &str) -> Option<String> {
    let version = output.trim();
    let valid = !version.is_empty()
        && version.split('.').all(|part| !part.is_empty() && part.chars().all(|c| c.is_ascii_digit()));
    valid.then(|| version.to_string())
}

/// NAME and VERSION_ID from `/etc/os-release`, falling back to plain "Linux".
fn parse_os_release(text: &str) -> OsInfo {
    let value = |key: &str| {
        text.lines()
            .filter_map(|line| line.trim().strip_prefix(key)?.strip_prefix('='))
            .map(|raw| raw.trim().trim_matches(|c| c == '"' || c == '\'').trim().to_string())
            .find(|value| !value.is_empty())
    };
    OsInfo {
        name: value("NAME").unwrap_or_else(|| "Linux".to_string()),
        version: value("VERSION_ID"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_macos_product_version() {
        assert_eq!(parse_product_version("15.4.1\n").as_deref(), Some("15.4.1"));
        assert_eq!(parse_product_version("  26.0 ").as_deref(), Some("26.0"));
        assert_eq!(parse_product_version(""), None);
        assert_eq!(parse_product_version("sw_vers: unknown option"), None);
        assert_eq!(parse_product_version("15..1"), None);
    }

    #[test]
    fn reads_the_linux_distribution() {
        let ubuntu = "PRETTY_NAME=\"Ubuntu 24.04.1 LTS\"\nNAME=\"Ubuntu\"\nVERSION_ID=\"24.04\"\nVERSION=\"24.04.1 LTS\"\n";
        assert_eq!(
            parse_os_release(ubuntu),
            OsInfo {
                name: "Ubuntu".to_string(),
                version: Some("24.04".to_string()),
            }
        );
        let arch = "NAME='Arch Linux'\nID=arch\n";
        assert_eq!(parse_os_release(arch).name, "Arch Linux");
        assert_eq!(parse_os_release(arch).version, None);
        assert_eq!(
            parse_os_release(""),
            OsInfo {
                name: "Linux".to_string(),
                version: None,
            }
        );
    }

    #[test]
    fn this_machine_has_a_name() {
        let os = current_os();
        assert!(!os.name.is_empty());
        if cfg!(target_os = "macos") {
            assert_eq!(os.name, "macOS");
            assert!(os.version.is_some(), "{os:?}");
        }
    }
}
