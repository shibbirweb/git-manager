//! The two time formats the usage readers meet: ISO 8601 timestamps from Anthropic and epoch seconds from Codex.

/// Now, in ms since the epoch.
pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as i64)
        .unwrap_or_default()
}

/// Days since 1970-01-01 of a civil date (Howard Hinnant's algorithm).
fn days_from_civil(year: i64, month: i64, day: i64) -> i64 {
    let year = if month <= 2 { year - 1 } else { year };
    let era = if year >= 0 { year } else { year - 399 } / 400;
    let year_of_era = year - era * 400;
    let month_index = (month + 9) % 12;
    let day_of_year = (153 * month_index + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    era * 146_097 + day_of_era - 719_468
}

fn number(text: &str) -> Option<i64> {
    if text.is_empty() || !text.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    text.parse().ok()
}

/// "2026-10-11T15:00:00.123456+00:00" or "...Z" in ms since the epoch; None for anything else.
pub fn parse_iso_ms(text: &str) -> Option<i64> {
    let text = text.trim();
    let (date, rest) = text.split_once(['T', ' '])?;
    let mut date_parts = date.split('-');
    let year = number(date_parts.next()?)?;
    let month = number(date_parts.next()?)?;
    let day = number(date_parts.next()?)?;
    if date_parts.next().is_some() || !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return None;
    }
    let (clock, offset_minutes) = if let Some(clock) = rest.strip_suffix(['Z', 'z']) {
        (clock, 0)
    } else if let Some(index) = rest.rfind(['+', '-']) {
        let (clock, offset) = rest.split_at(index);
        let sign = if offset.starts_with('-') { -1 } else { 1 };
        let (hours, minutes) = offset[1..].split_once(':').unwrap_or((&offset[1..], "0"));
        (clock, sign * (number(hours)? * 60 + number(minutes)?))
    } else {
        (rest, 0)
    };
    let (whole, fraction) = clock.split_once('.').unwrap_or((clock, ""));
    let mut clock_parts = whole.split(':');
    let hour = number(clock_parts.next()?)?;
    let minute = number(clock_parts.next()?)?;
    let second = clock_parts.next().map(number).unwrap_or(Some(0))?;
    if hour > 23 || minute > 59 || second > 60 {
        return None;
    }
    let millis = if fraction.is_empty() {
        0
    } else {
        let digits: String = fraction.chars().chain("000".chars()).take(3).collect();
        number(&digits)?
    };
    let seconds = days_from_civil(year, month, day) * 86_400 + hour * 3_600 + minute * 60 + second - offset_minutes * 60;
    Some(seconds * 1_000 + millis)
}

/// A reset time as Anthropic or Codex give it: ISO text, epoch seconds or epoch ms.
pub fn reset_ms(value: &serde_json::Value) -> Option<i64> {
    match value {
        serde_json::Value::Number(number) => {
            let raw = number.as_f64()?;
            // Seconds stay below 1e10 until the year 2286; anything bigger is already ms.
            Some(if raw > 1e10 { raw as i64 } else { (raw * 1_000.0) as i64 })
        }
        serde_json::Value::String(text) => match text.trim().parse::<f64>() {
            Ok(raw) => Some(if raw > 1e10 { raw as i64 } else { (raw * 1_000.0) as i64 }),
            Err(_) => parse_iso_ms(text),
        },
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_iso_timestamps_with_offsets_and_fractions() {
        assert_eq!(parse_iso_ms("1970-01-01T00:00:00Z"), Some(0));
        assert_eq!(parse_iso_ms("2026-10-11T15:00:00Z"), Some(1_791_730_800_000));
        assert_eq!(parse_iso_ms("2026-10-11T15:00:00.123456+00:00"), Some(1_791_730_800_123));
        assert_eq!(parse_iso_ms("2026-10-11T17:00:00+02:00"), Some(1_791_730_800_000));
        assert_eq!(parse_iso_ms("2026-10-11T10:30:00-04:30"), Some(1_791_730_800_000));
        assert_eq!(parse_iso_ms("2024-02-29T00:00:00Z"), Some(1_709_164_800_000));
    }

    #[test]
    fn refuses_what_is_not_a_timestamp() {
        for text in ["", "soon", "2026-13-01T00:00:00Z", "2026-10-11", "2026-10-11T25:00:00Z", "2026-10-1xT00:00:00Z"] {
            assert_eq!(parse_iso_ms(text), None, "{text}");
        }
    }

    #[test]
    fn reads_reset_times_in_any_unit() {
        assert_eq!(reset_ms(&json!(1_791_730_800)), Some(1_791_730_800_000));
        assert_eq!(reset_ms(&json!(1_791_730_800_000_i64)), Some(1_791_730_800_000));
        assert_eq!(reset_ms(&json!("1791730800")), Some(1_791_730_800_000));
        assert_eq!(reset_ms(&json!("2026-10-11T15:00:00Z")), Some(1_791_730_800_000));
        assert_eq!(reset_ms(&json!(null)), None);
    }
}
