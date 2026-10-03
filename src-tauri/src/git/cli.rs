//! Every mutation goes through the user's `git` binary so hooks, credential
//! helpers, signing and config behave exactly like in the terminal.

use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::OnceLock;
use std::time::{Duration, Instant};

use serde::Serialize;

use crate::error::{AppError, AppResult};
use crate::git_console;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitOutput {
    pub stdout: String,
    pub stderr: String,
    pub success: bool,
}

impl GitOutput {
    /// Combined text for showing to the user.
    pub fn text(&self) -> String {
        let mut text = self.stdout.trim_end().to_string();
        let stderr = self.stderr.trim_end();
        if !stderr.is_empty() {
            if !text.is_empty() {
                text.push('\n');
            }
            text.push_str(stderr);
        }
        text
    }
}

fn git_binary() -> &'static PathBuf {
    static GIT: OnceLock<PathBuf> = OnceLock::new();
    GIT.get_or_init(|| {
        let candidates = ["/opt/homebrew/bin/git", "/usr/local/bin/git", "/usr/bin/git"];
        candidates
            .iter()
            .map(PathBuf::from)
            .find(|path| path.exists())
            .unwrap_or_else(|| PathBuf::from("git"))
    })
}

/// GUI apps on macOS start with a minimal PATH, which breaks hooks that need
/// tools like node or husky. Ask the login shell once for the real PATH.
pub fn user_path() -> &'static String {
    static PATH: OnceLock<String> = OnceLock::new();
    PATH.get_or_init(|| {
        let fallback = {
            let current = std::env::var("PATH").unwrap_or_default();
            format!("/opt/homebrew/bin:/usr/local/bin:{current}")
        };
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        let child = Command::new(shell)
            .args(["-l", "-c", "printf %s \"$PATH\""])
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn();
        let Ok(mut child) = child else {
            return fallback;
        };
        let deadline = Instant::now() + Duration::from_secs(3);
        loop {
            match child.try_wait() {
                Ok(Some(_)) => break,
                Ok(None) if Instant::now() < deadline => std::thread::sleep(Duration::from_millis(20)),
                _ => {
                    let _ = child.kill();
                    return fallback;
                }
            }
        }
        let mut path = String::new();
        if let Some(mut stdout) = child.stdout.take() {
            let _ = stdout.read_to_string(&mut path);
        }
        let path = path.trim().to_string();
        if path.is_empty() {
            fallback
        } else {
            path
        }
    })
}

pub fn command(repo_path: &Path) -> Command {
    let mut command = Command::new(git_binary());
    command
        .current_dir(repo_path)
        .env("PATH", user_path())
        // Never block on an interactive prompt the GUI cannot answer.
        .env("GIT_TERMINAL_PROMPT", "0")
        // `--continue` and similar accept the prepared message as-is.
        .env("GIT_EDITOR", "true")
        .env("GIT_SEQUENCE_EDITOR", "true")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    command
}

fn describe(args: &[&str]) -> String {
    format!("git {}", args.join(" "))
}

/// Runs git and returns its output regardless of exit status.
pub fn run_raw(repo_path: &Path, args: &[&str], stdin: Option<&[u8]>) -> AppResult<GitOutput> {
    run_raw_with_env(repo_path, args, &[], stdin)
}

/// `run_raw` with extra environment variables for this one call.
pub fn run_raw_with_env(repo_path: &Path, args: &[&str], envs: &[(&str, &str)], stdin: Option<&[u8]>) -> AppResult<GitOutput> {
    let record = git_console::record(repo_path, args);
    let mut command = command(repo_path);
    command.args(args).envs(envs.iter().copied());
    if stdin.is_some() {
        command.stdin(Stdio::piped());
    }
    let mut child = command.spawn().map_err(|err| {
        record.fail(AppError::Command {
            message: format!("Could not start {}: {err}", describe(args)),
        })
    })?;
    if let (Some(input), Some(mut pipe)) = (stdin, child.stdin.take()) {
        pipe.write_all(input)?;
    }
    let output = child.wait_with_output()?;
    record.finish(output.status.code(), &output.stdout, &output.stderr);
    Ok(GitOutput {
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        success: output.status.success(),
    })
}

/// Runs git and turns a non-zero exit into an error carrying git's message.
pub fn run(repo_path: &Path, args: &[&str]) -> AppResult<GitOutput> {
    let output = run_raw(repo_path, args, None)?;
    ensure_success(output, args)
}

/// Runs git and returns its stdout as raw bytes (patches may hold text in any encoding).
pub fn run_bytes(repo_path: &Path, args: &[&str]) -> AppResult<Vec<u8>> {
    run_bytes_with_env(repo_path, args, &[])
}

/// `run_bytes` with extra environment variables for this one call.
pub fn run_bytes_with_env(repo_path: &Path, args: &[&str], envs: &[(&str, &str)]) -> AppResult<Vec<u8>> {
    let record = git_console::record(repo_path, args);
    let output = command(repo_path).args(args).envs(envs.iter().copied()).output().map_err(|err| {
        record.fail(AppError::Command {
            message: format!("Could not start {}: {err}", describe(args)),
        })
    })?;
    record.finish(output.status.code(), &output.stdout, &output.stderr);
    if output.status.success() {
        return Ok(output.stdout);
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim_end().to_string();
    let message = if stderr.is_empty() {
        format!("{} failed", describe(args))
    } else {
        stderr
    };
    Err(AppError::Command { message })
}

/// `run` with extra environment variables for this one call.
pub fn run_with_env(repo_path: &Path, args: &[&str], envs: &[(&str, &str)]) -> AppResult<GitOutput> {
    let mut command = command(repo_path);
    command.args(args).envs(envs.iter().copied());
    let record = git_console::record(repo_path, args);
    let output = command.output().map_err(|err| {
        record.fail(AppError::Command {
            message: format!("Could not start {}: {err}", describe(args)),
        })
    })?;
    record.finish(output.status.code(), &output.stdout, &output.stderr);
    let output = GitOutput {
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        success: output.status.success(),
    };
    ensure_success(output, args)
}

pub fn run_with_stdin(repo_path: &Path, args: &[&str], stdin: &[u8]) -> AppResult<GitOutput> {
    let output = run_raw(repo_path, args, Some(stdin))?;
    ensure_success(output, args)
}

/// Runs `git <args...>` with `paths` as NUL-separated pathspecs on stdin, so
/// any number of paths fits (50k paths as arguments exceed ARG_MAX). Does
/// nothing for an empty list: `git add -A` without a pathspec adds everything.
pub fn run_with_pathspecs(repo_path: &Path, args: &[&str], paths: &[String]) -> AppResult<Option<GitOutput>> {
    if paths.is_empty() {
        return Ok(None);
    }
    let mut all = args.to_vec();
    all.extend(["--pathspec-from-file=-", "--pathspec-file-nul"]);
    let mut input = Vec::with_capacity(paths.iter().map(|path| path.len() + 1).sum());
    for path in paths {
        input.extend_from_slice(path.as_bytes());
        input.push(0);
    }
    run_with_stdin(repo_path, &all, &input).map(Some)
}

fn ensure_success(output: GitOutput, args: &[&str]) -> AppResult<GitOutput> {
    if output.success {
        Ok(output)
    } else {
        let text = output.text();
        let message = if text.is_empty() {
            format!("{} failed", describe(args))
        } else {
            text
        };
        Err(AppError::Command { message })
    }
}

/// Runs a long network command, reporting each progress line (git uses `\r`
/// to redraw them) through `on_progress`.
pub fn run_streaming(repo_path: &Path, args: &[&str], on_progress: impl FnMut(&str)) -> AppResult<GitOutput> {
    run_streaming_with_env(repo_path, args, &[], on_progress)
}

/// `run_streaming` with extra environment variables for this one call.
pub fn run_streaming_with_env(
    repo_path: &Path,
    args: &[&str],
    envs: &[(&str, &str)],
    mut on_progress: impl FnMut(&str),
) -> AppResult<GitOutput> {
    let mut command = command(repo_path);
    command.args(args).envs(envs.iter().copied());
    let record = git_console::record(repo_path, args);
    let mut child = command.spawn().map_err(|err| {
        record.fail(AppError::Command {
            message: format!("Could not start {}: {err}", describe(args)),
        })
    })?;

    let stdout_pipe = child.stdout.take();
    let stdout_reader = std::thread::spawn(move || {
        let mut text = String::new();
        if let Some(mut pipe) = stdout_pipe {
            let _ = pipe.read_to_string(&mut text);
        }
        text
    });

    let mut stderr_text = String::new();
    if let Some(mut pipe) = child.stderr.take() {
        let mut buffer = [0u8; 4096];
        let mut pending = Vec::new();
        loop {
            let read = pipe.read(&mut buffer)?;
            if read == 0 {
                break;
            }
            for &byte in &buffer[..read] {
                if byte == b'\r' || byte == b'\n' {
                    if !pending.is_empty() {
                        let line = String::from_utf8_lossy(&pending).into_owned();
                        on_progress(&line);
                        if byte == b'\n' {
                            stderr_text.push_str(&line);
                            stderr_text.push('\n');
                        }
                        pending.clear();
                    }
                } else {
                    pending.push(byte);
                }
            }
        }
        if !pending.is_empty() {
            let line = String::from_utf8_lossy(&pending).into_owned();
            on_progress(&line);
            stderr_text.push_str(&line);
        }
    }

    let status = child.wait()?;
    let output = GitOutput {
        stdout: stdout_reader.join().unwrap_or_default(),
        stderr: stderr_text,
        success: status.success(),
    };
    record.finish(status.code(), output.stdout.as_bytes(), output.stderr.as_bytes());
    ensure_success(output, args)
}
