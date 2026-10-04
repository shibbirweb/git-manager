//! Live memory recording: a background sampler an agent starts, reads while it drives the UI
//! (or while the user scrolls by hand), marks with labels, and stops. Nothing runs or is kept
//! until it is started, and it stops itself after its time limit or when the server stops.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde_json::{json, Value};

use super::performance::mb;
use super::{json_out, no_args, object, Args, BackendTool, ToolCtx, ToolResult, PERFORMANCE};
use crate::memory::{self, MemoryUsage};

const DEFAULT_INTERVAL_MS: u64 = 250;
const MIN_INTERVAL_MS: u64 = 100;
const DEFAULT_MAX_SECONDS: u64 = 600;
const MAX_SECONDS: u64 = 3600;
/// Samples kept: the oldest go first, so a long recording stays small (each is a few numbers).
const MAX_SAMPLES: usize = 7200;
const MAX_MARKS: usize = 200;

pub const TOOLS: &[BackendTool] = &[
    BackendTool {
        name: "read_memory_log",
        title: "Read memory log",
        description: "The last lines of the debug memory log (Settings > Automation > Memory log): a reading whenever memory changed by the threshold, next to the UI events (tab, view, scroll start and stop) that happened then. Empty when the log was never turned on.",
        category: PERFORMANCE,
        read_only: true,
        destructive: false,
        schema: log_schema,
        run: read_log,
    },
    BackendTool {
        name: "start_memory_recording",
        title: "Start memory recording",
        description: "Starts recording memory in the background every intervalMs (default 250 ms) until stopped or maxSeconds (default 600) pass. Then drive the UI, or ask the user to act, and read the live numbers with read_memory_recording.",
        category: PERFORMANCE,
        read_only: true,
        destructive: false,
        schema: start_schema,
        run: start,
    },
    BackendTool {
        name: "read_memory_recording",
        title: "Read memory recording",
        description: "The live memory recording: samples after sinceMs (pass the last atMs you saw to get only new ones), the latest reading, the peak with its time, per-process minimum, maximum and average, and the marks.",
        category: PERFORMANCE,
        read_only: true,
        destructive: false,
        schema: read_schema,
        run: read,
    },
    BackendTool {
        name: "mark_memory_recording",
        title: "Mark memory recording",
        description: "Puts a label on the memory recording at this moment (for example \"fast scroll starts\"), so peaks can be matched to actions.",
        category: PERFORMANCE,
        read_only: true,
        destructive: false,
        schema: mark_schema,
        run: mark,
    },
    BackendTool {
        name: "stop_memory_recording",
        title: "Stop memory recording",
        description: "Stops the memory recording and returns its summary (peak, per-process minimum, maximum and average, marks); the samples are freed.",
        category: PERFORMANCE,
        read_only: true,
        destructive: false,
        schema: no_args,
        run: stop,
    },
];

struct Sample {
    at_ms: u64,
    usage: MemoryUsage,
}

struct Recording {
    started: Instant,
    started_at: u64,
    interval_ms: u64,
    max_seconds: u64,
    samples: Vec<Sample>,
    /// Samples dropped from the front to stay under MAX_SAMPLES.
    dropped: u64,
    marks: Vec<(u64, String)>,
    running: Arc<AtomicBool>,
    stopped_reason: Option<&'static str>,
}

static RECORDING: Mutex<Option<Recording>> = Mutex::new(None);

fn lock() -> MutexGuard<'static, Option<Recording>> {
    RECORDING.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as u64)
        .unwrap_or_default()
}

/// Ends a running recording's sampler; the server calls this when it stops.
pub fn stop_sampler() {
    if let Some(recording) = lock().as_mut() {
        if recording.running.swap(false, Ordering::SeqCst) {
            recording.stopped_reason = Some("the server stopped");
        }
    }
}

fn log_schema() -> Value {
    object(json!({ "lines": { "type": "integer", "minimum": 1, "maximum": 5000, "description": "How many of the last lines (default 200)." } }), &[])
}

fn read_log(_ctx: &ToolCtx, args: &Args) -> ToolResult {
    let lines = args.u64("lines", 200)?.clamp(1, 5000) as usize;
    let home = crate::config::home_dir().map_err(|err| err.to_string())?;
    let config_dir = crate::config::config_dir_in(&home);
    let text = crate::memory_log::read_tail(&config_dir, lines);
    json_out(json!({
        "path": crate::paths::to_ui(crate::memory_log::MemoryLog::path_in(&config_dir)),
        "lines": text.lines().collect::<Vec<_>>(),
    }))
}

fn start_schema() -> Value {
    object(
        json!({
            "intervalMs": { "type": "integer", "minimum": MIN_INTERVAL_MS, "description": format!("Time between samples (default {DEFAULT_INTERVAL_MS}).") },
            "maxSeconds": { "type": "integer", "minimum": 1, "maximum": MAX_SECONDS, "description": format!("Stops by itself after this long (default {DEFAULT_MAX_SECONDS}).") },
        }),
        &[],
    )
}

fn read_schema() -> Value {
    object(
        json!({
            "sinceMs": { "type": "integer", "minimum": 0, "description": "Only samples with atMs greater than this (ms since the recording started). Leave out for all." },
            "includeSamples": { "type": "boolean", "description": "Return the samples themselves (default true); false gives only the summary." },
        }),
        &[],
    )
}

fn mark_schema() -> Value {
    object(json!({ "label": { "type": "string", "minLength": 1, "maxLength": 200, "description": "What is happening now." } }), &["label"])
}

fn start(_ctx: &ToolCtx, args: &Args) -> ToolResult {
    let interval_ms = args.u64("intervalMs", DEFAULT_INTERVAL_MS)?.max(MIN_INTERVAL_MS);
    let max_seconds = args.u64("maxSeconds", DEFAULT_MAX_SECONDS)?.clamp(1, MAX_SECONDS);
    let running = Arc::new(AtomicBool::new(true));
    {
        let mut slot = lock();
        if let Some(old) = slot.as_ref() {
            // A new recording replaces the old one.
            old.running.store(false, Ordering::SeqCst);
        }
        *slot = Some(Recording {
            started: Instant::now(),
            started_at: now_ms(),
            interval_ms,
            max_seconds,
            samples: Vec::new(),
            dropped: 0,
            marks: Vec::new(),
            running: Arc::clone(&running),
            stopped_reason: None,
        });
    }
    let flag = Arc::clone(&running);
    std::thread::Builder::new()
        .name("gm-memory-recorder".to_string())
        .spawn(move || sample_loop(flag, interval_ms, max_seconds))
        .map_err(|err| format!("Could not start the recorder: {err}"))?;
    json_out(json!({ "recording": true, "intervalMs": interval_ms, "maxSeconds": max_seconds, "startedAt": now_ms() }))
}

fn sample_loop(running: Arc<AtomicBool>, interval_ms: u64, max_seconds: u64) {
    let started = Instant::now();
    let interval = Duration::from_millis(interval_ms);
    let limit = Duration::from_secs(max_seconds);
    let mut count: u32 = 0;
    while running.load(Ordering::SeqCst) {
        // Measured outside the lock: reading the processes takes a few milliseconds.
        let usage = memory::usage();
        let at_ms = started.elapsed().as_millis() as u64;
        {
            let mut slot = lock();
            let Some(recording) = slot.as_mut().filter(|recording| Arc::ptr_eq(&recording.running, &running)) else {
                return;
            };
            recording.samples.push(Sample { at_ms, usage });
            if recording.samples.len() > MAX_SAMPLES {
                let extra = recording.samples.len() - MAX_SAMPLES;
                recording.samples.drain(..extra);
                recording.dropped += extra as u64;
            }
            if started.elapsed() >= limit {
                running.store(false, Ordering::SeqCst);
                recording.stopped_reason = Some("its time limit passed");
                return;
            }
        }
        count += 1;
        std::thread::sleep((interval * count).saturating_sub(started.elapsed()));
    }
}

fn sample_json(sample: &Sample) -> Value {
    let processes: serde_json::Map<String, Value> = sample
        .usage
        .processes
        .iter()
        .map(|process| (format!("{} ({})", process.label, process.pid), json!(mb(process.bytes))))
        .collect();
    json!({ "atMs": sample.at_ms, "totalMb": mb(sample.usage.total_bytes), "processesMb": processes })
}

fn summary(recording: &Recording) -> Value {
    let usages: Vec<MemoryUsage> = recording.samples.iter().map(|sample| sample.usage.clone()).collect();
    let mut value = super::performance::summarize(&usages);
    let peak = recording.samples.iter().max_by_key(|sample| sample.usage.total_bytes);
    value["recording"] = json!(recording.running.load(Ordering::SeqCst));
    value["stoppedBecause"] = json!(recording.stopped_reason);
    value["startedAt"] = json!(recording.started_at);
    value["elapsedMs"] = json!(recording.started.elapsed().as_millis() as u64);
    value["intervalMs"] = json!(recording.interval_ms);
    value["maxSeconds"] = json!(recording.max_seconds);
    value["sampleCount"] = json!(recording.samples.len());
    value["droppedSamples"] = json!(recording.dropped);
    value["latest"] = recording.samples.last().map(sample_json).unwrap_or(Value::Null);
    value["peak"] = peak.map(sample_json).unwrap_or(Value::Null);
    value["marks"] = json!(recording.marks.iter().map(|(at_ms, label)| json!({ "atMs": at_ms, "label": label })).collect::<Vec<_>>());
    value
}

fn read(_ctx: &ToolCtx, args: &Args) -> ToolResult {
    let since = args.u64("sinceMs", 0)?;
    let has_since = args.present("sinceMs").is_some();
    let include = args.bool("includeSamples", true)?;
    let slot = lock();
    let Some(recording) = slot.as_ref() else {
        return Err("No memory recording. Start one with start_memory_recording.".to_string());
    };
    let mut value = summary(recording);
    if include {
        let samples: Vec<Value> = recording
            .samples
            .iter()
            .filter(|sample| !has_since || sample.at_ms > since)
            .map(sample_json)
            .collect();
        value["samples"] = json!(samples);
    }
    json_out(value)
}

fn mark(_ctx: &ToolCtx, args: &Args) -> ToolResult {
    let label = args.text("label")?.trim().chars().take(200).collect::<String>();
    let mut slot = lock();
    let Some(recording) = slot.as_mut() else {
        return Err("No memory recording. Start one with start_memory_recording.".to_string());
    };
    let at_ms = recording.started.elapsed().as_millis() as u64;
    if recording.marks.len() < MAX_MARKS {
        recording.marks.push((at_ms, label.clone()));
    }
    json_out(json!({ "atMs": at_ms, "label": label }))
}

fn stop(_ctx: &ToolCtx, _args: &Args) -> ToolResult {
    let Some(recording) = lock().take() else {
        return Err("No memory recording to stop.".to_string());
    };
    recording.running.store(false, Ordering::SeqCst);
    let mut value = summary(&recording);
    value["recording"] = json!(false);
    json_out(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Map;

    fn call(run: fn(&ToolCtx, &Args) -> ToolResult, ctx: &ToolCtx, value: Value) -> ToolResult {
        let map: Map<String, Value> = value.as_object().cloned().unwrap_or_default();
        run(ctx, &Args(&map))
    }

    #[test]
    #[cfg_attr(not(target_os = "macos"), ignore = "the memory readout is macOS only")]
    fn records_marks_reads_new_samples_and_stops() {
        // One test owns the global recorder, so the steps run in order.
        let shared = crate::mcp::Shared::new(Duration::from_secs(1));
        let ctx = ToolCtx { shared: &shared };
        assert!(call(read, &ctx, json!({})).is_err(), "nothing recorded yet");
        call(start, &ctx, json!({ "intervalMs": 100, "maxSeconds": 30 })).unwrap();
        std::thread::sleep(Duration::from_millis(450));
        call(mark, &ctx, json!({ "label": "scroll starts" })).unwrap();
        std::thread::sleep(Duration::from_millis(250));
        let first = json_value(call(read, &ctx, json!({})).unwrap());
        let samples = first["samples"].as_array().unwrap();
        assert!(samples.len() >= 3, "{first}");
        assert_eq!(first["recording"], json!(true));
        assert_eq!(first["marks"][0]["label"], json!("scroll starts"));
        let last_at = samples.last().unwrap()["atMs"].as_u64().unwrap();
        std::thread::sleep(Duration::from_millis(250));
        let newer = json_value(call(read, &ctx, json!({ "sinceMs": last_at })).unwrap());
        assert!(newer["samples"].as_array().unwrap().iter().all(|sample| sample["atMs"].as_u64().unwrap() > last_at));
        let summary_only = json_value(call(read, &ctx, json!({ "includeSamples": false })).unwrap());
        assert!(summary_only.get("samples").is_none());
        assert!(summary_only["peak"]["totalMb"].as_f64().unwrap() > 0.0);

        let stopped = json_value(call(stop, &ctx, json!({})).unwrap());
        assert_eq!(stopped["recording"], json!(false));
        assert!(call(stop, &ctx, json!({})).is_err(), "already freed");

        // The server stopping ends a running recorder.
        call(start, &ctx, json!({ "intervalMs": 100 })).unwrap();
        stop_sampler();
        let ended = json_value(call(read, &ctx, json!({ "includeSamples": false })).unwrap());
        assert_eq!(ended["recording"], json!(false));
        assert_eq!(ended["stoppedBecause"], json!("the server stopped"));
        let _ = call(stop, &ctx, json!({}));
    }

    fn json_value(output: super::super::ToolOutput) -> Value {
        match output {
            super::super::ToolOutput::Json(value) => value,
            _ => Value::Null,
        }
    }
}
