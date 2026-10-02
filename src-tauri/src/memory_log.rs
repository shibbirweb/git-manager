//! The debug memory log (Settings > Automation): while it is on, a thread reads the memory of
//! the app and its WebKit processes every interval and writes a line to
//! ~/.gitmanager/logs/memory.log whenever the total changed by the threshold or more, plus a line
//! for every UI event the window reports (tab, view, scroll start and stop). Off: no thread.

use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::Serialize;

use crate::memory::{self, MemoryUsage};

const FILE_NAME: &str = "memory.log";
/// The log is cut when it grows past this; the previous one is kept as memory.log.1.
const MAX_LOG_BYTES: u64 = 5 * 1024 * 1024;
const MIN_INTERVAL_MS: u64 = 100;
const MAX_EVENTS_QUEUED: usize = 200;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MemoryLogStatus {
    pub enabled: bool,
    pub path: String,
    pub interval_ms: u64,
    pub threshold_mb: f64,
}

struct Running {
    stop: Arc<AtomicBool>,
    events: Arc<Mutex<Vec<String>>>,
}

#[derive(Default)]
pub struct MemoryLog {
    running: Mutex<Option<Running>>,
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn mb(bytes: u64) -> f64 {
    bytes as f64 / (1024.0 * 1024.0)
}

/// UTC time with milliseconds, e.g. 2026-10-02T04:20:31.512Z.
fn timestamp(now: SystemTime) -> String {
    let millis = now.duration_since(UNIX_EPOCH).map(|elapsed| elapsed.as_millis() as u64).unwrap_or_default();
    let (seconds, millis) = (millis / 1000, millis % 1000);
    let (days, day_seconds) = (seconds / 86_400, seconds % 86_400);
    // Civil date from days since 1970 (Howard Hinnant's algorithm).
    let z = days as i64 + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}.{millis:03}Z",
        day_seconds / 3600,
        (day_seconds / 60) % 60,
        day_seconds % 60
    )
}

/// One reading as a log line: the total, its change since the last line, and each process.
pub fn usage_line(at: SystemTime, usage: &MemoryUsage, previous_total: Option<u64>) -> String {
    let delta = previous_total
        .map(|previous| format!(" ({:+.1})", mb(usage.total_bytes) - mb(previous)))
        .unwrap_or_default();
    let mut line = format!("{} total {:.1} MB{delta}", timestamp(at), mb(usage.total_bytes));
    for process in &usage.processes {
        let short = process.label.split(" (").next().unwrap_or(&process.label);
        line.push_str(&format!(" | {short} {:.1}", mb(process.bytes)));
    }
    line
}

fn event_line(at: SystemTime, label: &str) -> String {
    format!("{} event {label}", timestamp(at))
}

/// Appends lines, starting a new file (and keeping the old one as .1) past MAX_LOG_BYTES.
fn append(path: &Path, lines: &[String]) {
    if lines.is_empty() {
        return;
    }
    if std::fs::metadata(path).map(|meta| meta.len() > MAX_LOG_BYTES).unwrap_or(false) {
        let _ = std::fs::rename(path, path.with_extension("log.1"));
    }
    let file: std::io::Result<File> = OpenOptions::new().create(true).append(true).open(path);
    if let Ok(mut file) = file {
        let _ = file.write_all(format!("{}\n", lines.join("\n")).as_bytes());
    }
}

impl MemoryLog {
    pub fn path_in(config_dir: &Path) -> PathBuf {
        config_dir.join("logs").join(FILE_NAME)
    }

    /// Turns the log on (or changes its interval and threshold) or off.
    pub fn configure(&self, config_dir: &Path, enabled: bool, interval_ms: u64, threshold_mb: f64) -> MemoryLogStatus {
        let path = Self::path_in(config_dir);
        let interval_ms = interval_ms.max(MIN_INTERVAL_MS);
        let threshold_mb = if threshold_mb.is_finite() { threshold_mb.max(0.0) } else { 5.0 };
        let mut running = lock(&self.running);
        if let Some(old) = running.take() {
            old.stop.store(true, Ordering::SeqCst);
        }
        if enabled {
            let _ = std::fs::create_dir_all(path.parent().unwrap_or(config_dir));
            let stop = Arc::new(AtomicBool::new(false));
            let events: Arc<Mutex<Vec<String>>> = Arc::default();
            let (thread_stop, thread_events, thread_path) = (Arc::clone(&stop), Arc::clone(&events), path.clone());
            let started = std::thread::Builder::new()
                .name("gm-memory-log".to_string())
                .spawn(move || run(&thread_path, &thread_stop, &thread_events, interval_ms, threshold_mb));
            if started.is_ok() {
                *running = Some(Running { stop, events });
            }
        }
        MemoryLogStatus {
            enabled: running.is_some(),
            path: path.to_string_lossy().into_owned(),
            interval_ms,
            threshold_mb,
        }
    }

    /// A UI event to log with the next reading (dropped while the log is off).
    pub fn event(&self, label: &str) {
        let running = lock(&self.running);
        if let Some(running) = running.as_ref() {
            let mut events = lock(&running.events);
            if events.len() < MAX_EVENTS_QUEUED {
                let label: String = label.chars().filter(|character| !character.is_control()).take(300).collect();
                events.push(event_line(SystemTime::now(), &label));
            }
        }
    }

    pub fn stop(&self) {
        if let Some(old) = lock(&self.running).take() {
            old.stop.store(true, Ordering::SeqCst);
        }
    }
}

/// The last `lines` lines of the log, oldest first.
pub fn read_tail(config_dir: &Path, lines: usize) -> String {
    let text = std::fs::read_to_string(MemoryLog::path_in(config_dir)).unwrap_or_default();
    let all: Vec<&str> = text.lines().collect();
    all[all.len().saturating_sub(lines)..].join("\n")
}

fn run(path: &Path, stop: &AtomicBool, events: &Mutex<Vec<String>>, interval_ms: u64, threshold_mb: f64) {
    let interval = Duration::from_millis(interval_ms);
    let mut last_logged: Option<u64> = None;
    append(path, &[event_line(SystemTime::now(), &format!("memory log started (every {interval_ms} ms, changes of {threshold_mb} MB or more)"))]);
    while !stop.load(Ordering::SeqCst) {
        let usage = memory::usage();
        let now = SystemTime::now();
        let mut lines: Vec<String> = std::mem::take(&mut *lock(events));
        let changed = last_logged.is_none_or(|previous| (mb(usage.total_bytes) - mb(previous)).abs() >= threshold_mb);
        // An event always gets the reading next to it, so each action shows what it cost.
        if changed || !lines.is_empty() {
            lines.push(usage_line(now, &usage, last_logged));
            last_logged = Some(usage.total_bytes);
        }
        append(path, &lines);
        std::thread::sleep(interval);
    }
    let mut lines: Vec<String> = std::mem::take(&mut *lock(events));
    lines.push(event_line(SystemTime::now(), "memory log stopped"));
    append(path, &lines);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::memory::ProcessMemory;

    #[test]
    fn timestamps_are_utc_with_milliseconds() {
        assert_eq!(timestamp(UNIX_EPOCH + Duration::from_millis(1_790_894_975_987)), "2026-10-01T22:49:35.987Z");
        assert_eq!(timestamp(UNIX_EPOCH), "1970-01-01T00:00:00.000Z");
    }

    #[test]
    fn a_line_shows_the_total_its_change_and_each_process() {
        let usage = MemoryUsage {
            processes: vec![ProcessMemory {
                pid: 1,
                name: "com.apple.WebKit.WebContent".to_string(),
                label: "Web content (UI)".to_string(),
                bytes: 300 * 1024 * 1024,
            }],
            total_bytes: 400 * 1024 * 1024,
            approximate: false,
        };
        let line = usage_line(UNIX_EPOCH, &usage, Some(350 * 1024 * 1024));
        assert_eq!(line, "1970-01-01T00:00:00.000Z total 400.0 MB (+50.0) | Web content 300.0");
    }

    #[test]
    fn logs_changes_and_events_then_stops() {
        let temp = tempfile::tempdir().unwrap();
        let log = MemoryLog::default();
        let status = log.configure(temp.path(), true, 100, 0.0);
        assert!(status.enabled);
        log.event("tab README.md");
        std::thread::sleep(Duration::from_millis(450));
        log.configure(temp.path(), false, 100, 0.0);
        std::thread::sleep(Duration::from_millis(250));
        let text = read_tail(temp.path(), 100);
        assert!(text.contains("memory log started"), "{text}");
        assert!(text.contains("event tab README.md"), "{text}");
        assert!(text.lines().filter(|line| line.contains(" total ")).count() >= 2, "{text}");
        assert!(text.ends_with("event memory log stopped"), "{text}");
        log.event("ignored while off");
        assert!(!read_tail(temp.path(), 100).contains("ignored"));
    }
}
