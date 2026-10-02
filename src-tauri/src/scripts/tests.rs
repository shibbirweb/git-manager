use std::fs;
use std::path::Path;

use super::*;

fn write(root: &Path, relative: &str, text: &str) {
    let path = root.join(relative);
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, text).unwrap();
}

fn text(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

/// (workspace folder, path below it, kind, runner, script names)
fn summary(sources: &[ScriptSource], roots: &[&Path]) -> Vec<(usize, String, ScriptKind, String, Vec<String>)> {
    sources
        .iter()
        .map(|source| {
            let workspace_index = roots.iter().position(|root| text(root) == source.workspace_folder).unwrap();
            let relative = Path::new(&source.file_path)
                .strip_prefix(roots[workspace_index])
                .unwrap()
                .to_string_lossy()
                .into_owned();
            let names = source.scripts.iter().map(|script| script.name.clone()).collect();
            (workspace_index, relative, source.kind, source.runner.clone(), names)
        })
        .collect()
}

fn row(
    workspace_index: usize,
    relative: &str,
    kind: ScriptKind,
    runner: &str,
    names: &[&str],
) -> (usize, String, ScriptKind, String, Vec<String>) {
    (
        workspace_index,
        relative.to_string(),
        kind,
        runner.to_string(),
        names.iter().map(|name| name.to_string()).collect(),
    )
}

#[test]
fn lists_scripts_across_a_workspace() {
    let temp = tempfile::tempdir().unwrap();
    let mono = temp.path().join("mono");
    let other = temp.path().join("other");

    write(&mono, "package.json", "{\"name\": \"mono\", \"scripts\": {\"build\": \"turbo build\", \"dev\": \"turbo dev\"}}");
    write(&mono, "pnpm-lock.yaml", "");
    write(&mono, "Makefile", "setup:\n\tpnpm install\n");
    write(&mono, ".gitignore", "generated/\n");
    write(&mono, "packages/web/package.json", "{\"name\": \"web\", \"scripts\": {\"start\": \"vite\"}}");
    write(&mono, "packages/types/package.json", "{\"name\": \"types\", \"version\": \"1.0.0\"}");
    write(&mono, "packages/broken/package.json", "{\"scripts\": {\"a\": }");
    write(&mono, "packages/api/composer.json", "{\"name\": \"acme/api\", \"scripts\": {\"test\": \"phpunit\"}}");
    write(&mono, "node_modules/dep/package.json", "{\"scripts\": {\"no\": \"x\"}}");
    write(&mono, "generated/package.json", "{\"scripts\": {\"no\": \"x\"}}");
    write(&mono, ".hidden/package.json", "{\"scripts\": {\"no\": \"x\"}}");
    write(&mono, "tools/.justfile", "lint:\n    cargo clippy\n");
    write(&mono, "tools/deno.jsonc", "{\n  // tasks\n  \"tasks\": {\"fmt\": \"deno fmt\",},\n}\n");
    write(&mono, "a/b/c/d/e/f/package.json", "{\"scripts\": {\"deep\": \"x\"}}");
    write(&other, "justfile", "run:\n    ./run\n");

    let nested = mono.join("packages").join("web");
    let missing = temp.path().join("missing");
    let roots = [mono.as_path(), nested.as_path(), missing.as_path(), other.as_path()];
    let folder_paths: Vec<String> = roots.iter().map(|root| text(root)).collect();
    let sources = list_project_scripts(&folder_paths);

    assert_eq!(
        summary(&sources, &roots),
        vec![
            row(0, "Makefile", ScriptKind::Make, "make", &["setup"]),
            row(0, "package.json", ScriptKind::Npm, "pnpm", &["build", "dev"]),
            row(0, "tools/.justfile", ScriptKind::Just, "just", &["lint"]),
            row(0, "tools/deno.jsonc", ScriptKind::Deno, "deno", &["fmt"]),
            row(0, "packages/api/composer.json", ScriptKind::Composer, "composer", &["test"]),
            row(0, "packages/broken/package.json", ScriptKind::Npm, "pnpm", &[]),
            row(0, "packages/web/package.json", ScriptKind::Npm, "pnpm", &["start"]),
            row(3, "justfile", ScriptKind::Just, "just", &["run"]),
        ],
    );

    let root_package = &sources[1];
    assert_eq!(root_package.folder_path, text(&mono));
    assert_eq!(root_package.package_name.as_deref(), Some("mono"));
    assert_eq!(root_package.error, None);
    assert_eq!(
        root_package.scripts[0],
        ProjectScript {
            name: "build".to_string(),
            command: "turbo build".to_string(),
            line: 1,
        },
    );

    let broken = &sources[5];
    assert_eq!(broken.error.as_deref(), Some("Could not read package.json: Unexpected character on line 1"));
    assert_eq!(broken.package_name, None);

    let composer = &sources[4];
    assert_eq!(composer.package_name.as_deref(), Some("acme/api"));
    assert_eq!(composer.folder_path, text(&mono.join("packages").join("api")));
}

#[test]
fn serializes_for_the_frontend() {
    let source = ScriptSource {
        kind: ScriptKind::Npm,
        file_path: "/w/package.json".to_string(),
        folder_path: "/w".to_string(),
        workspace_folder: "/w".to_string(),
        runner: "bun".to_string(),
        package_name: None,
        scripts: vec![ProjectScript::new("dev", "vite", 3)],
        error: None,
        node_version: Some(NodeWanted {
            spec: "20".to_string(),
            source: ".nvmrc".to_string(),
            file_path: "/w/.nvmrc".to_string(),
        }),
    };
    let value = serde_json::to_value(&source).unwrap();
    assert_eq!(
        value,
        serde_json::json!({
            "kind": "npm",
            "filePath": "/w/package.json",
            "folderPath": "/w",
            "workspaceFolder": "/w",
            "runner": "bun",
            "packageName": null,
            "scripts": [{"name": "dev", "command": "vite", "line": 3}],
            "error": null,
            "nodeVersion": {"spec": "20", "source": ".nvmrc", "filePath": "/w/.nvmrc"},
        }),
    );
    assert_eq!(serde_json::to_value(ScriptKind::Just).unwrap(), serde_json::json!("just"));
}

#[test]
fn stops_after_the_file_limit() {
    let temp = tempfile::tempdir().unwrap();
    for index in 0..(MAX_FILES + 5) {
        write(temp.path(), &format!("p{index:03}/Makefile"), "go:\n\techo go\n");
    }
    let sources = list_project_scripts(&[text(temp.path())]);
    assert_eq!(sources.len(), MAX_FILES);
}

#[test]
fn finds_the_node_version_a_package_asks_for() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path();
    write(root, "pinned/package.json", r#"{"scripts": {"a": "x"}, "volta": {"node": "20.11.1"}, "engines": {"node": ">=18"}}"#);
    write(root, "ranged/package.json", r#"{"scripts": {"a": "x"}, "engines": {"node": "^18.17.0"}}"#);
    write(root, "both/package.json", r#"{"scripts": {"a": "x"}, "engines": {"node": ">=16"}}"#);
    write(root, "both/.nvmrc", "lts/iron\n");
    write(root, "plain/package.json", r#"{"scripts": {"a": "x"}}"#);
    write(root, "plain/Makefile", "go:\n\techo go\n");

    let sources = list_project_scripts(&[text(root)]);
    let wanted = |folder: &str, file: &str| {
        let source = sources.iter().find(|source| source.file_path == text(&root.join(folder).join(file))).unwrap();
        source.node_version.as_ref().map(|node| (node.spec.clone(), node.source.clone()))
    };
    assert_eq!(wanted("pinned", "package.json"), Some(("20.11.1".to_string(), "package.json volta.node".to_string())));
    assert_eq!(wanted("ranged", "package.json"), Some(("^18.17.0".to_string(), "package.json engines.node".to_string())));
    assert_eq!(wanted("both", "package.json"), Some(("lts/iron".to_string(), ".nvmrc".to_string())));
    assert_eq!(wanted("plain", "package.json"), None);
    assert_eq!(wanted("plain", "Makefile"), None, "only package.json scripts run with Node");
}
