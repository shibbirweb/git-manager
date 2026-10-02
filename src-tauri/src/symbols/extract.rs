//! Definitions found by per-language line scanners, like universal ctags:
//! no parser, just a small lexer that knows strings, comments and brace
//! depth, plus a few keyword patterns per language. A declaration is only
//! looked for where it can appear (the top level, a namespace or a class
//! body), so the lines inside function bodies, which are most lines, cost
//! one lexer pass and nothing else.
//!
//! Best effort by design: unusual formatting (a name on the line after its
//! keyword, macros that expand to definitions) is missed.

use std::ops::Range;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SymbolKind {
    Class,
    Interface,
    Trait,
    Struct,
    Enum,
    Type,
    Protocol,
    Record,
    Object,
    Module,
    Function,
    Method,
    Constant,
}

impl SymbolKind {
    pub const ALL: [SymbolKind; 13] = [
        SymbolKind::Class,
        SymbolKind::Interface,
        SymbolKind::Trait,
        SymbolKind::Struct,
        SymbolKind::Enum,
        SymbolKind::Type,
        SymbolKind::Protocol,
        SymbolKind::Record,
        SymbolKind::Object,
        SymbolKind::Module,
        SymbolKind::Function,
        SymbolKind::Method,
        SymbolKind::Constant,
    ];

    /// What the Classes tab lists.
    pub fn is_class_like(self) -> bool {
        !matches!(self, SymbolKind::Function | SymbolKind::Method | SymbolKind::Constant)
    }

    pub fn code(self) -> u8 {
        self as u8
    }

    pub fn from_code(code: u8) -> SymbolKind {
        SymbolKind::ALL.get(code as usize).copied().unwrap_or(SymbolKind::Function)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Language {
    /// TypeScript and JavaScript.
    Script,
    /// Svelte and Vue: the `<script>` blocks are scanned as `Script`.
    Markup,
    Php,
    Python,
    Rust,
    Go,
    Java,
    Kotlin,
    CSharp,
    Ruby,
    Swift,
    /// C and C++.
    C,
}

/// The language of a source file by its extension; None for anything else.
pub fn language_for(file_path: &str) -> Option<Language> {
    let name = file_path.rsplit('/').next().unwrap_or(file_path);
    let (stem, extension) = name.rsplit_once('.')?;
    // Minified bundles are not worth scanning.
    if stem.ends_with(".min") {
        return None;
    }
    let mut lower = [0u8; 8];
    if extension.len() > lower.len() {
        return None;
    }
    for (slot, byte) in lower.iter_mut().zip(extension.bytes()) {
        *slot = byte.to_ascii_lowercase();
    }
    let language = match &lower[..extension.len()] {
        b"ts" | b"tsx" | b"mts" | b"cts" | b"js" | b"jsx" | b"mjs" | b"cjs" => Language::Script,
        b"svelte" | b"vue" => Language::Markup,
        b"php" => Language::Php,
        b"py" | b"pyi" => Language::Python,
        b"rs" => Language::Rust,
        b"go" => Language::Go,
        b"java" => Language::Java,
        b"kt" | b"kts" => Language::Kotlin,
        b"cs" => Language::CSharp,
        b"rb" | b"rake" => Language::Ruby,
        b"swift" => Language::Swift,
        b"c" | b"h" | b"cc" | b"cpp" | b"cxx" | b"hpp" | b"hh" | b"hxx" | b"ipp" => Language::C,
        _ => return None,
    };
    Some(language)
}

/// One definition; `name` and `container` borrow from the scanned text.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Definition<'a> {
    pub name: &'a str,
    pub kind: SymbolKind,
    /// 1-based.
    pub line: u32,
    /// 0-based, in UTF-16 code units like the editor.
    pub column: u32,
    /// The class (or module) it belongs to, when the scanner saw it.
    pub container: Option<&'a str>,
}

/// Lines longer than this are skipped: generated or minified code.
const MAX_LINE: usize = 4096;

/// Calls `emit` for every definition in `text`.
pub fn extract<'a>(language: Language, text: &'a str, emit: &mut dyn FnMut(Definition<'a>)) {
    match language {
        Language::Python | Language::Ruby => {
            let mut scanner = IndentScanner::new(text, language);
            for_each_line(text, |line_start, line, line_number| scanner.feed(line_start, line, line_number, emit));
        }
        Language::Markup => {
            let mut scanner = BraceScanner::new(text, Language::Script);
            let mut in_script = false;
            for_each_line(text, |line_start, line, line_number| {
                let trimmed = line.trim_start();
                if !in_script {
                    if trimmed.starts_with("<script") {
                        in_script = !trimmed.contains("</script>");
                    }
                    return;
                }
                if trimmed.starts_with("</script>") {
                    in_script = false;
                    return;
                }
                scanner.feed(line_start, line, line_number, emit);
            });
        }
        _ => {
            let mut scanner = BraceScanner::new(text, language);
            for_each_line(text, |line_start, line, line_number| scanner.feed(line_start, line, line_number, emit));
        }
    }
}

/// Lines without their terminator, with their byte offset and 1-based number.
fn for_each_line<'a>(text: &'a str, mut visit: impl FnMut(usize, &'a str, u32)) {
    let mut start = 0;
    let mut number = 1u32;
    let bytes = text.as_bytes();
    while start <= bytes.len() {
        let end = memchr::memchr(b'\n', &bytes[start..]).map(|offset| start + offset).unwrap_or(bytes.len());
        let mut line = &text[start..end];
        if let Some(stripped) = line.strip_suffix('\r') {
            line = stripped;
        }
        visit(start, line, number);
        if end == bytes.len() {
            break;
        }
        start = end + 1;
        number += 1;
    }
}

fn utf16_column(line: &str, byte: usize) -> u32 {
    let prefix = &line.as_bytes()[..byte.min(line.len())];
    if prefix.is_ascii() {
        byte as u32
    } else {
        line[..byte].encode_utf16().count() as u32
    }
}

// ---------------------------------------------------------------------------
// Lexer: strings, comments and the bytes that change nesting.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Backtick {
    None,
    /// JavaScript: `${...}` holds code.
    Template,
    /// Go: a raw string that may span lines.
    Raw,
}

#[derive(Debug, Clone, Copy)]
struct Syntax {
    slash_comments: bool,
    hash_comments: bool,
    backtick: Backtick,
    /// `"..."` may continue on the next line.
    multiline_strings: bool,
    /// `"""` (and `'''` when single quotes are strings) blocks.
    triple_quotes: bool,
    /// Rust: `'a` is a lifetime unless it closes like a char literal.
    rust: bool,
}

impl Syntax {
    fn of(language: Language) -> Syntax {
        let base = Syntax {
            slash_comments: true,
            hash_comments: false,
            backtick: Backtick::None,
            multiline_strings: false,
            triple_quotes: false,
            rust: false,
        };
        match language {
            Language::Script | Language::Markup => Syntax {
                backtick: Backtick::Template,
                ..base
            },
            Language::Php => Syntax {
                hash_comments: true,
                multiline_strings: true,
                ..base
            },
            Language::Python => Syntax {
                slash_comments: false,
                hash_comments: true,
                triple_quotes: true,
                ..base
            },
            Language::Ruby => Syntax {
                slash_comments: false,
                hash_comments: true,
                ..base
            },
            Language::Rust => Syntax {
                multiline_strings: true,
                rust: true,
                ..base
            },
            Language::Go => Syntax {
                backtick: Backtick::Raw,
                ..base
            },
            Language::Java | Language::Kotlin | Language::Swift => Syntax {
                triple_quotes: true,
                ..base
            },
            Language::CSharp | Language::C => base,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum LexState {
    Code,
    BlockComment,
    Str { quote: u8, triple: bool },
    RawStr { hashes: u8 },
    Template,
}

struct Lexer {
    syntax: Syntax,
    state: LexState,
    /// Open `${` of template literals: brace depth inside each.
    templates: Vec<u32>,
}

impl Lexer {
    fn new(syntax: Syntax) -> Lexer {
        Lexer {
            syntax,
            state: LexState::Code,
            templates: Vec::new(),
        }
    }

    fn in_code(&self) -> bool {
        self.state == LexState::Code && self.templates.is_empty()
    }

    /// Feeds one line; `on(offset, byte)` hears every `{ } ( ) [ ] ;` in code.
    fn line(&mut self, line: &[u8], on: &mut impl FnMut(usize, u8)) {
        let length = line.len();
        let mut index = 0;
        while index < length {
            match self.state {
                LexState::BlockComment => match memchr::memmem::find(&line[index..], b"*/") {
                    Some(offset) => {
                        self.state = LexState::Code;
                        index += offset + 2;
                    }
                    None => index = length,
                },
                LexState::Str { quote, triple } => {
                    let byte = line[index];
                    if byte == b'\\' && quote != b'`' {
                        index += 2;
                    } else if triple {
                        if line[index..].starts_with(&[quote, quote, quote]) {
                            self.state = LexState::Code;
                            index += 3;
                        } else {
                            index += 1;
                        }
                    } else if byte == quote {
                        self.state = LexState::Code;
                        index += 1;
                    } else {
                        index += 1;
                    }
                }
                LexState::RawStr { hashes } => {
                    match memchr::memchr(b'"', &line[index..]) {
                        Some(offset) => {
                            let close = index + offset + 1;
                            let wanted = hashes as usize;
                            if line[close..].len() >= wanted && line[close..close + wanted].iter().all(|byte| *byte == b'#') {
                                self.state = LexState::Code;
                                index = close + wanted;
                            } else {
                                index = close;
                            }
                        }
                        None => index = length,
                    }
                }
                LexState::Template => {
                    let byte = line[index];
                    if byte == b'\\' {
                        index += 2;
                    } else if byte == b'`' {
                        self.state = LexState::Code;
                        index += 1;
                    } else if byte == b'$' && line.get(index + 1) == Some(&b'{') {
                        self.state = LexState::Code;
                        self.templates.push(0);
                        index += 2;
                    } else {
                        index += 1;
                    }
                }
                LexState::Code => index = self.code(line, index, on),
            }
        }
        // A plain string never continues past its line in most languages.
        if let LexState::Str { quote, triple: false } = self.state {
            if quote != b'`' && !self.syntax.multiline_strings {
                self.state = LexState::Code;
            }
        }
    }

    /// One step in code; returns the next index.
    fn code(&mut self, line: &[u8], index: usize, on: &mut impl FnMut(usize, u8)) -> usize {
        let syntax = self.syntax;
        let byte = line[index];
        let next = line.get(index + 1).copied();
        match byte {
            b'/' if syntax.slash_comments && next == Some(b'/') => line.len(),
            b'/' if syntax.slash_comments && next == Some(b'*') => {
                self.state = LexState::BlockComment;
                index + 2
            }
            b'#' if syntax.hash_comments => line.len(),
            b'"' => {
                if syntax.triple_quotes && line[index..].starts_with(b"\"\"\"") {
                    self.state = LexState::Str { quote: b'"', triple: true };
                    index + 3
                } else {
                    self.state = LexState::Str { quote: b'"', triple: false };
                    index + 1
                }
            }
            b'\'' => {
                if syntax.rust {
                    return rust_quote(line, index);
                }
                if syntax.triple_quotes && line[index..].starts_with(b"'''") {
                    self.state = LexState::Str { quote: b'\'', triple: true };
                    index + 3
                } else {
                    self.state = LexState::Str { quote: b'\'', triple: false };
                    index + 1
                }
            }
            b'`' if syntax.backtick == Backtick::Template => {
                self.state = LexState::Template;
                index + 1
            }
            b'`' if syntax.backtick == Backtick::Raw => {
                self.state = LexState::Str { quote: b'`', triple: false };
                index + 1
            }
            b'r' if syntax.rust && (index == 0 || !is_ident_byte(line[index - 1])) && matches!(next, Some(b'"' | b'#')) => {
                let hashes = line[index + 1..].iter().take_while(|byte| **byte == b'#').count();
                if line.get(index + 1 + hashes) == Some(&b'"') {
                    self.state = LexState::RawStr { hashes: hashes.min(255) as u8 };
                    index + 2 + hashes
                } else {
                    index + 1
                }
            }
            b'{' => {
                if let Some(depth) = self.templates.last_mut() {
                    *depth += 1;
                }
                on(index, byte);
                index + 1
            }
            b'}' => {
                if let Some(depth) = self.templates.last_mut() {
                    if *depth == 0 {
                        self.templates.pop();
                        self.state = LexState::Template;
                        return index + 1;
                    }
                    *depth -= 1;
                }
                on(index, byte);
                index + 1
            }
            b'(' | b')' | b'[' | b']' | b';' => {
                on(index, byte);
                index + 1
            }
            _ => index + 1,
        }
    }
}

/// Rust: skips a char literal (`'{'`, `'\''`) or just the quote of a lifetime (`'a`).
fn rust_quote(line: &[u8], index: usize) -> usize {
    match line.get(index + 1) {
        Some(b'\\') => memchr::memchr(b'\'', line.get(index + 3..).unwrap_or_default())
            .map(|offset| index + 3 + offset + 1)
            .unwrap_or(line.len()),
        Some(_) => {
            // A multi-byte char is followed by its closing quote within four bytes.
            let window = line.get(index + 2..(index + 6).min(line.len())).unwrap_or_default();
            match window.iter().position(|byte| *byte == b'\'') {
                Some(offset) if offset == 0 || line[index + 1] >= 0x80 => index + 2 + offset + 1,
                _ => index + 1,
            }
        }
        None => index + 1,
    }
}

// ---------------------------------------------------------------------------
// Cursor helpers over one line.

fn is_ident_byte(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'$' || byte >= 0x80
}

fn is_ident_start(byte: u8) -> bool {
    byte.is_ascii_alphabetic() || byte == b'_' || byte == b'$' || byte >= 0x80
}

#[derive(Clone, Copy)]
struct Cursor<'a> {
    text: &'a [u8],
    position: usize,
}

impl<'a> Cursor<'a> {
    fn new(text: &'a [u8], position: usize) -> Cursor<'a> {
        Cursor { text, position }
    }

    fn peek(&self) -> Option<u8> {
        self.text.get(self.position).copied()
    }

    fn peek_at(&self, offset: usize) -> Option<u8> {
        self.text.get(self.position + offset).copied()
    }

    fn at_end(&self) -> bool {
        self.position >= self.text.len()
    }

    fn rest(&self) -> &'a [u8] {
        self.text.get(self.position..).unwrap_or_default()
    }

    fn ws(&mut self) -> &mut Self {
        while matches!(self.peek(), Some(b' ' | b'\t')) {
            self.position += 1;
        }
        self
    }

    fn eat(&mut self, byte: u8) -> bool {
        if self.peek() == Some(byte) {
            self.position += 1;
            true
        } else {
            false
        }
    }

    fn eat_str(&mut self, text: &[u8]) -> bool {
        if self.rest().starts_with(text) {
            self.position += text.len();
            true
        } else {
            false
        }
    }

    /// An identifier here, without moving.
    fn peek_ident(&self) -> Option<Range<usize>> {
        let start = self.position;
        if !self.peek().is_some_and(is_ident_start) {
            return None;
        }
        let length = self.rest().iter().take_while(|byte| is_ident_byte(**byte)).count();
        Some(start..start + length)
    }

    fn ident(&mut self) -> Option<Range<usize>> {
        let range = self.peek_ident()?;
        self.position = range.end;
        Some(range)
    }

    fn peek_word(&self) -> &'a [u8] {
        match self.peek_ident() {
            Some(range) => &self.text[range],
            None => &[],
        }
    }

    /// Eats `word` when it is a whole word here, then whitespace.
    fn eat_word(&mut self, word: &[u8]) -> bool {
        if self.peek_word() == word {
            self.position += word.len();
            self.ws();
            true
        } else {
            false
        }
    }

    /// Eats any of `words` repeatedly; returns how many.
    fn skip_words(&mut self, words: &[&[u8]]) -> usize {
        let mut count = 0;
        loop {
            let word = self.peek_word();
            if word.is_empty() || !words.contains(&word) {
                return count;
            }
            // `get(...)` is a method named get, not a getter of the next name.
            let after = Cursor::new(self.text, self.position + word.len());
            let mut after = after;
            after.ws();
            if after.at_end() || matches!(after.peek(), Some(b'(' | b'<' | b'=' | b':' | b';' | b',' | b')' | b'?' | b'!')) {
                return count;
            }
            self.position = after.position;
            count += 1;
        }
    }

    /// Skips a balanced `open ... close` group starting here, if any.
    fn skip_group(&mut self, open: u8, close: u8) -> bool {
        if self.peek() != Some(open) {
            return false;
        }
        let mut depth = 0;
        while let Some(byte) = self.peek() {
            self.position += 1;
            if byte == open {
                depth += 1;
            } else if byte == close {
                depth -= 1;
                if depth == 0 {
                    return true;
                }
            }
        }
        true
    }

    /// Skips `@Name`, `@Name(...)` and `@a.b.Name` annotations or decorators.
    fn skip_annotations(&mut self) {
        while self.peek() == Some(b'@') && self.peek_at(1).is_some_and(is_ident_start) {
            self.position += 1;
            while self.ident().is_some() {
                if !self.eat(b'.') {
                    break;
                }
            }
            self.skip_group(b'(', b')');
            self.ws();
        }
    }
}

// ---------------------------------------------------------------------------
// Brace languages

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Opens {
    /// A class-like body: functions in it are methods.
    Type,
    /// A namespace or module body: functions in it stay functions.
    Module,
    /// A body that names nothing (`extern "C" {`, an anonymous namespace).
    Transparent,
    /// A body that belongs to the enclosing container (Kotlin's companion object).
    Parent,
}

#[derive(Debug, Clone)]
struct Decl {
    /// Byte range in the line.
    name: Range<usize>,
    /// None for a body that only names a container (`impl Foo`).
    kind: Option<SymbolKind>,
    opens: Option<Opens>,
    /// Byte range in the line of a container the declaration names itself
    /// (`func (c *Cart) Add`, `void Cart::add()`).
    container: Option<Range<usize>>,
}

impl Decl {
    fn new(name: Range<usize>, kind: SymbolKind) -> Decl {
        Decl {
            name,
            kind: Some(kind),
            opens: None,
            container: None,
        }
    }

    fn opening(name: Range<usize>, kind: SymbolKind, opens: Opens) -> Decl {
        Decl {
            name,
            kind: Some(kind),
            opens: Some(opens),
            container: None,
        }
    }

    fn container_only(name: Range<usize>, opens: Opens) -> Decl {
        Decl {
            name,
            kind: None,
            opens: Some(opens),
            container: None,
        }
    }
}

#[derive(Debug, Clone)]
struct Container {
    /// Byte range in the whole text; empty for a transparent body.
    name: Range<usize>,
    /// Brace depth of the lines directly inside.
    body_depth: i32,
    is_type: bool,
}

#[derive(Debug, Clone)]
struct Pending {
    name: Range<usize>,
    is_type: bool,
    depth: i32,
    parens: i32,
}

/// What a declaration line may hold, from its position.
#[derive(Debug, Clone, Copy)]
struct Place<'a> {
    /// Directly inside a class-like body.
    in_type: bool,
    /// The enclosing container's name ("" when none).
    container: &'a str,
}

struct BraceScanner<'a> {
    text: &'a str,
    language: Language,
    lexer: Lexer,
    depth: i32,
    parens: i32,
    stack: Vec<Container>,
    pending: Option<Pending>,
    /// Go: inside `const (` or `type (`, with the group's keyword.
    go_group: Option<&'static [u8]>,
}

impl<'a> BraceScanner<'a> {
    fn new(text: &'a str, language: Language) -> BraceScanner<'a> {
        BraceScanner {
            text,
            language,
            lexer: Lexer::new(Syntax::of(language)),
            depth: 0,
            parens: 0,
            stack: Vec::new(),
            pending: None,
            go_group: None,
        }
    }

    fn feed(&mut self, line_start: usize, line: &'a str, line_number: u32, emit: &mut dyn FnMut(Definition<'a>)) {
        let bytes = line.as_bytes();
        if bytes.len() > MAX_LINE {
            self.lex(bytes);
            return;
        }
        let top = self.stack.last();
        let at_body = self.depth == top.map(|container| container.body_depth).unwrap_or(0);
        if self.lexer.in_code() && at_body {
            let indent = bytes.iter().take_while(|byte| matches!(byte, b' ' | b'\t')).count();
            if indent < bytes.len() {
                let container_name = self.container_name();
                let place = Place {
                    in_type: top.is_some_and(|container| container.is_type),
                    container: container_name,
                };
                let decl = if self.parens == 0 {
                    self.go_group = None;
                    self.detect(bytes, indent, place)
                } else if self.language == Language::Go && self.parens == 1 {
                    self.go_group_entry(bytes, indent)
                } else {
                    None
                };
                if let Some(decl) = decl {
                    self.declare(decl, line_start, line, line_number, place, emit);
                }
            }
        }
        self.lex(bytes);
    }

    /// The nearest named container around the current line.
    fn container_name(&self) -> &'a str {
        let text = self.text;
        self.stack
            .iter()
            .rev()
            .find(|container| !container.name.is_empty())
            .map(|container| &text[container.name.clone()])
            .unwrap_or("")
    }

    fn declare(&mut self, decl: Decl, line_start: usize, line: &'a str, line_number: u32, place: Place<'a>, emit: &mut dyn FnMut(Definition<'a>)) {
        self.pending = decl.opens.map(|opens| {
            let (name, is_type) = match opens {
                Opens::Parent => {
                    let parent = self.stack.iter().rev().find(|container| !container.name.is_empty());
                    (parent.map(|container| container.name.clone()).unwrap_or(0..0), true)
                }
                Opens::Transparent => (0..0, false),
                Opens::Type => (line_start + decl.name.start..line_start + decl.name.end, true),
                Opens::Module => (line_start + decl.name.start..line_start + decl.name.end, false),
            };
            Pending {
                name,
                is_type,
                depth: self.depth,
                parens: self.parens,
            }
        });
        let Some(mut kind) = decl.kind else {
            return;
        };
        let name = &line[decl.name.clone()];
        if name.is_empty() {
            return;
        }
        let container = match &decl.container {
            Some(range) => Some(&line[range.clone()]),
            None if !place.container.is_empty() => Some(place.container),
            None => None,
        };
        if kind == SymbolKind::Function && (place.in_type || decl.container.is_some()) {
            kind = SymbolKind::Method;
        }
        emit(Definition {
            name,
            kind,
            line: line_number,
            column: utf16_column(line, decl.name.start),
            container: container.filter(|container| !container.is_empty()),
        });
    }

    fn lex(&mut self, bytes: &[u8]) {
        let BraceScanner {
            lexer,
            depth,
            parens,
            stack,
            pending,
            ..
        } = self;
        lexer.line(bytes, &mut |_, byte| match byte {
            b'{' => {
                if let Some(open) = pending.take() {
                    if open.depth == *depth && open.parens == *parens {
                        stack.push(Container {
                            name: open.name,
                            body_depth: *depth + 1,
                            is_type: open.is_type,
                        });
                    }
                }
                *depth += 1;
            }
            b'}' => {
                *depth = (*depth - 1).max(0);
                while stack.last().is_some_and(|container| container.body_depth > *depth) {
                    stack.pop();
                }
            }
            b'(' => *parens += 1,
            b')' => *parens = (*parens - 1).max(0),
            b';' if pending.as_ref().is_some_and(|open| open.depth == *depth && open.parens == *parens) => *pending = None,
            _ => {}
        });
    }

    fn detect(&mut self, line: &[u8], indent: usize, place: Place<'_>) -> Option<Decl> {
        let cursor = Cursor::new(line, indent);
        match self.language {
            Language::Script | Language::Markup => script(cursor, place),
            Language::Php => php(cursor, place),
            Language::Rust => rust(cursor, place),
            Language::Go => self.go(cursor),
            Language::Java => java(cursor, place),
            Language::Kotlin => kotlin(cursor, place),
            Language::CSharp => csharp(cursor, place),
            Language::Swift => swift(cursor, place),
            Language::C => c_like(cursor, place),
            Language::Python | Language::Ruby => None,
        }
    }

    // Go ------------------------------------------------------------------

    fn go(&mut self, mut cursor: Cursor<'_>) -> Option<Decl> {
        let keyword = cursor.peek_word();
        match keyword {
            b"func" => {
                cursor.eat_word(b"func");
                let mut receiver = None;
                if cursor.peek() == Some(b'(') {
                    let start = cursor.position;
                    cursor.skip_group(b'(', b')');
                    receiver = go_receiver(&cursor.text[start..cursor.position]).map(|range| start + range.start..start + range.end);
                    cursor.ws();
                }
                let name = cursor.ident()?;
                let mut decl = Decl::new(name, SymbolKind::Function);
                decl.container = receiver;
                Some(decl)
            }
            b"type" | b"const" | b"var" => {
                cursor.eat_word(keyword);
                if cursor.peek() == Some(b'(') {
                    self.go_group = Some(if keyword == b"type" { b"type" } else if keyword == b"const" { b"const" } else { b"var" });
                    return None;
                }
                go_spec(cursor, keyword)
            }
            _ => None,
        }
    }

    fn go_group_entry(&self, line: &[u8], indent: usize) -> Option<Decl> {
        let keyword = self.go_group?;
        go_spec(Cursor::new(line, indent), keyword)
    }
}

fn go_spec(mut cursor: Cursor<'_>, keyword: &[u8]) -> Option<Decl> {
    let name = cursor.ident()?;
    match keyword {
        b"type" => {
            cursor.ws();
            cursor.skip_group(b'[', b']');
            cursor.ws();
            cursor.eat(b'=');
            cursor.ws();
            let kind = match cursor.peek_word() {
                b"struct" => SymbolKind::Struct,
                b"interface" => SymbolKind::Interface,
                _ => SymbolKind::Type,
            };
            Some(Decl::new(name, kind))
        }
        b"const" => Some(Decl::new(name, SymbolKind::Constant)),
        _ => None,
    }
}

/// The type name in a Go receiver: `(c *Cart)`, `(Cart)`, `(s *Set[T])`.
fn go_receiver(group: &[u8]) -> Option<Range<usize>> {
    let inner = group.get(1..group.len().saturating_sub(1))?;
    let end = inner.iter().position(|byte| *byte == b'[').unwrap_or(inner.len());
    let head = &inner[..end];
    let last_end = head.iter().rposition(|byte| is_ident_byte(*byte))? + 1;
    let last_start = head[..last_end].iter().rposition(|byte| !is_ident_byte(*byte)).map(|index| index + 1).unwrap_or(0);
    Some(1 + last_start..1 + last_end)
}

// TypeScript / JavaScript --------------------------------------------------

const SCRIPT_MEMBER_MODIFIERS: &[&[u8]] = &[
    b"public",
    b"private",
    b"protected",
    b"static",
    b"readonly",
    b"abstract",
    b"async",
    b"override",
    b"declare",
    b"accessor",
    b"get",
    b"set",
];

fn script(mut cursor: Cursor<'_>, place: Place<'_>) -> Option<Decl> {
    cursor.skip_annotations();
    if place.in_type {
        cursor.skip_words(SCRIPT_MEMBER_MODIFIERS);
        cursor.eat(b'*');
        cursor.ws();
        let hash = cursor.eat(b'#');
        let name = cursor.ident()?;
        let name = if hash { name.start - 1..name.end } else { name };
        if &cursor.text[name.clone()] == b"constructor" {
            return None;
        }
        cursor.eat(b'?');
        cursor.eat(b'!');
        cursor.ws();
        return match cursor.peek() {
            Some(b'(' | b'<') => Some(Decl::new(name, SymbolKind::Method)),
            Some(b'=') if cursor.peek_at(1) != Some(b'=') => {
                cursor.position += 1;
                cursor.ws();
                is_script_function(cursor).then(|| Decl::new(name, SymbolKind::Method))
            }
            _ => None,
        };
    }
    cursor.skip_words(&[b"export", b"default", b"declare"]);
    let abstract_class = cursor.eat_word(b"abstract");
    match cursor.peek_word() {
        b"class" => {
            cursor.eat_word(b"class");
            let name = cursor.ident()?;
            Some(Decl::opening(name, SymbolKind::Class, Opens::Type))
        }
        _ if abstract_class => None,
        b"interface" => {
            cursor.eat_word(b"interface");
            let name = cursor.ident()?;
            Some(Decl::opening(name, SymbolKind::Interface, Opens::Type))
        }
        b"type" => {
            cursor.eat_word(b"type");
            let name = cursor.ident()?;
            cursor.ws();
            matches!(cursor.peek(), Some(b'=' | b'<')).then(|| Decl::new(name, SymbolKind::Type))
        }
        b"enum" => {
            cursor.eat_word(b"enum");
            Some(Decl::new(cursor.ident()?, SymbolKind::Enum))
        }
        b"async" | b"function" => {
            cursor.eat_word(b"async");
            if !cursor.eat_word(b"function") {
                return None;
            }
            cursor.eat(b'*');
            cursor.ws();
            Some(Decl::new(cursor.ident()?, SymbolKind::Function))
        }
        b"namespace" | b"module" => {
            let keyword = cursor.peek_word();
            cursor.eat_word(keyword);
            let name = cursor.ident()?;
            while cursor.eat(b'.') {
                cursor.ident()?;
            }
            Some(Decl::container_only(name, Opens::Module))
        }
        b"global" => Some(Decl::container_only(0..0, Opens::Transparent)),
        b"const" | b"let" | b"var" => {
            let is_const = cursor.peek_word() == b"const";
            let keyword = cursor.peek_word();
            cursor.eat_word(keyword);
            if is_const && cursor.eat_word(b"enum") {
                return Some(Decl::new(cursor.ident()?, SymbolKind::Enum));
            }
            let name = cursor.ident()?;
            cursor.ws();
            // `const name: Type = value`: the value starts after the first lone `=`.
            let rest = cursor.rest();
            let equals = (0..rest.len()).find(|index| {
                rest[*index] == b'=' && !matches!(rest.get(index + 1), Some(b'=' | b'>')) && (*index == 0 || !matches!(rest[index - 1], b'=' | b'!' | b'<' | b'>'))
            })?;
            let mut value = Cursor::new(cursor.text, cursor.position + equals + 1);
            value.ws();
            if is_script_function(value) {
                Some(Decl::new(name, SymbolKind::Function))
            } else if is_const {
                Some(Decl::new(name, SymbolKind::Constant))
            } else {
                None
            }
        }
        _ => None,
    }
}

/// `function`, `async (...) =>`, `(a, b) =>`, `x =>` and `<T>(...) =>`.
fn is_script_function(mut cursor: Cursor<'_>) -> bool {
    cursor.eat_word(b"async");
    if cursor.peek_word() == b"function" {
        return true;
    }
    let rest = cursor.rest();
    match cursor.peek() {
        Some(b'(' | b'<') => memchr::memmem::find(rest, b"=>").is_some(),
        Some(byte) if is_ident_start(byte) => {
            cursor.ident();
            cursor.ws();
            cursor.rest().starts_with(b"=>")
        }
        _ => false,
    }
}

// PHP ------------------------------------------------------------------------

fn php(mut cursor: Cursor<'_>, place: Place<'_>) -> Option<Decl> {
    cursor.skip_annotations();
    if place.in_type {
        cursor.skip_words(&[b"public", b"private", b"protected", b"static", b"abstract", b"final", b"readonly", b"var"]);
        match cursor.peek_word() {
            b"function" => {
                cursor.eat_word(b"function");
                cursor.eat(b'&');
                cursor.ws();
                return Some(Decl::new(cursor.ident()?, SymbolKind::Method));
            }
            b"const" => {
                cursor.eat_word(b"const");
                return last_ident_before(cursor, b'=').map(|name| Decl::new(name, SymbolKind::Constant));
            }
            _ => {}
        }
    }
    cursor.skip_words(&[b"abstract", b"final", b"readonly"]);
    let kind = match cursor.peek_word() {
        b"class" => SymbolKind::Class,
        b"interface" => SymbolKind::Interface,
        b"trait" => SymbolKind::Trait,
        b"enum" => SymbolKind::Enum,
        b"function" => {
            cursor.eat_word(b"function");
            cursor.eat(b'&');
            cursor.ws();
            return Some(Decl::new(cursor.ident()?, SymbolKind::Function));
        }
        b"const" => {
            cursor.eat_word(b"const");
            return last_ident_before(cursor, b'=').map(|name| Decl::new(name, SymbolKind::Constant));
        }
        b"namespace" => {
            cursor.eat_word(b"namespace");
            return Some(Decl::container_only(0..0, Opens::Transparent));
        }
        _ => return None,
    };
    let keyword = cursor.peek_word();
    cursor.eat_word(keyword);
    let name = cursor.ident()?;
    Some(Decl::opening(name, kind, Opens::Type))
}

/// The last identifier before `stop` (`const int MAX = 3` gives MAX).
fn last_ident_before(cursor: Cursor<'_>, stop: u8) -> Option<Range<usize>> {
    let rest = cursor.rest();
    let end = rest.iter().position(|byte| *byte == stop)?;
    let head = &rest[..end];
    let last_end = head.iter().rposition(|byte| is_ident_byte(*byte))? + 1;
    let last_start = head[..last_end].iter().rposition(|byte| !is_ident_byte(*byte)).map(|index| index + 1).unwrap_or(0);
    if !is_ident_start(head[last_start]) {
        return None;
    }
    Some(cursor.position + last_start..cursor.position + last_end)
}

// Rust -----------------------------------------------------------------------

fn rust(mut cursor: Cursor<'_>, _place: Place<'_>) -> Option<Decl> {
    while cursor.peek() == Some(b'#') && matches!(cursor.peek_at(1), Some(b'[' | b'!')) {
        cursor.position += 1;
        cursor.eat(b'!');
        cursor.skip_group(b'[', b']');
        cursor.ws();
    }
    loop {
        match cursor.peek_word() {
            b"pub" => {
                cursor.eat_word(b"pub");
                cursor.skip_group(b'(', b')');
                cursor.ws();
            }
            b"unsafe" | b"async" | b"default" => {
                let word = cursor.peek_word();
                cursor.eat_word(word);
            }
            b"extern" => {
                cursor.eat_word(b"extern");
                if cursor.eat(b'"') {
                    while !cursor.at_end() && !cursor.eat(b'"') {
                        cursor.position += 1;
                    }
                    cursor.ws();
                }
                if cursor.peek() == Some(b'{') {
                    return Some(Decl::container_only(0..0, Opens::Transparent));
                }
            }
            b"const" => {
                let mut after = cursor;
                after.eat_word(b"const");
                if matches!(after.peek_word(), b"fn" | b"unsafe" | b"async" | b"extern") {
                    cursor = after;
                } else {
                    break;
                }
            }
            _ => break,
        }
    }
    let keyword = cursor.peek_word();
    let kind = match keyword {
        b"fn" => SymbolKind::Function,
        b"struct" | b"union" => SymbolKind::Struct,
        b"enum" => SymbolKind::Enum,
        b"trait" => SymbolKind::Trait,
        b"type" => SymbolKind::Type,
        b"mod" => SymbolKind::Module,
        b"const" | b"static" => SymbolKind::Constant,
        b"impl" => {
            cursor.eat_word(b"impl");
            return rust_impl_target(cursor).map(|name| Decl::container_only(name, Opens::Type));
        }
        _ => return None,
    };
    cursor.eat_word(keyword);
    if keyword == b"static" {
        cursor.eat_word(b"mut");
    }
    let name = cursor.ident()?;
    match kind {
        SymbolKind::Trait => Some(Decl::opening(name, kind, Opens::Type)),
        SymbolKind::Module => {
            cursor.ws();
            (cursor.peek() == Some(b'{')).then(|| Decl::opening(name, kind, Opens::Module))
        }
        _ => Some(Decl::new(name, kind)),
    }
}

/// `impl<T> Trait for Cart<T>` gives Cart; `impl Cart` gives Cart.
fn rust_impl_target(mut cursor: Cursor<'_>) -> Option<Range<usize>> {
    cursor.skip_group(b'<', b'>');
    cursor.ws();
    let mut target = rust_type_path(&mut cursor)?;
    cursor.ws();
    if cursor.eat_word(b"for") {
        target = rust_type_path(&mut cursor)?;
    }
    Some(target)
}

/// The last segment of a type path: `&'a mut std::fmt::Formatter<'_>` gives Formatter.
fn rust_type_path(cursor: &mut Cursor<'_>) -> Option<Range<usize>> {
    loop {
        cursor.ws();
        if cursor.eat(b'&') || cursor.eat(b'!') {
            continue;
        }
        if cursor.peek() == Some(b'\'') {
            cursor.position += 1;
            cursor.ident();
            continue;
        }
        if cursor.eat_word(b"mut") || cursor.eat_word(b"dyn") {
            continue;
        }
        break;
    }
    let mut last = cursor.ident()?;
    while cursor.eat_str(b"::") {
        last = cursor.ident()?;
    }
    cursor.skip_group(b'<', b'>');
    Some(last)
}

// Java, C# and C++ members ---------------------------------------------------

const STATEMENT_WORDS: &[&[u8]] = &[
    b"return", b"new", b"throw", b"else", b"if", b"for", b"foreach", b"while", b"switch", b"case", b"do", b"try", b"catch",
    b"await", b"yield", b"delete", b"goto", b"using", b"lock", b"sizeof", b"typeof", b"assert", b"break", b"continue", b"super",
    b"this", b"synchronized",
];

/// A method declaration in a class body: `Type name(` with a type-like
/// prefix. Constructors (no return type) are left out.
fn member_method(cursor: Cursor<'_>, allow_qualified: bool) -> Option<Decl> {
    let rest = cursor.rest();
    let paren = rest.iter().position(|byte| *byte == b'(')?;
    let head = &rest[..paren];
    if head.iter().any(|byte| matches!(byte, b'=' | b'"' | b'\'' | b'{' | b'}' | b';' | b'!' | b'+' | b'|')) {
        return None;
    }
    let name_end = head.iter().rposition(|byte| !matches!(byte, b' ' | b'\t'))? + 1;
    let mut name_start = head[..name_end].iter().rposition(|byte| !is_ident_byte(*byte)).map(|index| index + 1).unwrap_or(0);
    if name_start >= name_end || !is_ident_start(head[name_start]) {
        return None;
    }
    let mut container = None;
    if allow_qualified && name_start >= 2 && &head[name_start - 2..name_start] == b"::" {
        let owner_end = name_start - 2;
        let owner_start = head[..owner_end].iter().rposition(|byte| !is_ident_byte(*byte)).map(|index| index + 1).unwrap_or(0);
        if owner_start < owner_end {
            container = Some(cursor.position + owner_start..cursor.position + owner_end);
        }
        if head.get(name_start) == Some(&b'~') {
            return None;
        }
    } else if name_start > 0 && matches!(head[name_start - 1], b'.' | b'~' | b':') {
        return None;
    }
    let prefix_end = match &container {
        Some(range) => range.start - cursor.position,
        None => name_start,
    };
    let prefix = trim_ascii(&head[..prefix_end]);
    let first_word_end = prefix.iter().position(|byte| !is_ident_byte(*byte)).unwrap_or(prefix.len());
    if STATEMENT_WORDS.contains(&&prefix[..first_word_end]) || STATEMENT_WORDS.contains(&&head[name_start..name_end]) {
        return None;
    }
    if !prefix.iter().all(|byte| is_ident_byte(*byte) || matches!(byte, b' ' | b'\t' | b'<' | b'>' | b'[' | b']' | b',' | b'.' | b'?' | b'*' | b'&' | b':')) {
        return None;
    }
    if prefix.is_empty() && container.is_none() {
        return None;
    }
    // A qualified constructor (`Cart::Cart(`) has no return type either.
    if let Some(range) = &container {
        if prefix.is_empty() && cursor.text[range.clone()] == head[name_start..name_end] {
            return None;
        }
    }
    if &head[name_start..name_end] == b"operator" {
        return None;
    }
    name_start += cursor.position;
    let mut decl = Decl::new(name_start..cursor.position + name_end, SymbolKind::Function);
    decl.container = container;
    Some(decl)
}

fn trim_ascii(bytes: &[u8]) -> &[u8] {
    let start = bytes.iter().position(|byte| !byte.is_ascii_whitespace()).unwrap_or(bytes.len());
    let end = bytes.iter().rposition(|byte| !byte.is_ascii_whitespace()).map(|index| index + 1).unwrap_or(start);
    &bytes[start..end]
}

fn java(mut cursor: Cursor<'_>, place: Place<'_>) -> Option<Decl> {
    cursor.skip_annotations();
    let modifiers_start = cursor.position;
    cursor.skip_words(&[
        b"public", b"protected", b"private", b"static", b"final", b"abstract", b"sealed", b"non", b"strictfp", b"default",
        b"synchronized", b"native", b"transient", b"volatile",
    ]);
    let modifiers = &cursor.text[modifiers_start..cursor.position];
    if cursor.eat_str(b"-sealed") {
        cursor.ws();
    }
    let kind = match cursor.peek_word() {
        b"class" => Some(SymbolKind::Class),
        b"interface" => Some(SymbolKind::Interface),
        b"enum" => Some(SymbolKind::Enum),
        b"record" => Some(SymbolKind::Record),
        _ if cursor.peek() == Some(b'@') && cursor.rest()[1..].starts_with(b"interface") => {
            cursor.position += 1;
            Some(SymbolKind::Interface)
        }
        _ => None,
    };
    if let Some(kind) = kind {
        let keyword = cursor.peek_word();
        let mut after = cursor;
        after.eat_word(keyword);
        if let Some(name) = after.ident() {
            after.ws();
            if kind != SymbolKind::Record || matches!(after.peek(), Some(b'(' | b'<')) {
                return Some(Decl::opening(name, kind, Opens::Type));
            }
        }
    }
    if !place.in_type {
        return None;
    }
    cursor.skip_group(b'<', b'>');
    cursor.ws();
    let is_constant = has_word(modifiers, b"static") && has_word(modifiers, b"final");
    if is_constant {
        let rest = cursor.rest();
        let equals = rest.iter().position(|byte| *byte == b'=');
        let paren = rest.iter().position(|byte| *byte == b'(');
        if equals.is_some_and(|equals| paren.is_none_or(|paren| equals < paren)) {
            return last_ident_before(cursor, b'=').map(|name| Decl::new(name, SymbolKind::Constant));
        }
    }
    member_method(cursor, false)
}

fn has_word(text: &[u8], word: &[u8]) -> bool {
    text.split(|byte| !is_ident_byte(*byte)).any(|part| part == word)
}

fn csharp(mut cursor: Cursor<'_>, place: Place<'_>) -> Option<Decl> {
    if cursor.peek() == Some(b'[') {
        cursor.skip_group(b'[', b']');
        cursor.ws();
    }
    cursor.skip_words(&[
        b"public", b"private", b"protected", b"internal", b"static", b"sealed", b"abstract", b"partial", b"readonly", b"virtual",
        b"override", b"async", b"unsafe", b"extern", b"new", b"volatile", b"required", b"file", b"ref",
    ]);
    let keyword = cursor.peek_word();
    let kind = match keyword {
        b"class" => Some(SymbolKind::Class),
        b"struct" => Some(SymbolKind::Struct),
        b"interface" => Some(SymbolKind::Interface),
        b"enum" => Some(SymbolKind::Enum),
        b"record" => Some(SymbolKind::Record),
        b"namespace" => {
            cursor.eat_word(b"namespace");
            let name = cursor.ident()?;
            let mut end = name.end;
            while cursor.eat(b'.') {
                end = cursor.ident()?.end;
            }
            return Some(Decl::container_only(name.start..end, Opens::Module));
        }
        b"const" => {
            cursor.eat_word(b"const");
            return last_ident_before(cursor, b'=').map(|name| Decl::new(name, SymbolKind::Constant));
        }
        _ => None,
    };
    if let Some(kind) = kind {
        cursor.eat_word(keyword);
        if kind == SymbolKind::Record && !cursor.eat_word(b"struct") {
            cursor.eat_word(b"class");
        }
        let name = cursor.ident()?;
        return Some(Decl::opening(name, kind, Opens::Type));
    }
    if !place.in_type {
        return None;
    }
    member_method(cursor, false)
}

// Kotlin ---------------------------------------------------------------------

const KOTLIN_MODIFIERS: &[&[u8]] = &[
    b"public", b"private", b"protected", b"internal", b"open", b"abstract", b"final", b"sealed", b"data", b"enum", b"annotation",
    b"inner", b"value", b"inline", b"override", b"suspend", b"operator", b"infix", b"tailrec", b"external", b"expect", b"actual",
    b"lateinit", b"const", b"companion", b"noinline", b"crossinline",
];

fn kotlin(mut cursor: Cursor<'_>, place: Place<'_>) -> Option<Decl> {
    cursor.skip_annotations();
    let modifiers_start = cursor.position;
    cursor.skip_words(KOTLIN_MODIFIERS);
    let modifiers = &cursor.text[modifiers_start..cursor.position];
    let keyword = cursor.peek_word();
    match keyword {
        b"class" | b"interface" => {
            cursor.eat_word(keyword);
            let name = cursor.ident()?;
            let kind = if keyword == b"interface" {
                SymbolKind::Interface
            } else if has_word(modifiers, b"enum") {
                SymbolKind::Enum
            } else {
                SymbolKind::Class
            };
            Some(Decl::opening(name, kind, Opens::Type))
        }
        b"object" => {
            cursor.eat_word(b"object");
            if has_word(modifiers, b"companion") {
                return Some(Decl::container_only(0..0, Opens::Parent));
            }
            let name = cursor.ident()?;
            Some(Decl::opening(name, SymbolKind::Object, Opens::Type))
        }
        b"fun" => {
            cursor.eat_word(b"fun");
            if cursor.eat_word(b"interface") {
                return Some(Decl::opening(cursor.ident()?, SymbolKind::Interface, Opens::Type));
            }
            cursor.skip_group(b'<', b'>');
            cursor.ws();
            // `fun Receiver.name(`: the name is the last segment.
            let mut name = cursor.ident()?;
            loop {
                cursor.skip_group(b'<', b'>');
                cursor.eat(b'?');
                if !cursor.eat(b'.') {
                    break;
                }
                name = cursor.ident()?;
            }
            Some(Decl::new(name, SymbolKind::Function))
        }
        b"typealias" => {
            cursor.eat_word(b"typealias");
            Some(Decl::new(cursor.ident()?, SymbolKind::Type))
        }
        b"val" | b"var" if has_word(modifiers, b"const") || (!place.in_type && place.container.is_empty() && keyword == b"val" && is_upper_name(cursor)) => {
            cursor.eat_word(keyword);
            Some(Decl::new(cursor.ident()?, SymbolKind::Constant))
        }
        _ => None,
    }
}

/// `val MAX_SIZE`: the word after `val` is SCREAMING_CASE.
fn is_upper_name(mut cursor: Cursor<'_>) -> bool {
    let keyword = cursor.peek_word();
    cursor.eat_word(keyword);
    let word = cursor.peek_word();
    word.len() > 1 && word.iter().all(|byte| byte.is_ascii_uppercase() || byte.is_ascii_digit() || *byte == b'_') && word.iter().any(u8::is_ascii_uppercase)
}

// Swift ----------------------------------------------------------------------

fn swift(mut cursor: Cursor<'_>, _place: Place<'_>) -> Option<Decl> {
    cursor.skip_annotations();
    loop {
        let skipped = cursor.skip_words(&[
            b"public", b"private", b"fileprivate", b"internal", b"open", b"final", b"static", b"override", b"mutating",
            b"nonmutating", b"convenience", b"required", b"lazy", b"weak", b"unowned", b"dynamic", b"indirect", b"nonisolated",
            b"package",
        ]);
        cursor.skip_group(b'(', b')');
        cursor.ws();
        // `class func` is a type method, not a class.
        let mut after = cursor;
        let class_modifier = after.eat_word(b"class") && matches!(after.peek_word(), b"func" | b"var" | b"let" | b"override" | b"final" | b"subscript");
        if class_modifier {
            cursor = after;
            continue;
        }
        if skipped == 0 {
            break;
        }
    }
    let keyword = cursor.peek_word();
    let kind = match keyword {
        b"class" | b"actor" => SymbolKind::Class,
        b"struct" => SymbolKind::Struct,
        b"enum" => SymbolKind::Enum,
        b"protocol" => SymbolKind::Protocol,
        b"typealias" => SymbolKind::Type,
        b"func" => SymbolKind::Function,
        b"extension" => {
            cursor.eat_word(b"extension");
            let mut name = cursor.ident()?;
            while cursor.eat(b'.') {
                name = cursor.ident()?;
            }
            return Some(Decl::container_only(name, Opens::Type));
        }
        _ => return None,
    };
    cursor.eat_word(keyword);
    let name = cursor.ident()?;
    match kind {
        SymbolKind::Type | SymbolKind::Function => Some(Decl::new(name, kind)),
        _ => Some(Decl::opening(name, kind, Opens::Type)),
    }
}

// C and C++ --------------------------------------------------------------------

fn c_like(mut cursor: Cursor<'_>, place: Place<'_>) -> Option<Decl> {
    if cursor.eat(b'#') {
        cursor.ws();
        if !cursor.eat_word(b"define") {
            return None;
        }
        let name = cursor.ident()?;
        let kind = if cursor.peek() == Some(b'(') { SymbolKind::Function } else { SymbolKind::Constant };
        return Some(Decl::new(name, kind));
    }
    if cursor.eat_word(b"template") {
        cursor.skip_group(b'<', b'>');
        cursor.ws();
        if cursor.at_end() {
            return None;
        }
    }
    cursor.skip_words(&[b"typedef", b"static", b"inline", b"extern", b"virtual", b"explicit", b"constexpr", b"consteval", b"friend", b"export"]);
    let keyword = cursor.peek_word();
    let before_keyword = cursor;
    match keyword {
        b"class" | b"struct" | b"union" | b"enum" => {
            cursor.eat_word(keyword);
            if keyword == b"enum" && !cursor.eat_word(b"class") {
                cursor.eat_word(b"struct");
            }
            // `struct __attribute__((packed)) Name` and `class alignas(8) Name`.
            while matches!(cursor.peek_word(), b"__attribute__" | b"alignas" | b"__declspec") {
                let word = cursor.peek_word();
                cursor.eat_word(word);
                cursor.skip_group(b'(', b')');
                cursor.ws();
            }
            let name = cursor.ident()?;
            cursor.ws();
            cursor.eat_word(b"final");
            let opens_body = cursor.at_end() || matches!(cursor.peek(), Some(b'{' | b':')) || cursor.rest().starts_with(b"//");
            if !opens_body {
                // `struct point *make_point(int x) {`: a function returning a struct.
                return c_function(before_keyword, place);
            }
            let kind = match keyword {
                b"class" => SymbolKind::Class,
                b"enum" => SymbolKind::Enum,
                _ => SymbolKind::Struct,
            };
            return Some(Decl::opening(name, kind, Opens::Type));
        }
        b"namespace" => {
            cursor.eat_word(b"namespace");
            return Some(match cursor.ident() {
                Some(name) => {
                    let mut end = name.end;
                    while cursor.eat_str(b"::") {
                        end = cursor.ident()?.end;
                    }
                    Decl::container_only(name.start..end, Opens::Module)
                }
                None => Decl::container_only(0..0, Opens::Transparent),
            });
        }
        _ => {}
    }
    if cursor.rest().starts_with(b"\"C\"") {
        return Some(Decl::container_only(0..0, Opens::Transparent));
    }
    c_function(cursor, place)
}

fn c_function(cursor: Cursor<'_>, place: Place<'_>) -> Option<Decl> {
    // A declaration ends with `;` outside a class body: a prototype, not a definition.
    if !place.in_type && trim_ascii(cursor.rest()).ends_with(b";") {
        return None;
    }
    member_method(cursor, true)
}

// ---------------------------------------------------------------------------
// Python and Ruby: containers by indentation.

struct Scope {
    indent: usize,
    /// Byte range in the whole text.
    name: Range<usize>,
    /// A class or module (a def holds nothing worth listing).
    is_type: bool,
}

struct IndentScanner<'a> {
    text: &'a str,
    language: Language,
    lexer: Lexer,
    /// Open brackets at the end of the last line: the next line continues it.
    nesting: i32,
    continued: bool,
    stack: Vec<Scope>,
}

impl<'a> IndentScanner<'a> {
    fn new(text: &'a str, language: Language) -> IndentScanner<'a> {
        IndentScanner {
            text,
            language,
            lexer: Lexer::new(Syntax::of(language)),
            nesting: 0,
            continued: false,
            stack: Vec::new(),
        }
    }

    fn feed(&mut self, line_start: usize, line: &'a str, line_number: u32, emit: &mut dyn FnMut(Definition<'a>)) {
        let bytes = line.as_bytes();
        let statement_start = self.lexer.in_code() && self.nesting == 0 && !self.continued;
        if statement_start && bytes.len() <= MAX_LINE {
            self.statement(line_start, line, line_number, emit);
        }
        let IndentScanner { lexer, nesting, .. } = self;
        lexer.line(bytes, &mut |_, byte| match byte {
            b'(' | b'[' | b'{' => *nesting += 1,
            b')' | b']' | b'}' => *nesting = (*nesting - 1).max(0),
            _ => {}
        });
        self.continued = self.language == Language::Python && bytes.last() == Some(&b'\\');
    }

    fn statement(&mut self, line_start: usize, line: &'a str, line_number: u32, emit: &mut dyn FnMut(Definition<'a>)) {
        let bytes = line.as_bytes();
        let indent: usize = bytes
            .iter()
            .take_while(|byte| matches!(byte, b' ' | b'\t'))
            .map(|byte| if *byte == b'\t' { 8 } else { 1 })
            .sum();
        let start = bytes.iter().take_while(|byte| matches!(byte, b' ' | b'\t')).count();
        if start == bytes.len() || bytes[start] == b'#' {
            return;
        }
        while self.stack.last().is_some_and(|scope| scope.indent >= indent) {
            self.stack.pop();
        }
        let parent = self.stack.last();
        let parent_is_type = parent.is_some_and(|scope| scope.is_type);
        let in_def = parent.is_some_and(|scope| !scope.is_type);
        let container = parent.filter(|scope| scope.is_type).map(|scope| &self.text[scope.name.clone()]);
        let cursor = Cursor::new(bytes, start);
        let found = match self.language {
            Language::Python => python(cursor, self.stack.is_empty()),
            _ => ruby(cursor),
        };
        let Some((name, mut kind, opens)) = found else {
            return;
        };
        if let Some(is_type) = opens {
            self.stack.push(Scope {
                indent,
                name: line_start + name.start..line_start + name.end,
                is_type,
            });
        }
        // Functions nested in functions are local helpers.
        if in_def {
            return;
        }
        if kind == SymbolKind::Function && parent_is_type {
            kind = SymbolKind::Method;
        }
        emit(Definition {
            name: &line[name.clone()],
            kind,
            line: line_number,
            column: utf16_column(line, name.start),
            container,
        });
    }
}

/// A Python definition: (name, kind, opens a scope that is a class).
fn python(mut cursor: Cursor<'_>, top_level: bool) -> Option<(Range<usize>, SymbolKind, Option<bool>)> {
    cursor.eat_word(b"async");
    match cursor.peek_word() {
        b"class" => {
            cursor.eat_word(b"class");
            Some((cursor.ident()?, SymbolKind::Class, Some(true)))
        }
        b"def" => {
            cursor.eat_word(b"def");
            Some((cursor.ident()?, SymbolKind::Function, Some(false)))
        }
        _ if top_level && cursor.position == 0 => {
            let name = cursor.ident()?;
            let word = &cursor.text[name.clone()];
            cursor.ws();
            let assigns = cursor.peek() == Some(b'=') && cursor.peek_at(1) != Some(b'=') || cursor.peek() == Some(b':');
            let upper = word.iter().all(|byte| byte.is_ascii_uppercase() || byte.is_ascii_digit() || *byte == b'_') && word.iter().any(u8::is_ascii_uppercase);
            (assigns && upper).then_some((name, SymbolKind::Constant, None))
        }
        _ => None,
    }
}

fn ruby(mut cursor: Cursor<'_>) -> Option<(Range<usize>, SymbolKind, Option<bool>)> {
    cursor.skip_words(&[b"private", b"protected", b"public", b"module_function"]);
    match cursor.peek_word() {
        b"class" | b"module" => {
            let kind = if cursor.peek_word() == b"class" { SymbolKind::Class } else { SymbolKind::Module };
            let keyword = cursor.peek_word();
            cursor.eat_word(keyword);
            // `class << self` opens the singleton class: its defs stay with the class.
            if cursor.peek() == Some(b'<') {
                return None;
            }
            let mut name = cursor.ident()?;
            while cursor.eat_str(b"::") {
                name = cursor.ident()?;
            }
            Some((name, kind, Some(true)))
        }
        b"def" => {
            cursor.eat_word(b"def");
            if cursor.eat_str(b"self.") {
                cursor.ws();
            }
            let name = cursor.ident()?;
            let end = if matches!(cursor.peek(), Some(b'?' | b'!')) { name.end + 1 } else { name.end };
            Some((name.start..end, SymbolKind::Function, Some(false)))
        }
        _ => {
            let name = cursor.ident()?;
            let word = &cursor.text[name.clone()];
            cursor.ws();
            let assigns = cursor.peek() == Some(b'=') && !matches!(cursor.peek_at(1), Some(b'=' | b'~' | b'>'));
            let upper = word.iter().all(|byte| byte.is_ascii_uppercase() || byte.is_ascii_digit() || *byte == b'_') && word.iter().any(u8::is_ascii_uppercase);
            (assigns && upper).then_some((name, SymbolKind::Constant, None))
        }
    }
}

#[cfg(test)]
#[path = "extract_tests.rs"]
mod tests;
