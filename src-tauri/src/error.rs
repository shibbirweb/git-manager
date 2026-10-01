use serde::{ser::SerializeStruct, Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    Git(#[from] git2::Error),
    #[error("{0}")]
    Io(#[from] std::io::Error),
    /// A `git` CLI invocation exited with a non-zero status.
    #[error("{message}")]
    Command { message: String },
    #[error("{0}")]
    Invalid(String),
}

impl AppError {
    pub fn invalid(message: impl Into<String>) -> Self {
        AppError::Invalid(message.into())
    }

    fn kind(&self) -> &'static str {
        match self {
            AppError::Git(_) => "git",
            AppError::Io(_) => "io",
            AppError::Command { .. } => "command",
            AppError::Invalid(_) => "invalid",
        }
    }
}

/// Serialized to the frontend as `{ kind, message }`.
impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut state = serializer.serialize_struct("AppError", 2)?;
        state.serialize_field("kind", self.kind())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

pub type AppResult<T> = Result<T, AppError>;
