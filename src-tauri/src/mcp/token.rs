//! `~/.gitmanager/mcp.json`: the bearer token, plus the port and process id while the
//! server runs so the command line tool can find it. Readable by the user only.

use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

pub const FILE_NAME: &str = "mcp.json";
const TOKEN_BYTES: usize = 32;

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

/// Writes atomically with mode 0600 from the start, so the token is never readable by others.
pub fn write_in(config_dir: &Path, file: &McpFile) -> AppResult<()> {
    std::fs::create_dir_all(config_dir)?;
    let path = file_in(config_dir);
    let temp = config_dir.join(format!(".{FILE_NAME}.tmp"));
    let _ = std::fs::remove_file(&temp);
    let mut text = serde_json::to_string_pretty(file).map_err(|err| AppError::invalid(err.to_string()))?;
    text.push('\n');
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut handle = options.open(&temp)?;
    handle.write_all(text.as_bytes())?;
    handle.sync_all()?;
    drop(handle);
    std::fs::rename(&temp, &path)?;
    Ok(())
}

/// 32 random bytes as lowercase hex.
pub fn new_token() -> AppResult<String> {
    let mut bytes = [0u8; TOKEN_BYTES];
    getrandom::fill(&mut bytes).map_err(|err| AppError::invalid(format!("Could not make a random token: {err}")))?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

/// Constant-time comparison, so the token cannot be guessed byte by byte from timings.
pub fn tokens_match(expected: &str, given: &str) -> bool {
    let (expected, given) = (expected.as_bytes(), given.as_bytes());
    if expected.len() != given.len() {
        return false;
    }
    expected.iter().zip(given).fold(0u8, |diff, (a, b)| diff | (a ^ b)) == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokens_are_random_hex_and_compare_exactly() {
        let first = new_token().unwrap();
        let second = new_token().unwrap();
        assert!(is_valid_token(&first), "{first}");
        assert_ne!(first, second);
        assert!(tokens_match(&first, &first.clone()));
        assert!(!tokens_match(&first, &second));
        assert!(!tokens_match(&first, &first[1..]));
        assert!(!is_valid_token("abc"));
    }

    #[test]
    fn the_file_round_trips_with_user_only_permissions() {
        let dir = tempfile::TempDir::new().unwrap();
        let config_dir = dir.path().join(".gitmanager");
        assert_eq!(read_in(&config_dir), None);
        let file = McpFile {
            token: new_token().unwrap(),
            port: Some(48731),
            pid: Some(42),
        };
        write_in(&config_dir, &file).unwrap();
        assert_eq!(read_in(&config_dir), Some(file.clone()));
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(file_in(&config_dir)).unwrap().permissions().mode();
            assert_eq!(mode & 0o777, 0o600);
        }
        let stopped = McpFile {
            token: file.token.clone(),
            ..McpFile::default()
        };
        write_in(&config_dir, &stopped).unwrap();
        let text = std::fs::read_to_string(file_in(&config_dir)).unwrap();
        assert!(!text.contains("port") && !text.contains("pid"), "{text}");

        std::fs::write(file_in(&config_dir), "{ \"token\": \"short\" }").unwrap();
        assert_eq!(read_in(&config_dir), None, "a bad token is replaced, not used");
    }
}
