//! composer.json "scripts": a command string or a list of them.

use super::{json, set_script, string_field, Parsed, ProjectScript};

pub(super) fn parse(text: &str) -> Result<Parsed, String> {
    let manifest = json::parse(text, false)?;
    let mut scripts = Vec::new();
    for member in manifest.get("scripts").and_then(json::Value::members).unwrap_or_default() {
        let command = match &member.value {
            json::Value::String(command) => command.clone(),
            json::Value::Array(items) => {
                let parts: Vec<&str> = items.iter().filter_map(json::Value::as_str).collect();
                if parts.is_empty() {
                    continue;
                }
                parts.join(" && ")
            }
            _ => {
                continue;
            }
        };
        set_script(&mut scripts, ProjectScript::new(member.key.as_str(), &command, member.line));
    }
    Ok(Parsed {
        package_name: string_field(&manifest, "name"),
        scripts,
        ..Parsed::default()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_strings_and_arrays_in_order() {
        let text = r#"{
    "name": "acme/api",
    "scripts": {
        "test": "phpunit",
        "post-install-cmd": [
            "@php artisan key:generate",
            7,
            "@php artisan migrate"
        ],
        "empty": [],
        "odd": {"a": 1},
        "lint": "pint --test"
    }
}"#;
        let parsed = parse(text).unwrap();
        assert_eq!(parsed.package_name.as_deref(), Some("acme/api"));
        let scripts: Vec<(&str, &str, u32)> = parsed
            .scripts
            .iter()
            .map(|script| (script.name.as_str(), script.command.as_str(), script.line))
            .collect();
        assert_eq!(
            scripts,
            vec![
                ("test", "phpunit", 4),
                ("post-install-cmd", "@php artisan key:generate && @php artisan migrate", 5),
                ("lint", "pint --test", 12),
            ],
        );
    }

    #[test]
    fn invalid_json_is_an_error() {
        assert!(parse("{\"scripts\": {\"a\": }}").is_err());
    }
}
