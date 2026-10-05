use crate::test_support::UiText;
use std::path::{Path, PathBuf};

use super::plan::{Limits, MAX_FILE_BYTES};
use super::store::{check_file_path, check_hash, content_hash, Label, Recorded, Snapshot, Store};
use super::{collect_files, configure, is_on, read_for_snapshot};
use crate::commands::local_history::{file_history, request_bytes, snapshot_diff, RecordRequest};
use crate::commands::status;
use crate::test_support::{block_on, TestRepo};
use crate::error::AppError;
use crate::merge::model::Eol;

const DAY: u64 = 24 * 60 * 60 * 1000;

struct Fixture {
    _temp: tempfile::TempDir,
    store: Store,
    /// A folder for "work tree" files, outside the store.
    work: PathBuf,
}

impl Fixture {
    fn new() -> Fixture {
        let temp = tempfile::TempDir::new().unwrap();
        let store = Store::new(temp.path().join("config").join("local-history"));
        let work = temp.path().join("work");
        std::fs::create_dir_all(&work).unwrap();
        Fixture { _temp: temp, store, work }
    }

    fn path(&self, name: &str) -> String {
        self.work.join(name).ui()
    }

    fn record(&self, file_path: &str, text: &str, label: Label, now_ms: u64) -> Recorded {
        self.store.record(file_path, text.as_bytes(), label, now_ms, &Limits::default()).unwrap()
    }

    fn object_files(&self) -> Vec<PathBuf> {
        let mut found = Vec::new();
        collect_files(&self.store.root().join("objects"), &mut found, 10_000);
        found
    }

    fn index_files(&self) -> usize {
        std::fs::read_dir(self.store.root().join("index")).map(|reader| reader.count()).unwrap_or(0)
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

fn texts(store: &Store, file_path: &str) -> Vec<String> {
    store
        .list(file_path)
        .unwrap()
        .iter()
        .map(|snapshot| String::from_utf8(store.read(file_path, &snapshot.hash).unwrap()).unwrap())
        .collect()
}

/// Waits for the background thread of a save.
fn wait_for(store: &Store, file_path: &str, count: usize) -> Vec<Snapshot> {
    for _ in 0..200 {
        let snapshots = store.list(file_path).unwrap();
        if snapshots.len() >= count {
            return snapshots;
        }
        std::thread::sleep(std::time::Duration::from_millis(10));
    }
    store.list(file_path).unwrap()
}

#[test]
fn saves_discards_and_rollbacks_keep_versions_while_history_is_on() {
    // The only test that switches the global store on, in a temporary folder (never ~/.gitmanager).
    let home = tempfile::TempDir::new().unwrap();
    let store = Store::new(home.path().join("local-history"));
    configure(Some(home.path().join("local-history")), Limits::default());
    let outcome = std::panic::catch_unwind(|| {
        assert!(is_on());
        let repo = TestRepo::new();
        repo.write("a.txt", "v1\n");
        repo.commit_all("first");
        let file = repo.file("a.txt").ui();

        // A save keeps what it replaced, then what it wrote.
        block_on(status::write_worktree_file(repo.path_string(), "a.txt".to_string(), "v2\n".to_string(), Eol::Lf)).unwrap();
        let saved = wait_for(&store, &file, 2);
        assert_eq!(saved.iter().map(|snapshot| snapshot.label).collect::<Vec<_>>(), vec![Label::Saved, Label::BeforeSave]);
        assert_eq!(texts(&store, &file), vec!["v2\n", "v1\n"]);

        // Discard keeps the text it throws away, untracked folders included.
        repo.write("a.txt", "v3\n");
        repo.write("new/x.txt", "untracked\n");
        block_on(status::discard_files(repo.path_string(), vec!["a.txt".to_string()], vec!["new".to_string()])).unwrap();
        assert_eq!(repo.read_text("a.txt"), "v1\n");
        let discarded = store.list(&file).unwrap();
        assert_eq!(discarded[0].label, Label::BeforeDiscard);
        assert_eq!(texts(&store, &file)[0], "v3\n");
        let gone = store.deleted_under(&[repo.path_string()]).unwrap();
        assert_eq!(gone.len(), 1);
        assert!(gone[0].file_path.ends_with("/new/x.txt"), "{gone:?}");

        // Rollback too.
        repo.write("a.txt", "v4\n");
        block_on(status::rollback_files(repo.path_string(), vec!["a.txt".to_string()], false)).unwrap();
        assert_eq!(store.list(&file).unwrap()[0].label, Label::BeforeRollback);
        assert_eq!(texts(&store, &file)[0], "v4\n");
    });
    configure(None, Limits::default());
    if let Err(panic) = outcome {
        std::panic::resume_unwind(panic);
    }
}

#[test]
fn snapshots_list_newest_first_and_read_back_exactly() {
    let fixture = Fixture::new();
    let file = fixture.path("a.txt");
    assert!(fixture.store.list(&file).unwrap().is_empty());
    assert!(matches!(fixture.record(&file, "one\n", Label::BeforeSave, 1000), Recorded::Added { .. }));
    assert!(matches!(fixture.record(&file, "two\r\n", Label::Saved, 2000), Recorded::Added { .. }));
    let snapshots = fixture.store.list(&file).unwrap();
    assert_eq!(snapshots.len(), 2);
    assert_eq!(snapshots[0].label, Label::Saved);
    assert_eq!(snapshots[0].time, 2000);
    assert_eq!(snapshots[0].size, 5);
    assert_eq!(snapshots[0].hash, content_hash(b"two\r\n").unwrap());
    assert_eq!(snapshots[1].label, Label::BeforeSave);
    assert_eq!(texts(&fixture.store, &file), vec!["two\r\n", "one\n"]);
}

#[test]
fn the_same_text_is_stored_once() {
    let fixture = Fixture::new();
    let first = fixture.path("a.txt");
    let second = fixture.path("b.txt");
    fixture.record(&first, "same", Label::Saved, 1);
    // The newest snapshot already has this text: nothing new.
    assert_eq!(fixture.record(&first, "same", Label::Saved, 2), Recorded::Unchanged);
    // Another file with the same text gets an entry but no second object.
    match fixture.record(&second, "same", Label::Saved, 3) {
        Recorded::Added { stored_bytes, .. } => assert_eq!(stored_bytes, 0),
        other => panic!("{other:?}"),
    }
    // Going back to an older text adds an entry again (it is not the newest).
    fixture.record(&first, "other", Label::Saved, 4);
    fixture.record(&first, "same", Label::Saved, 5);
    assert_eq!(fixture.store.list(&first).unwrap().len(), 3);
    assert_eq!(fixture.object_files().len(), 2);
    assert_eq!(fixture.index_files(), 2);
}

#[test]
fn times_stay_in_order_within_a_file() {
    let fixture = Fixture::new();
    let file = fixture.path("a.txt");
    fixture.record(&file, "1", Label::Saved, 500);
    fixture.record(&file, "2", Label::Saved, 500);
    fixture.record(&file, "3", Label::Saved, 100);
    let times: Vec<u64> = fixture.store.list(&file).unwrap().iter().map(|snapshot| snapshot.time).collect();
    assert_eq!(times, vec![502, 501, 500]);
}

#[test]
fn objects_are_compressed_and_large_files_skipped() {
    let fixture = Fixture::new();
    let file = fixture.path("big.txt");
    let text = "the same line again and again\n".repeat(2000);
    fixture.record(&file, &text, Label::Saved, 1);
    let objects = fixture.object_files();
    assert_eq!(objects.len(), 1);
    let stored = std::fs::metadata(&objects[0]).unwrap().len();
    assert!(stored < text.len() as u64 / 10, "{stored} bytes for {}", text.len());

    let too_big = vec![b'x'; MAX_FILE_BYTES as usize + 1];
    let result = fixture.store.record(&file, &too_big, Label::Saved, 2, &Limits::default()).unwrap();
    assert_eq!(result, Recorded::TooLarge);
    assert_eq!(fixture.store.list(&file).unwrap().len(), 1);
}

#[test]
fn each_file_keeps_its_newest_snapshots_within_the_age() {
    let fixture = Fixture::new();
    let file = fixture.path("a.txt");
    let few = limits(3, 7 * DAY, u64::MAX);
    for number in 0..5 {
        fixture.store.record(&file, format!("v{number}").as_bytes(), Label::Saved, 1000 + number, &few).unwrap();
    }
    assert_eq!(texts(&fixture.store, &file), vec!["v4", "v3", "v2"]);

    // A write ten days later drops what is older than seven days.
    fixture.store.record(&file, b"later", Label::Saved, 10 * DAY, &few).unwrap();
    assert_eq!(texts(&fixture.store, &file), vec!["later"]);
}

#[test]
fn pruning_applies_age_and_size_and_removes_unused_objects() {
    let fixture = Fixture::new();
    let old = fixture.path("old.txt");
    let kept = fixture.path("kept.txt");
    fixture.record(&old, "ancient text", Label::Saved, 1);
    for number in 0..4 {
        // Random-looking text compresses badly, so each object is about its size.
        let mut seed: u64 = 7 + number;
        let text: String = (0..400)
            .map(|_| {
                seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
                char::from(b'a' + ((seed >> 33) % 26) as u8)
            })
            .collect();
        fixture.record(&kept, &text, Label::Saved, 9 * DAY + number);
    }
    let leftover = fixture.store.root().join("index").join("x.json.tmp");
    std::fs::write(&leftover, "partial").unwrap();
    assert_eq!(fixture.object_files().len(), 5);

    let total: u64 = fixture.object_files().iter().map(|path| std::fs::metadata(path).unwrap().len()).sum();
    let report = fixture.store.prune(10 * DAY, &limits(50, 7 * DAY, total / 2)).unwrap();
    // The 1-day-old file is past seven days; then the oldest versions of the other go until half fits.
    assert!(fixture.store.list(&old).unwrap().is_empty());
    let left = fixture.store.list(&kept).unwrap();
    assert!(!left.is_empty() && left.len() < 4, "{left:?}");
    assert_eq!(left[0].time, 9 * DAY + 3, "the newest stays");
    assert_eq!(report.removed_snapshots, 1 + (4 - left.len()));
    assert_eq!(fixture.object_files().len(), left.len());
    assert!(report.kept_bytes <= total / 2);
    assert!(!leftover.exists());
    // The emptied index file is gone too.
    assert_eq!(fixture.index_files(), 1);

    // Nothing more to do: a second prune changes nothing.
    let again = fixture.store.prune(10 * DAY, &limits(50, 7 * DAY, total / 2)).unwrap();
    assert_eq!((again.removed_snapshots, again.removed_objects), (0, 0));
}

#[test]
fn pruning_keeps_objects_shared_with_a_kept_file() {
    let fixture = Fixture::new();
    let old = fixture.path("old.txt");
    let new = fixture.path("new.txt");
    fixture.record(&old, "shared", Label::Saved, 1);
    fixture.record(&new, "shared", Label::Saved, 9 * DAY);
    fixture.store.prune(10 * DAY, &Limits::default()).unwrap();
    assert!(fixture.store.list(&old).unwrap().is_empty());
    assert_eq!(texts(&fixture.store, &new), vec!["shared"]);
}

#[test]
fn a_deleted_file_is_listed_and_restored() {
    let fixture = Fixture::new();
    let gone = fixture.path("src/gone.txt");
    let here = fixture.path("here.txt");
    std::fs::write(&here, "here").unwrap();
    fixture.record(&gone, "first", Label::Saved, 1);
    fixture.record(&gone, "last", Label::BeforeDiscard, 2);
    fixture.record(&here, "here", Label::Saved, 3);
    let outside = Fixture::new();
    fixture.record(&outside.path("elsewhere.txt"), "x", Label::Saved, 4);

    let work = fixture.work.ui();
    let deleted = fixture.store.deleted_under(std::slice::from_ref(&work)).unwrap();
    assert_eq!(deleted.len(), 1);
    assert_eq!(deleted[0].file_path, gone);
    assert_eq!(deleted[0].count, 2);
    assert_eq!(deleted[0].latest.label, Label::BeforeDiscard);
    // A folder named like the start of another is not its parent.
    assert!(fixture.store.deleted_under(&[format!("{work}/sr")]).unwrap().is_empty());

    let history = file_history(&fixture.store, &gone).unwrap();
    assert!(!history.exists);
    let oldest = history.snapshots[1].hash.clone();
    fixture.store.restore(&gone, &oldest).unwrap();
    assert_eq!(std::fs::read_to_string(&gone).unwrap(), "first");
    assert!(file_history(&fixture.store, &gone).unwrap().exists);
    assert!(fixture.store.deleted_under(&[work]).unwrap().is_empty());

    // Never over a file that is there again, and only versions of this file.
    let refused = fixture.store.restore(&gone, &oldest);
    assert!(matches!(refused, Err(AppError::Invalid(_))), "{refused:?}");
    let foreign = content_hash(b"here").unwrap();
    std::fs::remove_file(&gone).unwrap();
    assert!(fixture.store.restore(&gone, &foreign).is_err());
    assert!(!Path::new(&gone).exists());
}

#[test]
fn bad_paths_and_ids_are_refused() {
    let fixture = Fixture::new();
    for bad in ["relative.txt", "/a/../b", "/a/./b", "/a//b", "/a/", ""] {
        assert!(check_file_path(bad).is_err(), "{bad}");
        assert!(fixture.store.list(bad).is_err(), "{bad}");
    }
    assert!(check_file_path(if cfg!(windows) { "C:/a/b.txt" } else { "/a/b.txt" }).is_ok());
    for bad in ["", "../x", "ABCDEF0123456789ABCDEF0123456789ABCDEF01", &"a".repeat(41)] {
        assert!(check_hash(bad).is_err(), "{bad}");
    }
    let file = fixture.path("a.txt");
    assert!(fixture.store.read(&file, "../../../etc/passwd").is_err());
}

#[test]
fn a_damaged_object_is_reported() {
    let fixture = Fixture::new();
    let file = fixture.path("a.txt");
    fixture.record(&file, "text", Label::Saved, 1);
    let hash = fixture.store.list(&file).unwrap()[0].hash.clone();
    std::fs::write(&fixture.object_files()[0], b"not zlib").unwrap();
    let result = fixture.store.read(&file, &hash);
    assert!(matches!(result, Err(AppError::Invalid(ref message)) if message.contains("damaged")), "{result:?}");
}

#[test]
fn an_unreadable_index_is_skipped_and_replaced_on_the_next_write() {
    let fixture = Fixture::new();
    let file = fixture.path("a.txt");
    fixture.record(&file, "v1", Label::Saved, 1);
    let index = std::fs::read_dir(fixture.store.root().join("index")).unwrap().next().unwrap().unwrap().path();
    std::fs::write(&index, "{ broken").unwrap();
    assert!(fixture.store.list(&file).unwrap().is_empty());
    assert_eq!(fixture.store.usage().unwrap().files, 0);
    fixture.record(&file, "v2", Label::Saved, 2);
    assert_eq!(texts(&fixture.store, &file), vec!["v2"]);
}

#[test]
fn usage_counts_and_clear_removes_everything() {
    let fixture = Fixture::new();
    fixture.record(&fixture.path("a.txt"), "a1", Label::Saved, 1);
    fixture.record(&fixture.path("a.txt"), "a2", Label::Saved, 2);
    fixture.record(&fixture.path("b.txt"), "a1", Label::Saved, 3);
    let usage = fixture.store.usage().unwrap();
    assert_eq!((usage.files, usage.snapshots), (2, 3));
    assert!(usage.bytes > 0);
    fixture.store.clear().unwrap();
    assert!(!fixture.store.root().exists());
    assert_eq!(fixture.store.usage().unwrap(), Default::default());
    fixture.store.clear().unwrap();
}

#[test]
fn editor_requests_use_the_editor_text_or_the_file_on_disk() {
    let fixture = Fixture::new();
    let on_disk = fixture.path("disk.txt");
    std::fs::write(&on_disk, "from disk").unwrap();
    let requests = vec![
        RecordRequest {
            file_path: fixture.path("edited.txt"),
            text: Some("a\nb\n".to_string()),
            eol: Some(Eol::Crlf),
            label: Label::BeforeRevert,
        },
        RecordRequest {
            file_path: on_disk.clone(),
            text: None,
            eol: None,
            label: Label::ExternalChange,
        },
        RecordRequest {
            file_path: fixture.path("missing.txt"),
            text: None,
            eol: None,
            label: Label::ExternalChange,
        },
        RecordRequest {
            file_path: "relative.txt".to_string(),
            text: Some("x".to_string()),
            eol: None,
            label: Label::Saved,
        },
    ];
    let items = request_bytes(requests);
    assert_eq!(items.len(), 2);
    assert_eq!(items[0].1, b"a\r\nb\r\n");
    assert_eq!(items[0].2, Label::BeforeRevert);
    assert_eq!(items[1], (on_disk, b"from disk".to_vec(), Label::ExternalChange));
}

#[test]
fn labels_read_and_write_in_camel_case() {
    let json = serde_json::to_string(&Label::BeforeExternalChange).unwrap();
    assert_eq!(json, "\"beforeExternalChange\"");
    let label: Label = serde_json::from_str("\"somethingNew\"").unwrap();
    assert_eq!(label, Label::Other);
}

#[test]
fn a_version_is_compared_with_the_editor_text_the_file_or_nothing() {
    let fixture = Fixture::new();
    let file = fixture.path("a.txt");
    fixture.record(&file, "old\r\nline\r\n", Label::Saved, 1);
    let hash = fixture.store.list(&file).unwrap()[0].hash.clone();

    std::fs::write(&file, "new\nline\n").unwrap();
    let with_disk = snapshot_diff(&fixture.store, &file, &hash, None).unwrap();
    assert_eq!(with_disk.original, "old\nline\n");
    assert_eq!(with_disk.original_eol, Eol::Crlf);
    assert_eq!(with_disk.modified, "new\nline\n");
    assert_eq!(with_disk.hunks.len(), 1);

    let with_editor = snapshot_diff(&fixture.store, &file, &hash, Some("unsaved\nline\n".to_string())).unwrap();
    assert_eq!(with_editor.modified, "unsaved\nline\n");

    std::fs::remove_file(&file).unwrap();
    let deleted = snapshot_diff(&fixture.store, &file, &hash, None).unwrap();
    assert_eq!(deleted.modified, "");
}

#[test]
fn destructive_actions_collect_files_of_folders_without_git_dirs_or_links() {
    let fixture = Fixture::new();
    let folder = fixture.work.join("folder");
    std::fs::create_dir_all(folder.join("nested")).unwrap();
    std::fs::create_dir_all(folder.join(".git")).unwrap();
    std::fs::write(folder.join("a.txt"), "a").unwrap();
    std::fs::write(folder.join("nested/b.txt"), "b").unwrap();
    std::fs::write(folder.join(".git/config"), "c").unwrap();
    #[cfg(unix)]
    std::os::unix::fs::symlink(folder.join("a.txt"), folder.join("link.txt")).unwrap();

    let mut files = Vec::new();
    collect_files(&folder, &mut files, 100);
    assert_eq!(files, vec![folder.join("a.txt"), folder.join("nested/b.txt")]);

    let mut limited = Vec::new();
    collect_files(&folder, &mut limited, 1);
    assert_eq!(limited.len(), 1);

    let mut single = Vec::new();
    collect_files(&folder.join("missing.txt"), &mut single, 10);
    assert!(single.is_empty());
}

#[test]
fn a_destructive_action_reads_files_within_its_byte_budget() {
    let fixture = Fixture::new();
    let folder = fixture.work.join("big");
    std::fs::create_dir_all(&folder).unwrap();
    for name in ["a.txt", "b.txt", "c.txt"] {
        std::fs::write(folder.join(name), vec![b'x'; 400]).unwrap();
    }
    std::fs::write(folder.join("huge.bin"), vec![b'y'; 2000]).unwrap();

    // huge.bin is over the per-file limit; the budget of 1000 bytes stops after two files.
    let items = read_for_snapshot(std::slice::from_ref(&folder), Label::BeforeDiscard, 1000, 1000);
    let names: Vec<String> = items.iter().map(|(file_path, _, _)| file_path.rsplit('/').next().unwrap_or_default().to_string()).collect();
    assert_eq!(names, vec!["a.txt", "b.txt"]);
    assert!(items.iter().all(|(_, bytes, label)| bytes.len() == 400 && *label == Label::BeforeDiscard));

    let all = read_for_snapshot(&[folder.join("c.txt"), folder.join("missing.txt")], Label::BeforeRollback, 1000, 1000);
    assert_eq!(all.len(), 1);
}
