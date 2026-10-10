//! Go to File and Find in Files, shaped like the Tauri commands in src-tauri/src/commands/search.rs and run by the
//! same file_search and text_search modules. The window has one search session, as each Tauri window does. The
//! page's progress and result channels have no C counterpart: file_search_open answers the progress at the call;
//! text_search answers every batch at once, and text_search_start runs the search on a thread of its own while
//! text_search_poll hands over the batches found since the last poll, so results show as they come, as on the page.

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};

use crate::error::AppResult;
use crate::file_search::{lock, FileSearch, FileSearchProgress, FileSearchResults, DEFAULT_LIMIT};
use crate::text_search::{TextSearchBatch, TextSearchOptions};

fn session() -> &'static FileSearch {
    static SEARCH: OnceLock<FileSearch> = OnceLock::new();
    SEARCH.get_or_init(FileSearch::default)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenArgs {
    workspace_roots: Vec<String>,
}

/// Go to File opened: starts (or reuses) the index of the workspace folders and returns right away.
pub fn file_search_open(args: OpenArgs) -> AppResult<FileSearchProgress> {
    Ok(session().open(&args.workspace_roots, Box::new(|_| {})))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryArgs {
    workspace_roots: Vec<String>,
    query: String,
    limit: Option<usize>,
}

/// Matches against whatever is indexed so far; never waits for indexing.
pub fn file_search_query(args: QueryArgs) -> AppResult<FileSearchResults> {
    Ok(session().query(&args.workspace_roots, &args.query, args.limit.unwrap_or(DEFAULT_LIMIT)))
}

/// The popup closed; the index stays a short while so reopening is instant.
pub fn file_search_close() -> AppResult<()> {
    session().close();
    Ok(())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextSearchArgs {
    workspace_roots: Vec<String>,
    search_id: u64,
    query: String,
    #[serde(default)]
    options: TextSearchOptions,
}

/// Find in Files: every batch of the search, the last one `done`; a newer `searchId` (or a cancel) stops it.
pub fn text_search(args: TextSearchArgs) -> AppResult<Vec<TextSearchBatch>> {
    let batches = Mutex::new(Vec::new());
    session().search_text(&args.workspace_roots, args.search_id, &args.query, &args.options, &|batch| {
        lock(&batches).push(batch);
    });
    Ok(batches.into_inner().unwrap_or_else(|poisoned| poisoned.into_inner()))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelArgs {
    search_id: u64,
}

pub fn text_search_cancel(args: CancelArgs) -> AppResult<()> {
    session().cancel_text_search(args.search_id);
    Ok(())
}

/// The batches a streamed search found and not yet polled, and whether its last one came.
#[derive(Default)]
struct Stream {
    batches: Vec<TextSearchBatch>,
    done: bool,
}

fn streams() -> &'static Mutex<HashMap<u64, Stream>> {
    static STREAMS: OnceLock<Mutex<HashMap<u64, Stream>>> = OnceLock::new();
    STREAMS.get_or_init(Mutex::default)
}

/// Find in Files, streamed: starts the search on its own thread and returns at once; older streams are dropped
/// (the newer id stops their search too).
pub fn text_search_start(args: TextSearchArgs) -> AppResult<()> {
    let search_id = args.search_id;
    {
        let mut all = lock(streams());
        all.retain(|id, _| *id > search_id);
        all.insert(search_id, Stream::default());
    }
    std::thread::spawn(move || {
        session().search_text(&args.workspace_roots, search_id, &args.query, &args.options, &|batch| {
            if let Some(stream) = lock(streams()).get_mut(&search_id) {
                stream.done |= batch.done;
                stream.batches.push(batch);
            }
        });
        if let Some(stream) = lock(streams()).get_mut(&search_id) {
            stream.done = true;
        }
    });
    Ok(())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PollArgs {
    search_id: u64,
    /// Waits up to this many milliseconds for a batch when none is there yet, so batches come about as they are
    /// found without the app polling in a tight loop.
    #[serde(default)]
    wait_ms: u64,
    /// Once a batch is there, also waits this long for more to come with it (0: hands it over at once).
    #[serde(default)]
    gather_ms: u64,
}

#[derive(Serialize)]
pub struct Poll {
    batches: Vec<TextSearchBatch>,
    done: bool,
}

/// The batches found since the last poll; `done` once the search is over (the stream is then dropped).
pub fn text_search_poll(args: PollArgs) -> AppResult<Poll> {
    let deadline = std::time::Instant::now() + std::time::Duration::from_millis(args.wait_ms);
    let mut frame_end: Option<std::time::Instant> = None;
    loop {
        let (done, has) = lock(streams())
            .get(&args.search_id)
            .map_or((true, false), |stream| (stream.done, !stream.batches.is_empty()));
        let now = std::time::Instant::now();
        if has && frame_end.is_none() {
            frame_end = Some(now + std::time::Duration::from_millis(args.gather_ms));
        }
        if done || now >= deadline || frame_end.is_some_and(|end| now >= end) {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(1));
    }
    let mut all = lock(streams());
    let Some(stream) = all.get_mut(&args.search_id) else {
        return Ok(Poll { batches: Vec::new(), done: true });
    };
    let poll = Poll { batches: std::mem::take(&mut stream.batches), done: stream.done };
    if poll.done {
        all.remove(&args.search_id);
    }
    Ok(poll)
}
