//! A small JSON (and JSONC) parser that keeps object keys in file order and
//! remembers the line of each key, which serde_json's default map does not.
//! It only has to read manifest files, so values stay simple.

const MAX_DEPTH: usize = 128;

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Null,
    Bool(bool),
    Number(String),
    String(String),
    Array(Vec<Value>),
    Object(Vec<Member>),
}

#[derive(Debug, Clone, PartialEq)]
pub struct Member {
    pub key: String,
    /// 1-based line of the key.
    pub line: u32,
    pub value: Value,
}

impl Value {
    /// The first member called `key`, if this is an object.
    pub fn get(&self, key: &str) -> Option<&Value> {
        match self {
            Value::Object(members) => members.iter().find(|member| member.key == key).map(|member| &member.value),
            _ => None,
        }
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            Value::String(text) => Some(text),
            _ => None,
        }
    }

    pub fn members(&self) -> Option<&[Member]> {
        match self {
            Value::Object(members) => Some(members),
            _ => None,
        }
    }
}

/// Parses strict JSON, or JSONC (comments and trailing commas) when `jsonc` is set.
pub fn parse(text: &str, jsonc: bool) -> Result<Value, String> {
    let text = text.strip_prefix('\u{feff}').unwrap_or(text);
    let mut parser = Parser {
        text,
        bytes: text.as_bytes(),
        pos: 0,
        line: 1,
        jsonc,
    };
    parser.skip_space()?;
    let value = parser.value(0)?;
    parser.skip_space()?;
    if parser.pos < parser.bytes.len() {
        return Err(parser.error("Unexpected text after the end"));
    }
    Ok(value)
}

struct Parser<'t> {
    text: &'t str,
    bytes: &'t [u8],
    pos: usize,
    line: u32,
    jsonc: bool,
}

impl Parser<'_> {
    fn error(&self, message: &str) -> String {
        format!("{message} on line {}", self.line)
    }

    fn peek(&self) -> Option<u8> {
        self.bytes.get(self.pos).copied()
    }

    fn skip_space(&mut self) -> Result<(), String> {
        while let Some(byte) = self.peek() {
            match byte {
                b'\n' => {
                    self.line += 1;
                    self.pos += 1;
                }
                b' ' | b'\t' | b'\r' => {
                    self.pos += 1;
                }
                b'/' if self.jsonc => {
                    self.skip_comment()?;
                }
                _ => {
                    return Ok(());
                }
            }
        }
        Ok(())
    }

    fn skip_comment(&mut self) -> Result<(), String> {
        match self.bytes.get(self.pos + 1) {
            Some(b'/') => {
                while let Some(byte) = self.peek() {
                    if byte == b'\n' {
                        break;
                    }
                    self.pos += 1;
                }
                Ok(())
            }
            Some(b'*') => {
                let start_line = self.line;
                self.pos += 2;
                loop {
                    match self.peek() {
                        None => {
                            return Err(format!("Unclosed comment from line {start_line}"));
                        }
                        Some(b'*') if self.bytes.get(self.pos + 1) == Some(&b'/') => {
                            self.pos += 2;
                            return Ok(());
                        }
                        Some(b'\n') => {
                            self.line += 1;
                            self.pos += 1;
                        }
                        Some(_) => {
                            self.pos += 1;
                        }
                    }
                }
            }
            _ => Err(self.error("Unexpected '/'")),
        }
    }

    fn value(&mut self, depth: usize) -> Result<Value, String> {
        if depth > MAX_DEPTH {
            return Err(self.error("Nested too deeply"));
        }
        match self.peek() {
            None => Err(self.error("Unexpected end of file")),
            Some(b'{') => self.object(depth),
            Some(b'[') => self.array(depth),
            Some(b'"') => Ok(Value::String(self.string()?)),
            Some(b't') => self.literal("true", Value::Bool(true)),
            Some(b'f') => self.literal("false", Value::Bool(false)),
            Some(b'n') => self.literal("null", Value::Null),
            Some(byte) if byte == b'-' || byte.is_ascii_digit() => Ok(self.number()),
            Some(_) => Err(self.error("Unexpected character")),
        }
    }

    fn literal(&mut self, word: &str, value: Value) -> Result<Value, String> {
        if self.text[self.pos..].starts_with(word) {
            self.pos += word.len();
            return Ok(value);
        }
        Err(self.error("Unexpected character"))
    }

    fn number(&mut self) -> Value {
        let start = self.pos;
        while let Some(byte) = self.peek() {
            if byte.is_ascii_digit() || matches!(byte, b'-' | b'+' | b'.' | b'e' | b'E') {
                self.pos += 1;
            } else {
                break;
            }
        }
        Value::Number(self.text[start..self.pos].to_string())
    }

    fn string(&mut self) -> Result<String, String> {
        // Called on the opening quote.
        self.pos += 1;
        let mut out = String::new();
        loop {
            let start = self.pos;
            while let Some(byte) = self.peek() {
                if byte == b'"' || byte == b'\\' || byte < 0x20 {
                    break;
                }
                self.pos += 1;
            }
            // Stops only on ASCII bytes, so the slice is on char boundaries.
            out.push_str(&self.text[start..self.pos]);
            match self.peek() {
                None => {
                    return Err(self.error("Unclosed string"));
                }
                Some(b'"') => {
                    self.pos += 1;
                    return Ok(out);
                }
                Some(b'\\') => {
                    self.escape(&mut out)?;
                }
                Some(_) => {
                    return Err(self.error("Line break inside a string"));
                }
            }
        }
    }

    fn escape(&mut self, out: &mut String) -> Result<(), String> {
        let Some(code) = self.bytes.get(self.pos + 1).copied() else {
            return Err(self.error("Unclosed string"));
        };
        self.pos += 2;
        match code {
            b'"' => out.push('"'),
            b'\\' => out.push('\\'),
            b'/' => out.push('/'),
            b'b' => out.push('\u{8}'),
            b'f' => out.push('\u{c}'),
            b'n' => out.push('\n'),
            b'r' => out.push('\r'),
            b't' => out.push('\t'),
            b'u' => {
                let high = self.hex4()?;
                let is_high_surrogate = (0xD800..0xDC00).contains(&high);
                if is_high_surrogate && self.text[self.pos..].starts_with("\\u") {
                    self.pos += 2;
                    let low = self.hex4()?;
                    let combined = 0x10000 + ((high - 0xD800) << 10) + (low.wrapping_sub(0xDC00) & 0x3FF);
                    out.push(char::from_u32(combined).unwrap_or('\u{fffd}'));
                } else {
                    out.push(char::from_u32(high).unwrap_or('\u{fffd}'));
                }
            }
            _ => {
                return Err(self.error("Invalid escape in a string"));
            }
        }
        Ok(())
    }

    fn hex4(&mut self) -> Result<u32, String> {
        let digits = self.text.get(self.pos..self.pos + 4).unwrap_or("");
        let code = u32::from_str_radix(digits, 16).map_err(|_| self.error("Invalid \\u escape"))?;
        self.pos += 4;
        Ok(code)
    }

    fn array(&mut self, depth: usize) -> Result<Value, String> {
        self.pos += 1;
        let mut items = Vec::new();
        loop {
            self.skip_space()?;
            if self.peek() == Some(b']') && (items.is_empty() || self.jsonc) {
                self.pos += 1;
                return Ok(Value::Array(items));
            }
            items.push(self.value(depth + 1)?);
            self.skip_space()?;
            match self.peek() {
                Some(b',') => {
                    self.pos += 1;
                }
                Some(b']') => {
                    self.pos += 1;
                    return Ok(Value::Array(items));
                }
                _ => {
                    return Err(self.error("Expected ',' or ']'"));
                }
            }
        }
    }

    fn object(&mut self, depth: usize) -> Result<Value, String> {
        self.pos += 1;
        let mut members: Vec<Member> = Vec::new();
        loop {
            self.skip_space()?;
            if self.peek() == Some(b'}') && (members.is_empty() || self.jsonc) {
                self.pos += 1;
                return Ok(Value::Object(members));
            }
            if self.peek() != Some(b'"') {
                return Err(self.error("Expected a quoted key"));
            }
            let line = self.line;
            let key = self.string()?;
            self.skip_space()?;
            if self.peek() != Some(b':') {
                return Err(self.error("Expected ':'"));
            }
            self.pos += 1;
            self.skip_space()?;
            let value = self.value(depth + 1)?;
            members.push(Member { key, line, value });
            self.skip_space()?;
            match self.peek() {
                Some(b',') => {
                    self.pos += 1;
                }
                Some(b'}') => {
                    self.pos += 1;
                    return Ok(Value::Object(members));
                }
                _ => {
                    return Err(self.error("Expected ',' or '}'"));
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn keys(value: &Value) -> Vec<(String, u32)> {
        value
            .members()
            .unwrap_or_default()
            .iter()
            .map(|member| (member.key.clone(), member.line))
            .collect()
    }

    #[test]
    fn keeps_key_order_and_lines() {
        let value = parse("{\n  \"zeta\": 1,\n  \"alpha\": [true, null],\n\n  \"mid\": {\"x\": -1.5e3}\n}", false).unwrap();
        assert_eq!(
            keys(&value),
            vec![("zeta".to_string(), 2), ("alpha".to_string(), 3), ("mid".to_string(), 5)],
        );
        assert_eq!(value.get("mid").and_then(|mid| mid.get("x")), Some(&Value::Number("-1.5e3".to_string())));
    }

    #[test]
    fn decodes_escapes_and_unicode() {
        let value = parse(r#"{"a": "x\"y\\z\né😀", "b": "café ok"}"#, false).unwrap();
        assert_eq!(value.get("a").and_then(Value::as_str), Some("x\"y\\z\n\u{e9}\u{1f600}"));
        assert_eq!(value.get("b").and_then(Value::as_str), Some("caf\u{e9} ok"));
        let raw = parse("{\"k\": \"na\u{ef}ve\"}", false).unwrap();
        assert_eq!(raw.get("k").and_then(Value::as_str), Some("na\u{ef}ve"));
    }

    #[test]
    fn jsonc_allows_comments_and_trailing_commas() {
        let text = "// head\n{\n  /* block\n  comment */ \"a\": \"http://x\", // tail\n  \"b\": [1, 2,],\n}\n";
        let value = parse(text, true).unwrap();
        assert_eq!(keys(&value), vec![("a".to_string(), 4), ("b".to_string(), 5)]);
        assert_eq!(value.get("a").and_then(Value::as_str), Some("http://x"));
        assert!(parse(text, false).is_err());
    }

    #[test]
    fn reports_errors_with_lines() {
        assert_eq!(parse("{\n  \"a\": 1\n  \"b\": 2\n}", false), Err("Expected ',' or '}' on line 3".to_string()));
        assert!(parse("{\"a\": 1,}", false).is_err());
        assert!(parse("{\"a\": \"open", false).is_err());
        assert!(parse("{} extra", false).is_err());
        assert!(parse("", false).is_err());
        assert!(parse("{\"a\": /* x", true).is_err());
        assert!(parse(&"[".repeat(500), false).is_err());
    }
}
