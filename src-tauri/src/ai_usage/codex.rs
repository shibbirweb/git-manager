//! Codex's usage, from its own files: after each answer Codex writes its rate limits into the session log
//! (`<CODEX_HOME>/sessions/YYYY/MM/DD/rollout-*.jsonl`, a `token_count` event with `rate_limits`). The newest
//! record wins; no network and no sign-in are needed.

use std::path::{Path, PathBuf};

use serde_json::Value;

use super::{clamp_percent, is_session_window, time, ProviderUsage, UsageStatus, UsageWindow};

/// Session logs searched, newest first: enough for a quiet week, cheap to read.
const MAX_FILES: usize = 12;
/// Larger logs are read from their end only.
const TAIL_BYTES: u64 = 4 * 1024 * 1024;

pub fn usage(codex_dir: &Path, now_ms: i64) -> ProviderUsage {
    for file in newest_logs(&codex_dir.join("sessions")) {
        if let Some(record) = std::fs::read(&file).ok().and_then(|bytes| last_rate_limits(&tail(&bytes))) {
            return from_record(&record, now_ms);
        }
    }
    ProviderUsage::without_numbers("codex", UsageStatus::NoData, "No usage recorded yet: Codex writes it after an answer.")
}

fn tail(bytes: &[u8]) -> String {
    let start = bytes.len().saturating_sub(TAIL_BYTES as usize);
    String::from_utf8_lossy(&bytes[start..]).into_owned()
}

/// The `.jsonl` logs under `sessions`, newest first (by modification time).
fn newest_logs(sessions: &Path) -> Vec<PathBuf> {
    let mut found: Vec<(std::time::SystemTime, PathBuf)> = Vec::new();
    let mut folders = vec![(sessions.to_path_buf(), 0)];
    while let Some((folder, depth)) = folders.pop() {
        let Ok(entries) = std::fs::read_dir(&folder) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let Ok(metadata) = entry.metadata() else {
                continue;
            };
            if metadata.is_dir() && depth < 4 {
                folders.push((path, depth + 1));
            } else if metadata.is_file() && path.extension().is_some_and(|extension| extension == "jsonl") {
                found.push((metadata.modified().unwrap_or(std::time::UNIX_EPOCH), path));
            }
        }
    }
    found.sort_by_key(|(modified, _)| std::cmp::Reverse(*modified));
    found.into_iter().take(MAX_FILES).map(|(_, path)| path).collect()
}

/// A rate-limit record and when it was written.
#[derive(Debug, PartialEq)]
pub struct Record {
    pub rate_limits: Value,
    /// ms since the epoch; None when the line has no timestamp.
    pub written_at: Option<i64>,
}

/// The last line of a log that carries `rate_limits` (in its payload, or at the top in older logs).
pub fn last_rate_limits(log: &str) -> Option<Record> {
    log.lines().rev().filter(|line| line.contains("\"rate_limits\"")).find_map(|line| {
        let value: Value = serde_json::from_str(line).ok()?;
        let rate_limits = value
            .get("payload")
            .and_then(|payload| payload.get("rate_limits"))
            .or_else(|| value.get("rate_limits"))?
            .clone();
        if !rate_limits.is_object() {
            return None;
        }
        let written_at = value.get("timestamp").and_then(Value::as_str).and_then(time::parse_iso_ms);
        Some(Record { rate_limits, written_at })
    })
}

/// `{"primary": {...}, "secondary": {...}}` as the session and weekly windows.
pub fn from_record(record: &Record, now_ms: i64) -> ProviderUsage {
    let mut session = None;
    let mut weekly = None;
    for (key, fallback_minutes) in [("primary", 300), ("secondary", 10_080)] {
        let Some(window) = record.rate_limits.get(key).and_then(|raw| window(raw, fallback_minutes, record.written_at, now_ms)) else {
            continue;
        };
        if is_session_window(window.window_minutes) {
            session = session.or(Some(window));
        } else {
            weekly = weekly.or(Some(window));
        }
    }
    let plan = record.rate_limits.get("plan_type").and_then(Value::as_str).map(str::to_string);
    let status = if session.is_none() && weekly.is_none() { UsageStatus::NoData } else { UsageStatus::Ok };
    ProviderUsage {
        provider: "codex",
        status,
        session,
        weekly,
        model_weekly: Vec::new(),
        plan,
        message: None,
    }
}

/// One window: `used_percent`, `window_minutes`, and `resets_at` (epoch seconds) or `resets_in_seconds` (from
/// when it was written). A window whose reset has passed starts over at 0%.
fn window(raw: &Value, fallback_minutes: u32, written_at: Option<i64>, now_ms: i64) -> Option<UsageWindow> {
    let used = raw.get("used_percent")?.as_f64()?;
    let window_minutes = raw
        .get("window_minutes")
        .and_then(Value::as_u64)
        .filter(|minutes| *minutes > 0)
        .map(|minutes| minutes.min(u32::MAX as u64) as u32)
        .unwrap_or(fallback_minutes);
    let resets_at = raw.get("resets_at").and_then(time::reset_ms).or_else(|| {
        let seconds = raw.get("resets_in_seconds")?.as_f64()?;
        Some(written_at? + (seconds * 1_000.0) as i64)
    });
    if resets_at.is_some_and(|reset| reset <= now_ms) {
        return Some(UsageWindow {
            used_percent: 0.0,
            window_minutes,
            resets_at: None,
        });
    }
    Some(UsageWindow {
        used_percent: clamp_percent(used),
        window_minutes,
        resets_at,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: i64 = 1_791_700_000_000;

    fn line(timestamp: &str, rate_limits: &str) -> String {
        format!(
            r#"{{"timestamp":"{timestamp}","type":"event_msg","payload":{{"type":"token_count","info":null,"rate_limits":{rate_limits}}}}}"#
        )
    }

    #[test]
    fn takes_the_last_rate_limits_of_a_log() {
        let log = [
            line("2026-10-11T10:00:00Z", r#"{"primary":{"used_percent":10,"window_minutes":300}}"#),
            r#"{"type":"response_item","payload":{"text":"no limits here"}}"#.to_string(),
            line("2026-10-11T11:00:00Z", r#"{"primary":{"used_percent":40,"window_minutes":300}}"#),
            "not json with \"rate_limits\"".to_string(),
        ]
        .join("\n");
        let record = last_rate_limits(&log).unwrap();
        assert_eq!(record.rate_limits["primary"]["used_percent"], 40);
        assert_eq!(record.written_at, Some(time::parse_iso_ms("2026-10-11T11:00:00Z").unwrap()));
        assert_eq!(last_rate_limits("{}\n{\"x\":1}"), None);
        // Older logs put rate_limits at the top.
        assert!(last_rate_limits(r#"{"rate_limits":{"primary":{"used_percent":5}}}"#).is_some());
    }

    #[test]
    fn sorts_windows_by_length_and_reads_both_reset_forms() {
        let written = time::parse_iso_ms("2026-10-11T11:00:00Z").unwrap();
        let record = Record {
            rate_limits: serde_json::json!({
                "primary": {"used_percent": 120.0, "window_minutes": 10080, "resets_at": 1_791_800_000},
                "secondary": {"used_percent": 22.5, "window_minutes": 300, "resets_in_seconds": 3600},
                "plan_type": "plus"
            }),
            written_at: Some(written),
        };
        let usage = from_record(&record, NOW);
        assert_eq!(usage.status, UsageStatus::Ok);
        assert_eq!(usage.plan.as_deref(), Some("plus"));
        assert_eq!(
            usage.session,
            Some(UsageWindow {
                used_percent: 22.5,
                window_minutes: 300,
                resets_at: Some(written + 3_600_000),
            }),
        );
        assert_eq!(usage.weekly.as_ref().map(|weekly| (weekly.used_percent, weekly.resets_at)), Some((100.0, Some(1_791_800_000_000))));
    }

    #[test]
    fn a_window_that_has_reset_starts_over() {
        let record = Record {
            rate_limits: serde_json::json!({"primary": {"used_percent": 90.0, "resets_at": 1_791_600_000}}),
            written_at: None,
        };
        let usage = from_record(&record, NOW);
        assert_eq!(usage.session.map(|session| (session.used_percent, session.window_minutes)), Some((0.0, 300)));
    }

    #[test]
    fn reads_the_newest_log_that_has_numbers() {
        let temp = tempfile::tempdir().unwrap();
        let day = temp.path().join("sessions/2026/10/11");
        std::fs::create_dir_all(&day).unwrap();
        std::fs::write(day.join("rollout-old.jsonl"), line("2026-10-11T09:00:00Z", r#"{"primary":{"used_percent":12}}"#)).unwrap();
        // Newer, but without numbers: the older log answers.
        std::thread::sleep(std::time::Duration::from_millis(20));
        std::fs::write(day.join("rollout-new.jsonl"), r#"{"type":"session_meta"}"#).unwrap();
        let usage = usage(temp.path(), NOW);
        assert_eq!(usage.session.map(|session| session.used_percent), Some(12.0));

        let empty = tempfile::tempdir().unwrap();
        assert_eq!(super::usage(empty.path(), NOW).status, UsageStatus::NoData);
    }
}
