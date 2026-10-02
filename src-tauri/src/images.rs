//! Local images for the Markdown preview. The webview's CSP only allows
//! `'self'` and `data:` images, so files are read here and handed over as data
//! URLs, and only from inside the workspace folder that holds the document.

use std::path::Path;

use crate::error::{AppError, AppResult};

/// Larger images are refused; a data URL keeps the whole file in memory.
pub const MAX_IMAGE_BYTES: u64 = 10 * 1024 * 1024;

/// The media type for an image path, by extension; None when it is not an image we show.
pub fn image_mime(image_path: &Path) -> Option<&'static str> {
    let extension = image_path.extension()?.to_str()?.to_ascii_lowercase();
    match extension.as_str() {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        // Shown through <img> only, where SVG never runs scripts or loads anything.
        "svg" => Some("image/svg+xml"),
        _ => None,
    }
}

const BASE64_ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/// Standard base64 with padding.
pub fn base64_encode(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let first = chunk[0] as u32;
        let second = chunk.get(1).copied().unwrap_or_default() as u32;
        let third = chunk.get(2).copied().unwrap_or_default() as u32;
        let triple = (first << 16) | (second << 8) | third;
        out.push(BASE64_ALPHABET[(triple >> 18) as usize & 63] as char);
        out.push(BASE64_ALPHABET[(triple >> 12) as usize & 63] as char);
        if chunk.len() > 1 {
            out.push(BASE64_ALPHABET[(triple >> 6) as usize & 63] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(BASE64_ALPHABET[triple as usize & 63] as char);
        } else {
            out.push('=');
        }
    }
    out
}

/// Reads `full_path` as a data URL. `root` must be canonical; the image must
/// resolve inside it (symlinks included), be a supported type and fit the cap.
pub fn read_data_url(root: &Path, full_path: &Path) -> AppResult<String> {
    let mime = image_mime(full_path).ok_or_else(|| AppError::invalid("Not a supported image type"))?;
    let resolved = full_path.canonicalize()?;
    if !resolved.starts_with(root) {
        return Err(AppError::invalid("The image is outside the workspace"));
    }
    let metadata = std::fs::metadata(&resolved)?;
    if !metadata.is_file() {
        return Err(AppError::invalid("Not a file"));
    }
    if metadata.len() > MAX_IMAGE_BYTES {
        return Err(AppError::invalid(format!(
            "The image is larger than {} MB",
            MAX_IMAGE_BYTES / 1024 / 1024
        )));
    }
    // The file can grow between the size check and the read; never send more than the cap.
    let bytes = std::fs::read(&resolved)?;
    if bytes.len() as u64 > MAX_IMAGE_BYTES {
        return Err(AppError::invalid("The image is too large"));
    }
    Ok(format!("data:{mime};base64,{}", base64_encode(&bytes)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_base64_with_padding() {
        assert_eq!(base64_encode(b""), "");
        assert_eq!(base64_encode(b"f"), "Zg==");
        assert_eq!(base64_encode(b"fo"), "Zm8=");
        assert_eq!(base64_encode(b"foo"), "Zm9v");
        assert_eq!(base64_encode(b"foobar"), "Zm9vYmFy");
        assert_eq!(base64_encode(&[0xff, 0xfe, 0x00]), "//4A");
    }

    #[test]
    fn knows_image_types_by_extension() {
        assert_eq!(image_mime(Path::new("a/logo.PNG")), Some("image/png"));
        assert_eq!(image_mime(Path::new("photo.jpeg")), Some("image/jpeg"));
        assert_eq!(image_mime(Path::new("photo.jpg")), Some("image/jpeg"));
        assert_eq!(image_mime(Path::new("anim.gif")), Some("image/gif"));
        assert_eq!(image_mime(Path::new("pic.webp")), Some("image/webp"));
        assert_eq!(image_mime(Path::new("icon.svg")), Some("image/svg+xml"));
        assert_eq!(image_mime(Path::new("page.html")), None);
        assert_eq!(image_mime(Path::new("README")), None);
    }

    #[test]
    fn reads_images_inside_the_root_only() {
        let dir = tempfile::TempDir::new().unwrap();
        let root = dir.path().join("root");
        std::fs::create_dir_all(root.join("docs")).unwrap();
        std::fs::write(root.join("docs/pixel.png"), [0x89, b'P', b'N', b'G']).unwrap();
        std::fs::write(dir.path().join("outside.png"), b"x").unwrap();
        let root = root.canonicalize().unwrap();

        let url = read_data_url(&root, &root.join("docs/pixel.png")).unwrap();
        assert_eq!(url, "data:image/png;base64,iVBORw==");

        assert!(read_data_url(&root, &root.join("docs/../../outside.png")).is_err());
        assert!(read_data_url(&root, &root.join("docs/missing.png")).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn refuses_symlinks_that_leave_the_root() {
        let dir = tempfile::TempDir::new().unwrap();
        let root = dir.path().join("root");
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(dir.path().join("secret.png"), b"x").unwrap();
        std::os::unix::fs::symlink(dir.path().join("secret.png"), root.join("link.png")).unwrap();
        let root = root.canonicalize().unwrap();
        let error = read_data_url(&root, &root.join("link.png")).unwrap_err();
        assert!(error.to_string().contains("outside the workspace"));
    }

    #[test]
    fn refuses_other_types_and_large_files() {
        let dir = tempfile::TempDir::new().unwrap();
        let root = dir.path().canonicalize().unwrap();
        std::fs::write(root.join("notes.txt"), b"hello").unwrap();
        assert!(read_data_url(&root, &root.join("notes.txt")).is_err());

        let big = std::fs::File::create(root.join("big.png")).unwrap();
        big.set_len(MAX_IMAGE_BYTES + 1).unwrap();
        let error = read_data_url(&root, &root.join("big.png")).unwrap_err();
        assert!(error.to_string().contains("larger than 10 MB"));

        let exact = std::fs::File::create(root.join("exact.gif")).unwrap();
        exact.set_len(MAX_IMAGE_BYTES).unwrap();
        assert!(read_data_url(&root, &root.join("exact.gif")).unwrap().starts_with("data:image/gif;base64,"));
    }
}
