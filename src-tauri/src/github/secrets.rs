//! Where the GitHub token lives: only the operating system's keychain (macOS Keychain,
//! Windows Credential Manager). Behind a trait so the tests use an in-memory store.

use crate::error::{AppError, AppResult};

/// The keychain item's service, the app's identifier plus `.github`; the account is the GitHub host.
const SERVICE: &str = "io.github.shibbirweb.gitmanager.github";

/// Where earlier versions kept the token, while the app's identifier was `com.shibbir.gitmanager`.
const LEGACY_SERVICE: &str = "com.shibbir.gitmanager.github";

pub trait SecretStore: Send + Sync {
    fn read(&self, host: &str) -> AppResult<Option<String>>;
    fn write(&self, host: &str, token: &str) -> AppResult<()>;
    /// Removing a missing item is not an error.
    fn remove(&self, host: &str) -> AppResult<()>;
}

/// The keychain items of one service.
pub struct KeychainStore {
    #[cfg_attr(not(any(target_os = "macos", windows)), allow(dead_code))]
    service: &'static str,
}

/// The app's token store: the current keychain service, moving a token an older version saved on first read.
pub fn app_secrets() -> MovingStore<KeychainStore, KeychainStore> {
    MovingStore {
        current: KeychainStore { service: SERVICE },
        legacy: KeychainStore { service: LEGACY_SERVICE },
    }
}

/// Reads fall back to `legacy` and move what they find to `current`, so people stay signed in after the
/// app's identifier changed. A legacy item that cannot be read (say the keychain prompt was denied) counts
/// as none: the person signs in again.
pub struct MovingStore<C, L> {
    pub current: C,
    pub legacy: L,
}

impl<C: SecretStore, L: SecretStore> SecretStore for MovingStore<C, L> {
    fn read(&self, host: &str) -> AppResult<Option<String>> {
        if let Some(token) = self.current.read(host)? {
            return Ok(Some(token));
        }
        let Ok(Some(token)) = self.legacy.read(host) else {
            return Ok(None);
        };
        self.current.write(host, &token)?;
        // The token is safe in the new item; a legacy item left behind does no harm.
        let _ = self.legacy.remove(host);
        Ok(Some(token))
    }

    fn write(&self, host: &str, token: &str) -> AppResult<()> {
        self.current.write(host, token)
    }

    fn remove(&self, host: &str) -> AppResult<()> {
        self.current.remove(host)?;
        self.legacy.remove(host)
    }
}

#[cfg(any(target_os = "macos", windows))]
fn entry(service: &str, host: &str) -> AppResult<keyring::Entry> {
    keyring::Entry::new(service, host).map_err(keychain_error)
}

#[cfg(any(target_os = "macos", windows))]
fn keychain_error(err: keyring::Error) -> AppError {
    AppError::invalid(format!("Keychain: {err}"))
}

#[cfg(any(target_os = "macos", windows))]
impl SecretStore for KeychainStore {
    fn read(&self, host: &str) -> AppResult<Option<String>> {
        match entry(self.service, host)?.get_password() {
            Ok(token) => Ok(Some(token)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(err) => Err(keychain_error(err)),
        }
    }

    fn write(&self, host: &str, token: &str) -> AppResult<()> {
        entry(self.service, host)?.set_password(token).map_err(keychain_error)
    }

    fn remove(&self, host: &str) -> AppResult<()> {
        match entry(self.service, host)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(err) => Err(keychain_error(err)),
        }
    }
}

// No keychain backend yet on other platforms: refuse rather than keep the token in a file.
#[cfg(not(any(target_os = "macos", windows)))]
impl SecretStore for KeychainStore {
    fn read(&self, _host: &str) -> AppResult<Option<String>> {
        Ok(None)
    }

    fn write(&self, _host: &str, _token: &str) -> AppResult<()> {
        Err(AppError::invalid(
            "Saving a GitHub token is not supported on this system yet. Use the GitHub CLI instead.",
        ))
    }

    fn remove(&self, _host: &str) -> AppResult<()> {
        Ok(())
    }
}

#[cfg(test)]
pub mod memory {
    use std::collections::HashMap;
    use std::sync::Mutex;

    use super::SecretStore;
    use crate::error::AppResult;

    #[derive(Default)]
    pub struct MemoryStore {
        items: Mutex<HashMap<String, String>>,
    }

    impl MemoryStore {
        pub fn get(&self, host: &str) -> Option<String> {
            self.items.lock().unwrap().get(host).cloned()
        }
    }

    impl SecretStore for MemoryStore {
        fn read(&self, host: &str) -> AppResult<Option<String>> {
            Ok(self.get(host))
        }

        fn write(&self, host: &str, token: &str) -> AppResult<()> {
            self.items.lock().unwrap().insert(host.to_string(), token.to_string());
            Ok(())
        }

        fn remove(&self, host: &str) -> AppResult<()> {
            self.items.lock().unwrap().remove(host);
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::memory::MemoryStore;
    use super::{MovingStore, SecretStore};
    use crate::error::{AppError, AppResult};

    const HOST: &str = "github.com";

    /// A legacy keychain the app may not read, as when the keychain prompt is denied.
    struct DeniedStore;

    impl SecretStore for DeniedStore {
        fn read(&self, _host: &str) -> AppResult<Option<String>> {
            Err(AppError::invalid("Keychain: denied"))
        }

        fn write(&self, _host: &str, _token: &str) -> AppResult<()> {
            Err(AppError::invalid("Keychain: denied"))
        }

        fn remove(&self, _host: &str) -> AppResult<()> {
            Err(AppError::invalid("Keychain: denied"))
        }
    }

    fn moving() -> MovingStore<MemoryStore, MemoryStore> {
        MovingStore { current: MemoryStore::default(), legacy: MemoryStore::default() }
    }

    #[test]
    fn reads_the_current_item_first() {
        let store = moving();
        store.current.write(HOST, "new").unwrap();
        store.legacy.write(HOST, "old").unwrap();
        assert_eq!(store.read(HOST).unwrap().as_deref(), Some("new"));
        assert_eq!(store.legacy.get(HOST).as_deref(), Some("old"));
    }

    #[test]
    fn moves_a_token_an_older_version_saved() {
        let store = moving();
        store.legacy.write(HOST, "old").unwrap();
        assert_eq!(store.read(HOST).unwrap().as_deref(), Some("old"));
        assert_eq!(store.current.get(HOST).as_deref(), Some("old"));
        assert_eq!(store.legacy.get(HOST), None);
    }

    #[test]
    fn finds_nothing_when_neither_item_exists() {
        assert_eq!(moving().read(HOST).unwrap(), None);
    }

    #[test]
    fn counts_an_unreadable_legacy_item_as_none() {
        let store = MovingStore { current: MemoryStore::default(), legacy: DeniedStore };
        assert_eq!(store.read(HOST).unwrap(), None);
    }

    #[test]
    fn writes_only_the_current_item_and_removes_both() {
        let store = moving();
        store.legacy.write(HOST, "old").unwrap();
        store.write(HOST, "new").unwrap();
        assert_eq!(store.current.get(HOST).as_deref(), Some("new"));
        assert_eq!(store.legacy.get(HOST).as_deref(), Some("old"));
        store.remove(HOST).unwrap();
        assert_eq!(store.current.get(HOST), None);
        assert_eq!(store.legacy.get(HOST), None);
    }
}
