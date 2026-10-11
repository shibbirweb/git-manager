//! Memory of each terminal, like Orca's resource manager: the shell plus everything it started (an agent,
//! node, git, a dev server), counted like the memory readout (`memory.rs`). These processes are not part of
//! the app's own total, so the details show them as a section of their own.

use std::collections::{HashMap, HashSet};

use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalMemory {
    pub terminal_id: u32,
    pub bytes: u64,
    /// The shell and the processes below it that could be measured.
    pub processes: u32,
}

/// `root` and every process below it in a list of (pid, parent pid). Each pid is taken once, so a
/// stale list with a reused pid cannot loop.
pub fn process_tree(root: u32, parents: &[(u32, u32)]) -> Vec<u32> {
    let mut children: HashMap<u32, Vec<u32>> = HashMap::new();
    for (pid, parent_pid) in parents {
        if pid != parent_pid {
            children.entry(*parent_pid).or_default().push(*pid);
        }
    }
    let mut found = vec![root];
    let mut seen = HashSet::from([root]);
    let mut index = 0;
    while index < found.len() {
        for pid in children.get(&found[index]).map(Vec::as_slice).unwrap_or_default() {
            if seen.insert(*pid) {
                found.push(*pid);
            }
        }
        index += 1;
    }
    found
}

/// Adds up a tree; processes that ended meanwhile are left out.
fn measure_tree(terminal_id: u32, pids: &[u32], bytes_of: impl Fn(u32) -> Option<u64>) -> TerminalMemory {
    let measured: Vec<u64> = pids.iter().filter_map(|pid| bytes_of(*pid)).collect();
    TerminalMemory {
        terminal_id,
        bytes: measured.iter().sum(),
        processes: measured.len() as u32,
    }
}

/// Measures each terminal of `shells`, given as (terminal id, shell pid).
pub fn usage(shells: &[(u32, u32)]) -> Vec<TerminalMemory> {
    if shells.is_empty() {
        return Vec::new();
    }
    let parents = crate::memory::process_parents();
    shells
        .iter()
        .map(|(terminal_id, shell_pid)| {
            measure_tree(*terminal_id, &process_tree(*shell_pid, &parents), crate::memory::process_bytes)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_tree_is_the_shell_and_everything_below_it() {
        let parents = vec![(1, 0), (100, 1), (200, 100), (201, 100), (300, 200), (400, 1), (500, 400)];
        let mut tree = process_tree(100, &parents);
        tree.sort_unstable();
        assert_eq!(tree, vec![100, 200, 201, 300]);
        assert_eq!(process_tree(300, &parents), vec![300]);
        // A shell that is already gone from the list still counts as its own root.
        assert_eq!(process_tree(999, &parents), vec![999]);
    }

    #[test]
    fn a_reused_pid_cannot_loop() {
        let parents = vec![(100, 1), (200, 100), (100, 200), (300, 300)];
        let mut tree = process_tree(100, &parents);
        tree.sort_unstable();
        assert_eq!(tree, vec![100, 200]);
        assert_eq!(process_tree(300, &parents), vec![300]);
    }

    #[test]
    fn ended_processes_are_left_out_of_the_sum() {
        let bytes_of = |pid: u32| (pid != 201).then_some(u64::from(pid) * 1000);
        let measured = measure_tree(7, &[100, 200, 201], bytes_of);
        assert_eq!(measured, TerminalMemory { terminal_id: 7, bytes: 300_000, processes: 2 });
        assert_eq!(measure_tree(8, &[], bytes_of).bytes, 0);
    }

    #[cfg(any(target_os = "macos", windows))]
    #[test]
    fn measures_a_real_shell_and_its_children() {
        #[cfg(unix)]
        let mut shell = std::process::Command::new("/bin/sh").args(["-c", "sleep 5 & sleep 5; wait"]).spawn().unwrap();
        #[cfg(windows)]
        let mut shell = std::process::Command::new("cmd")
            .args(["/C", "ping -n 5 127.0.0.1 > NUL"])
            .spawn()
            .unwrap();
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
        let mut measured = usage(&[(3, shell.id())]);
        while measured[0].processes < 2 && std::time::Instant::now() < deadline {
            std::thread::sleep(std::time::Duration::from_millis(50));
            measured = usage(&[(3, shell.id())]);
        }
        let _ = shell.kill();
        let _ = shell.wait();
        assert_eq!(measured[0].terminal_id, 3);
        assert!(measured[0].processes >= 2, "the shell and its children: {measured:?}");
        assert!(measured[0].bytes > 0);
        assert!(usage(&[]).is_empty());
    }
}
