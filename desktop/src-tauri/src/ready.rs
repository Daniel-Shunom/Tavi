/// Only readiness messages from our child's stdout can select the Studio origin.
pub fn port_from_line(line: &str) -> Option<u16> {
    let json = line.strip_prefix("TAVI_READY ")?;
    let value: serde_json::Value = serde_json::from_str(json).ok()?;
    u16::try_from(value.get("port")?.as_u64()?)
        .ok()
        .filter(|port| *port != 0)
}

#[cfg(test)]
mod tests {
    use super::port_from_line;
    #[test]
    fn accepts_a_bound_port_from_the_ready_message() {
        assert_eq!(port_from_line(r#"TAVI_READY {"port":49152}"#), Some(49152));
    }
    #[test]
    fn rejects_logs_malformed_messages_and_invalid_ports() {
        for line in [
            r#"{"port":4318}"#,
            "TAVI_READY nope",
            r#"TAVI_READY {"port":0}"#,
            r#"TAVI_READY {"port":65536}"#,
            r#"TAVI_READY {"port":"4318"}"#,
        ] {
            assert_eq!(port_from_line(line), None);
        }
    }
}
