mod child_process;
mod commands;
mod config;
mod error;
mod file_ops;
mod file_search;
mod git;
mod git_console;
mod github;
mod local_history;
mod media;
mod mcp;
mod memory;
mod memory_log;
mod merge;
mod run_process;
mod node_versions;
mod paths;
mod preview_scheme;
mod scripts;
mod shelf;
mod state;
mod symbols;
mod terminal;
mod terminal_flow;
mod terminal_link;
#[cfg(test)]
mod test_support;
mod text_search;
mod unsaved;
mod watcher;
mod windows;
mod workspace_file;

use std::sync::atomic::Ordering;

use tauri::{Manager, RunEvent};

use state::{AppState, LaunchMode};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    // `git-manager cli ...` is the command line tool: no window, just its exit code.
    if args.first().map(String::as_str) == Some("cli") {
        std::process::exit(mcp::cli::run(&args[1..]));
    }
    let launch = LaunchMode::from_args(&args);

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new(launch))
        // Images and PDFs for the previews, off the main thread (see preview_scheme.rs).
        // Each window's page reaches only the folders open in that window.
        .register_asynchronous_uri_scheme_protocol(preview_scheme::SCHEME, |context, request, responder| {
            let folders = context.app_handle().state::<AppState>().preview_folders.get(context.webview_label());
            tauri::async_runtime::spawn_blocking(move || {
                responder.respond(preview_scheme::http_response(&folders, &request));
            });
        })
        .setup(|app| {
            let host = std::sync::Arc::new(mcp::TauriHost::new(app.handle().clone()));
            app.state::<AppState>().mcp.attach_host(host);
            commands::window::restore_at_start(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::repo::get_launch_mode,
            commands::repo::open_repo,
            commands::workspace::open_workspace,
            commands::workspace::discover_repositories,
            commands::workspace::init_repository,
            commands::workspace::watch_workspace,
            commands::workspace::unwatch_workspace,
            commands::status::get_status,
            commands::status::get_file_diff,
            commands::status::stage_files,
            commands::status::unstage_files,
            commands::status::discard_files,
            commands::status::stage_content,
            commands::lines::apply_selected_lines,
            commands::lines::restore_discarded_lines,
            commands::status::write_worktree_file,
            commands::status::commit,
            commands::status::commit_all,
            commands::status::undo_last_commit,
            commands::status::get_head_message,
            commands::identity::get_identity,
            commands::identity::set_identity,
            commands::identity::recent_commit_messages,
            commands::identity::get_commit_template,
            commands::status::commit_files,
            commands::status::rollback_files,
            commands::merge::list_conflicts,
            commands::merge::load_conflict,
            commands::merge::save_resolution,
            commands::merge::accept_side,
            commands::merge::continue_operation,
            commands::merge::abort_operation,
            commands::merge::skip_rebase_commit,
            commands::merge::load_mergetool,
            commands::merge::save_mergetool,
            commands::merge::cancel_mergetool,
            commands::branch::get_refs,
            commands::branch::get_refs_snapshot,
            commands::branch::checkout_branch,
            commands::branch::checkout_remote_branch,
            commands::branch::create_branch,
            commands::branch::rename_branch,
            commands::branch::delete_branch,
            commands::reflog::get_reflog,
            commands::reflog::last_action,
            commands::reflog::move_head_back,
            commands::bisect::bisect_state,
            commands::bisect::bisect_start,
            commands::bisect::bisect_mark,
            commands::bisect::bisect_reset,
            commands::branch::merge_branch,
            commands::branch::rebase_onto,
            commands::branch_actions::update_branch,
            commands::branch_actions::push_branch,
            commands::branch_actions::set_branch_upstream,
            commands::branch_actions::unset_branch_upstream,
            commands::branch_actions::compare_branches,
            commands::branch_actions::compare_with_worktree,
            commands::branch_actions::revisions_file_diff,
            commands::integrate::merge_with_options,
            commands::integrate::rebase_with_options,
            commands::rebase::rebase_plan,
            commands::rebase::interactive_rebase,
            commands::rebase::rebase_plan_onto,
            commands::remote::fetch_all,
            commands::auto_fetch::auto_fetch,
            commands::remote::fetch,
            commands::remote::pull,
            commands::remote::push,
            commands::remote::push_tags,
            commands::remote::pull_with_options,
            commands::remote::push_with_options,
            commands::remote::outgoing_commits,
            commands::remote::list_remotes,
            commands::remote::add_remote,
            commands::remote::edit_remote,
            commands::remote::remove_remote,
            commands::remote::clone_repository,
            commands::remote::cancel_git_command,
            commands::patch::create_patch,
            commands::patch::create_commit_patch,
            commands::patch::apply_patch,
            commands::patch::read_clipboard_text,
            commands::tag::create_tag,
            commands::tag::delete_tag,
            commands::history::get_log,
            commands::history::get_commit_details,
            commands::history::get_commit_file_diff,
            commands::history::blame_file,
            commands::editor::blame_contents,
            commands::editor::line_change_marks,
            commands::editor::head_file_version,
            commands::editor::read_head_file,
            commands::history::cherry_pick,
            commands::history::revert_commit,
            commands::history::reset_to,
            commands::history::checkout_commit,
            commands::history::resolve_revision,
            commands::history::file_history,
            commands::history::line_history,
            commands::history::compare_with_revision,
            commands::compare::compare_files,
            commands::stash::get_stashes,
            commands::stash::stash_push,
            commands::stash::stash_apply,
            commands::stash::stash_drop,
            commands::stash::stash_clear,
            commands::config::memory_usage,
            commands::config::clear_cache,
            commands::config::memory_log_configure,
            commands::config::memory_log_event,
            commands::config::load_config,
            commands::config::save_config,
            commands::config::config_dir,
            commands::config::os_info,
            commands::local_history::local_history_configure,
            commands::local_history::local_history_record,
            commands::local_history::local_history_list,
            commands::local_history::local_history_diff,
            commands::local_history::local_history_restore,
            commands::local_history::local_history_deleted,
            commands::local_history::local_history_usage,
            commands::local_history::local_history_clear,
            commands::unsaved::unsaved_write,
            commands::unsaved::unsaved_read,
            commands::unsaved::unsaved_remove,
            commands::unsaved::unsaved_list,
            commands::workspace::read_workspace_file,
            commands::workspace::write_workspace_file,
            commands::files::list_directories,
            commands::files::read_worktree_file,
            commands::files::preview_stat,
            commands::file_ops::file_create,
            commands::file_ops::file_rename,
            commands::file_ops::file_copy,
            commands::file_ops::file_move,
            commands::file_ops::file_trash,
            commands::file_ops::files_exist,
            commands::search::file_search_open,
            commands::search::file_search_query,
            commands::search::file_search_close,
            commands::search::symbol_search_open,
            commands::search::symbol_search_query,
            commands::search::text_search,
            commands::search::text_search_cancel,
            commands::search::replace_in_files,
            commands::search::replace_in_files_cancel,
            commands::search::document_symbols,
            commands::scripts::list_project_scripts,
            commands::scripts::list_node_versions,
            commands::scripts::run_script,
            commands::terminal::terminal_shells,
            commands::terminal::terminal_spawn,
            commands::terminal::terminal_write,
            commands::terminal::terminal_ack,
            commands::terminal::terminal_resize,
            commands::terminal::terminal_close,
            commands::terminal::terminal_close_all,
            commands::terminal::terminal_unstash,
            commands::terminal::terminal_reattach,
            commands::console::git_console_entries,
            commands::console::git_console_clear,
            commands::console::git_console_set_enabled,
            commands::mcp::mcp_configure,
            commands::mcp::mcp_status,
            commands::mcp::mcp_tools,
            commands::mcp::mcp_register_ui_tools,
            commands::mcp::mcp_ui_respond,
            commands::mcp::mcp_regenerate_token,
            commands::mcp::mcp_activity,
            commands::mcp::cli_install,
            commands::mcp::cli_uninstall,
            commands::shelf::shelve_changes,
            commands::shelf::list_shelf,
            commands::shelf::unshelve,
            commands::shelf::shelf_file_diff,
            commands::shelf::rename_shelf,
            commands::shelf::delete_shelf,
            commands::ignore::add_to_ignore,
            commands::ignore::ensure_ignore_file,
            commands::ignore::untrack_files,
            commands::worktree::list_worktrees,
            commands::worktree::add_worktree,
            commands::worktree::remove_worktree,
            commands::worktree::lock_worktree,
            commands::worktree::unlock_worktree,
            commands::worktree::prune_worktrees,
            commands::worktree::worktree_has_changes,
            commands::submodule::list_submodules,
            commands::submodule::init_submodules,
            commands::submodule::update_submodules,
            commands::submodule::sync_submodules,
            commands::submodule::add_submodule,
            commands::submodule::remove_submodule,
            commands::lfs::lfs_status,
            commands::lfs::lfs_track,
            commands::lfs::lfs_untrack,
            commands::lfs::lfs_transfer,
            commands::lfs::lfs_prune,
            commands::lfs::lfs_install,
            github::commands::github_account,
            github::commands::github_cli_status,
            github::commands::github_sign_in_with_token,
            github::commands::github_sign_in_with_cli,
            github::commands::github_sign_out,
            github::commands::github_share_project,
            github::commands::github_repository,
            github::commands::github_sync_fork,
            github::commands::github_create_gist,
            commands::config::update_config,
            commands::window::window_startup,
            commands::window::window_set_workspace,
            commands::window::window_focus_owner,
            commands::window::window_open,
            commands::window::window_close,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| match event {
        RunEvent::WindowEvent { label, event, .. } => commands::window::on_window_event(app_handle, &label, &event),
        // An explicit quit closes every window at once: they all stay in the session.
        RunEvent::ExitRequested { code: Some(_), .. } => commands::window::on_quit(app_handle),
        RunEvent::Exit => {
            // Cmd+Q on macOS ends the loop without closing the windows one by one.
            commands::window::on_quit(app_handle);
            let state = app_handle.state::<AppState>();
            // No orphan shells: every terminal process dies with the app.
            state.terminals.shutdown();
            // Frees the port and takes it out of mcp.json, so the command line tool sees the app is gone.
            state.mcp.shutdown();
            state.memory_log.stop();
            if state.launch.is_mergetool() {
                // git mergetool trusts the exit code: 0 only after an explicit save.
                std::process::exit(state.mergetool_exit_code.load(Ordering::SeqCst));
            }
        }
        _ => {}
    });
}

#[cfg(test)]
mod capability_tests {
    #[test]
    fn opener_may_open_web_links() {
        let capability: serde_json::Value = serde_json::from_str(include_str!("../capabilities/default.json")).unwrap();
        let permissions: Vec<&str> = capability["permissions"]
            .as_array()
            .map(|items| items.iter().filter_map(|item| item.as_str()).collect())
            .unwrap_or_default();
        // allow-open-url has no URL scope of its own, so without allow-default-urls every link is refused.
        assert!(permissions.contains(&"opener:allow-open-url"));
        assert!(permissions.contains(&"opener:allow-default-urls"));
    }
}
