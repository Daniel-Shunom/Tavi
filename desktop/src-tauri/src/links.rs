//! Navigation policy for the studio window. Page JavaScript never gets an opener API;
//! instead the shell decides here which link targets may leave the app.
use tauri::Url;

#[derive(Debug, PartialEq, Eq)]
pub enum Target {
    /// Stay in the studio window.
    InApp,
    /// Open in the user's default browser.
    Browser,
    /// Ignore the navigation.
    Blocked,
}

fn same_origin(url: &Url, origin: &str) -> bool {
    Url::parse(origin).is_ok_and(|origin| url.origin() == origin.origin())
}

/// Same-origin pages that are useful outside the studio window: the OBS overlay preview and
/// third-party credits.
fn external_local_page(url: &Url) -> bool {
    url.path() == "/overlay" || url.path().starts_with("/credits/")
}

/// External sites the studio links to. Kept deliberately narrow.
fn trusted_external(url: &Url) -> bool {
    url.scheme() == "https"
        && url.port().is_none()
        && url.username().is_empty()
        && url.password().is_none()
        && ((url.host_str() == Some("www.twitch.tv") && url.path() == "/activate")
            || (url.host_str() == Some("auth.openai.com") && url.path() == "/api/accounts/authorize"))
}

pub fn classify(url: &Url, origin: &str) -> Target {
    if same_origin(url, origin) {
        if external_local_page(url) {
            Target::Browser
        } else {
            Target::InApp
        }
    } else if trusted_external(url) {
        Target::Browser
    } else {
        Target::Blocked
    }
}

/// Top-level navigation inside the studio window: same-origin pages stay in-app (including
/// the overlay, if a link navigates there without opening a new window).
pub fn navigation(url: &Url, origin: &str) -> Target {
    if same_origin(url, origin) {
        Target::InApp
    } else {
        classify(url, origin)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    const ORIGIN: &str = "http://127.0.0.1:4318";
    fn check(url: &str) -> Target {
        classify(&Url::parse(url).unwrap(), ORIGIN)
    }
    #[test]
    fn twitch_activation_opens_in_browser() {
        assert_eq!(check("https://www.twitch.tv/activate"), Target::Browser);
        assert_eq!(check("https://www.twitch.tv/activate?device-code=ABC"), Target::Browser);
    }
    #[test]
    fn other_external_urls_are_blocked() {
        for url in [
            "https://www.twitch.tv/somebody",
            "https://auth.openai.com.evil.example/api/accounts/authorize",
            "https://auth.openai.com/api/accounts/oauth/token",
            "http://www.twitch.tv/activate",
            "https://twitch.tv.evil.example/activate",
            "https://user@www.twitch.tv/activate",
            "https://www.twitch.tv:8443/activate",
            "file:///C:/Windows/System32/cmd.exe",
            "ms-settings:privacy",
            "http://127.0.0.1:5173/",
        ] {
            assert_eq!(check(url), Target::Blocked, "{url}");
        }
    }
    #[test]
    fn studio_pages() {
        assert_eq!(check("http://127.0.0.1:4318/"), Target::InApp);
        assert_eq!(check("http://127.0.0.1:4318/overlay"), Target::Browser);
        assert_eq!(check("http://127.0.0.1:4318/credits/rive-avatar.md"), Target::Browser);
        assert_eq!(
            navigation(&Url::parse("http://127.0.0.1:4318/overlay").unwrap(), ORIGIN),
            Target::InApp
        );
    }
    #[test]
    fn chatgpt_authorization_opens_in_browser() {
        assert_eq!(check("https://auth.openai.com/api/accounts/authorize?client_id=dynamic_agent_client"), Target::Browser);
    }
}
