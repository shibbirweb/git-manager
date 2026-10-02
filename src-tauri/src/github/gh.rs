//! The GitHub CLI as a token source: `gh auth token` is asked each time a token is needed,
//! so Git Manager never stores it. Behind a trait so the tests need no `gh`.

use std::io::Read;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use crate::error::{AppError, AppResult};

const TIMEOUT: Duration = Duration::from_secs(15);

pub trait GhCli: Send + Sync {
    fn installed(&self) -> bool;
    /// The token gh holds for `host`, None when gh is not signed in there.
    fn token(&self, host: &str) -> AppResult<Option<String>>;
}

pub struct SystemGh;

/// GUI apps start with a minimal PATH, so look where installers put gh first.
fn gh_binary() -> Option<PathBuf> {
    let candidates = ["/opt/homebrew/bin/gh", "/usr/local/bin/gh", "/usr/bin/gh"];
    if let Some(found) = candidates.iter().map(PathBuf::from).find(|path| path.is_file()) {
        return Some(found);
    }
    let path = std::env::var_os("PATH").unwrap_or_default();
    let name = if cfg!(windows) { "gh.exe" } else { "gh" };
    std::env::split_paths(&path).map(|dir| dir.join(name)).find(|candidate| candidate.is_file())
}

impl GhCli for SystemGh {
    fn installed(&self) -> bool {
        gh_binary().is_some()
    }

    fn token(&self, host: &str) -> AppResult<Option<String>> {
        let Some(binary) = gh_binary() else {
            return Err(AppError::invalid("The GitHub CLI (gh) is not installed."));
        };
        let mut child = Command::new(binary)
            .args(["auth", "token", "--hostname", host])
            .env("GH_PROMPT_DISABLED", "1")
            .env("NO_COLOR", "1")
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|err| AppError::invalid(format!("Could not start gh: {err}")))?;
        let deadline = Instant::now() + TIMEOUT;
        let status = loop {
            match child.try_wait()? {
                Some(status) => break status,
                None if Instant::now() < deadline => std::thread::sleep(Duration::from_millis(20)),
                None => {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(AppError::invalid("gh auth token did not answer in time."));
                }
            }
        };
        let mut output = String::new();
        if let Some(mut stdout) = child.stdout.take() {
            let _ = stdout.read_to_string(&mut output);
        }
        let token = output.trim().to_string();
        if !status.success() || token.is_empty() {
            return Ok(None);
        }
        Ok(Some(token))
    }
}
