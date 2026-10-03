//! What Local History keeps: pure rules over the snapshot lists, so the store only reads and
//! writes what a plan says. Per file: at most `max_per_file` snapshots, none older than
//! `max_age_ms`. In total: the stored objects stay under `max_total_bytes`, dropping the
//! oldest snapshots of any file first.

use std::collections::HashMap;

/// Files over 1 MB are not kept: Local History is for source text, not data dumps.
pub const MAX_FILE_BYTES: u64 = 1024 * 1024;
pub const DEFAULT_MAX_PER_FILE: usize = 50;
pub const DEFAULT_MAX_DAYS: u32 = 7;
pub const DEFAULT_MAX_SIZE_MB: u32 = 200;
/// The settings' ranges; anything outside is clamped.
pub const DAYS_RANGE: (u32, u32) = (1, 90);
pub const SIZE_MB_RANGE: (u32, u32) = (10, 2000);

const DAY_MS: u64 = 24 * 60 * 60 * 1000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Limits {
    pub max_per_file: usize,
    pub max_age_ms: u64,
    pub max_total_bytes: u64,
    pub max_file_bytes: u64,
}

impl Limits {
    pub fn new(max_days: u32, max_size_mb: u32) -> Limits {
        let days = max_days.clamp(DAYS_RANGE.0, DAYS_RANGE.1);
        let size_mb = max_size_mb.clamp(SIZE_MB_RANGE.0, SIZE_MB_RANGE.1);
        Limits {
            max_per_file: DEFAULT_MAX_PER_FILE,
            max_age_ms: u64::from(days) * DAY_MS,
            max_total_bytes: u64::from(size_mb) * 1024 * 1024,
            max_file_bytes: MAX_FILE_BYTES,
        }
    }
}

impl Default for Limits {
    fn default() -> Limits {
        Limits::new(DEFAULT_MAX_DAYS, DEFAULT_MAX_SIZE_MB)
    }
}

/// The parts of a snapshot the rules look at.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SnapshotRef {
    pub time: u64,
    pub hash: String,
}

fn too_old(time: u64, now_ms: u64, limits: &Limits) -> bool {
    now_ms.saturating_sub(time) > limits.max_age_ms
}

/// Indexes (into `snapshots`, oldest first) of what one file keeps: young enough, and only
/// the newest `max_per_file`.
pub fn keep_for_file(snapshots: &[SnapshotRef], now_ms: u64, limits: &Limits) -> Vec<usize> {
    let young: Vec<usize> = (0..snapshots.len())
        .filter(|&index| !too_old(snapshots[index].time, now_ms, limits))
        .collect();
    let skip = young.len().saturating_sub(limits.max_per_file);
    young[skip..].to_vec()
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct PrunePlan {
    /// For each input file, the indexes it keeps (oldest first); empty when the file has none left.
    pub keep: Vec<Vec<usize>>,
    /// Objects nothing refers to any more, sorted.
    pub delete_objects: Vec<String>,
    /// Bytes of the objects kept.
    pub kept_bytes: u64,
}

impl PrunePlan {
    /// The file at `file_index` keeps everything it had.
    pub fn unchanged(&self, file_index: usize, snapshot_count: usize) -> bool {
        self.keep[file_index].len() == snapshot_count
    }
}

/// The whole store at once: every file's snapshots (oldest first) and the size of every
/// object on disk. Snapshots whose object is missing are dropped, then the per-file rules
/// apply, then the oldest snapshots go until the kept objects fit in `max_total_bytes`.
pub fn plan_prune(files: &[Vec<SnapshotRef>], objects: &HashMap<String, u64>, now_ms: u64, limits: &Limits) -> PrunePlan {
    let mut keep: Vec<Vec<usize>> = files
        .iter()
        .map(|snapshots| {
            let present: Vec<SnapshotRef> = snapshots.iter().filter(|item| objects.contains_key(&item.hash)).cloned().collect();
            let present_indexes: Vec<usize> = (0..snapshots.len()).filter(|&index| objects.contains_key(&snapshots[index].hash)).collect();
            keep_for_file(&present, now_ms, limits)
                .into_iter()
                .map(|index| present_indexes[index])
                .collect()
        })
        .collect();

    let mut references: HashMap<&str, usize> = HashMap::new();
    for (file_index, kept) in keep.iter().enumerate() {
        for &index in kept {
            *references.entry(files[file_index][index].hash.as_str()).or_default() += 1;
        }
    }
    let size_of = |hash: &str| objects.get(hash).copied().unwrap_or_default();
    let mut total: u64 = references.keys().map(|hash| size_of(hash)).sum();

    if total > limits.max_total_bytes {
        // Oldest first across files; ties go to the file listed first.
        let mut order: Vec<(u64, usize, usize)> = keep
            .iter()
            .enumerate()
            .flat_map(|(file_index, kept)| kept.iter().map(move |&index| (file_index, index)))
            .map(|(file_index, index)| (files[file_index][index].time, file_index, index))
            .collect();
        order.sort();
        let mut dropped: HashMap<usize, Vec<usize>> = HashMap::new();
        for (_, file_index, index) in order {
            if total <= limits.max_total_bytes {
                break;
            }
            let hash = files[file_index][index].hash.as_str();
            if let Some(count) = references.get_mut(hash) {
                *count -= 1;
                if *count == 0 {
                    references.remove(hash);
                    total = total.saturating_sub(size_of(hash));
                }
            }
            dropped.entry(file_index).or_default().push(index);
        }
        for (file_index, indexes) in dropped {
            keep[file_index].retain(|index| !indexes.contains(index));
        }
    }

    let mut delete_objects: Vec<String> = objects.keys().filter(|hash| !references.contains_key(hash.as_str())).cloned().collect();
    delete_objects.sort();
    PrunePlan {
        keep,
        delete_objects,
        kept_bytes: total,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn snap(time: u64, hash: &str) -> SnapshotRef {
        SnapshotRef {
            time,
            hash: hash.to_string(),
        }
    }

    fn limits(max_per_file: usize, max_age_ms: u64, max_total_bytes: u64) -> Limits {
        Limits {
            max_per_file,
            max_age_ms,
            max_total_bytes,
            max_file_bytes: MAX_FILE_BYTES,
        }
    }

    fn sizes(entries: &[(&str, u64)]) -> HashMap<String, u64> {
        entries.iter().map(|(hash, size)| (hash.to_string(), *size)).collect()
    }

    #[test]
    fn settings_are_clamped_to_their_ranges() {
        let low = Limits::new(0, 1);
        assert_eq!(low.max_age_ms, DAY_MS);
        assert_eq!(low.max_total_bytes, 10 * 1024 * 1024);
        let high = Limits::new(1000, 100_000);
        assert_eq!(high.max_age_ms, 90 * DAY_MS);
        assert_eq!(high.max_total_bytes, 2000 * 1024 * 1024);
        let defaults = Limits::default();
        assert_eq!(defaults.max_per_file, 50);
        assert_eq!(defaults.max_age_ms, 7 * DAY_MS);
        assert_eq!(defaults.max_total_bytes, 200 * 1024 * 1024);
        assert_eq!(defaults.max_file_bytes, 1024 * 1024);
    }

    #[test]
    fn a_file_keeps_its_newest_young_snapshots() {
        let snapshots = vec![snap(10, "a"), snap(20, "b"), snap(30, "c"), snap(40, "d")];
        assert_eq!(keep_for_file(&snapshots, 40, &limits(2, 100, u64::MAX)), vec![2, 3]);
        // Age: 40 - 10 = 30 is over 25, 40 - 20 = 20 is not.
        assert_eq!(keep_for_file(&snapshots, 40, &limits(10, 25, u64::MAX)), vec![1, 2, 3]);
        assert_eq!(keep_for_file(&snapshots, 1000, &limits(10, 25, u64::MAX)), Vec::<usize>::new());
        assert_eq!(keep_for_file(&[], 0, &limits(10, 25, u64::MAX)), Vec::<usize>::new());
    }

    #[test]
    fn snapshots_without_an_object_are_dropped_and_unused_objects_deleted() {
        let files = vec![vec![snap(1, "a"), snap(2, "gone"), snap(3, "b")]];
        let objects = sizes(&[("a", 5), ("b", 7), ("orphan", 9)]);
        let plan = plan_prune(&files, &objects, 3, &limits(10, 100, u64::MAX));
        assert_eq!(plan.keep, vec![vec![0, 2]]);
        assert_eq!(plan.delete_objects, vec!["orphan".to_string()]);
        assert_eq!(plan.kept_bytes, 12);
        assert!(!plan.unchanged(0, 3));
    }

    #[test]
    fn shared_objects_count_once_and_survive_while_referenced() {
        let files = vec![vec![snap(1, "same")], vec![snap(2, "same"), snap(3, "x")]];
        let objects = sizes(&[("same", 100), ("x", 10)]);
        let plan = plan_prune(&files, &objects, 3, &limits(10, 100, u64::MAX));
        assert_eq!(plan.kept_bytes, 110);
        assert!(plan.delete_objects.is_empty());
        assert!(plan.unchanged(0, 1) && plan.unchanged(1, 2));
    }

    #[test]
    fn the_size_cap_drops_the_oldest_snapshots_of_any_file() {
        let files = vec![vec![snap(1, "a"), snap(4, "d")], vec![snap(2, "b"), snap(3, "c")]];
        let objects = sizes(&[("a", 40), ("b", 40), ("c", 40), ("d", 40)]);
        let plan = plan_prune(&files, &objects, 4, &limits(10, 100, 90));
        // 160 bytes: a (time 1) and b (time 2) go, leaving 80.
        assert_eq!(plan.keep, vec![vec![1], vec![1]]);
        assert_eq!(plan.delete_objects, vec!["a".to_string(), "b".to_string()]);
        assert_eq!(plan.kept_bytes, 80);
    }

    #[test]
    fn dropping_one_reference_of_a_shared_object_frees_nothing() {
        let files = vec![vec![snap(1, "shared"), snap(5, "new")], vec![snap(2, "shared")]];
        let objects = sizes(&[("shared", 50), ("new", 50)]);
        let plan = plan_prune(&files, &objects, 5, &limits(10, 100, 60));
        // The first drop (time 1) leaves "shared" in use; the second (time 2) frees it.
        assert_eq!(plan.keep, vec![vec![1], Vec::<usize>::new()]);
        assert_eq!(plan.delete_objects, vec!["shared".to_string()]);
        assert_eq!(plan.kept_bytes, 50);
    }

    #[test]
    fn per_file_rules_run_before_the_size_cap() {
        let files = vec![vec![snap(1, "a"), snap(2, "b"), snap(3, "c")]];
        let objects = sizes(&[("a", 10), ("b", 10), ("c", 10)]);
        let plan = plan_prune(&files, &objects, 3, &limits(2, 100, 1000));
        assert_eq!(plan.keep, vec![vec![1, 2]]);
        assert_eq!(plan.delete_objects, vec!["a".to_string()]);
    }
}
