//! Images and PDFs for the file preview and the binary diff preview: which files they show
//! and how big they may be. The bytes travel by the `gmpreview` scheme (preview_scheme.rs).

use std::path::Path;

/// Bigger images are refused: the decoded picture takes several times the file size.
pub const MAX_IMAGE_PREVIEW_BYTES: u64 = 50 * 1024 * 1024;
/// A PDF sent in one piece (a git blob, or a work tree file asked for without a range) sits in
/// memory once; range requests of a work tree PDF have no limit.
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

/// The most a file of this type may have when it is held in memory whole.
pub fn limit_for(mime: &str) -> u64 {
    if mime == "application/pdf" {
        MAX_PDF_PREVIEW_BYTES
    } else {
        MAX_IMAGE_PREVIEW_BYTES
    }
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
    fn a_pdf_may_be_bigger_than_an_image() {
        assert_eq!(limit_for("image/png"), MAX_IMAGE_PREVIEW_BYTES);
        assert_eq!(limit_for("application/pdf"), MAX_PDF_PREVIEW_BYTES);
    }
}
