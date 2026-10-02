use std::path::Path;

use serde_json::{json, Value};

use super::patch::{self, DiffMode, DiffRequest};
use super::{files_prop, json_out, object, repo_prop, wait, Args, BackendTool, ToolCtx, ToolOutput, ToolResult, GIT};
use crate::git::blame;
use crate::git::history as file_log;
use crate::git::log;
use crate::git::repo as git_repo;
use crate::git::{conflicts, refs, stash, status, submodule, worktree};

const MAX_LOG: usize = 500;

fn repo_only() -> Value {
    object(json!({ "repoPath": repo_prop() }), &["repoPath"])
}

fn max_bytes_prop() -> Value {
    json!({
        "type": "integer",
        "description": format!("Cut the diff after this many bytes (default {}, at most {}).", patch::DEFAULT_MAX_BYTES, patch::MAX_BYTES),
    })
}

pub const TOOLS: &[BackendTool] = &[
    BackendTool {
        name: "git_status",
        title: "Git status",
        description: "The current branch, its upstream and ahead/behind counts, any merge or rebase in progress, and every changed file with its staged and unstaged state.",
        category: GIT,
        read_only: true,
        destructive: false,
        schema: repo_only,
        run: git_status,
    },
    BackendTool {
        name: "git_diff",
        title: "Git diff",
        description: "A unified diff: unstaged changes (default), staged changes, everything since HEAD, one commit, or between two revisions. Optionally limited to some files; long diffs are cut at maxBytes.",
        category: GIT,
        read_only: true,
        destructive: false,
        schema: diff_schema,
        run: git_diff,
    },
    BackendTool {
        name: "git_log",
        title: "Git log",
        description: "Commit history of the current branch (or all branches), newest first, a page at a time. With filePath, only commits that touched that file, following renames.",
        category: GIT,
        read_only: true,
        destructive: false,
        schema: log_schema,
        run: git_log,
    },
    BackendTool {
        name: "git_show_commit",
        title: "Show commit",
        description: "One commit's full message, author, committer, parents and changed files, optionally with its patch.",
        category: GIT,
        read_only: true,
        destructive: false,
        schema: show_schema,
        run: git_show_commit,
    },
    BackendTool {
        name: "git_branches",
        title: "List branches and tags",
        description: "Local branches (with upstream and ahead/behind), remote branches, tags and remotes.",
        category: GIT,
        read_only: true,
        destructive: false,
        schema: repo_only,
        run: git_branches,
    },
    BackendTool {
        name: "git_remotes",
        title: "List remotes",
        description: "Each remote with its fetch and push URLs (credentials masked).",
        category: GIT,
        read_only: true,
        destructive: false,
        schema: repo_only,
        run: git_remotes,
    },
    BackendTool {
        name: "git_stashes",
        title: "List stashes",
        description: "The stash list, newest first; the index is what git_stash_apply, git_stash_pop and git_stash_drop take.",
        category: GIT,
        read_only: true,
        destructive: false,
        schema: repo_only,
        run: git_stashes,
    },
    BackendTool {
        name: "git_blame",
        title: "Git blame",
        description: "Who last changed each line of a file and in which commit, for the work tree or a revision, optionally only a line range.",
        category: GIT,
        read_only: true,
        destructive: false,
        schema: blame_schema,
        run: git_blame,
    },
    BackendTool {
        name: "git_file_history",
        title: "File history",
        description: "Commits that changed one file, newest first, following renames, with how the file changed in each.",
        category: GIT,
        read_only: true,
        destructive: false,
        schema: file_history_schema,
        run: git_file_history,
    },
    BackendTool {
        name: "git_line_history",
        title: "Line history",
        description: "Commits that changed a range of lines of a file (git log -L), each with the diff of those lines.",
        category: GIT,
        read_only: true,
        destructive: false,
        schema: line_history_schema,
        run: git_line_history,
    },
    BackendTool {
        name: "git_conflicts",
        title: "List conflicts",
        description: "The merge, rebase, cherry-pick or revert in progress and the files still in conflict, with the kind of each conflict.",
        category: GIT,
        read_only: true,
        destructive: false,
        schema: repo_only,
        run: git_conflicts,
    },
    BackendTool {
        name: "git_compare_branches",
        title: "Compare branches",
        description: "Commits that one branch has and the other lacks, both ways, and the files that differ between them.",
        category: GIT,
        read_only: true,
        destructive: false,
        schema: compare_schema,
        run: git_compare_branches,
    },
    BackendTool {
        name: "git_worktrees",
        title: "List work trees",
        description: "The repository's linked work trees (git worktree list) with their branches and states.",
        category: GIT,
        read_only: true,
        destructive: false,
        schema: repo_only,
        run: git_worktrees,
    },
    BackendTool {
        name: "git_submodules",
        title: "List submodules",
        description: "The repository's submodules with their paths, URLs, recorded and checked out commits.",
        category: GIT,
        read_only: true,
        destructive: false,
        schema: repo_only,
        run: git_submodules,
    },
    BackendTool {
        name: "git_console_entries",
        title: "Git Console entries",
        description: "The git commands Git Manager ran recently (the Git Console), with arguments, exit codes, timing and the start of their output. Empty unless the Git Console is turned on in Settings.",
        category: GIT,
        read_only: true,
        destructive: false,
        schema: console_schema,
        run: git_console_entries,
    },
];

fn diff_schema() -> Value {
    object(
        json!({
            "repoPath": repo_prop(),
            "mode": {
                "type": "string",
                "enum": ["unstaged", "staged", "head", "commit", "range"],
                "description": "unstaged: work tree vs index (default, new files included). staged: index vs HEAD. head: work tree vs HEAD. commit: commitId vs its parent. range: from vs to.",
            },
            "commitId": { "type": "string", "description": "The commit for mode \"commit\" (hash, branch or tag)." },
            "from": { "type": "string", "description": "The older revision for mode \"range\"." },
            "to": { "type": "string", "description": "The newer revision for mode \"range\" (default HEAD)." },
            "filePaths": files_prop("Only these files."),
            "contextLines": { "type": "integer", "description": "Unchanged lines around each change (default 3)." },
            "maxBytes": max_bytes_prop(),
        }),
        &["repoPath"],
    )
}

fn diff_text(ctx: &ToolCtx, args: &Args, repo_path: &str, mode: DiffMode) -> Result<String, String> {
    let file_paths = ctx.repo_files(repo_path, &args.opt_str_list("filePaths")?)?;
    let request = DiffRequest {
        mode,
        commit_id: args.opt_str("commitId")?,
        from: args.opt_str("from")?,
        to: args.opt_str("to")?,
        file_paths: &file_paths,
        context_lines: args.u64("contextLines", 3)?.min(100) as u32,
        max_bytes: args.usize("maxBytes", patch::DEFAULT_MAX_BYTES, patch::MAX_BYTES)?,
    };
    let repo = git_repo::open(repo_path).map_err(|err| err.to_string())?;
    Ok(patch::render(&patch::unified(&repo, &request)?))
}

fn git_diff(ctx: &ToolCtx, args: &Args) -> ToolResult {
    let repo_path = ctx.repo(args)?;
    let mode = DiffMode::parse(args.opt_str("mode")?.unwrap_or("unstaged"))?;
    Ok(ToolOutput::Text(diff_text(ctx, args, &repo_path, mode)?))
}

fn git_status(ctx: &ToolCtx, args: &Args) -> ToolResult {
    let repo_path = ctx.repo(args)?;
    let repo = git_repo::open(&repo_path).map_err(|err| err.to_string())?;
    json_out(status::read(&repo).map_err(|err| err.to_string())?)
}

fn log_schema() -> Value {
    object(
        json!({
            "repoPath": repo_prop(),
            "offset": { "type": "integer", "description": "Commits to skip, for the next page (default 0)." },
            "limit": { "type": "integer", "description": format!("Commits to return (default 50, at most {MAX_LOG}).") },
            "allRefs": { "type": "boolean", "description": "Include every local and remote branch, like git log --branches --remotes; tags and stashes are not followed (default false)." },
            "filePath": { "type": "string", "description": "Only commits that changed this file (absolute or relative to repoPath)." },
        }),
        &["repoPath"],
    )
}

fn git_log(ctx: &ToolCtx, args: &Args) -> ToolResult {
    let repo_path = ctx.repo(args)?;
    let offset = args.usize("offset", 0, usize::MAX)?;
    let limit = args.usize("limit", 50, MAX_LOG)?;
    if let Some(file_path) = args.opt_str("filePath")? {
        let relative = ctx.repo_files(&repo_path, &[file_path.to_string()])?.remove(0);
        let entries = file_log::file_history(Path::new(&repo_path), &relative, offset, limit).map_err(|err| err.to_string())?;
        return json_out(json!({ "commits": entries, "offset": offset }));
    }
    let repo = git_repo::open(&repo_path).map_err(|err| err.to_string())?;
    let commits = log::page(&repo, offset, limit, args.bool("allRefs", false)?).map_err(|err| err.to_string())?;
    let more = commits.len() == limit;
    json_out(json!({ "commits": commits, "offset": offset, "nextOffset": more.then_some(offset + limit) }))
}

fn show_schema() -> Value {
    object(
        json!({
            "repoPath": repo_prop(),
            "commitId": { "type": "string", "description": "The commit (hash, branch, tag or HEAD~2 style revision)." },
            "includePatch": { "type": "boolean", "description": "Add the commit's unified diff (default false)." },
            "maxBytes": max_bytes_prop(),
        }),
        &["repoPath", "commitId"],
    )
}

fn git_show_commit(ctx: &ToolCtx, args: &Args) -> ToolResult {
    let repo_path = ctx.repo(args)?;
    let revision = args.str("commitId")?;
    let repo = git_repo::open(&repo_path).map_err(|err| err.to_string())?;
    let commit_id = git_repo::resolve_commit(&repo, revision).map_err(|err| err.to_string())?.id().to_string();
    let details = log::details(&repo, &commit_id).map_err(|err| err.to_string())?;
    let mut value = json!(details);
    if args.bool("includePatch", false)? {
        value["patch"] = json!(diff_text(ctx, args, &repo_path, DiffMode::Commit)?);
    }
    json_out(value)
}

fn git_branches(ctx: &ToolCtx, args: &Args) -> ToolResult {
    let repo_path = ctx.repo(args)?;
    let repo = git_repo::open(&repo_path).map_err(|err| err.to_string())?;
    json_out(refs::read(&repo).map_err(|err| err.to_string())?)
}

fn git_remotes(ctx: &ToolCtx, args: &Args) -> ToolResult {
    let repo_path = ctx.repo(args)?;
    json_out(json!({ "remotes": wait(crate::commands::remote::list_remotes(repo_path))? }))
}

fn git_stashes(ctx: &ToolCtx, args: &Args) -> ToolResult {
    let repo_path = ctx.repo(args)?;
    let mut repo = git_repo::open(&repo_path).map_err(|err| err.to_string())?;
    json_out(json!({ "stashes": stash::list(&mut repo).map_err(|err| err.to_string())? }))
}

fn blame_schema() -> Value {
    object(
        json!({
            "repoPath": repo_prop(),
            "filePath": { "type": "string", "description": "The file (absolute or relative to repoPath)." },
            "revision": { "type": "string", "description": "Blame the file as of this commit instead of the work tree." },
            "startLine": { "type": "integer", "description": "First line to return (1-based, default 1)." },
            "endLine": { "type": "integer", "description": "Last line to return (default: 200 lines after startLine)." },
        }),
        &["repoPath", "filePath"],
    )
}

/// The blamed text, so each line can be shown with its code.
fn blamed_text(repo_path: &str, file_path: &str, revision: Option<&str>) -> Vec<String> {
    let text = match revision {
        None => std::fs::read(Path::new(repo_path).join(file_path)).ok(),
        Some(revision) => git_repo::open(repo_path).ok().and_then(|repo| {
            let object = repo.revparse_single(&format!("{revision}:{file_path}")).ok()?;
            object.as_blob().map(|blob| blob.content().to_vec())
        }),
    };
    text.map(|bytes| String::from_utf8_lossy(&bytes).lines().map(str::to_string).collect())
        .unwrap_or_default()
}

fn git_blame(ctx: &ToolCtx, args: &Args) -> ToolResult {
    let repo_path = ctx.repo(args)?;
    let file_path = ctx.repo_files(&repo_path, &[args.str("filePath")?.to_string()])?.remove(0);
    let revision = args.opt_str("revision")?;
    if let Some(revision) = revision {
        crate::commands::reject_option(revision, "A revision").map_err(|err| err.to_string())?;
    }
    let info = blame::blame(Path::new(&repo_path), &file_path, revision, None).map_err(|err| err.to_string())?;
    let start = args.usize("startLine", 1, usize::MAX)?.max(1);
    let end = args.usize("endLine", start + 199, usize::MAX)?.max(start);
    let text = blamed_text(&repo_path, &file_path, revision);
    let lines: Vec<Value> = info
        .lines
        .iter()
        .enumerate()
        .skip(start - 1)
        .take(end + 1 - start)
        .filter_map(|(index, commit_index)| {
            let commit = info.commits.get(*commit_index as usize)?;
            Some(json!({
                "line": index + 1,
                "commit": if commit.uncommitted { "uncommitted".to_string() } else { commit.short_id.clone() },
                "author": commit.author_name,
                "authorTime": commit.author_time,
                "summary": commit.summary,
                "text": text.get(index).cloned().unwrap_or_default(),
            }))
        })
        .collect();
    json_out(json!({ "filePath": file_path, "totalLines": info.lines.len(), "lines": lines }))
}

fn file_history_schema() -> Value {
    object(
        json!({
            "repoPath": repo_prop(),
            "filePath": { "type": "string", "description": "The file (absolute or relative to repoPath)." },
            "offset": { "type": "integer", "description": "Commits to skip (default 0)." },
            "limit": { "type": "integer", "description": format!("Commits to return (default 50, at most {}).", file_log::MAX_FILE_HISTORY) },
        }),
        &["repoPath", "filePath"],
    )
}

fn git_file_history(ctx: &ToolCtx, args: &Args) -> ToolResult {
    let repo_path = ctx.repo(args)?;
    let file_path = ctx.repo_files(&repo_path, &[args.str("filePath")?.to_string()])?.remove(0);
    let offset = args.usize("offset", 0, usize::MAX)?;
    let limit = args.usize("limit", 50, file_log::MAX_FILE_HISTORY)?;
    let entries = file_log::file_history(Path::new(&repo_path), &file_path, offset, limit).map_err(|err| err.to_string())?;
    json_out(json!({ "entries": entries }))
}

fn line_history_schema() -> Value {
    object(
        json!({
            "repoPath": repo_prop(),
            "filePath": { "type": "string", "description": "The file (absolute or relative to repoPath)." },
            "startLine": { "type": "integer", "description": "First line of the range (1-based, as numbered in HEAD, not the work tree)." },
            "endLine": { "type": "integer", "description": "Last line of the range (1-based, as numbered in HEAD)." },
            "limit": { "type": "integer", "description": format!("Commits to return (default 20, at most {}).", file_log::MAX_LINE_HISTORY) },
        }),
        &["repoPath", "filePath", "startLine", "endLine"],
    )
}

fn git_line_history(ctx: &ToolCtx, args: &Args) -> ToolResult {
    let repo_path = ctx.repo(args)?;
    let file_path = ctx.repo_files(&repo_path, &[args.str("filePath")?.to_string()])?.remove(0);
    let start = args.opt_u64("startLine")?.ok_or("Missing required argument: startLine")? as usize;
    let end = args.opt_u64("endLine")?.ok_or("Missing required argument: endLine")? as usize;
    let limit = args.usize("limit", 20, file_log::MAX_LINE_HISTORY)?;
    let entries = file_log::line_history(Path::new(&repo_path), &file_path, start, end, limit).map_err(|err| err.to_string())?;
    json_out(json!({ "entries": entries }))
}

fn git_conflicts(ctx: &ToolCtx, args: &Args) -> ToolResult {
    let repo_path = ctx.repo(args)?;
    let repo = git_repo::open(&repo_path).map_err(|err| err.to_string())?;
    json_out(conflicts::list(&repo).map_err(|err| err.to_string())?)
}

fn compare_schema() -> Value {
    object(
        json!({
            "repoPath": repo_prop(),
            "branchName": { "type": "string", "description": "The branch (or revision) to look at." },
            "baseName": { "type": "string", "description": "The branch (or revision) to compare against, e.g. main." },
        }),
        &["repoPath", "branchName", "baseName"],
    )
}

fn git_compare_branches(ctx: &ToolCtx, args: &Args) -> ToolResult {
    let repo_path = ctx.repo(args)?;
    let branch_name = args.str("branchName")?.to_string();
    let base_name = args.str("baseName")?.to_string();
    json_out(wait(crate::commands::branch_actions::compare_branches(repo_path, branch_name, base_name))?)
}

fn git_worktrees(ctx: &ToolCtx, args: &Args) -> ToolResult {
    let repo_path = ctx.repo(args)?;
    json_out(json!({ "worktrees": worktree::list(&repo_path).map_err(|err| err.to_string())? }))
}

fn git_submodules(ctx: &ToolCtx, args: &Args) -> ToolResult {
    let repo_path = ctx.repo(args)?;
    json_out(json!({ "submodules": submodule::list(&repo_path).map_err(|err| err.to_string())? }))
}

fn console_schema() -> Value {
    object(
        json!({
            "repoPath": { "type": "string", "description": "Only commands run in this repository (absolute path)." },
            "limit": { "type": "integer", "description": "Newest commands to return (default 50, at most 500)." },
        }),
        &[],
    )
}

fn git_console_entries(ctx: &ToolCtx, args: &Args) -> ToolResult {
    let console = crate::git_console::global();
    if !console.is_enabled() {
        return json_out(json!({
            "enabled": false,
            "entries": [],
            "note": "The Git Console is off. Turn it on in Git Manager's Settings to record git commands.",
        }));
    }
    let repo_filter = match args.opt_str("repoPath")? {
        Some(_) => Some(ctx.repo(args)?),
        None => None,
    };
    let limit = args.usize("limit", 50, crate::git_console::MAX_ENTRIES)?;
    let mut entries: Vec<_> = console
        .entries()
        .into_iter()
        .filter(|entry| {
            repo_filter
                .as_deref()
                .is_none_or(|repo_root| Path::new(&entry.repo_path).starts_with(repo_root))
        })
        .collect();
    let skip = entries.len().saturating_sub(limit);
    entries.drain(..skip);
    json_out(json!({ "enabled": true, "entries": entries }))
}
