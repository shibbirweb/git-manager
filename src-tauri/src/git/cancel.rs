//! Long streaming git commands the user can stop by an id, like the Clone dialog's Cancel
//! button. The command runs in its own process group so git's helpers (remote-https,
//! index-pack) stop with it, and git gets SIGTERM so it can clean up after itself.

use std::collections::HashMap;
use std::io::Read;
use std::path::Path;
use std::process::{Child, ExitStatus};
use std::sync::{Arc, Mutex, MutexGuard, OnceLock};
use std::time::Duration;

use super::cli::{self, GitOutput};
use crate::error::{AppError, AppResult};

struct Running {
    child: Child,
    /// Reaped: its pid may belong to another process now, so it is never signalled again.
    exited: bool,
}

#[derive(Default)]
struct Entry {
    running: Option<Arc<Mutex<Running>>>,
    cancelled: bool,
}

fn registry() -> &'static Mutex<HashMap<String, Entry>> {
    static REGISTRY: OnceLock<Mutex<HashMap<String, Entry>>> = OnceLock::new();
    REGISTRY.get_or_init(|| Mutex::new(HashMap::new()))
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn stop(running: &Arc<Mutex<Running>>) {
    let mut state = lock(running);
    if !state.exited {
        signal(&mut state.child);
    }
}

#[cfg(unix)]
fn signal(child: &mut Child) {
    if let Ok(group) = i32::try_from(child.id()) {
        // SAFETY: signals the process group this module started; it has not been reaped yet.
        unsafe {
            libc::kill(-group, libc::SIGTERM);
        }
    }
}

#[cfg(not(unix))]
fn signal(child: &mut Child) {
    let _ = child.kill();
}

/// Stops the command running under `cancel_id`; false when none is.
pub fn cancel(cancel_id: &str) -> bool {
    let running = {
        let mut entries = lock(registry());
        let Some(entry) = entries.get_mut(cancel_id) else {
            return false;
        };
        entry.cancelled = true;
        entry.running.clone()
    };
    if let Some(running) = running {
        stop(&running);
    }
    true
}

/// Drops the registry entry when the command ends, however it ends.
struct Registered<'a>(&'a str);

impl Drop for Registered<'_> {
    fn drop(&mut self) {
        lock(registry()).remove(self.0);
    }
}

fn was_cancelled(cancel_id: &str) -> bool {
    lock(registry()).get(cancel_id).is_some_and(|entry| entry.cancelled)
}

/// Reads git's progress from stderr (it uses `\r` to redraw a line), returning the finished lines.
fn read_progress(mut pipe: impl Read, on_progress: &mut impl FnMut(&str)) -> std::io::Result<String> {
    let mut text = String::new();
    let mut buffer = [0u8; 4096];
    let mut pending = Vec::new();
    loop {
        let read = pipe.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        for &byte in &buffer[..read] {
            if byte != b'\r' && byte != b'\n' {
                pending.push(byte);
                continue;
            }
            if pending.is_empty() {
                continue;
            }
            let line = String::from_utf8_lossy(&pending).into_owned();
            on_progress(&line);
            if byte == b'\n' {
                text.push_str(&line);
                text.push('\n');
            }
            pending.clear();
        }
    }
    if !pending.is_empty() {
        let line = String::from_utf8_lossy(&pending).into_owned();
        on_progress(&line);
        text.push_str(&line);
    }
    Ok(text)
}

fn wait(running: &Arc<Mutex<Running>>) -> AppResult<ExitStatus> {
    loop {
        {
            let mut state = lock(running);
            if let Some(status) = state.child.try_wait()? {
                state.exited = true;
                return Ok(status);
            }
        }
        std::thread::sleep(Duration::from_millis(20));
    }
}

/// `cli::run_streaming` that `cancel(cancel_id)` can stop. Ok(None) means it was cancelled.
pub fn run_streaming(
    repo_path: &Path,
    args: &[&str],
    cancel_id: &str,
    mut on_progress: impl FnMut(&str),
) -> AppResult<Option<GitOutput>> {
    {
        let mut entries = lock(registry());
        if entries.contains_key(cancel_id) {
            return Err(AppError::invalid("This command is already running"));
        }
        entries.insert(cancel_id.to_string(), Entry::default());
    }
    let _registered = Registered(cancel_id);

    let describe = format!("git {}", args.join(" "));
    let mut command = cli::command(repo_path);
    command.args(args);
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    // Recorded in the Git Console like every command of git/cli.rs.
    let record = crate::git_console::record(repo_path, args);
    let mut child = command.spawn().map_err(|err| {
        record.fail(AppError::Command {
            message: format!("Could not start {describe}: {err}"),
        })
    })?;
    let stdout_pipe = child.stdout.take();
    let stderr_pipe = child.stderr.take();
    let running = Arc::new(Mutex::new(Running { child, exited: false }));
    let cancelled_before_start = {
        let mut entries = lock(registry());
        let entry = entries.entry(cancel_id.to_string()).or_default();
        entry.running = Some(running.clone());
        entry.cancelled
    };
    if cancelled_before_start {
        stop(&running);
    }

    let stdout_reader = std::thread::spawn(move || {
        let mut text = String::new();
        if let Some(mut pipe) = stdout_pipe {
            let _ = pipe.read_to_string(&mut text);
        }
        text
    });
    let stderr = match stderr_pipe {
        Some(pipe) => read_progress(pipe, &mut on_progress)?,
        None => String::new(),
    };
    let status = wait(&running)?;
    let output = GitOutput {
        stdout: stdout_reader.join().unwrap_or_default(),
        stderr,
        success: status.success(),
    };
    record.finish(status.code(), output.stdout.as_bytes(), output.stderr.as_bytes());
    if output.success {
        // Finished before the cancel could stop it: the work is done, so report it.
        return Ok(Some(output));
    }
    if was_cancelled(cancel_id) {
        return Ok(None);
    }
    let text = output.text();
    let message = if text.is_empty() { format!("{describe} failed") } else { text };
    Err(AppError::Command { message })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::TestRepo;
    use std::time::Instant;

    #[test]
    #[cfg_attr(windows, ignore = "Windows stops only git itself, not its children, until cancel uses a Job Object")]
    fn cancel_stops_the_command_and_its_children() {
        let repo = TestRepo::new();
        repo.write("f.txt", "f\n");
        repo.git(&["add", "f.txt"]);
        let hook = repo.path.parent().expect("repo parent").join("hooks/pre-commit");
        std::fs::write(&hook, "#!/bin/sh\nsleep 30\n").unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&hook, std::fs::Permissions::from_mode(0o755)).unwrap();
        }

        let cancel_id = "test-cancel-hook";
        let canceller = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(300));
            cancel(cancel_id)
        });
        let started = Instant::now();
        let result = run_streaming(&repo.path, &["commit", "-m", "slow"], cancel_id, |_line: &str| {}).unwrap();
        assert!(canceller.join().unwrap(), "the command was running");
        assert!(result.is_none(), "a cancelled command reports None");
        assert!(started.elapsed() < Duration::from_secs(10), "the hook's sleep was stopped too");
        assert!(!cancel(cancel_id), "nothing runs under the id afterwards");
        assert!(repo.git_raw(&["rev-parse", "HEAD"]).status.code() != Some(0), "nothing was committed");
    }

    #[test]
    fn an_uncancelled_command_reports_its_output_or_error() {
        let repo = TestRepo::new();
        let output = run_streaming(&repo.path, &["status", "--short"], "test-cancel-plain", |_line: &str| {})
            .unwrap()
            .unwrap();
        assert!(output.success);
        let failed = run_streaming(&repo.path, &["rev-parse", "--verify", "nope"], "test-cancel-fail", |_line: &str| {});
        assert!(matches!(failed, Err(AppError::Command { .. })));
    }
}
