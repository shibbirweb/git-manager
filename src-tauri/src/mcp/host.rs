//! What the MCP server needs from the running app, behind a trait so tests run without a window.

use serde_json::Value;
use tauri::{AppHandle, Emitter, EventTarget, Manager};

pub trait Host: Send + Sync {
    /// To every window.
    fn emit(&self, event: &str, payload: Value);
    /// To one window only (a UI tool call is answered by the window it acts on).
    fn emit_to(&self, window_label: &str, event: &str, payload: Value) {
        let _ = window_label;
        self.emit(event, payload);
    }
    /// A window exists that can answer UI tool calls.
    fn window_ready(&self) -> bool;
    /// The first window as PNG bytes.
    fn screenshot_png(&self) -> Result<Vec<u8>, String>;
    /// One window as PNG bytes.
    fn screenshot_window_png(&self, window_label: &str) -> Result<Vec<u8>, String> {
        let _ = window_label;
        self.screenshot_png()
    }
}

pub struct TauriHost {
    app: AppHandle,
}

impl TauriHost {
    pub fn new(app: AppHandle) -> TauriHost {
        TauriHost { app }
    }
}

impl Host for TauriHost {
    fn emit(&self, event: &str, payload: Value) {
        let _ = self.app.emit(event, payload);
    }

    fn emit_to(&self, window_label: &str, event: &str, payload: Value) {
        let _ = self.app.emit_to(EventTarget::webview_window(window_label), event, payload);
    }

    fn window_ready(&self) -> bool {
        !self.app.webview_windows().is_empty()
    }

    fn screenshot_png(&self) -> Result<Vec<u8>, String> {
        screenshot::capture(&self.app, None)
    }

    fn screenshot_window_png(&self, window_label: &str) -> Result<Vec<u8>, String> {
        screenshot::capture(&self.app, Some(window_label))
    }
}

#[cfg(target_os = "macos")]
mod screenshot {
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::mpsc;
    use std::time::Duration;

    use objc2::msg_send;
    use objc2::runtime::AnyObject;
    use tauri::{AppHandle, Manager};

    /// The CGWindowID of a window (else the main one), read on the main thread as AppKit requires.
    fn window_number(app: &AppHandle, window_label: Option<&str>) -> Result<isize, String> {
        let window = window_label
            .and_then(|label| app.get_webview_window(label))
            .or_else(|| app.get_webview_window(crate::windows::MAIN_LABEL))
            .or_else(|| app.webview_windows().into_values().next())
            .ok_or_else(|| "The app window is not ready".to_string())?;
        let (sender, receiver) = mpsc::channel();
        app.run_on_main_thread(move || {
            let number = window.ns_window().ok().filter(|pointer| !pointer.is_null()).map(|pointer| {
                // SAFETY: tauri hands out the live NSWindow of this window; windowNumber is a plain getter.
                let ns_window = unsafe { &*(pointer as *const AnyObject) };
                let number: isize = unsafe { msg_send![ns_window, windowNumber] };
                number
            });
            let _ = sender.send(number);
        })
        .map_err(|err| err.to_string())?;
        receiver
            .recv_timeout(Duration::from_secs(5))
            .ok()
            .flatten()
            .filter(|number| *number > 0)
            .ok_or_else(|| "Could not find the app window".to_string())
    }

    pub fn capture(app: &AppHandle, window_label: Option<&str>) -> Result<Vec<u8>, String> {
        static NEXT: AtomicU64 = AtomicU64::new(1);
        let number = window_number(app, window_label)?;
        let file = std::env::temp_dir().join(format!(
            "git-manager-screenshot-{}-{}.png",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        // -x: no sound, -o: no window shadow, -l: just this window, even when covered.
        let output = std::process::Command::new("/usr/sbin/screencapture")
            .args(["-x", "-o", "-l", &number.to_string()])
            .arg(&file)
            .output()
            .map_err(|err| format!("Could not run screencapture: {err}"))?;
        let bytes = std::fs::read(&file);
        let _ = std::fs::remove_file(&file);
        match bytes {
            Ok(bytes) if output.status.success() && !bytes.is_empty() => Ok(bytes),
            _ => {
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                let reason = if stderr.is_empty() { "no image was made".to_string() } else { stderr };
                Err(format!(
                    "The screenshot failed ({reason}). Allow Git Manager in System Settings > Privacy & Security > Screen Recording."
                ))
            }
        }
    }
}

#[cfg(not(target_os = "macos"))]
mod screenshot {
    use tauri::AppHandle;

    pub fn capture(_app: &AppHandle, _window_label: Option<&str>) -> Result<Vec<u8>, String> {
        Err("Screenshots are not supported on this platform yet".to_string())
    }
}

