//! package.json "scripts", run by npm, yarn, pnpm or bun.

use std::path::Path;

use super::{json, set_script, string_field, Parsed, ProjectScript};

const RUNNERS: &[&str] = &["npm", "yarn", "pnpm", "bun"];

/// Lockfiles per directory, in the order they are checked.
const LOCKFILES: &[(&str, &str)] = &[
    ("bun.lock", "bun"),
    ("bun.lockb", "bun"),
    ("pnpm-lock.yaml", "pnpm"),
    ("yarn.lock", "yarn"),
    ("package-lock.json", "npm"),
    ("npm-shrinkwrap.json", "npm"),
];

pub(super) fn parse(text: &str) -> Result<Parsed, String> {
    let manifest = json::parse(text, false)?;
    let mut scripts = Vec::new();
    for member in manifest.get("scripts").and_then(json::Value::members).unwrap_or_default() {
        if let Some(command) = member.value.as_str() {
            set_script(&mut scripts, ProjectScript::new(member.key.as_str(), command, member.line));
        }
    }
    Ok(Parsed {
        package_name: string_field(&manifest, "name"),
        scripts,
        package_manager: string_field(&manifest, "packageManager"),
        node_wanted: manifest_node(&manifest),
    })
}

/// Volta's pin wins over the engines range: it names one version.
fn manifest_node(manifest: &json::Value) -> Option<(String, &'static str)> {
    let volta = manifest.get("volta").and_then(|volta| volta.get("node")).and_then(json::Value::as_str);
    if let Some(spec) = volta.map(str::trim).filter(|spec| !spec.is_empty()) {
        return Some((spec.to_string(), "package.json volta.node"));
    }
    let engines = manifest.get("engines").and_then(|engines| engines.get("node")).and_then(json::Value::as_str);
    engines
        .map(str::trim)
        .filter(|spec| !spec.is_empty())
        .map(|spec| (spec.to_string(), "package.json engines.node"))
}

/// The "packageManager" field wins, then the nearest lockfile up to the
/// workspace folder (a monorepo package has it at the root), then npm.
pub(super) fn runner(package_manager: Option<&str>, package_folder: &Path, workspace_folder: &Path) -> String {
    let declared = package_manager
        .and_then(|value| value.split('@').next())
        .map(str::trim)
        .filter(|name| RUNNERS.contains(name));
    if let Some(name) = declared {
        return name.to_string();
    }
    let mut folder = Some(package_folder);
    while let Some(current) = folder {
        if !current.starts_with(workspace_folder) {
            break;
        }
        let locked = LOCKFILES.iter().find(|(lockfile, _)| current.join(lockfile).is_file());
        if let Some((_, name)) = locked {
            return name.to_string();
        }
        if current == workspace_folder {
            break;
        }
        folder = current.parent();
    }
    "npm".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn names_and_lines(parsed: &Parsed) -> Vec<(&str, &str, u32)> {
        parsed
            .scripts
            .iter()
            .map(|script| (script.name.as_str(), script.command.as_str(), script.line))
            .collect()
    }

    #[test]
    fn reads_scripts_in_file_order_with_lines() {
        let text = r#"{
  "name": "@acme/web",
  "packageManager": "pnpm@9.1.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": 42,
    "check": "svelte-check"
  }
}"#;
        let parsed = parse(text).unwrap();
        assert_eq!(parsed.package_name.as_deref(), Some("@acme/web"));
        assert_eq!(parsed.package_manager.as_deref(), Some("pnpm@9.1.0"));
        assert_eq!(
            names_and_lines(&parsed),
            vec![("dev", "vite", 5), ("build", "vite build", 6), ("check", "svelte-check", 8)],
        );
    }

    #[test]
    fn missing_scripts_and_invalid_json() {
        let parsed = parse("{\"name\": \"x\", \"scripts\": \"nope\"}").unwrap();
        assert!(parsed.scripts.is_empty());
        assert!(parse("{\"name\": \"x\",\n}").is_err());
    }

    #[test]
    fn long_commands_are_cut() {
        let long = "a".repeat(400);
        let parsed = parse(&format!("{{\"scripts\": {{\"long\": \"{long}\"}}}}")).unwrap();
        assert_eq!(parsed.scripts[0].command.len(), 303);
        assert!(parsed.scripts[0].command.ends_with("..."));
    }

    #[test]
    fn runner_from_package_manager_then_lockfiles() {
        let root = tempfile::tempdir().unwrap();
        let workspace = root.path().join("mono");
        let package = workspace.join("packages").join("app");
        std::fs::create_dir_all(&package).unwrap();
        assert_eq!(runner(None, &package, &workspace), "npm");
        assert_eq!(runner(Some("yarn@4.0.0+sha.abc"), &package, &workspace), "yarn");
        assert_eq!(runner(Some("bun@1"), &package, &workspace), "bun");
        assert_eq!(runner(Some("unknown@1"), &package, &workspace), "npm");

        // Outside the workspace folder does not count.
        std::fs::write(root.path().join("yarn.lock"), "").unwrap();
        assert_eq!(runner(None, &package, &workspace), "npm");

        std::fs::write(workspace.join("pnpm-lock.yaml"), "").unwrap();
        assert_eq!(runner(None, &package, &workspace), "pnpm");
        std::fs::write(workspace.join("bun.lockb"), "").unwrap();
        assert_eq!(runner(None, &package, &workspace), "bun");

        // The nearest folder wins.
        std::fs::write(package.join("package-lock.json"), "").unwrap();
        assert_eq!(runner(None, &package, &workspace), "npm");
        assert_eq!(runner(Some("pnpm@9"), &package, &workspace), "pnpm");
    }
}
