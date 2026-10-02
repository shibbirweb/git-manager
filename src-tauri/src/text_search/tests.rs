use std::sync::atomic::AtomicUsize;

use super::*;
use crate::test_support::TestDir;

fn options(match_case: bool, whole_words: bool, regex: bool) -> TextSearchOptions {
    TextSearchOptions {
        match_case,
        whole_words,
        regex,
    }
}

/// Every batch of a search over `dir`.
fn run(dir: &TestDir, query: &str, options: TextSearchOptions) -> Vec<TextSearchBatch> {
    let files = Index::built_for_test(&[dir.path_string()]);
    let batches = Mutex::new(Vec::new());
    search(&files, query, &options, &|| false, &|batch| lock(&batches).push(batch));
    batches.into_inner().unwrap()
}

/// "relative/path:line:text" of every match, sorted.
fn hits(batches: &[TextSearchBatch]) -> Vec<String> {
    let mut out: Vec<String> = batches
        .iter()
        .flat_map(|batch| batch.files.iter())
        .flat_map(|file| file.lines.iter().map(move |line| format!("{}:{}:{}", file.relative_path, line.line, line.text)))
        .collect();
    out.sort();
    out
}

fn last(batches: &[TextSearchBatch]) -> &TextSearchBatch {
    let last = batches.last().expect("a final batch");
    assert!(last.done);
    last
}

fn sample() -> TestDir {
    let dir = TestDir::new();
    dir.write("src/cart.ts", "export class Cart {\n  addItem(item) {}\n}\nconst cart = new Cart();\n");
    dir.write("src/order.ts", "// carts and cartography\nconst total = a+b;\n");
    dir
}

#[test]
fn literal_search_is_case_insensitive_by_default() {
    let dir = sample();
    let batches = run(&dir, "cart", TextSearchOptions::default());
    assert_eq!(
        hits(&batches),
        [
            "src/cart.ts:1:export class Cart {",
            "src/cart.ts:4:const cart = new Cart();",
            "src/order.ts:1:// carts and cartography",
        ]
    );
    let done = last(&batches);
    assert_eq!((done.matches, done.files_matched, done.files_searched), (3, 2, 2));
    assert!(!done.more);
    // Regex characters are literal.
    assert_eq!(hits(&run(&dir, "a+b", TextSearchOptions::default())), ["src/order.ts:2:const total = a+b;"]);
}

#[test]
fn match_case_whole_words_and_regex() {
    let dir = sample();
    assert_eq!(
        hits(&run(&dir, "Cart", options(true, false, false))),
        ["src/cart.ts:1:export class Cart {", "src/cart.ts:4:const cart = new Cart();"]
    );
    assert_eq!(
        hits(&run(&dir, "cart", options(false, true, false))),
        ["src/cart.ts:1:export class Cart {", "src/cart.ts:4:const cart = new Cart();"]
    );
    assert_eq!(hits(&run(&dir, r"add\w+\(", options(false, false, true))), ["src/cart.ts:2:addItem(item) {}"]);
    let invalid = run(&dir, "add(", options(false, false, true));
    assert!(last(&invalid).error.as_deref().unwrap_or_default().starts_with("Invalid regular expression"));
}

#[test]
fn ranges_columns_and_trimming() {
    let dir = TestDir::new();
    let long = format!("    {}needle{}\n", "x".repeat(300), "y".repeat(300));
    dir.write("a.txt", format!("\tfind the needle, needle\n{long}é needle\n"));
    let batches = run(&dir, "needle", TextSearchOptions::default());
    let lines = &batches.iter().flat_map(|batch| batch.files.iter()).next().unwrap().lines;
    // Indentation is dropped; the column still counts it.
    assert_eq!(lines[0].text, "find the needle, needle");
    assert_eq!(lines[0].column, 11);
    assert_eq!(lines[0].ranges, [[9, 15], [17, 23]]);
    // A long line is cut around the match.
    assert!(lines[1].text.starts_with('\u{2026}') && lines[1].text.ends_with('\u{2026}'));
    let [start, end] = lines[1].ranges[0];
    let shown: Vec<u16> = lines[1].text.encode_utf16().collect();
    assert_eq!(String::from_utf16_lossy(&shown[start as usize..end as usize]), "needle");
    assert_eq!(lines[1].column, 305);
    // UTF-16 offsets.
    assert_eq!((lines[2].column, lines[2].ranges.clone()), (3, vec![[2, 8]]));
}

#[test]
fn binary_and_big_files_are_skipped_and_gitignore_is_respected() {
    let dir = TestDir::new();
    dir.init_repo("app");
    dir.write("app/.gitignore", "ignored.txt\n");
    dir.write("app/ignored.txt", "needle\n");
    dir.write("app/found.txt", "needle\n");
    dir.write("app/image.png", b"needle\x00\x01\x02");
    dir.write("app/node_modules/x/index.js", "needle\n");
    let big = format!("needle\n{}", "x".repeat(MAX_FILE_BYTES as usize));
    dir.write("app/big.log", big);
    let batches = run(&dir, "needle", TextSearchOptions::default());
    assert_eq!(hits(&batches), ["app/found.txt:1:needle"]);
}

#[test]
fn caps_stop_the_search_and_say_so() {
    let dir = TestDir::new();
    for number in 0..(MAX_FILES + 20) {
        dir.write(&format!("f{number}.txt"), "needle\n");
    }
    let batches = run(&dir, "needle", TextSearchOptions::default());
    let done = last(&batches);
    assert!(done.more);
    assert_eq!(done.files_matched, MAX_FILES);
    assert_eq!(hits(&batches).len(), MAX_FILES);

    let lines = TestDir::new();
    lines.write("many.txt", "needle\n".repeat(MAX_MATCHES + 50));
    let batches = run(&lines, "needle", TextSearchOptions::default());
    assert!(last(&batches).more);
    assert_eq!(hits(&batches).len(), MAX_MATCHES);
    assert_eq!(last(&batches).matches, MAX_MATCHES);
}

#[test]
fn results_stream_in_batches_and_short_queries_do_nothing() {
    let dir = TestDir::new();
    for number in 0..200 {
        dir.write(&format!("d/f{number}.txt"), "needle\nneedle\n");
    }
    let batches = run(&dir, "needle", TextSearchOptions::default());
    // The first file goes out alone and at once, the rest in batches.
    assert!(batches.len() >= 3);
    assert_eq!(batches[0].files.len(), 1);
    assert!(!batches[0].done);
    assert_eq!(hits(&batches).len(), 400);

    let short = run(&dir, "n", TextSearchOptions::default());
    assert_eq!(short.len(), 1);
    assert!(short[0].done && short[0].files.is_empty());
}

#[test]
fn cancelling_stops_within_the_running_search() {
    let dir = TestDir::new();
    for number in 0..300 {
        dir.write(&format!("f{number}.txt"), "needle\n");
    }
    let files = Index::built_for_test(&[dir.path_string()]);
    let seen = AtomicUsize::new(0);
    let batches = Mutex::new(Vec::new());
    // Cancelled as soon as the first result is out.
    search(
        &files,
        "needle",
        &TextSearchOptions::default(),
        &|| seen.load(Ordering::Relaxed) > 0,
        &|batch| {
            seen.fetch_add(1, Ordering::Relaxed);
            lock(&batches).push(batch);
        },
    );
    let batches = batches.into_inner().unwrap();
    let done = last(&batches);
    assert!(done.files_searched < 300, "searched {}", done.files_searched);
    assert!(hits(&batches).len() < 300);
}

#[test]
fn searches_a_file_list_that_is_still_being_built() {
    let dir = TestDir::new();
    dir.write("a.txt", "needle\n");
    dir.write("b.txt", "needle\n");
    let files = Index::building_for_test(&[dir.path_string()]);
    files.add_paths_for_test(0, &["a.txt"]);
    let feeder = {
        let files = files.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(50));
            files.add_paths_for_test(0, &["b.txt"]);
            files.finish_for_test();
        })
    };
    let batches = Mutex::new(Vec::new());
    search(&files, "needle", &TextSearchOptions::default(), &|| false, &|batch| lock(&batches).push(batch));
    feeder.join().unwrap();
    assert_eq!(hits(&batches.into_inner().unwrap()), ["a.txt:1:needle", "b.txt:1:needle"]);
}

#[test]
fn the_newest_search_id_wins() {
    let dir = sample();
    let roots = vec![dir.path_string()];
    let search = crate::file_search::FileSearch::default();
    let batches = Mutex::new(Vec::new());
    search.search_text(&roots, 10, "cart", &TextSearchOptions::default(), &|batch| lock(&batches).push(batch));
    assert_eq!(hits(&batches.lock().unwrap()).len(), 3);
    // An older search arriving late does nothing.
    let late = Mutex::new(Vec::new());
    search.search_text(&roots, 5, "cart", &TextSearchOptions::default(), &|batch| lock(&late).push(batch));
    let late = late.into_inner().unwrap();
    assert_eq!(late.len(), 1);
    assert!(late[0].done && late[0].files.is_empty());
}
