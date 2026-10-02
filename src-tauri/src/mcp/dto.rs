//! The MCP data the frontend sees (mirrored in src/lib/types.ts).

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct McpStatus {
    /// The MCP server switch (AI harnesses).
    pub enabled: bool,
    /// The command line tool switch.
    pub cli_enabled: bool,
    pub running: bool,
    pub port: u16,
    pub url: String,
    /// Only for the Settings page to show and copy.
    pub token: Option<String>,
    pub error: Option<String>,
    /// The running binary followed by " cli", for display.
    pub cli_command: String,
    /// `~/.local/bin/git-manager` when it is our link.
    pub cli_installed_path: Option<String>,
    /// `~/.local/bin` is on the login shell's PATH.
    pub cli_on_path: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ToolKind {
    Backend,
    Ui,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct McpToolInfo {
    pub name: String,
    pub title: String,
    pub description: String,
    pub category: String,
    pub kind: ToolKind,
    pub read_only: bool,
    pub destructive: bool,
    pub enabled: bool,
    pub input_schema: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct McpUiToolDef {
    pub name: String,
    pub title: String,
    pub description: String,
    pub category: String,
    #[serde(default)]
    pub read_only: bool,
    #[serde(default)]
    pub destructive: bool,
    #[serde(default)]
    pub input_schema: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct McpUiResult {
    pub ok: bool,
    pub text: String,
    pub structured: Option<Value>,
    pub image_png_base64: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum McpClient {
    Mcp,
    Cli,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct McpActivity {
    pub tool: String,
    /// Milliseconds since the epoch.
    pub at: u64,
    pub duration_ms: u64,
    pub ok: bool,
    pub error: Option<String>,
    pub client: McpClient,
}
