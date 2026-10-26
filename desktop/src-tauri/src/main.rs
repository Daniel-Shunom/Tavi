#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{
    io::{Read, Write},
    net::{SocketAddr, TcpStream},
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::Manager;

struct Service(Mutex<Option<Child>>);
impl Drop for Service {
    fn drop(&mut self) {
        if let Ok(child) = self.0.get_mut() {
            if let Some(mut process) = child.take() {
                let _ = process.kill();
                let _ = process.wait();
            }
        }
    }
}
fn healthy() -> bool {
    let address: SocketAddr = "127.0.0.1:4318".parse().unwrap();
    let Ok(mut stream) = TcpStream::connect_timeout(&address, Duration::from_millis(200)) else {
        return false;
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(300)));
    if stream
        .write_all(b"GET /api/health HTTP/1.0\r\nHost: 127.0.0.1\r\n\r\n")
        .is_err()
    {
        return false;
    }
    let mut response = String::new();
    stream.read_to_string(&mut response).is_ok()
        && response.starts_with("HTTP/1.1 200")
        && response.contains("Tavi")
}
fn main() {
    tauri::Builder::default()
        .manage(Service(Mutex::new(None)))
        .setup(|app| {
            if !cfg!(debug_assertions) {
                if TcpStream::connect_timeout(&"127.0.0.1:4318".parse().unwrap(), Duration::from_millis(200)).is_ok() {
                    return Err("Port 4318 is already in use. Close the other Tavi instance or local service and retry.".into());
                }
                let resources = app.path().resource_dir()?.join("resources");
                let data = app.path().app_data_dir()?;
                std::fs::create_dir_all(&data)?;
                let log = std::fs::OpenOptions::new().create(true).append(true).open(data.join("service.log"))?;
                let executable = if cfg!(windows) { "node.exe" } else { "node" };
                let mut command = Command::new(resources.join("runtime").join(executable));
                command.arg(resources.join("service/server.mjs"))
                    .env("TAVI_DATA_DIR", &data).current_dir(resources.join("service"))
                    .stdin(Stdio::null()).stdout(Stdio::from(log.try_clone()?)).stderr(Stdio::from(log));
                #[cfg(windows)] { use std::os::windows::process::CommandExt; command.creation_flags(0x08000000); }
                let child = command.spawn()?;
                *app.state::<Service>().0.lock().unwrap() = Some(child);
                let start = Instant::now();
                while !healthy() {
                    if let Some(child) = app.state::<Service>().0.lock().unwrap().as_mut() {
                        if child.try_wait()?.is_some() { return Err("Tavi service exited. Check service.log in the app data folder.".into()); }
                    }
                    if start.elapsed() > Duration::from_secs(15) { return Err("Tavi service did not start within 15 seconds. Check service.log.".into()); }
                    std::thread::sleep(Duration::from_millis(100));
                }
            }
            let url = if cfg!(debug_assertions) { "http://127.0.0.1:5173" } else { "http://127.0.0.1:4318" };
            tauri::WebviewWindowBuilder::new(app, "studio", tauri::WebviewUrl::External(url.parse()?))
                .title("Tavi Studio").inner_size(1360.0, 900.0).min_inner_size(1000.0, 680.0)
                .build()?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Could not initialize Tavi Studio")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                if let Some(mut child) = app.state::<Service>().0.lock().unwrap().take() {
                    let _ = child.kill(); let _ = child.wait();
                }
            }
        });
}
