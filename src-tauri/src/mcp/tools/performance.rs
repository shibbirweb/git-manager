use std::collections::BTreeMap;
use std::time::{Duration, Instant};

use base64::Engine;
use serde_json::{json, Value};

use super::{json_out, no_args, object, Args, BackendTool, ToolCtx, ToolOutput, ToolResult, PERFORMANCE};
use crate::memory::{self, MemoryUsage};

const MAX_DURATION_MS: u64 = 60_000;
const MIN_INTERVAL_MS: u64 = 100;

pub const TOOLS: &[BackendTool] = &[
    BackendTool {
        name: "get_memory_usage",
        title: "Memory usage",
        description: "Memory used right now by Git Manager and its WebKit helper processes (UI, graphics, networking), as Activity Monitor counts it; the status bar shows the same number.",
        category: PERFORMANCE,
        read_only: true,
        destructive: false,
        schema: no_args,
        run: get_memory_usage,
    },
    BackendTool {
        name: "sample_memory",
        title: "Sample memory",
        description: "Measures memory every intervalMs for durationMs (at most 60 s) and returns each sample with the minimum, maximum and average per process. Drive the UI with other tools meanwhile (from another call) to see what an action costs.",
        category: PERFORMANCE,
        read_only: true,
        destructive: false,
        schema: sample_schema,
        run: sample_memory,
    },
    BackendTool {
        name: "take_screenshot",
        title: "Screenshot",
        description: "A PNG screenshot of the Git Manager window, even when other windows cover it. macOS only; macOS asks for Screen Recording permission the first time.",
        category: PERFORMANCE,
        read_only: true,
        destructive: false,
        schema: no_args,
        run: take_screenshot,
    },
];

pub fn mb(bytes: u64) -> f64 {
    (bytes as f64 / (1024.0 * 1024.0) * 10.0).round() / 10.0
}

fn get_memory_usage(_ctx: &ToolCtx, _args: &Args) -> ToolResult {
    let usage = memory::usage();
    let mut value = json!(usage);
    value["totalMb"] = json!(mb(usage.total_bytes));
    json_out(value)
}

fn sample_schema() -> Value {
    object(
        json!({
            "durationMs": { "type": "integer", "description": format!("How long to sample (default 5000, at most {MAX_DURATION_MS}).") },
            "intervalMs": { "type": "integer", "description": format!("Time between samples (default 500, at least {MIN_INTERVAL_MS}).") },
        }),
        &[],
    )
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
        json!({ "minBytes": self.min, "maxBytes": self.max, "avgBytes": avg, "minMb": mb(self.min), "maxMb": mb(self.max), "avgMb": mb(avg) })
    }
}

/// Per-process and total statistics over the samples, keyed by "label (pid)".
pub fn summarize(samples: &[MemoryUsage]) -> Value {
    let mut total = Stats::default();
    let mut by_process: BTreeMap<String, Stats> = BTreeMap::new();
    for sample in samples {
        total.add(sample.total_bytes);
        for process in &sample.processes {
            by_process
                .entry(format!("{} ({})", process.label, process.pid))
                .or_default()
                .add(process.bytes);
        }
    }
    let processes: serde_json::Map<String, Value> =
        by_process.iter().map(|(key, stats)| (key.clone(), stats.to_json())).collect();
    json!({ "total": total.to_json(), "processes": processes })
}

fn sample_memory(_ctx: &ToolCtx, args: &Args) -> ToolResult {
    let duration = Duration::from_millis(args.u64("durationMs", 5000)?.min(MAX_DURATION_MS));
    let interval = Duration::from_millis(args.u64("intervalMs", 500)?.max(MIN_INTERVAL_MS));
    let started = Instant::now();
    let mut samples = Vec::new();
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
    let rows: Vec<Value> = samples
        .iter()
        .zip(&offsets)
        .map(|(sample, offset)| {
            let processes: serde_json::Map<String, Value> = sample
                .processes
                .iter()
                .map(|process| (format!("{} ({})", process.label, process.pid), json!(process.bytes)))
                .collect();
            json!({ "atMs": offset, "totalBytes": sample.total_bytes, "processes": processes })
        })
        .collect();
    let mut value = summarize(&samples);
    value["samples"] = json!(rows);
    value["approximate"] = json!(samples.iter().any(|sample| sample.approximate));
    json_out(value)
}

/// Width and height from the PNG header, for the caption.
fn png_size(bytes: &[u8]) -> Option<(u32, u32)> {
    let header = bytes.get(16..24)?;
    let width = u32::from_be_bytes(header[0..4].try_into().ok()?);
    let height = u32::from_be_bytes(header[4..8].try_into().ok()?);
    Some((width, height))
}

fn take_screenshot(ctx: &ToolCtx, _args: &Args) -> ToolResult {
    let host = ctx.host().ok_or("The app window is not ready")?;
    let png = host.screenshot_png()?;
    let caption = match png_size(&png) {
        Some((width, height)) => format!("Screenshot of the Git Manager window, {width}x{height} pixels."),
        None => "Screenshot of the Git Manager window.".to_string(),
    };
    Ok(ToolOutput::Image {
        png_base64: base64::engine::general_purpose::STANDARD.encode(png),
        caption,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::memory::ProcessMemory;

    fn sample(bytes: u64) -> MemoryUsage {
        MemoryUsage {
            total_bytes: bytes * 2,
            processes: vec![ProcessMemory {
                pid: 7,
                name: "app".to_string(),
                label: "Git Manager (app)".to_string(),
                bytes,
            }],
            approximate: false,
        }
    }

    #[test]
    fn summaries_give_min_max_and_average() {
        let summary = summarize(&[sample(10), sample(30), sample(20)]);
        let app = &summary["processes"]["Git Manager (app) (7)"];
        assert_eq!(app["minBytes"], 10);
        assert_eq!(app["maxBytes"], 30);
        assert_eq!(app["avgBytes"], 20);
        assert_eq!(summary["total"]["maxBytes"], 60);
        assert_eq!(png_size(&crate::test_support::image_bytes(&[0, 0, 0, 2, 0, 0, 0, 3])), Some((1, 2)));
    }
}
