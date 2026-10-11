//! Claude Code's usage: Anthropic's OAuth usage endpoint (as Orca and Claude Code's own /usage ask it), with the
//! access token Claude Code keeps in the macOS Keychain ("Claude Code-credentials") or, elsewhere, in
//! `.credentials.json`. The token is read for each request and never kept.

use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};

use serde_json::Value;

use super::{clamp_percent, time, ModelWindow, ProviderUsage, UsageStatus, UsageWindow};
use crate::github::http::{HttpRequest, HttpTransport, Method};

const USAGE_URL: &str = "https://api.anthropic.com/api/oauth/usage";
#[cfg(target_os = "macos")]
const KEYCHAIN_SERVICE: &str = "Claude Code-credentials";

/// The user said no to the Keychain question: do not ask again until they press Refresh.
static KEYCHAIN_REFUSED: AtomicBool = AtomicBool::new(false);

pub fn allow_keychain_again() {
    KEYCHAIN_REFUSED.store(false, Ordering::Relaxed);
}

/// What the credentials hold that the request needs.
#[derive(Debug, PartialEq)]
pub struct Credentials {
    pub access_token: String,
    /// ms since the epoch.
    pub expires_at: Option<i64>,
    pub plan: Option<String>,
}

/// Claude Code's credentials JSON: `{"claudeAiOauth": {"accessToken", "expiresAt", "subscriptionType"}}`.
pub fn parse_credentials(json: &str) -> Option<Credentials> {
    let value: Value = serde_json::from_str(json).ok()?;
    let oauth = value.get("claudeAiOauth")?;
    let access_token = oauth.get("accessToken")?.as_str()?.trim().to_string();
    if access_token.is_empty() {
        return None;
    }
    Some(Credentials {
        access_token,
        expires_at: oauth.get("expiresAt").and_then(time::reset_ms),
        plan: oauth.get("subscriptionType").and_then(Value::as_str).map(str::to_string),
    })
}

/// The Keychain item, then the credentials file. Err when the Keychain refused.
fn read_credentials(claude_dir: &Path, user: Option<&str>) -> Result<Option<String>, String> {
    #[cfg(target_os = "macos")]
    if !KEYCHAIN_REFUSED.load(Ordering::Relaxed) {
        let account = user.filter(|name| !name.is_empty()).unwrap_or("claude-code-user");
        let entry = keyring::Entry::new(KEYCHAIN_SERVICE, account).map_err(|err| err.to_string())?;
        match entry.get_password() {
            Ok(secret) => return Ok(Some(secret)),
            Err(keyring::Error::NoEntry) => {}
            Err(err) if is_refusal(&err) => {
                KEYCHAIN_REFUSED.store(true, Ordering::Relaxed);
                return Err(format!("The Keychain did not give Claude Code's sign-in: {err}"));
            }
            // Any other trouble (no keychain, say): try the credentials file, else say why.
            Err(err) => {
                return std::fs::read_to_string(claude_dir.join(".credentials.json"))
                    .map(Some)
                    .map_err(|_| format!("Could not read Claude Code's sign-in from the Keychain: {err}"));
            }
        }
    }
    #[cfg(not(target_os = "macos"))]
    let _ = user;
    Ok(std::fs::read_to_string(claude_dir.join(".credentials.json")).ok())
}

/// The user said no to macOS's question (or it could not be asked): Deny, a wrong password, or no way to ask. Asking
/// again at every refresh would nag, so these wait for Refresh.
#[cfg(target_os = "macos")]
fn is_refusal(err: &keyring::Error) -> bool {
    let text = err.to_string().to_lowercase();
    ["canceled", "cancelled", "not correct", "interaction is not allowed", "denied"]
        .iter()
        .any(|word| text.contains(word))
}

pub fn usage(transport: &dyn HttpTransport, claude_dir: &Path, user: Option<&str>, now_ms: i64) -> ProviderUsage {
    if KEYCHAIN_REFUSED.load(Ordering::Relaxed) && cfg!(target_os = "macos") {
        return ProviderUsage::without_numbers(
            "claude",
            UsageStatus::Error,
            "Keychain access was refused. Click the usage and choose Refresh to be asked again.",
        );
    }
    match read_credentials(claude_dir, user) {
        Ok(json) => usage_with(transport, json.as_deref(), now_ms),
        Err(message) => ProviderUsage::without_numbers("claude", UsageStatus::Error, message),
    }
}

/// The usage for `credentials_json` (None: not signed in), asked of the endpoint through `transport`.
pub fn usage_with(transport: &dyn HttpTransport, credentials_json: Option<&str>, now_ms: i64) -> ProviderUsage {
    let Some(credentials) = credentials_json.and_then(parse_credentials) else {
        return ProviderUsage::without_numbers("claude", UsageStatus::SignedOut, "Not signed in to Claude Code.");
    };
    if credentials.expires_at.is_some_and(|expires_at| expires_at <= now_ms) {
        return ProviderUsage {
            plan: credentials.plan,
            ..ProviderUsage::without_numbers(
                "claude",
                UsageStatus::SignedOut,
                "Claude Code's sign-in has expired. Start Claude Code once to renew it.",
            )
        };
    }
    let request = HttpRequest {
        method: Method::Get,
        url: USAGE_URL.to_string(),
        headers: vec![
            ("Authorization".to_string(), format!("Bearer {}", credentials.access_token)),
            ("anthropic-beta".to_string(), "oauth-2025-04-20".to_string()),
            ("Accept".to_string(), "application/json".to_string()),
        ],
        body: None,
    };
    let response = match transport.send(&request) {
        Ok(response) => response,
        Err(message) => {
            return ProviderUsage::without_numbers("claude", UsageStatus::Error, format!("Could not reach Anthropic: {message}"));
        }
    };
    let failure = match response.status {
        200..=299 => None,
        401 | 403 => Some((UsageStatus::SignedOut, "Claude Code's sign-in was refused. Start Claude Code once to renew it.".to_string())),
        429 => Some((UsageStatus::Error, "Anthropic asked to wait before asking again.".to_string())),
        status => Some((UsageStatus::Error, format!("Anthropic answered {status}."))),
    };
    if let Some((status, message)) = failure {
        return ProviderUsage {
            plan: credentials.plan,
            ..ProviderUsage::without_numbers("claude", status, message)
        };
    }
    let Ok(body) = serde_json::from_str::<Value>(&response.body) else {
        return ProviderUsage::without_numbers("claude", UsageStatus::Error, "Anthropic's answer could not be read.");
    };
    let session = window(body.get("five_hour"), 300);
    let weekly = window(body.get("seven_day"), 10_080);
    let model_weekly = model_weekly(&body);
    let status = if session.is_none() && weekly.is_none() && model_weekly.is_empty() {
        UsageStatus::NoData
    } else {
        UsageStatus::Ok
    };
    ProviderUsage {
        provider: "claude",
        status,
        session,
        weekly,
        model_weekly,
        plan: credentials.plan,
        message: None,
    }
}

/// Weekly limits of single models, as Orca reads them: the `limits` list's `weekly_scoped` entries (`percent`,
/// `resets_at`, `scope.model.display_name`), else the older `fable_weekly` / `fable_seven_day` / `seven_day_fable`.
fn model_weekly(body: &Value) -> Vec<ModelWindow> {
    let mut found: Vec<ModelWindow> = Vec::new();
    for limit in body.get("limits").and_then(Value::as_array).into_iter().flatten() {
        if limit.get("kind").and_then(Value::as_str) != Some("weekly_scoped") {
            continue;
        }
        let model = limit
            .pointer("/scope/model/display_name")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|name| !name.is_empty());
        let (Some(model), Some(percent)) = (model, limit.get("percent").and_then(Value::as_f64)) else {
            continue;
        };
        if found.iter().any(|known| known.model.eq_ignore_ascii_case(model)) {
            continue;
        }
        found.push(ModelWindow {
            model: model.to_string(),
            window: UsageWindow {
                used_percent: clamp_percent(percent),
                window_minutes: 10_080,
                resets_at: limit.get("resets_at").and_then(time::reset_ms),
            },
        });
    }
    let has_fable = found.iter().any(|known| known.model.eq_ignore_ascii_case("fable"));
    if !has_fable {
        let legacy = ["fable_weekly", "fable_seven_day", "seven_day_fable"]
            .iter()
            .find_map(|key| window(body.get(*key), 10_080));
        if let Some(window) = legacy {
            found.push(ModelWindow {
                model: "Fable".to_string(),
                window,
            });
        }
    }
    found
}

/// `{"utilization": 23.0, "resets_at": "2026-10-11T15:00:00Z"}`; `used_percentage` is accepted too.
fn window(value: Option<&Value>, window_minutes: u32) -> Option<UsageWindow> {
    let value = value?;
    let used = value.get("utilization").or_else(|| value.get("used_percentage"))?.as_f64()?;
    Some(UsageWindow {
        used_percent: clamp_percent(used),
        window_minutes,
        resets_at: value.get("resets_at").and_then(time::reset_ms),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::github::http::HttpResponse;
    use std::sync::Mutex;

    /// A request as the fake saw it: its address and headers.
    type Asked = (String, Vec<(String, String)>);

    /// Answers every request with one response and remembers what it was asked.
    struct FakeTransport {
        answer: Result<HttpResponse, String>,
        asked: Mutex<Vec<Asked>>,
    }

    impl FakeTransport {
        fn new(status: u16, body: &str) -> FakeTransport {
            FakeTransport {
                answer: Ok(HttpResponse {
                    status,
                    headers: Vec::new(),
                    body: body.to_string(),
                }),
                asked: Mutex::new(Vec::new()),
            }
        }
    }

    impl HttpTransport for FakeTransport {
        fn send(&self, request: &HttpRequest) -> Result<HttpResponse, String> {
            self.asked.lock().unwrap().push((request.url.clone(), request.headers.clone()));
            self.answer.clone()
        }
    }

    const NOW: i64 = 1_791_700_000_000;
    const CREDENTIALS: &str = r#"{"claudeAiOauth":{"accessToken":"sk-ant-oat01-secret","refreshToken":"r","expiresAt":1791800000000,"scopes":["user:inference"],"subscriptionType":"max"}}"#;

    #[cfg(target_os = "macos")]
    #[test]
    fn only_a_refusal_stops_the_keychain_questions() {
        let failure = |message: &str| keyring::Error::PlatformFailure(Box::new(std::io::Error::other(message.to_string())));
        assert!(is_refusal(&failure("User canceled the operation.")));
        assert!(is_refusal(&failure("The user name or passphrase you entered is not correct.")));
        assert!(is_refusal(&failure("User interaction is not allowed.")));
        assert!(!is_refusal(&failure("A default keychain could not be found.")));
        assert!(!is_refusal(&keyring::Error::NoEntry));
    }

    #[test]
    fn reads_the_token_expiry_and_plan_from_claude_codes_credentials() {
        assert_eq!(
            parse_credentials(CREDENTIALS),
            Some(Credentials {
                access_token: "sk-ant-oat01-secret".to_string(),
                expires_at: Some(1_791_800_000_000),
                plan: Some("max".to_string()),
            }),
        );
        assert_eq!(parse_credentials("{}"), None);
        assert_eq!(parse_credentials(r#"{"claudeAiOauth":{"accessToken":"  "}}"#), None);
        assert_eq!(parse_credentials("not json"), None);
    }

    #[test]
    fn asks_the_usage_endpoint_with_the_token_and_reads_both_windows() {
        let transport = FakeTransport::new(
            200,
            r#"{"five_hour":{"utilization":23.5,"resets_at":"2026-10-11T15:00:00Z"},"seven_day":{"utilization":104,"resets_at":null}}"#,
        );
        let usage = usage_with(&transport, Some(CREDENTIALS), NOW);
        assert_eq!(usage.status, UsageStatus::Ok);
        assert_eq!(usage.plan.as_deref(), Some("max"));
        assert_eq!(
            usage.session,
            Some(UsageWindow {
                used_percent: 23.5,
                window_minutes: 300,
                resets_at: Some(1_791_730_800_000),
            }),
        );
        assert_eq!(usage.weekly.as_ref().map(|weekly| weekly.used_percent), Some(100.0));
        let asked = transport.asked.lock().unwrap();
        assert_eq!(asked[0].0, USAGE_URL);
        assert!(asked[0].1.iter().any(|(name, value)| name == "Authorization" && value == "Bearer sk-ant-oat01-secret"));
        assert!(asked[0].1.iter().any(|(name, value)| name == "anthropic-beta" && value == "oauth-2025-04-20"));
    }

    #[test]
    fn reads_model_weekly_limits_like_fable() {
        let transport = FakeTransport::new(
            200,
            r#"{"five_hour":{"utilization":2},"seven_day":{"utilization":31},
                "limits":[
                  {"kind":"weekly","percent":31},
                  {"kind":"weekly_scoped","percent":12.5,"resets_at":"2026-10-11T15:00:00Z","scope":{"model":{"display_name":"Fable"}}},
                  {"kind":"weekly_scoped","percent":7,"scope":{"model":{"display_name":"fable"}}},
                  {"kind":"weekly_scoped","scope":{"model":{"display_name":"Opus"}}},
                  {"kind":"weekly_scoped","percent":40,"scope":{"model":null}}
                ],
                "fable_weekly":{"utilization":99}}"#,
        );
        let usage = usage_with(&transport, Some(CREDENTIALS), NOW);
        assert_eq!(
            usage.model_weekly,
            vec![ModelWindow {
                model: "Fable".to_string(),
                window: UsageWindow {
                    used_percent: 12.5,
                    window_minutes: 10_080,
                    resets_at: Some(1_791_730_800_000),
                },
            }],
        );
        // Older answers name it in a field of its own.
        let legacy = FakeTransport::new(200, r#"{"seven_day_fable":{"utilization":64,"resets_at":1791730800}}"#);
        let usage = usage_with(&legacy, Some(CREDENTIALS), NOW);
        assert_eq!(usage.status, UsageStatus::Ok);
        assert_eq!(usage.model_weekly[0].model, "Fable");
        assert_eq!(usage.model_weekly[0].window.used_percent, 64.0);
        // None at all.
        assert!(usage_with(&FakeTransport::new(200, r#"{"seven_day":{"utilization":1}}"#), Some(CREDENTIALS), NOW).model_weekly.is_empty());
    }

    #[test]
    fn says_why_there_are_no_numbers() {
        let ok = FakeTransport::new(200, "{}");
        assert_eq!(usage_with(&ok, None, NOW).status, UsageStatus::SignedOut);
        assert_eq!(usage_with(&ok, Some(CREDENTIALS), NOW).status, UsageStatus::NoData);
        // An expired token is not sent at all.
        let expired = usage_with(&ok, Some(CREDENTIALS), 1_791_900_000_000);
        assert_eq!(expired.status, UsageStatus::SignedOut);
        assert_eq!(ok.asked.lock().unwrap().len(), 1);

        assert_eq!(usage_with(&FakeTransport::new(401, ""), Some(CREDENTIALS), NOW).status, UsageStatus::SignedOut);
        let limited = usage_with(&FakeTransport::new(429, ""), Some(CREDENTIALS), NOW);
        assert_eq!(limited.status, UsageStatus::Error);
        assert!(limited.message.unwrap().contains("wait"));
        assert_eq!(usage_with(&FakeTransport::new(200, "<html>"), Some(CREDENTIALS), NOW).status, UsageStatus::Error);
        let offline = FakeTransport {
            answer: Err("the connection failed (are you offline?)".to_string()),
            asked: Mutex::new(Vec::new()),
        };
        assert!(usage_with(&offline, Some(CREDENTIALS), NOW).message.unwrap().contains("offline"));
    }
}
