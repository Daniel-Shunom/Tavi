//! In-app updates from GitHub Releases (tauri-plugin-updater).
//!
//! Shortly after launch Tavi Studio checks the signed `latest.json` on the latest release.
//! When a newer version exists the streamer is asked with a native dialog; nothing installs
//! without consent. Updating stops the bundled service first (its runtime files are replaced),
//! installs the verified bundle, and relaunches. A failed check is logged and ignored: the app
//! keeps working offline or before any signed release exists.
use std::time::Duration;

use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_updater::UpdaterExt;

/// Lets the studio window and service settle before the check, so it never slows startup.
const CHECK_DELAY: Duration = Duration::from_secs(8);

/// Starts the background check. `before_install` must release everything the installer
/// replaces (the bundled Node service).
pub fn spawn(app: AppHandle, before_install: impl FnOnce() + Send + 'static) {
    tauri::async_runtime::spawn(async move {
        tokio_sleep(CHECK_DELAY).await;
        if let Err(error) = check(&app, before_install).await {
            eprintln!("Tavi update check failed: {error}");
        }
    });
}

async fn tokio_sleep(duration: Duration) {
    // tauri's async runtime is tokio; a blocking sleep on a spawn_blocking thread avoids
    // depending on tokio's timer feature directly.
    let _ = tauri::async_runtime::spawn_blocking(move || std::thread::sleep(duration)).await;
}

async fn check(
    app: &AppHandle,
    before_install: impl FnOnce() + Send + 'static,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    if !self_updating() {
        return Ok(());
    }
    let Some(update) = app.updater()?.check().await? else {
        return Ok(());
    };
    let message = prompt(&update.current_version, &update.version);
    let dialog = app
        .dialog()
        .message(message)
        .title("Tavi Studio update")
        .kind(MessageDialogKind::Info)
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Update now".into(),
            "Later".into(),
        ));
    let accepted = tauri::async_runtime::spawn_blocking(move || dialog.blocking_show()).await?;
    if !accepted {
        return Ok(());
    }
    let bytes = update.download(|_, _| {}, || {}).await?;
    before_install();
    // Windows: hands over to the installer, which closes and relaunches Tavi Studio.
    if let Err(error) = update.install(bytes) {
        // The service is already stopped: tell the streamer, then restart on the current
        // version so the service (and the OBS overlay) come back.
        let dialog = app
            .dialog()
            .message(format!(
                "The update could not be installed ({error}).

Tavi Studio will restart on                  the current version."
            ))
            .title("Tavi Studio update")
            .kind(MessageDialogKind::Error);
        let _ = tauri::async_runtime::spawn_blocking(move || dialog.blocking_show()).await;
    }
    app.restart();
}

/// Linux updates only replace an AppImage (Tauri sets `APPIMAGE` when running one); .deb
/// installs update through the system package manager, so they never see an update prompt.
fn self_updating() -> bool {
    if cfg!(target_os = "linux") {
        std::env::var_os("APPIMAGE").is_some()
    } else {
        true
    }
}

fn prompt(current: &str, next: &str) -> String {
    format!(
        "Tavi Studio {next} is available (you have {current}).\n\n\
         Update now? Tavi Studio will close, update and reopen. Your character, settings and \
         OBS overlay link stay the same."
    )
}

#[cfg(test)]
mod tests {
    use super::prompt;

    #[test]
    fn prompt_names_both_versions_and_reassures_about_settings() {
        let text = prompt("0.1.0", "0.1.1");
        assert!(text.contains("0.1.1"));
        assert!(text.contains("0.1.0"));
        assert!(text.contains("settings"));
    }
}
