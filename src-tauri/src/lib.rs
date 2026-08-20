pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![read_file, write_file, launch_path])
        .run(tauri::generate_context!())
        .expect("error while running Folio");
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(path, contents).map_err(|error| error.to_string())
}

#[tauri::command]
fn launch_path() -> Option<String> {
    std::env::args().skip(1).find(|path| {
        let path = path.to_ascii_lowercase();
        path.ends_with(".md") || path.ends_with(".markdown")
    })
}
