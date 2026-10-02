//! Makefile targets: rule lines only, never variables or special targets.

use std::collections::HashSet;

use super::{Parsed, ProjectScript};

const MAX_RECIPE_LINES: usize = 3;

pub(super) fn parse(text: &str) -> Parsed {
    let lines: Vec<&str> = text.lines().collect();
    let mut scripts = Vec::new();
    let mut seen: HashSet<&str> = HashSet::new();
    let mut in_define = false;
    let mut continued = false;
    for (index, line) in lines.iter().enumerate() {
        let was_continued = continued;
        continued = line.ends_with('\\');
        if was_continued {
            continue;
        }
        let mut words = line.split_whitespace();
        let first_word = words.next().unwrap_or_default();
        if in_define {
            if first_word == "endef" {
                in_define = false;
            }
            continue;
        }
        // `define NAME` bodies can hold anything, including colons.
        let opens_define =
            first_word == "define" || (matches!(first_word, "override" | "export") && words.next() == Some("define"));
        if opens_define {
            in_define = true;
            continue;
        }
        let Some((targets, inline_recipe)) = rule_targets(line) else {
            continue;
        };
        let names: Vec<&str> = targets.into_iter().filter(|name| seen.insert(name)).collect();
        if names.is_empty() {
            continue;
        }
        let command = recipe(inline_recipe, &lines[index + 1..]);
        let line_number = u32::try_from(index + 1).unwrap_or(0);
        for name in names {
            scripts.push(ProjectScript::new(name, &command, line_number));
        }
    }
    Parsed {
        scripts,
        ..Parsed::default()
    }
}

/// The real target names of a rule line, and its `; recipe` part if any.
fn rule_targets(line: &str) -> Option<(Vec<&str>, Option<&str>)> {
    if line.starts_with(|first: char| first.is_whitespace() || first == '#') {
        return None;
    }
    let colon = line.find(':')?;
    let (head, rest) = (&line[..colon], &line[colon + 1..]);
    // `a::b` is a double-colon rule, `::=` and `:=` are assignments.
    let rest = rest.strip_prefix(':').unwrap_or(rest);
    if rest.starts_with('=') || head.contains('=') {
        return None;
    }
    let (prerequisites, inline_recipe) = match rest.split_once(';') {
        Some((prerequisites, recipe)) => (prerequisites, Some(recipe)),
        None => (rest, None),
    };
    // `target: VAR = value` sets a target-specific variable.
    if prerequisites.contains('=') {
        return None;
    }
    let targets = head.split_whitespace().filter(|name| is_target_name(name)).collect();
    Some((targets, inline_recipe))
}

fn is_target_name(name: &str) -> bool {
    let mut chars = name.chars();
    let starts_well = chars.next().is_some_and(|first| first.is_ascii_alphanumeric());
    starts_well && chars.all(|next| next.is_ascii_alphanumeric() || matches!(next, '_' | '.' | '-' | '/'))
}

/// The inline recipe and the first tab-indented recipe lines, joined.
fn recipe(inline_recipe: Option<&str>, following: &[&str]) -> String {
    let mut parts: Vec<&str> = inline_recipe.map(str::trim).filter(|part| !part.is_empty()).into_iter().collect();
    for line in following {
        if parts.len() >= MAX_RECIPE_LINES {
            break;
        }
        if let Some(body) = line.strip_prefix('\t') {
            let body = body.trim();
            if !body.is_empty() && !body.starts_with('#') {
                parts.push(body);
            }
        } else if !line.trim().is_empty() {
            break;
        }
    }
    parts.join("; ")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn targets(text: &str) -> Vec<(String, String, u32)> {
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
    fn reads_rules_and_first_recipe_lines() {
        let text = "\
CC := clang
VERSION ::= 1
.PHONY: build test
# comment: not a target
build: deps
\t@echo building
\tcargo build

\tcargo test --no-run
\techo fourth

test:
\tcargo test
";
        assert_eq!(
            targets(text),
            vec![
                entry("build", "@echo building; cargo build; cargo test --no-run", 5),
                entry("test", "cargo test", 12),
            ],
        );
    }

    #[test]
    fn handles_several_targets_patterns_and_duplicates() {
        let text = "\
all lint fmt: ; @true
%.o: %.c
\tcc -c $<
$(OBJS) app: main.o
\tcc -o app main.o
src/gen.rs dist-v1.2:
lint:
\techo again
build: CFLAGS = -O2
debug:: one
\techo debug
";
        assert_eq!(
            targets(text),
            vec![
                entry("all", "@true", 1),
                entry("lint", "@true", 1),
                entry("fmt", "@true", 1),
                entry("app", "cc -o app main.o", 4),
                entry("src/gen.rs", "", 6),
                entry("dist-v1.2", "", 6),
                entry("debug", "echo debug", 10),
            ],
        );
    }

    #[test]
    fn skips_define_blocks_and_continued_lines() {
        let text = "\
define HELP
usage: make it
endef
SOURCES = a.c \\
  fake: b.c
\tnot: a target
real:
\techo real
";
        assert_eq!(targets(text), vec![entry("real", "echo real", 7)]);
    }
}
