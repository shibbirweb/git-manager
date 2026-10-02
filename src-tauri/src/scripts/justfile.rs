//! justfile recipes: public ones only, never settings, aliases or variables.

use std::collections::HashSet;

use super::{Parsed, ProjectScript};

const NOT_RECIPES: &[&str] = &["set", "alias", "export", "import", "import?", "mod", "mod?"];

pub(super) fn parse(text: &str) -> Parsed {
    let lines: Vec<&str> = text.lines().collect();
    let mut scripts = Vec::new();
    let mut seen: HashSet<&str> = HashSet::new();
    let mut private_attribute = false;
    for (index, line) in lines.iter().enumerate() {
        if line.trim().is_empty() || line.starts_with(|first: char| first.is_whitespace() || first == '#') {
            continue;
        }
        if line.starts_with('[') {
            private_attribute = private_attribute || line.contains("private");
            continue;
        }
        let is_private = std::mem::take(&mut private_attribute);
        let first_word = line.split_whitespace().next().unwrap_or_default();
        if NOT_RECIPES.contains(&first_word) {
            continue;
        }
        let Some(name) = recipe_name(line) else {
            continue;
        };
        if is_private || name.starts_with('_') || !seen.insert(name) {
            continue;
        }
        let line_number = u32::try_from(index + 1).unwrap_or(0);
        scripts.push(ProjectScript::new(name, first_body_line(&lines[index + 1..]), line_number));
    }
    Parsed {
        scripts,
        ..Parsed::default()
    }
}

/// `[@]name [params...]: [deps]`, where the colon is outside quotes and not `:=`.
fn recipe_name(line: &str) -> Option<&str> {
    let line = line.strip_prefix('@').unwrap_or(line);
    let name_end = line
        .find(|next: char| !(next.is_ascii_alphanumeric() || next == '_' || next == '-'))
        .unwrap_or(line.len());
    let name = &line[..name_end];
    let starts_well = name.starts_with(|first: char| first.is_ascii_alphabetic() || first == '_');
    if !starts_well {
        return None;
    }
    let rest = &line[name_end..];
    if !rest.starts_with(|next: char| next == ':' || next.is_whitespace()) {
        return None;
    }
    let colon = recipe_colon(rest)?;
    if rest[colon + 1..].starts_with('=') {
        return None;
    }
    Some(name)
}

/// The first colon outside strings, backticks and parentheses (parameter defaults).
fn recipe_colon(text: &str) -> Option<usize> {
    let mut quote: Option<char> = None;
    let mut parens = 0usize;
    for (index, next) in text.char_indices() {
        if let Some(open) = quote {
            if next == open {
                quote = None;
            }
            continue;
        }
        match next {
            '"' | '\'' | '`' => {
                quote = Some(next);
            }
            '(' => {
                parens += 1;
            }
            ')' => {
                parens = parens.saturating_sub(1);
            }
            ':' if parens == 0 => {
                return Some(index);
            }
            _ => {}
        }
    }
    None
}

fn first_body_line<'t>(following: &[&'t str]) -> &'t str {
    for line in following {
        if line.trim().is_empty() {
            continue;
        }
        if !line.starts_with(char::is_whitespace) {
            break;
        }
        return line.trim();
    }
    ""
}

#[cfg(test)]
mod tests {
    use super::*;

    fn recipes(text: &str) -> Vec<(String, String, u32)> {
        parse(text)
            .scripts
            .into_iter()
            .map(|script| (script.name, script.command, script.line))
            .collect()
    }

    fn entry(name: &str, command: &str, line: u32) -> (String, String, u32) {
        (name.to_string(), command.to_string(), line)
    }

    #[test]
    fn reads_public_recipes_in_order() {
        let text = r#"set shell := ["bash", "-c"]
alias b := build
export RUST_LOG := "info"
version := "1.0"
import? "local.just"

# Build everything
build target="debug:x" *flags: fmt
    cargo build --profile {{target}} {{flags}}

@fmt:
    cargo fmt

_helper:
    echo private

[private]
hidden:
    echo hidden

[group('ci')]
test $FILTER='': build
  cargo test $FILTER
build:
    echo duplicate
empty:
deploy env=(arch()):
    ./deploy {{env}}
"#;
        assert_eq!(
            recipes(text),
            vec![
                entry("build", "cargo build --profile {{target}} {{flags}}", 8),
                entry("fmt", "cargo fmt", 11),
                entry("test", "cargo test $FILTER", 22),
                entry("empty", "", 26),
                entry("deploy", "./deploy {{env}}", 27),
            ],
        );
    }

    #[test]
    fn rejects_assignments_and_other_lines() {
        assert_eq!(recipe_name("name := \"x\""), None);
        assert_eq!(recipe_name("name:=x"), None);
        assert_eq!(recipe_name("1bad:"), None);
        assert_eq!(recipe_name("foo.bar:"), None);
        assert_eq!(recipe_name("no colon here"), None);
        assert_eq!(recipe_name("serve port=\"8080:80\":"), Some("serve"));
        assert_eq!(recipe_name("@quiet-one:"), Some("quiet-one"));
    }
}
