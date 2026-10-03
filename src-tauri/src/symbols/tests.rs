use std::time::Duration;

use super::*;
use crate::test_support::TestDir;

fn built(dir: &TestDir, max_symbols: usize) -> SymbolIndex {
    let files = Index::built_for_test(&[dir.path_string()]);
    let index = SymbolIndex::new(files, max_symbols);
    build(&index, &|_| {});
    index
}

fn names(results: &SymbolSearchResults) -> Vec<String> {
    results
        .items
        .iter()
        .map(|item| match &item.container {
            Some(container) => format!("{container}.{}", item.name),
            None => item.name.clone(),
        })
        .collect()
}

fn query(index: &SymbolIndex, text: &str, scope: SymbolScope) -> SymbolSearchResults {
    search(index, text, scope, DEFAULT_LIMIT, &|| false)
}

fn wait_until(mut condition: impl FnMut() -> bool) {
    let started = Instant::now();
    while !condition() {
        assert!(started.elapsed() < Duration::from_secs(10), "timed out");
        std::thread::sleep(Duration::from_millis(5));
    }
}

#[test]
fn indexes_source_files_and_skips_big_minified_and_binary_ones() {
    let dir = TestDir::new();
    dir.write("src/cart.ts", "export class Cart {\n  add(item: Item) {}\n}\n");
    dir.write("src/notes.md", "class NotCode {}\n");
    // Over the size limit, though full of definitions.
    let big = "function bigOne() {}\n".repeat((MAX_FILE_BYTES as usize / 21) + 10);
    dir.write("src/big.js", big);
    // Minified: few, very long lines.
    let minified = format!("function minifiedOne(){{}}{}\n", ";".repeat(MINIFIED_MIN_BYTES * 2));
    dir.write("src/bundle.js", minified);
    dir.write("src/latin1.ts", b"function notUtf8() {} // \xe9\n");
    dir.write("node_modules/pkg/index.js", "function dependency() {}\n");
    let index = built(&dir, MAX_SYMBOLS);
    let progress = index.progress();
    assert!(progress.done);
    assert!(!progress.truncated);
    assert_eq!(progress.symbols, 2);
    assert_eq!(names(&query(&index, "cart", SymbolScope::All)), ["Cart"]);
    assert_eq!(names(&query(&index, "add", SymbolScope::All)), ["Cart.add"]);
    for skipped in ["bigOne", "minifiedOne", "notUtf8", "dependency", "NotCode"] {
        assert!(query(&index, skipped, SymbolScope::All).items.is_empty(), "{skipped}");
    }
}

#[test]
fn results_point_at_the_file_line_and_column() {
    let dir = TestDir::new();
    dir.write("lib/shop.py", "import os\n\nclass Cart:\n    def add(self):\n        pass\n");
    let index = built(&dir, MAX_SYMBOLS);
    let results = query(&index, "add", SymbolScope::All);
    let item = &results.items[0];
    assert_eq!(item.name, "add");
    assert_eq!(item.kind, SymbolKind::Method);
    assert_eq!(item.container.as_deref(), Some("Cart"));
    assert_eq!(item.relative_path, "lib/shop.py");
    assert_eq!(item.path, dir.file_string("lib/shop.py"));
    assert_eq!((item.line, item.column), (4, 9));
    assert_eq!(item.indices, [0, 1, 2]);
}

#[test]
fn exact_names_rank_first_then_prefixes_then_fuzzy() {
    let dir = TestDir::new();
    dir.write(
        "a.ts",
        "function cartographer() {}\nfunction createAppRouterTree() {}\nfunction Cart() {}\nfunction cart() {}\nfunction carts() {}\n",
    );
    dir.write("deeper/folder/b.ts", "export class Cart {}\n");
    let index = built(&dir, MAX_SYMBOLS);
    let ranked = names(&query(&index, "Cart", SymbolScope::All));
    assert_eq!(ranked, ["Cart", "Cart", "cart", "carts", "cartographer", "createAppRouterTree"]);
    // Same name and kind: the shorter path first.
    let results = query(&index, "Cart", SymbolScope::All);
    assert_eq!(results.items[0].relative_path, "a.ts");
    assert_eq!(results.matched, 6);
    // camelCase humps.
    assert_eq!(names(&query(&index, "cart", SymbolScope::All))[0], "cart");
    assert_eq!(names(&query(&index, "cART", SymbolScope::All)).len(), 6);
}

#[test]
fn scopes_and_container_queries() {
    let dir = TestDir::new();
    dir.write(
        "shop.rs",
        "pub struct Cart;\nimpl Cart {\n    pub fn add(&self) {}\n}\npub struct Order;\nimpl Order {\n    pub fn add(&self) {}\n}\nfn add_all() {}\n",
    );
    let index = built(&dir, MAX_SYMBOLS);
    assert_eq!(names(&query(&index, "cart", SymbolScope::Classes)), ["Cart"]);
    assert!(query(&index, "add", SymbolScope::Classes).items.is_empty());
    assert_eq!(names(&query(&index, "add", SymbolScope::Members)).len(), 3);
    assert_eq!(names(&query(&index, "Cart.add", SymbolScope::All)), ["Cart.add"]);
    assert_eq!(names(&query(&index, "order::add", SymbolScope::All)), ["Order.add"]);
    // A container alone lists its members.
    assert_eq!(names(&query(&index, "Order.", SymbolScope::All)), ["Order.add"]);
    let item = &query(&index, "Cart.add", SymbolScope::All).items[0];
    assert_eq!(item.container_indices, [0, 1, 2, 3]);
    assert!(query(&index, "", SymbolScope::All).items.is_empty());
}

#[test]
fn the_cap_stops_indexing_and_says_so() {
    let dir = TestDir::new();
    let text: String = (0..50).map(|number| format!("function f{number}() {{}}\n")).collect();
    dir.write("many.js", text);
    let index = built(&dir, 10);
    let progress = index.progress();
    assert_eq!(progress.symbols, 10);
    assert!(progress.truncated);
    assert!(progress.done);
    assert!(query(&index, "f", SymbolScope::All).truncated);
    assert!(!built(&dir, 50).progress().truncated);
}

#[test]
fn a_partly_built_index_answers_queries() {
    let dir = TestDir::new();
    dir.write("one.ts", "export function first() {}\n");
    dir.write("two.ts", "export function second() {}\n");
    let files = Index::building_for_test(&[dir.path_string()]);
    files.add_paths_for_test(0, &["one.ts"]);
    let index = Arc::new(SymbolIndex::new(files.clone(), MAX_SYMBOLS));
    let worker = index.clone();
    let builder = std::thread::spawn(move || build(&worker, &|_| {}));
    wait_until(|| index.progress().files == 1);
    let partial = query(&index, "first", SymbolScope::All);
    assert_eq!(names(&partial), ["first"]);
    assert!(!partial.done);
    assert!(query(&index, "second", SymbolScope::All).items.is_empty());

    files.add_paths_for_test(0, &["two.ts"]);
    files.finish_for_test();
    builder.join().unwrap();
    let full = query(&index, "second", SymbolScope::All);
    assert_eq!(names(&full), ["second"]);
    assert!(full.done);
    assert_eq!(full.files, 2);
}

#[test]
fn a_superseded_query_stops_early() {
    let dir = TestDir::new();
    dir.write("a.ts", "function cart() {}\n");
    let index = built(&dir, MAX_SYMBOLS);
    assert!(search(&index, "cart", SymbolScope::All, 10, &|| true).items.is_empty());
}

#[test]
fn symbols_are_stored_compactly() {
    assert_eq!(std::mem::size_of::<Symbol>(), 20);
    let dir = TestDir::new();
    let text: String = (0..100).map(|number| format!("    pub fn method{number}(&self) {{}}\n")).collect();
    dir.write("a.rs", format!("impl Cart {{\n{text}}}\n"));
    let index = built(&dir, MAX_SYMBOLS);
    assert_eq!(index.progress().symbols, 100);
    // The container name is stored once for all 100 methods.
    let chunks = lock(&index.chunks);
    assert_eq!(chunks[0].names.len(), "Cart".len() + (0..100).map(|number| format!("method{number}").len()).sum::<usize>());
    drop(chunks);
    assert!(index.heap_bytes() < 4096);
}

#[test]
fn the_session_builds_symbols_on_first_use_and_rebuilds_after_edits() {
    let dir = TestDir::new();
    dir.write("src/cart.ts", "export class Cart {}\n");
    let roots = vec![dir.path_string()];
    let search = crate::file_search::FileSearch::default();
    search.open(&roots, Box::new(|_| {}));
    search.open_symbols(&roots, Box::new(|_| {}));
    wait_until(|| search.query_symbols(&roots, "Cart", SymbolScope::All, 10).done);
    assert_eq!(names(&search.query_symbols(&roots, "Cart", SymbolScope::All, 10)), ["Cart"]);

    // An edit while the popup shows: the rebuild replaces the symbols once done.
    dir.write("src/cart.ts", "export class Basket {}\n");
    search.mark_contents_changed();
    wait_until(|| !search.query_symbols(&roots, "Basket", SymbolScope::All, 10).items.is_empty());
    assert!(search.query_symbols(&roots, "Cart", SymbolScope::All, 10).items.is_empty());

    // A new file: the file list and then the symbols are rebuilt.
    dir.write("src/order.ts", "export class Order {}\n");
    search.mark_stale();
    wait_until(|| !search.query_symbols(&roots, "Order", SymbolScope::All, 10).items.is_empty());
    search.close();
}

#[test]
fn the_all_tab_classes_and_members_queries_do_not_cancel_each_other() {
    // The All tab asks for its Classes and its Symbols (members) at the same time. They once
    // shared one "latest query" counter, so whichever started second stopped the other, and
    // on a big workspace the Classes section came back empty.
    let dir = TestDir::new();
    let functions: String = (0..4000).map(|number| format!("function cartItem{number}() {{}}\n")).collect();
    for file in 0..20 {
        dir.write(&format!("src/cart{file}.ts"), format!("export class Cart{file} {{}}\n{functions}"));
    }
    let roots = vec![dir.path_string()];
    let search = crate::file_search::FileSearch::default();
    search.open(&roots, Box::new(|_| {}));
    search.open_symbols(&roots, Box::new(|_| {}));
    wait_until(|| search.query_symbols(&roots, "cart", SymbolScope::All, 10).done);

    let finished = std::sync::atomic::AtomicBool::new(false);
    let classes = std::thread::scope(|scope| {
        let members = scope.spawn(|| {
            let mut answered = 0;
            while !finished.load(std::sync::atomic::Ordering::Relaxed) {
                let results = search.query_symbols(&roots, "cart", SymbolScope::Members, DEFAULT_LIMIT);
                assert!(results.items.iter().all(|item| !item.kind.is_class_like()));
                answered += 1;
            }
            answered
        });
        let classes: Vec<SymbolSearchResults> = (0..20)
            .map(|_| search.query_symbols(&roots, "cart", SymbolScope::Classes, DEFAULT_LIMIT))
            .collect();
        finished.store(true, std::sync::atomic::Ordering::Relaxed);
        assert!(members.join().unwrap() > 0);
        classes
    });
    for results in classes {
        assert_eq!(results.matched, 20, "a Members query must not cancel a Classes query");
        assert_eq!(results.items.len(), 20);
    }
    search.close();

    let slots: std::collections::HashSet<usize> = [SymbolScope::Classes, SymbolScope::All, SymbolScope::Members]
        .into_iter()
        .map(SymbolScope::index)
        .collect();
    assert_eq!(slots.len(), SymbolScope::COUNT);
    assert!(slots.iter().all(|slot| *slot < SymbolScope::COUNT));
}
