use super::*;
use crate::test_support::TestDir;

fn options(match_case: bool, whole_words: bool, regex: bool) -> TextSearchOptions {
    TextSearchOptions {
        match_case,
        whole_words,
        regex,
    }
}

fn request(query: &str, replacement: &str, options: TextSearchOptions) -> ReplaceRequest {
    ReplaceRequest {
        query: query.to_string(),
        options,
        replacement: replacement.to_string(),
        ..ReplaceRequest::default()
    }
}

fn run(dir: &TestDir, request: &ReplaceRequest) -> ReplaceOutcome {
    let files = Index::built_for_test(&[dir.path_string()]);
    replace(&files, request, &|| false)
}

fn read(dir: &TestDir, relative_path: &str) -> String {
    std::fs::read_to_string(dir.file(relative_path)).expect("read file")
}

/// "relative/path:count" of every replaced file.
fn counts(outcome: &ReplaceOutcome) -> Vec<String> {
    outcome
        .files
        .iter()
        .map(|file| format!("{}:{}", file.relative_path, file.replacements))
        .collect()
}

fn sample() -> TestDir {
    let dir = TestDir::new();
    dir.write("src/cart.ts", "export class Cart {\n  addItem(item) {}\n}\nconst cart = new Cart();\n");
    dir.write("src/order.ts", "// carts and cartography\nconst total = a+b;\n");
    dir
}

#[test]
fn literal_replace_is_case_insensitive_by_default() {
    let dir = sample();
    let outcome = run(&dir, &request("cart", "basket", TextSearchOptions::default()));
    assert_eq!(counts(&outcome), ["src/cart.ts:3", "src/order.ts:2"]);
    assert_eq!(outcome.replacements, 5);
    assert!(!outcome.cancelled && !outcome.preview && outcome.error.is_none());
    assert_eq!(
        read(&dir, "src/cart.ts"),
        "export class basket {\n  addItem(item) {}\n}\nconst basket = new basket();\n"
    );
    assert_eq!(read(&dir, "src/order.ts"), "// baskets and basketography\nconst total = a+b;\n");
}

#[test]
fn literal_replace_keeps_regex_characters_and_dollars() {
    let dir = sample();
    let outcome = run(&dir, &request("a+b", "$1 \\n", TextSearchOptions::default()));
    assert_eq!(counts(&outcome), ["src/order.ts:1"]);
    assert_eq!(read(&dir, "src/order.ts"), "// carts and cartography\nconst total = $1 \\n;\n");
}

#[test]
fn match_case_and_whole_words() {
    let dir = sample();
    let outcome = run(&dir, &request("Cart", "Basket", options(true, false, false)));
    assert_eq!(counts(&outcome), ["src/cart.ts:2"]);
    assert_eq!(
        read(&dir, "src/cart.ts"),
        "export class Basket {\n  addItem(item) {}\n}\nconst cart = new Basket();\n"
    );

    let dir = sample();
    let outcome = run(&dir, &request("cart", "basket", options(false, true, false)));
    // "carts" and "cartography" are not the whole word.
    assert_eq!(counts(&outcome), ["src/cart.ts:3"]);
    assert_eq!(read(&dir, "src/order.ts"), "// carts and cartography\nconst total = a+b;\n");
}

#[test]
fn regex_replace_expands_groups() {
    let dir = TestDir::new();
    dir.write("names.txt", "first: Ada Lovelace\nfirst: Alan Turing\nnone here\n");
    let outcome = run(
        &dir,
        &request(r"first: (\w+) (\w+)", "$2, $1 ($&) $$ $9 $10", options(false, false, true)),
    );
    assert_eq!(counts(&outcome), ["names.txt:2"]);
    assert_eq!(
        read(&dir, "names.txt"),
        "Lovelace, Ada (first: Ada Lovelace) $ $9 Ada0\nTuring, Alan (first: Alan Turing) $ $9 Alan0\nnone here\n"
    );
}

#[test]
fn regex_replace_unquotes_escapes_and_anchors_per_line() {
    let dir = TestDir::new();
    dir.write("list.txt", "a,b\r\nc,d\r\n");
    let outcome = run(&dir, &request(r"^(\w),(\w)", r"$1\t$2", options(false, false, true)));
    assert_eq!(outcome.replacements, 2);
    // Line endings stay as they were.
    assert_eq!(read(&dir, "list.txt"), "a\tb\r\nc\td\r\n");
}

#[test]
fn invalid_regex_reports_an_error_and_writes_nothing() {
    let dir = sample();
    let outcome = run(&dir, &request("add(", "x", options(false, false, true)));
    assert!(outcome.error.as_deref().unwrap_or_default().starts_with("Invalid regular expression"));
    assert!(outcome.files.is_empty());
    assert_eq!(read(&dir, "src/cart.ts"), "export class Cart {\n  addItem(item) {}\n}\nconst cart = new Cart();\n");
}

#[test]
fn no_match_changes_nothing() {
    let dir = sample();
    let before = std::fs::metadata(dir.file("src/cart.ts")).unwrap().modified().unwrap();
    let outcome = run(&dir, &request("nothing like this", "x", TextSearchOptions::default()));
    assert_eq!(outcome, ReplaceOutcome::default());
    assert_eq!(std::fs::metadata(dir.file("src/cart.ts")).unwrap().modified().unwrap(), before);
    // Too short a query does nothing, like the search.
    assert_eq!(run(&dir, &request("c", "x", TextSearchOptions::default())), ReplaceOutcome::default());
}

#[test]
fn preview_counts_without_writing() {
    let dir = sample();
    let mut preview = request("cart", "basket", TextSearchOptions::default());
    preview.preview = true;
    let outcome = run(&dir, &preview);
    assert!(outcome.preview);
    assert_eq!(counts(&outcome), ["src/cart.ts:3", "src/order.ts:2"]);
    assert_eq!(read(&dir, "src/order.ts"), "// carts and cartography\nconst total = a+b;\n");
}

#[test]
fn skips_unsaved_files_and_limits_to_given_files() {
    let dir = sample();
    let mut skipping = request("cart", "basket", TextSearchOptions::default());
    skipping.skip_paths = vec![dir.file_string("src/cart.ts")];
    let outcome = run(&dir, &skipping);
    assert_eq!(counts(&outcome), ["src/order.ts:2"]);
    assert_eq!(
        outcome.skipped,
        [SkippedFile {
            path: dir.file_string("src/cart.ts"),
            relative_path: "src/cart.ts".into(),
            reason: SkipReason::Unsaved,
            matches: 3,
        }]
    );
    assert!(read(&dir, "src/cart.ts").contains("class Cart"));

    let dir = sample();
    let mut only = request("cart", "basket", TextSearchOptions::default());
    only.file_paths = Some(vec![dir.file_string("src/order.ts")]);
    let outcome = run(&dir, &only);
    assert_eq!(counts(&outcome), ["src/order.ts:2"]);
    assert!(read(&dir, "src/cart.ts").contains("class Cart"));
}

#[test]
fn skips_binary_and_too_big_files() {
    let dir = TestDir::new();
    dir.write("image.bin", b"cart\0cart\n");
    let big = format!("cart\n{}", "x".repeat(MAX_FILE_BYTES as usize));
    dir.write("big.txt", &big);
    dir.write("small.txt", "cart\n");
    let outcome = run(&dir, &request("cart", "basket", TextSearchOptions::default()));
    assert_eq!(counts(&outcome), ["small.txt:1"]);
    assert_eq!(std::fs::read(dir.file("image.bin")).unwrap(), b"cart\0cart\n");
    assert!(read(&dir, "big.txt").starts_with("cart\n"));
}

#[cfg(unix)]
#[test]
fn atomic_write_keeps_the_file_mode_and_leaves_no_temp_file() {
    use std::os::unix::fs::PermissionsExt;

    let dir = TestDir::new();
    dir.write("bin/run.sh", "#!/bin/sh\necho cart\n");
    std::fs::set_permissions(dir.file("bin/run.sh"), std::fs::Permissions::from_mode(0o751)).unwrap();
    let outcome = run(&dir, &request("cart", "basket", TextSearchOptions::default()));
    assert_eq!(counts(&outcome), ["bin/run.sh:1"]);
    assert_eq!(read(&dir, "bin/run.sh"), "#!/bin/sh\necho basket\n");
    let mode = std::fs::metadata(dir.file("bin/run.sh")).unwrap().permissions().mode() & 0o777;
    assert_eq!(mode, 0o751);
    let names: Vec<String> = std::fs::read_dir(dir.file("bin"))
        .unwrap()
        .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
        .collect();
    assert_eq!(names, ["run.sh"]);
}

#[cfg(unix)]
#[test]
fn skips_links_and_read_only_files() {
    use std::os::unix::fs::PermissionsExt;

    let dir = TestDir::new();
    dir.write("plain.txt", "cart\n");
    // The link's target sits outside the searched folder. A target inside it may be
    // rewritten by another worker before the link is read, and then the link has no
    // matches left to report: that order depends on thread timing.
    let outside = dir.path.parent().unwrap().join("outside.txt");
    std::fs::write(&outside, "cart\n").unwrap();
    std::os::unix::fs::symlink(&outside, dir.file("link.txt")).unwrap();
    dir.write("locked.txt", "cart\n");
    std::fs::set_permissions(dir.file("locked.txt"), std::fs::Permissions::from_mode(0o444)).unwrap();
    let outcome = run(&dir, &request("cart", "basket", TextSearchOptions::default()));
    assert_eq!(counts(&outcome), ["plain.txt:1"]);
    let skipped: Vec<(String, SkipReason)> = outcome
        .skipped
        .iter()
        .map(|file| (file.relative_path.clone(), file.reason))
        .collect();
    assert_eq!(
        skipped,
        [("link.txt".to_string(), SkipReason::Link), ("locked.txt".to_string(), SkipReason::ReadOnly)]
    );
    assert!(std::fs::symlink_metadata(dir.file("link.txt")).unwrap().file_type().is_symlink());
    assert_eq!(std::fs::read_to_string(&outside).unwrap(), "cart\n");
    assert_eq!(read(&dir, "locked.txt"), "cart\n");
}

#[test]
fn write_atomic_refuses_a_file_changed_since_it_was_read() {
    let dir = TestDir::new();
    dir.write("a.txt", "cart\n");
    let original = std::fs::metadata(dir.file("a.txt")).unwrap();
    dir.write("a.txt", "cart and more\n");
    let error = write_atomic(&dir.file("a.txt"), b"basket\n", &original).unwrap_err();
    assert!(error.to_string().contains("changed on disk"));
    assert_eq!(read(&dir, "a.txt"), "cart and more\n");
    assert_eq!(std::fs::read_dir(&dir.path).unwrap().count(), 1);
}

#[test]
fn a_stopped_replace_is_cancelled() {
    let dir = sample();
    let files = Index::built_for_test(&[dir.path_string()]);
    let outcome = replace(&files, &request("cart", "basket", TextSearchOptions::default()), &|| true);
    assert!(outcome.cancelled);
    assert!(outcome.files.is_empty());
    assert!(read(&dir, "src/cart.ts").contains("class Cart"));
}

#[test]
fn template_rules_match_the_editor() {
    let template = Template::compile("a$1b$$c$&d$e$", true, 2);
    assert_eq!(
        template.pieces,
        [
            Piece::Text(b"a".to_vec()),
            Piece::Group(1),
            Piece::Text(b"b$c".to_vec()),
            Piece::Whole,
            Piece::Text(b"d$e$".to_vec()),
        ]
    );
    // Without Regex everything is literal.
    assert_eq!(Template::compile("$1\\n", false, 2).pieces, [Piece::Text(b"$1\\n".to_vec())]);
    assert_eq!(unquote(r"a\nb\tc\\n\x"), "a\nb\tc\\n\\x");
}

#[test]
fn the_newest_replace_id_wins_and_cancel_stops_older_ones() {
    let dir = sample();
    let roots = vec![dir.path_string()];
    let search = crate::file_search::FileSearch::default();
    let mut preview = request("cart", "basket", TextSearchOptions::default());
    preview.preview = true;
    let outcome = search.replace_text(&roots, 10, &preview);
    assert_eq!(outcome.replacements, 5);
    // An older replace arriving late does nothing.
    let late = search.replace_text(&roots, 5, &request("cart", "basket", TextSearchOptions::default()));
    assert!(late.cancelled && late.files.is_empty());
    search.cancel_replace(20);
    let cancelled = search.replace_text(&roots, 15, &request("cart", "basket", TextSearchOptions::default()));
    assert!(cancelled.cancelled);
    assert!(read(&dir, "src/cart.ts").contains("class Cart"));
    let done = search.replace_text(&roots, 30, &request("cart", "basket", TextSearchOptions::default()));
    assert_eq!(done.replacements, 5);
    assert!(!done.cancelled);
}
