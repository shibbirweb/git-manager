//! Go to File and Find in Files, shaped like the Tauri commands in src-tauri/src/commands/search.rs and run by the
//! same file_search and text_search modules. The window has one search session, as each Tauri window does. The
//! page's progress and result channels have no C counterpart: file_search_open answers the progress at the call,
//! and text_search answers every batch of the search at once, in the order the backend sent them.

use std::sync::{Mutex, OnceLock};

use serde::Deserialize;

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
