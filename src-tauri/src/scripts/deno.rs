//! deno.json / deno.jsonc "tasks": a command string, or (Deno 2) an object
//! with a "command" and maybe "dependencies".

use super::{json, set_script, Parsed, ProjectScript};

pub(super) fn parse(text: &str) -> Result<Parsed, String> {
    // Deno reads deno.json as JSONC too.
    let manifest = json::parse(text, true)?;
    let mut scripts = Vec::new();
    for member in manifest.get("tasks").and_then(json::Value::members).unwrap_or_default() {
        let command = match &member.value {
            json::Value::String(command) => command.as_str(),
            task @ json::Value::Object(_) => match task.get("command").and_then(json::Value::as_str) {
                Some(command) => command,
                // A task with only dependencies still runs them.
                None if task.get("dependencies").is_some() => "",
                None => {
                    continue;
                }
            },
            _ => {
                continue;
            }
        };
        set_script(&mut scripts, ProjectScript::new(member.key.as_str(), command, member.line));
    }
    Ok(Parsed {
        scripts,
        ..Parsed::default()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_tasks_with_comments_and_objects() {
        let text = r#"{
  // Tasks for local work
  "tasks": {
    "dev": "deno run --watch main.ts", // "fake": "x"
    /* "hidden": "no", */
    "build": {
      "description": "Bundle",
      "command": "deno task bundle"
    },
    "all": { "dependencies": ["dev", "build"] },
    "broken": { "description": "no command" },
    "num": 3,
  },
}"#;
        let parsed = parse(text).unwrap();
        let tasks: Vec<(&str, &str, u32)> = parsed
            .scripts
            .iter()
            .map(|script| (script.name.as_str(), script.command.as_str(), script.line))
            .collect();
        assert_eq!(
            tasks,
            vec![("dev", "deno run --watch main.ts", 4), ("build", "deno task bundle", 6), ("all", "", 10)],
        );
        assert_eq!(parsed.package_name, None);
    }

    #[test]
    fn invalid_jsonc_is_an_error() {
        assert!(parse("{ \"tasks\": { /* open").is_err());
    }
}
