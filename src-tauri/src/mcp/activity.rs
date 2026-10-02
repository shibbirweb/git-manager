//! The last tool calls, for the live list in the MCP dialog.

use std::collections::VecDeque;
use std::sync::Mutex;

use super::dto::McpActivity;
use crate::file_search::lock;

pub const MAX_ACTIVITY: usize = 50;

#[derive(Default)]
pub struct ActivityLog {
    entries: Mutex<VecDeque<McpActivity>>,
}

impl ActivityLog {
    pub fn push(&self, entry: McpActivity) {
        let mut entries = lock(&self.entries);
        if entries.len() >= MAX_ACTIVITY {
            entries.pop_front();
        }
        entries.push_back(entry);
    }

    /// Oldest first, newest last.
    pub fn entries(&self) -> Vec<McpActivity> {
        lock(&self.entries).iter().cloned().collect()
    }

    /// Frees the buffer too, so a stopped server keeps nothing.
    pub fn clear(&self) {
        *lock(&self.entries) = VecDeque::new();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::mcp::dto::McpClient;

    fn entry(tool: &str) -> McpActivity {
        McpActivity {
            tool: tool.to_string(),
            at: 1,
            duration_ms: 2,
            ok: true,
            error: None,
            client: McpClient::Mcp,
        }
    }

    #[test]
    fn keeps_the_newest_fifty_newest_last() {
        let log = ActivityLog::default();
        for number in 0..(MAX_ACTIVITY + 7) {
            log.push(entry(&format!("tool_{number}")));
        }
        let entries = log.entries();
        assert_eq!(entries.len(), MAX_ACTIVITY);
        assert_eq!(entries[0].tool, "tool_7");
        assert_eq!(entries[MAX_ACTIVITY - 1].tool, format!("tool_{}", MAX_ACTIVITY + 6));
        log.clear();
        assert!(log.entries().is_empty());
    }
}
