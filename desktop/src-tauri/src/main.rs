#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod links;
#[cfg(windows)]
mod win;

use std::{
    io::{Read, Write},
    net::{SocketAddr, TcpStream},
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

/// The OBS overlay URL streamers paste into OBS depends on this port, so it is fixed by
/// default. `TAVI_PORT` overrides it for testing next to a running development server.
const DEFAULT_PORT: u16 = 4318;
const STUDIO_LABEL: &str = "studio";

fn port() -> u16 {
    std::env::var("TAVI_PORT")
        .ok()
        .and_then(|value| value.parse().ok())
        .filter(|port| *port != 0)
        .unwrap_or(DEFAULT_PORT)
}

struct Service(Mutex<Option<Child>>);
impl Service {
    fn stop(&self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(mut process) = guard.take() {
                let _ = process.kill();
                let _ = process.wait();
            }
        }
    }
}
impl Drop for Service {
    fn drop(&mut self) {
        self.stop();
    }
}

fn address() -> SocketAddr {
    SocketAddr::from(([127, 0, 0, 1], port()))
}

fn port_in_use() -> bool {
    TcpStream::connect_timeout(&address(), Duration::from_millis(200)).is_ok()
}

fn healthy() -> bool {
    let Ok(mut stream) = TcpStream::connect_timeout(&address(), Duration::from_millis(200)) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
    if stream
        .write_all(b"GET /api/health HTTP/1.0\r\nHost: 127.0.0.1\r\n\r\n")
        .is_err()
    {
        return false;
    }
    let mut response = String::new();
    stream.read_to_string(&mut response).is_ok()
        && response.starts_with("HTTP/1.1 200")
        && response.contains("\"name\":\"Tavi\"")
}

/// Shows a blocking native error dialog. Release builds have no console, so every startup
/// failure must be surfaced this way rather than as a silent exit.
fn report(message: &str) {
    #[cfg(windows)]
    win::error_dialog("Tavi Studio", message);
    #[cfg(not(windows))]
    eprintln!("Tavi Studio: {message}");
}

fn start_service(app: &tauri::App) -> Result<(), String> {
    if port_in_use() {
        let address = address();
        return Err(format!(
            "Tavi Studio could not start because port {} is already in use.\n\n\
             Another program (for example a Tavi development server started with \
             `npm run dev`) is using {address}. Close it and open Tavi Studio again.",
            address.port()
        ));
    }
    // Tauri returns verbatim `\\?\C:\...` paths on Windows. Node cannot resolve its entry
    // script from such a path (EISDIR on `C:`), so pass ordinary paths to the service.
    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
    let resources = dunce::simplified(&resource_dir).join("resources");
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let data = dunce::simplified(&data_dir).to_path_buf();
    std::fs::create_dir_all(&data)
        .map_err(|e| format!("Could not create the data folder {}: {e}", data.display()))?;
    let log_path = data.join("service.log");
    let log = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|e| format!("Could not open {}: {e}", log_path.display()))?;
    let stderr = log.try_clone().map_err(|e| e.to_string())?;
    let node = resources.join("runtime").join("node.exe");
    let mut command = Command::new(&node);
    command
        .arg(resources.join("service").join("server.mjs"))
        .env("TAVI_DATA_DIR", &data)
        .env("TAVI_PORT", port().to_string())
        .env("TAVI_VERSION", app.package_info().version.to_string())
        .current_dir(resources.join("service"))
        .stdin(Stdio::null())
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(stderr));
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    let child = command
        .spawn()
        .map_err(|e| format!("Could not start the bundled service ({}): {e}", node.display()))?;
    // Bind the service's lifetime to ours so it also stops if Tavi crashes or is killed.
    #[cfg(windows)]
    if let Err(error) = win::kill_with_parent(&child) {
        eprintln!("Could not attach service to a job object: {error}");
    }
    let state = app.state::<Service>();
    *state.0.lock().unwrap() = Some(child);
    let start = Instant::now();
    let failure = |reason: &str| {
        format!(
            "{reason}\n\nDetails are in the service log:\n{}",
            log_path.display()
        )
    };
    while !healthy() {
        if let Some(child) = state.0.lock().unwrap().as_mut() {
            if let Ok(Some(status)) = child.try_wait() {
                return Err(failure(&format!("The Tavi service stopped unexpectedly ({status}).")));
            }
        }
        if start.elapsed() > Duration::from_secs(20) {
            state.stop();
            return Err(failure("The Tavi service did not start within 20 seconds."));
        }
        std::thread::sleep(Duration::from_millis(100));
    }
    Ok(())
}

fn main() {
    let builder = tauri::Builder::default()
        // Must be registered first: a second launch focuses the running studio and exits
        // before it can try to start a second service.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window(STUDIO_LABEL) {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        // Used from Rust only. No capability grants page JavaScript access to it.
        .plugin(tauri_plugin_opener::init())
        .manage(Service(Mutex::new(None)))
        .setup(|app| {
            if !cfg!(debug_assertions) {
                if let Err(message) = start_service(app) {
                    report(&message);
                    std::process::exit(1);
                }
            }
            let origin: &'static str = if cfg!(debug_assertions) {
                "http://127.0.0.1:5173"
            } else {
                // Leaked once at startup so the navigation handlers can borrow it.
                Box::leak(format!("http://127.0.0.1:{}", port()).into_boxed_str())
            };
            let navigate_handle = app.handle().clone();
            let popup_handle = app.handle().clone();
            let window = WebviewWindowBuilder::new(
                app,
                STUDIO_LABEL,
                WebviewUrl::External(origin.parse()?),
            )
            .title("Tavi Studio")
            .inner_size(1360.0, 900.0)
            .min_inner_size(960.0, 600.0)
            .visible(false)
            .on_navigation(move |url| match links::navigation(url, origin) {
                links::Target::InApp => true,
                links::Target::Browser => {
                    let _ = navigate_handle.opener().open_url(url.as_str(), None::<&str>);
                    false
                }
                links::Target::Blocked => false,
            })
            .on_new_window(move |url, _features| {
                if links::classify(&url, origin) != links::Target::Blocked {
                    let _ = popup_handle.opener().open_url(url.as_str(), None::<&str>);
                }
                tauri::webview::NewWindowResponse::Deny
            })
            .build()?;
            fit_to_monitor(&window);
            window.show()?;
            Ok(())
        });
    let app = match builder.build(tauri::generate_context!()) {
        Ok(app) => app,
        Err(error) => {
            report(&format!("Tavi Studio could not start: {error}"));
            std::process::exit(1);
        }
    };
    app.run(|app, event| {
        if matches!(event, tauri::RunEvent::Exit) {
            app.state::<Service>().stop();
        }
    });
}

/// Keeps the default window inside small laptop screens instead of overflowing them.
fn fit_to_monitor(window: &tauri::WebviewWindow) {
    let Ok(Some(monitor)) = window.current_monitor() else {
        return;
    };
    let scale = monitor.scale_factor();
    let area = monitor.work_area().size.to_logical::<f64>(scale);
    let width = (area.width * 0.92).clamp(960.0, 1360.0);
    let height = (area.height * 0.92).clamp(600.0, 900.0);
    let _ = window.set_size(tauri::LogicalSize::new(width, height));
    let _ = window.center();
}
