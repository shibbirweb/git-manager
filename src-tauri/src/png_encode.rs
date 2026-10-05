//! A minimal PNG writer for the Windows screenshot: 8-bit RGBA, no filtering, zlib from flate2
//! (already a dependency for Local History), so no image crate ends up in the binary.

use std::io::Write;

use flate2::write::ZlibEncoder;
use flate2::{Compression, Crc};

const SIGNATURE: &[u8] = b"\x89PNG\r\n\x1a\n";

/// `rgba` holds `width * height` pixels, row by row from the top, 4 bytes each.
pub fn encode_rgba(width: u32, height: u32, rgba: &[u8]) -> std::io::Result<Vec<u8>> {
    let row_bytes = width as usize * 4;
    if width == 0 || height == 0 || rgba.len() != row_bytes * height as usize {
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidInput, "the pixels do not match the size"));
    }
    // Each row starts with its filter type; 0 is none.
    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::fast());
    for row in rgba.chunks_exact(row_bytes) {
        encoder.write_all(&[0])?;
        encoder.write_all(row)?;
    }
    let data = encoder.finish()?;

    let mut header = Vec::with_capacity(13);
    header.extend_from_slice(&width.to_be_bytes());
    header.extend_from_slice(&height.to_be_bytes());
    // Bit depth 8, color type 6 (RGBA), default compression, filtering and no interlace.
    header.extend_from_slice(&[8, 6, 0, 0, 0]);

    let mut png = SIGNATURE.to_vec();
    chunk(&mut png, b"IHDR", &header);
    chunk(&mut png, b"IDAT", &data);
    chunk(&mut png, b"IEND", &[]);
    Ok(png)
}

fn chunk(png: &mut Vec<u8>, kind: &[u8; 4], data: &[u8]) {
    png.extend_from_slice(&(data.len() as u32).to_be_bytes());
    png.extend_from_slice(kind);
    png.extend_from_slice(data);
    let mut crc = Crc::new();
    crc.update(kind);
    crc.update(data);
    png.extend_from_slice(&crc.sum().to_be_bytes());
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    /// The chunks of a PNG: kind and data, after checking every CRC.
    fn chunks(png: &[u8]) -> Vec<(String, Vec<u8>)> {
        assert_eq!(&png[..8], SIGNATURE);
        let mut found = Vec::new();
        let mut at = 8;
        while at < png.len() {
            let length = u32::from_be_bytes(png[at..at + 4].try_into().unwrap()) as usize;
            let kind = &png[at + 4..at + 8];
            let data = &png[at + 8..at + 8 + length];
            let mut crc = Crc::new();
            crc.update(kind);
            crc.update(data);
            assert_eq!(crc.sum().to_be_bytes(), png[at + 8 + length..at + 12 + length], "CRC of {}", String::from_utf8_lossy(kind));
            found.push((String::from_utf8_lossy(kind).into_owned(), data.to_vec()));
            at += 12 + length;
        }
        found
    }

    #[test]
    fn writes_a_valid_rgba_png_that_reads_back() {
        let (width, height) = (3u32, 2u32);
        let pixels: Vec<u8> = (0..width * height * 4).map(|index| (index * 7 % 256) as u8).collect();
        let png = encode_rgba(width, height, &pixels).unwrap();
        let found = chunks(&png);
        assert_eq!(found.iter().map(|(kind, _)| kind.as_str()).collect::<Vec<_>>(), ["IHDR", "IDAT", "IEND"]);
        assert_eq!(found[0].1, [0, 0, 0, 3, 0, 0, 0, 2, 8, 6, 0, 0, 0]);

        let mut raw = Vec::new();
        flate2::read::ZlibDecoder::new(found[1].1.as_slice()).read_to_end(&mut raw).unwrap();
        let rows: Vec<&[u8]> = raw.chunks(1 + width as usize * 4).collect();
        assert_eq!(rows.len(), 2);
        assert!(rows.iter().all(|row| row[0] == 0), "no filter");
        assert_eq!(rows.iter().flat_map(|row| row[1..].iter().copied()).collect::<Vec<_>>(), pixels);
    }

    #[test]
    fn refuses_pixels_that_do_not_match_the_size() {
        assert!(encode_rgba(2, 2, &[0; 15]).is_err());
        assert!(encode_rgba(0, 1, &[]).is_err());
    }
}
