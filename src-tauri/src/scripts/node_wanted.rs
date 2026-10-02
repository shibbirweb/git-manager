//! The Node version a package asks for in a version file: `.nvmrc`, `.node-version`
//! (nvm, fnm, n, nodenv) or `.tool-versions` (asdf, mise). The nearest folder wins.

use std::path::Path;

use super::NodeWanted;

const VERSION_FILES: &[&str] = &[".nvmrc", ".node-version", ".tool-versions"];

/// Looks in the package's folder, then each parent up to the workspace folder.
pub(super) fn find(package_folder: &Path, workspace_folder: &Path) -> Option<NodeWanted> {
    let mut folder = Some(package_folder);
    while let Some(current) = folder {
        if !current.starts_with(workspace_folder) {
            break;
        }
        for name in VERSION_FILES {
            let file_path = current.join(name);
            let Ok(text) = std::fs::read_to_string(&file_path) else {
                continue;
            };
            let spec = if *name == ".tool-versions" { tool_versions_node(&text) } else { first_value(&text) };
            if let Some(spec) = spec {
                return Some(NodeWanted {
                    spec,
                    source: (*name).to_string(),
                    file_path: file_path.to_string_lossy().into_owned(),
                });
            }
        }
        if current == workspace_folder {
            break;
        }
        folder = current.parent();
    }
    None
}

/// The first line that is not empty or a comment, without trailing comments.
fn first_value(text: &str) -> Option<String> {
    text.lines()
        .map(|line| line.split('#').next().unwrap_or_default().trim())
        .find(|line| !line.is_empty())
        .map(str::to_string)
}

/// `nodejs 20.11.1` (asdf) or `node 20` (mise); the first version listed is the one used.
fn tool_versions_node(text: &str) -> Option<String> {
    text.lines().find_map(|line| {
        let mut words = line.split('#').next().unwrap_or_default().split_whitespace();
        let tool = words.next()?;
        if tool != "nodejs" && tool != "node" {
            return None;
        }
        words.next().map(str::to_string)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_each_version_file_format() {
        assert_eq!(first_value("# pinned\n\n  v20.11.1  # current LTS\n").as_deref(), Some("v20.11.1"));
        assert_eq!(first_value("lts/iron\n").as_deref(), Some("lts/iron"));
        assert_eq!(first_value("\n# only a comment\n"), None);
        assert_eq!(tool_versions_node("python 3.12.1\nnodejs 18.19.0 20.11.1\n").as_deref(), Some("18.19.0"));
        assert_eq!(tool_versions_node("node 22 # mise\n").as_deref(), Some("22"));
        assert_eq!(tool_versions_node("ruby 3.3.0\n"), None);
    }

    #[test]
    fn the_nearest_folder_wins_inside_the_workspace() {
        let root = tempfile::tempdir().unwrap();
        let workspace = root.path().join("mono");
        let package = workspace.join("packages").join("web");
        std::fs::create_dir_all(&package).unwrap();
        std::fs::write(root.path().join(".nvmrc"), "16\n").unwrap();
        assert_eq!(find(&package, &workspace), None, "outside the workspace folder does not count");

        std::fs::write(workspace.join(".tool-versions"), "nodejs 18.20.4\n").unwrap();
        let found = find(&package, &workspace).unwrap();
        assert_eq!((found.spec.as_str(), found.source.as_str()), ("18.20.4", ".tool-versions"));
        assert!(found.file_path.ends_with(".tool-versions"));

        std::fs::write(package.join(".node-version"), "20\n").unwrap();
        assert_eq!(find(&package, &workspace).unwrap().spec, "20");
        std::fs::write(package.join(".nvmrc"), "22\n").unwrap();
        assert_eq!(find(&package, &workspace).unwrap().source, ".nvmrc");
    }
}
