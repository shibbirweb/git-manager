//! Memory as Activity Monitor counts it, measured exactly like the current app's
//! src-tauri/src/memory.rs (which cannot be shared: one function there takes a Tauri window): the
//! app's own phys_footprint plus the WebKit helpers macOS holds it responsible for. The native app
//! has no WebKit helpers today, and counting the same way keeps the two apps' numbers comparable.

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessMemory {
    pub pid: i32,
    pub name: String,
    pub label: String,
    pub bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryUsage {
    pub total_bytes: u64,
    pub processes: Vec<ProcessMemory>,
    /// True when helpers were matched by start time (app started from a terminal).
    pub approximate: bool,
}

pub fn mb(bytes: u64) -> f64 {
    (bytes as f64 / (1024.0 * 1024.0) * 10.0).round() / 10.0
}

fn label_for(name: &str, is_self: bool) -> String {
    if is_self {
        "Git Manager Native (app)".to_string()
    } else if name.contains("WebContent") {
        "Web content (UI)".to_string()
    } else if name.contains("GPU") {
        "Graphics".to_string()
    } else if name.contains("Networking") {
        "Networking".to_string()
    } else {
        name.to_string()
    }
}

#[cfg(target_os = "macos")]
pub fn usage() -> MemoryUsage {
    macos::usage()
}

#[cfg(not(target_os = "macos"))]
pub fn usage() -> MemoryUsage {
    MemoryUsage { total_bytes: 0, processes: Vec::new(), approximate: true }
}

#[cfg(target_os = "macos")]
mod macos {
    use std::ffi::{c_int, c_void};

    use super::{label_for, MemoryUsage, ProcessMemory};

    const RUSAGE_INFO_V2: c_int = 2;

    #[repr(C)]
    #[derive(Default)]
    struct RusageInfoV2 {
        uuid: [u8; 16],
        user_time: u64,
        system_time: u64,
        pkg_idle_wkups: u64,
        interrupt_wkups: u64,
        pageins: u64,
        wired_size: u64,
        resident_size: u64,
        phys_footprint: u64,
        proc_start_abstime: u64,
        proc_exit_abstime: u64,
        child_user_time: u64,
        child_system_time: u64,
        child_pkg_idle_wkups: u64,
        child_interrupt_wkups: u64,
        child_pageins: u64,
        child_elapsed_abstime: u64,
        diskio_bytesread: u64,
        diskio_byteswritten: u64,
    }

    extern "C" {
        fn proc_listallpids(buffer: *mut c_void, buffersize: c_int) -> c_int;
        fn proc_name(pid: c_int, buffer: *mut c_void, buffersize: u32) -> c_int;
        fn proc_pid_rusage(pid: c_int, flavor: c_int, buffer: *mut c_void) -> c_int;
        // Exported by libSystem; Activity Monitor uses it to group helper processes.
        fn responsibility_get_pid_responsible_for_pid(pid: c_int) -> c_int;
    }

    fn rusage(pid: c_int) -> Option<RusageInfoV2> {
        let mut info = RusageInfoV2::default();
        // SAFETY: `info` is a correctly sized, writable rusage_info_v2 buffer.
        let result = unsafe { proc_pid_rusage(pid, RUSAGE_INFO_V2, &mut info as *mut RusageInfoV2 as *mut c_void) };
        (result == 0).then_some(info)
    }

    fn name_of(pid: c_int) -> String {
        let mut buffer = [0u8; 256];
        // SAFETY: the buffer is writable and its length is passed along.
        let length = unsafe { proc_name(pid, buffer.as_mut_ptr() as *mut c_void, buffer.len() as u32) };
        String::from_utf8_lossy(&buffer[..length.max(0) as usize]).into_owned()
    }

    fn all_pids() -> Vec<c_int> {
        let mut pids = vec![0 as c_int; 4096];
        loop {
            let capacity = (pids.len() * std::mem::size_of::<c_int>()) as c_int;
            // SAFETY: the buffer holds `capacity` bytes.
            let count = unsafe { proc_listallpids(pids.as_mut_ptr() as *mut c_void, capacity) };
            if count < 0 {
                return Vec::new();
            }
            if (count as usize) < pids.len() {
                pids.truncate(count as usize);
                return pids;
            }
            pids.resize(pids.len() * 2, 0);
        }
    }

    pub fn usage() -> MemoryUsage {
        let own = std::process::id() as c_int;
        let own_info = rusage(own);
        let own_start = own_info.as_ref().map(|info| info.proc_start_abstime).unwrap_or(0);
        // SAFETY: plain query on a pid.
        let responsible = unsafe { responsibility_get_pid_responsible_for_pid(own) };
        // Launched from Finder the app is responsible for itself and helpers match
        // exactly; from a terminal the terminal is, so also require a later start.
        let approximate = responsible != own;

        let mut processes = vec![ProcessMemory {
            pid: own,
            name: name_of(own),
            label: label_for("", true),
            bytes: own_info.map(|info| info.phys_footprint).unwrap_or(0),
        }];
        for pid in all_pids() {
            if pid <= 0 || pid == own {
                continue;
            }
            // SAFETY: plain query on a pid.
            if unsafe { responsibility_get_pid_responsible_for_pid(pid) } != responsible {
                continue;
            }
            let name = name_of(pid);
            if !name.starts_with("com.apple.WebKit") {
                continue;
            }
            let Some(info) = rusage(pid) else {
                continue;
            };
            if approximate && info.proc_start_abstime < own_start {
                continue;
            }
            processes.push(ProcessMemory {
                pid,
                label: label_for(&name, false),
                name,
                bytes: info.phys_footprint,
            });
        }
        MemoryUsage {
            total_bytes: processes.iter().map(|process| process.bytes).sum(),
            processes,
            approximate,
        }
    }
}
