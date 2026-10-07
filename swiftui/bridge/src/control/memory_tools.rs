//! get_memory_usage and sample_memory, with the current app's arguments, limits and result shape
//! (src-tauri/src/mcp/tools/performance.rs), so one command measures either app.

use std::collections::BTreeMap;
use std::time::{Duration, Instant};

use serde_json::{json, Map, Value};

use super::protocol::{Output, ToolResult};
use super::tools::object;
use super::Server;
use crate::memory::{self, mb, MemoryUsage};

const MAX_SAMPLE_MS: u64 = 60_000;
const MIN_INTERVAL_MS: u64 = 100;

pub(super) fn sample_schema() -> Value {
    let duration = format!("How long to sample (default 5000, at most {MAX_SAMPLE_MS}).");
    let interval = format!("Time between samples (default 500, at least {MIN_INTERVAL_MS}).");
    object(
        json!({
            "durationMs": { "type": "integer", "description": duration },
            "intervalMs": { "type": "integer", "description": interval },
        }),
        &[],
    )
}

pub(super) fn get_memory_usage(_server: &Server, _args: &Map<String, Value>) -> ToolResult {
    let usage = memory::usage();
    let mut value = json!(usage);
    value["totalMb"] = json!(mb(usage.total_bytes));
    Ok(Output::Json(value))
}

fn u64_arg(args: &Map<String, Value>, key: &str, default: u64) -> Result<u64, String> {
    match args.get(key) {
        None | Some(Value::Null) => Ok(default),
        Some(value) => value.as_u64().ok_or_else(|| format!("{key} must be a whole number")),
    }
}

#[derive(Default)]
struct Stats {
    min: u64,
    max: u64,
    sum: u64,
    count: u64,
}

impl Stats {
    fn add(&mut self, bytes: u64) {
        self.min = if self.count == 0 { bytes } else { self.min.min(bytes) };
        self.max = self.max.max(bytes);
        self.sum += bytes;
        self.count += 1;
    }

    fn to_json(&self) -> Value {
        let avg = self.sum.checked_div(self.count).unwrap_or(0);
        json!({
            "minBytes": self.min, "maxBytes": self.max, "avgBytes": avg,
            "minMb": mb(self.min), "maxMb": mb(self.max), "avgMb": mb(avg),
        })
    }
}

pub(super) fn sample_memory(_server: &Server, args: &Map<String, Value>) -> ToolResult {
    let duration = Duration::from_millis(u64_arg(args, "durationMs", 5000)?.min(MAX_SAMPLE_MS));
    let interval = Duration::from_millis(u64_arg(args, "intervalMs", 500)?.max(MIN_INTERVAL_MS));
    let started = Instant::now();
    let mut samples: Vec<MemoryUsage> = Vec::new();
    let mut offsets = Vec::new();
    loop {
        offsets.push(started.elapsed().as_millis() as u64);
        samples.push(memory::usage());
        let next = interval * samples.len() as u32;
        if next > duration {
            break;
        }
        std::thread::sleep(next.saturating_sub(started.elapsed()));
    }
    let label = |process: &memory::ProcessMemory| format!("{} ({})", process.label, process.pid);
    let mut total = Stats::default();
    let mut by_process: BTreeMap<String, Stats> = BTreeMap::new();
    for sample in &samples {
        total.add(sample.total_bytes);
        for process in &sample.processes {
            by_process.entry(label(process)).or_default().add(process.bytes);
        }
    }
    let rows: Vec<Value> = samples
        .iter()
        .zip(&offsets)
        .map(|(sample, offset)| {
            let processes: Map<String, Value> =
                sample.processes.iter().map(|process| (label(process), json!(process.bytes))).collect();
            json!({ "atMs": offset, "totalBytes": sample.total_bytes, "processes": processes })
        })
        .collect();
    let processes: Map<String, Value> = by_process.iter().map(|(key, stats)| (key.clone(), stats.to_json())).collect();
    Ok(Output::Json(json!({
        "total": total.to_json(),
        "processes": processes,
        "samples": rows,
        "approximate": samples.iter().any(|sample| sample.approximate),
    })))
}
