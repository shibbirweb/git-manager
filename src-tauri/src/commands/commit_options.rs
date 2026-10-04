//! Commit Options: sign-off, another author, GPG signing and skipping hooks,
//! turned into `git commit` arguments for every commit path.

use serde::Deserialize;

use crate::error::{AppError, AppResult};

/// `-S`, `--no-gpg-sign`, or neither so `commit.gpgSign` decides.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GpgSign {
    #[default]
    Default,
    Sign,
    NoSign,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CommitOptions {
    pub sign_off: bool,
    /// "Name <email>"; empty or None keeps the configured author.
    pub author: Option<String>,
    pub gpg_sign: GpgSign,
    pub no_verify: bool,
}

/// Why `author` is not "Name <email>", or None.
pub fn author_error(author: &str) -> Option<&'static str> {
    let author = author.trim();
    let Some(open) = author.find('<') else {
        return Some("Write the author as Name <email>");
    };
    let name = author[..open].trim();
    let rest = &author[open + 1..];
    let Some(email) = rest.strip_suffix('>') else {
        return Some("Write the author as Name <email>");
    };
    if name.is_empty() || name.starts_with('-') {
        return Some("The author needs a name before the email");
    }
    let email = email.trim();
    let bad_email = email.is_empty() || email.contains(['<', '>', ' ']) || !email.contains('@');
    if bad_email || name.contains(['<', '>']) {
        return Some("Not a valid email address");
    }
    None
}

impl CommitOptions {
    /// The `git commit` arguments, after validating the author.
    pub fn args(&self) -> AppResult<Vec<String>> {
        let mut args = Vec::new();
        if self.sign_off {
            args.push("--signoff".to_string());
        }
        if let Some(author) = self.author.as_deref().map(str::trim).filter(|text| !text.is_empty()) {
            if let Some(message) = author_error(author) {
                return Err(AppError::invalid(message));
            }
            // One argument, so the value can never be read as an option.
            args.push(format!("--author={author}"));
        }
        match self.gpg_sign {
            GpgSign::Default => {}
            GpgSign::Sign => args.push("-S".to_string()),
            GpgSign::NoSign => args.push("--no-gpg-sign".to_string()),
        }
        if self.no_verify {
            args.push("--no-verify".to_string());
        }
        Ok(args)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_each_option_to_its_argument() {
        assert!(CommitOptions::default().args().unwrap().is_empty());
        let options = CommitOptions {
            sign_off: true,
            author: Some(" Ann Lee <ann@example.com> ".to_string()),
            gpg_sign: GpgSign::NoSign,
            no_verify: true,
        };
        assert_eq!(
            options.args().unwrap(),
            ["--signoff", "--author=Ann Lee <ann@example.com>", "--no-gpg-sign", "--no-verify"]
        );
        let sign = CommitOptions {
            gpg_sign: GpgSign::Sign,
            author: Some("  ".to_string()),
            ..CommitOptions::default()
        };
        assert_eq!(sign.args().unwrap(), ["-S"]);
    }

    #[test]
    fn refuses_a_malformed_author() {
        for bad in ["Ann", "<ann@example.com>", "Ann <>", "Ann <ann>", "-x <a@b>", "Ann <a@b", "Ann <a b@c>"] {
            assert!(author_error(bad).is_some(), "{bad}");
            let options = CommitOptions {
                author: Some(bad.to_string()),
                ..CommitOptions::default()
            };
            assert!(matches!(options.args(), Err(AppError::Invalid(_))), "{bad}");
        }
        assert_eq!(author_error("Ann Lee <ann@example.com>"), None);
    }
}
