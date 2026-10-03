//! The UI bridge: a "ui" tool call becomes an `mcp-ui-request` event, and the
//! frontend answers with `mcp_ui_respond(requestId, result)`.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, Mutex};
use std::time::Duration;

use serde_json::{json, Map, Value};

use super::dto::McpUiResult;
use super::host::Host;
use crate::file_search::lock;

pub const UI_TIMEOUT: Duration = Duration::from_secs(30);
pub const NOT_READY: &str = "The app window is not ready";
pub const NO_ANSWER: &str = "The app did not answer in time";
pub const STOPPED: &str = "The MCP server was turned off";

#[derive(Default)]
pub struct Bridge {
    next_id: AtomicU64,
    pending: Mutex<HashMap<u64, mpsc::Sender<McpUiResult>>>,
}

impl Bridge {
    /// Emits the request (to `window_label` only, when given) and waits for the answer; the
    /// request is forgotten on timeout.
    pub fn call(
        &self,
        host: Option<&dyn Host>,
        window_label: Option<&str>,
        tool_name: &str,
        arguments: &Map<String, Value>,
        timeout: Duration,
    ) -> Result<McpUiResult, String> {
        let host = host.filter(|host| host.window_ready()).ok_or_else(|| NOT_READY.to_string())?;
        let request_id = self.next_id.fetch_add(1, Ordering::Relaxed) + 1;
        let (sender, receiver) = mpsc::channel();
        lock(&self.pending).insert(request_id, sender);
        let request = json!({ "requestId": request_id, "tool": tool_name, "arguments": arguments });
        match window_label {
            Some(label) => host.emit_to(label, "mcp-ui-request", request),
            None => host.emit("mcp-ui-request", request),
        }
        let answer = receiver.recv_timeout(timeout);
        lock(&self.pending).remove(&request_id);
        match answer {
            Ok(result) => Ok(result),
            Err(mpsc::RecvTimeoutError::Timeout) => Err(NO_ANSWER.to_string()),
            Err(mpsc::RecvTimeoutError::Disconnected) => Err(STOPPED.to_string()),
        }
    }

    /// False when the request is unknown (answered already, or timed out).
    pub fn respond(&self, request_id: u64, result: McpUiResult) -> bool {
        match lock(&self.pending).remove(&request_id) {
            Some(sender) => sender.send(result).is_ok(),
            None => false,
        }
    }

    /// Wakes every waiting call with "turned off".
    pub fn cancel_all(&self) {
        *lock(&self.pending) = HashMap::new();
    }

    #[cfg(test)]
    pub fn pending_count(&self) -> usize {
        lock(&self.pending).len()
    }
}
