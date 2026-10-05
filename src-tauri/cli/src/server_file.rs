//! `~/.gitmanager/mcp.json`: the bearer token, plus the port and process id while the server
//! runs. The app writes it (its `mcp::token`); this tool reads it to find the server.

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

pub const FILE_NAME: &str = "mcp.json";
pub const TOKEN_BYTES: usize = 32;

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpFile {
    pub token: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub port: Option<u16>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pid: Option<u32>,
}

pub fn file_in(config_dir: &Path) -> PathBuf {
    config_dir.join(FILE_NAME)
}

pub fn is_valid_token(token: &str) -> bool {
    token.len() == TOKEN_BYTES * 2 && token.bytes().all(|byte| byte.is_ascii_hexdigit())
}

/// The file, or None when it is missing or not ours to trust (a fresh token is made then).
pub fn read_in(config_dir: &Path) -> Option<McpFile> {
    let text = std::fs::read_to_string(file_in(config_dir)).ok()?;
    let file: McpFile = serde_json::from_str(&text).ok()?;
    is_valid_token(&file.token).then_some(file)
}
