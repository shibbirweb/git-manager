//! Images and PDFs for the file preview. They go to the web view as raw bytes (no base64,
//! which would grow them by a third and keep a big string alive), where they become a blob
//! URL that the preview frees when its tab closes. Only files inside the workspace folder.

use std::path::Path;

use crate::error::{AppError, AppResult};

/// Bigger images are refused: the decoded picture takes several times the file size.
pub const MAX_IMAGE_PREVIEW_BYTES: u64 = 50 * 1024 * 1024;
/// WebKit's PDF view pages through the document, but the bytes still sit in memory once.
pub const MAX_PDF_PREVIEW_BYTES: u64 = 100 * 1024 * 1024;

/// The media type of a file the preview can show, by extension. SVG is left out on purpose:
/// it is text, so it opens in the editor.
pub fn preview_mime(file_path: &Path) -> Option<&'static str> {
    let extension = file_path.extension()?.to_str()?.to_ascii_lowercase();
    match extension.as_str() {
        "png" => Some("image/png"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "gif" => Some("image/gif"),
        "webp" => Some("image/webp"),
        "bmp" => Some("image/bmp"),
        "ico" => Some("image/x-icon"),
        "avif" => Some("image/avif"),
        "pdf" => Some("application/pdf"),
        _ => None,
    }
}

fn limit_for(mime: &str) -> u64 {
    if mime == "application/pdf" {
        MAX_PDF_PREVIEW_BYTES
    } else {
        MAX_IMAGE_PREVIEW_BYTES
    }
}

/// Reads an image or PDF for the preview. `root` must be canonical; the file must resolve
/// inside it (symlinks included), be a type the preview shows and fit its size limit.
pub fn read_preview(root: &Path, full_path: &Path) -> AppResult<Vec<u8>> {
    let mime = preview_mime(full_path).ok_or_else(|| AppError::invalid("Not an image or PDF the preview can show"))?;
    let resolved = full_path.canonicalize()?;
    if !resolved.starts_with(root) {
        return Err(AppError::invalid("The file is outside the workspace"));
    }
    let metadata = std::fs::metadata(&resolved)?;
    if !metadata.is_file() {
        return Err(AppError::invalid("Not a file"));
    }
    let limit = limit_for(mime);
    if metadata.len() > limit {
        return Err(AppError::invalid(format!(
            "The file is larger than {} MB, too big to preview",
            limit / 1024 / 1024
        )));
    }
    // The file can grow between the size check and the read; never send more than the limit.
    let bytes = std::fs::read(&resolved)?;
    if bytes.len() as u64 > limit {
        return Err(AppError::invalid("The file is too big to preview"));
    }
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn knows_previewable_types_by_extension() {
        assert_eq!(preview_mime(Path::new("a/logo.PNG")), Some("image/png"));
        assert_eq!(preview_mime(Path::new("photo.jpeg")), Some("image/jpeg"));
        assert_eq!(preview_mime(Path::new("photo.JPG")), Some("image/jpeg"));
        assert_eq!(preview_mime(Path::new("favicon.ico")), Some("image/x-icon"));
        assert_eq!(preview_mime(Path::new("manual.pdf")), Some("application/pdf"));
        assert_eq!(preview_mime(Path::new("icon.svg")), None);
        assert_eq!(preview_mime(Path::new("notes.txt")), None);
        assert_eq!(preview_mime(Path::new("Makefile")), None);
    }

    #[test]
    fn reads_files_inside_the_root_only() {
        let dir = tempfile::TempDir::new().unwrap();
        let root = dir.path().join("root");
        std::fs::create_dir_all(root.join("docs")).unwrap();
        std::fs::write(root.join("docs/manual.pdf"), b"%PDF-1.7").unwrap();
        std::fs::write(dir.path().join("outside.png"), b"x").unwrap();
        let root = root.canonicalize().unwrap();

        assert_eq!(read_preview(&root, &root.join("docs/manual.pdf")).unwrap(), b"%PDF-1.7");
        assert!(read_preview(&root, &root.join("docs/../../outside.png")).is_err());
        assert!(read_preview(&root, &root.join("docs/missing.png")).is_err());
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
        let error = read_preview(&root, &root.join("link.png")).unwrap_err();
        assert!(error.to_string().contains("outside the workspace"));
    }

    #[test]
    fn refuses_other_types_and_files_over_the_limit() {
        let dir = tempfile::TempDir::new().unwrap();
        let root = dir.path().canonicalize().unwrap();
        std::fs::write(root.join("notes.txt"), b"hello").unwrap();
        assert!(read_preview(&root, &root.join("notes.txt")).is_err());

        let big = std::fs::File::create(root.join("huge.png")).unwrap();
        big.set_len(MAX_IMAGE_PREVIEW_BYTES + 1).unwrap();
        let error = read_preview(&root, &root.join("huge.png")).unwrap_err();
        assert!(error.to_string().contains("too big to preview"));

        // A PDF may be bigger than the image limit.
        let pdf = std::fs::File::create(root.join("book.pdf")).unwrap();
        pdf.set_len(MAX_IMAGE_PREVIEW_BYTES + 1).unwrap();
        assert_eq!(read_preview(&root, &root.join("book.pdf")).unwrap().len() as u64, MAX_IMAGE_PREVIEW_BYTES + 1);
    }
}
