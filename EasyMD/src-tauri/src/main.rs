#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

struct AppState {
    open_arg: Mutex<Option<String>>,
    trusted_dirs: Mutex<HashSet<PathBuf>>,
}

const BACKUP_DIR: &str = ".easymd-bak";
const MAX_BACKUPS: usize = 5;

fn now_unix_nanos() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0)
}

/// Convert unix nanos to "YYYYMMDD-HHMMSSmmm" in UTC+8 for readable,
/// chronologically sortable backup names.
fn format_timestamp(nanos: u128) -> String {
    let secs = u64::try_from(nanos / 1_000_000_000).unwrap_or(u64::MAX);
    let millis = u32::try_from((nanos % 1_000_000_000) / 1_000_000).unwrap_or(0);
    let secs = secs + 8 * 3600;
    let days = (secs / 86400) as i64;
    let rem = (secs % 86400) as i64;
    let (h, m, s) = (rem / 3600, (rem % 3600) / 60, rem % 60);
    // Howard Hinnant's civil_from_days algorithm.
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let mth = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if mth <= 2 { y + 1 } else { y };
    format!("{y:04}{mth:02}{d:02}-{h:02}{m:02}{s:02}{millis:03}")
}

fn mtime_ns(path: &Path) -> Option<u64> {
    let meta = std::fs::metadata(path).ok()?;
    let t = meta.modified().ok()?;
    let d = t.duration_since(UNIX_EPOCH).ok()?;
    Some(d.as_nanos() as u64)
}

fn canonical_dir(path: &Path) -> Result<PathBuf, String> {
    let dir = path
        .parent()
        .ok_or_else(|| "path has no parent directory".to_string())?;
    std::fs::canonicalize(dir).map_err(|e| format!("cannot resolve directory: {e}"))
}

fn ensure_trusted(state: &AppState, path: &Path) -> Result<(), String> {
    let dir = canonical_dir(path)?;
    let ok = state
        .trusted_dirs
        .lock()
        .expect("trusted dirs poisoned")
        .contains(&dir);
    if ok {
        Ok(())
    } else {
        Err("path not trusted".to_string())
    }
}

fn atomic_write(target: &Path, bytes: &[u8]) -> Result<(), String> {
    let dir = target
        .parent()
        .ok_or_else(|| "target has no parent directory".to_string())?;
    std::fs::create_dir_all(dir).map_err(|e| format!("mkdir failed: {e}"))?;
    let tmp = dir.join(format!(".easymd-tmp-{}-{}", std::process::id(), now_unix_nanos()));
    if let Err(e) = std::fs::write(&tmp, bytes) {
        let _ = std::fs::remove_file(&tmp);
        return Err(format!("write temp file failed: {e}"));
    }
    let result = if target.exists() {
        replace_file(&tmp, target)
    } else {
        std::fs::rename(&tmp, target).map_err(|e| format!("rename temp file failed: {e}"))
    };
    if let Err(e) = result {
        let _ = std::fs::remove_file(&tmp);
        return Err(format!("rename temp file failed: {e}"));
    }
    Ok(())
}

/// Windows can replace an existing file atomically instead of using the
/// remove-then-rename sequence, which leaves a crash window with no target.
#[cfg(windows)]
fn replace_file(source: &Path, target: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Foundation::GetLastError;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    fn wide(path: &Path) -> Vec<u16> {
        path.as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    let from = wide(source);
    let to = wide(target);
    let ok = unsafe {
        MoveFileExW(
            from.as_ptr(),
            to.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if ok == 0 {
        return Err(format!("atomic replace failed: {}", unsafe { GetLastError() }));
    }
    Ok(())
}

#[cfg(not(windows))]
fn replace_file(source: &Path, target: &Path) -> Result<(), String> {
    std::fs::rename(source, target)
        .map_err(|e| format!("rename temp file failed: {e}"))
}

/// Copy the current file into the per-directory backup folder and prune older
/// backups of the same file, keeping the newest MAX_BACKUPS.
fn backup_existing(target: &Path) -> Result<(), String> {
    if !target.exists() {
        return Ok(());
    }
    let parent = target
        .parent()
        .ok_or_else(|| "target has no parent directory".to_string())?;
    let backup_dir = parent.join(BACKUP_DIR);
    std::fs::create_dir_all(&backup_dir).map_err(|e| format!("mkdir backup failed: {e}"))?;
    let name = target
        .file_name()
        .ok_or_else(|| "target has no file name".to_string())?
        .to_string_lossy()
        .to_string();
    let now_nanos = now_unix_nanos();
    let mut backup = backup_dir.join(format!("{name}.{}.bak", format_timestamp(now_nanos)));
    let mut seq = 2u32;
    while backup.exists() {
        backup = backup_dir.join(format!(
            "{name}.{}-{seq}.bak",
            format_timestamp(now_nanos)
        ));
        seq += 1;
    }
    std::fs::copy(target, &backup).map_err(|e| format!("backup failed: {e}"))?;
    let prefix = format!("{name}.");
    let mut mine: Vec<PathBuf> = std::fs::read_dir(&backup_dir)
        .map_err(|e| format!("read backup dir failed: {e}"))?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| {
            p.is_file()
                && p.file_name()
                    .map(|f| f.to_string_lossy().starts_with(&prefix))
                    .unwrap_or(false)
        })
        .collect();
    mine.sort();
    mine.reverse();
    for old in mine.iter().skip(MAX_BACKUPS) {
        let _ = std::fs::remove_file(old);
    }
    Ok(())
}

#[cfg(windows)]
mod singleton {
    use std::ptr::{null, null_mut};
    use std::time::Duration;
    use tauri::{Emitter, Manager};
    use windows_sys::Win32::Foundation::{
        CloseHandle, GetLastError, ERROR_ALREADY_EXISTS, GENERIC_WRITE, INVALID_HANDLE_VALUE,
    };
    use windows_sys::Win32::Storage::FileSystem::{
        CreateFileW, ReadFile, WriteFile, FILE_SHARE_READ, OPEN_EXISTING, PIPE_ACCESS_INBOUND,
    };
    use windows_sys::Win32::System::Pipes::{
        ConnectNamedPipe, CreateNamedPipeW, PIPE_TYPE_BYTE, PIPE_WAIT, PIPE_UNLIMITED_INSTANCES,
    };
    use windows_sys::Win32::System::Threading::CreateMutexW;

    const MUTEX_NAME: &str = "Local\\com.lmworkstation.easymd.single-instance";
    const PIPE_NAME: &str = "\\\\.\\pipe\\com.lmworkstation.easymd.open-file";

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    /// Returns Some(handle) when this is the first instance. The handle is
    /// intentionally never closed: it must stay alive for the whole process.
    pub fn acquire() -> Option<isize> {
        let name = wide(MUTEX_NAME);
        unsafe {
            let h = CreateMutexW(null(), 0, name.as_ptr());
            if h.is_null() || h == INVALID_HANDLE_VALUE {
                return None;
            }
            if GetLastError() == ERROR_ALREADY_EXISTS {
                CloseHandle(h);
                return None;
            }
            Some(h as isize)
        }
    }

    pub fn spawn_server(app: tauri::AppHandle) {
        std::thread::spawn(move || loop {
            unsafe {
                let name = wide(PIPE_NAME);
                let server = CreateNamedPipeW(
                    name.as_ptr(),
                    PIPE_ACCESS_INBOUND,
                    PIPE_TYPE_BYTE | PIPE_WAIT,
                    PIPE_UNLIMITED_INSTANCES,
                    4096,
                    4096,
                    0,
                    null_mut(),
                );
                if server.is_null() || server == INVALID_HANDLE_VALUE {
                    std::thread::sleep(Duration::from_millis(200));
                    continue;
                }
                ConnectNamedPipe(server, null_mut());
                let mut buf = [0u8; 4096];
                let mut read: u32 = 0;
                ReadFile(
                    server,
                    buf.as_mut_ptr().cast(),
                    buf.len() as u32,
                    &mut read,
                    null_mut(),
                );
                CloseHandle(server);
                let path = String::from_utf8_lossy(&buf[..read as usize]).trim().to_string();
                if !path.is_empty() {
                    let _ = app.emit("open-file", path);
                }
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.set_focus();
                }
            }
        });
    }

    pub fn send_open_request(path: &str) {
        let name = wide(PIPE_NAME);
        let data = path.as_bytes();
        unsafe {
            for _ in 0..40 {
                let h = CreateFileW(
                    name.as_ptr(),
                    GENERIC_WRITE,
                    FILE_SHARE_READ,
                    null(),
                    OPEN_EXISTING,
                    0,
                    null_mut(),
                );
                if !h.is_null() && h != INVALID_HANDLE_VALUE {
                    let mut written: u32 = 0;
                    WriteFile(h, data.as_ptr().cast(), data.len() as u32, &mut written, null_mut());
                    CloseHandle(h);
                    return;
                }
                std::thread::sleep(Duration::from_millis(50));
            }
        }
    }
}

#[tauri::command]
fn get_open_file_arg(state: tauri::State<AppState>) -> Option<String> {
    state.open_arg.lock().expect("open file arg poisoned").clone()
}

#[tauri::command]
fn trust_directory(state: tauri::State<AppState>, path: String) -> Result<(), String> {
    let dir = canonical_dir(Path::new(&path))?;
    state
        .trusted_dirs
        .lock()
        .expect("trusted dirs poisoned")
        .insert(dir);
    Ok(())
}

#[derive(serde::Serialize)]
struct ReadFileResult {
    contents_base64: String,
    mtime_ns: Option<u64>,
}

#[tauri::command]
fn read_file_bytes(state: tauri::State<AppState>, path: String) -> Result<ReadFileResult, String> {
    use base64::engine::general_purpose::STANDARD as BASE64;
    use base64::Engine as _;

    let p = Path::new(&path);
    ensure_trusted(state.inner(), p)?;
    let bytes = std::fs::read(p).map_err(|e| format!("read failed: {e}"))?;
    Ok(ReadFileResult {
        contents_base64: BASE64.encode(bytes),
        mtime_ns: mtime_ns(p),
    })
}

/// Returns the new mtime (nanoseconds) so the frontend can detect external
/// modifications on the next save.
#[tauri::command]
fn write_text_file(
    state: tauri::State<AppState>,
    path: String,
    contents: String,
    expected_mtime_ns: Option<u64>,
) -> Result<u64, String> {
    let p = Path::new(&path);
    ensure_trusted(state.inner(), p)?;
    if let Some(expected) = expected_mtime_ns {
        match mtime_ns(p) {
            Some(current) if current == expected => {}
            _ => return Err("external modified".to_string()),
        }
    }
    backup_existing(p)?;
    atomic_write(p, contents.as_bytes())?;
    mtime_ns(p).ok_or_else(|| "cannot read new mtime".to_string())
}

fn session_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app data dir failed: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("mkdir session failed: {e}"))?;
    Ok(dir.join("session.json"))
}

#[tauri::command]
fn save_session(app: tauri::AppHandle, json: String) -> Result<(), String> {
    atomic_write(&session_path(&app)?, json.as_bytes())
}

#[tauri::command]
fn load_session(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = session_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    std::fs::read_to_string(&path)
        .map(Some)
        .map_err(|e| format!("read session failed: {e}"))
}

fn find_same_content(dir: &Path, bytes: &[u8]) -> Option<PathBuf> {
    for entry in std::fs::read_dir(dir).ok()? {
        let entry = entry.ok()?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        if std::fs::read(&path).map(|existing| existing == bytes).unwrap_or(false) {
            return Some(path);
        }
    }
    None
}

#[tauri::command]
fn save_image_file(
    state: tauri::State<AppState>,
    doc_path: String,
    file_name: String,
    contents_base64: String,
) -> Result<String, String> {
    use base64::engine::general_purpose::STANDARD as BASE64;
    use base64::Engine as _;

    let bytes = BASE64
        .decode(contents_base64.as_bytes())
        .map_err(|e| format!("decode failed: {e}"))?;
    let doc = Path::new(&doc_path);
    ensure_trusted(state.inner(), doc)?;
    let dir = doc
        .parent()
        .ok_or_else(|| "document has no parent dir".to_string())?
        .join("assets");
    std::fs::create_dir_all(&dir).map_err(|e| format!("mkdir failed: {e}"))?;

    if let Some(existing) = find_same_content(&dir, &bytes) {
        let name = existing
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        if !name.is_empty() {
            return Ok(format!("assets/{name}"));
        }
    }

    let safe: String = file_name
        .chars()
        .map(|c| {
            if matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') {
                '_'
            } else {
                c
            }
        })
        .collect();
    let path = Path::new(if safe.is_empty() { "image.png" } else { &safe });
    let stem = path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "image".into());
    let ext = path
        .extension()
        .map(|s| s.to_string_lossy().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "png".into());

    let mut final_name = format!("{stem}.{ext}");
    let mut i = 1;
    while dir.join(&final_name).exists() {
        final_name = format!("{stem}-{i}.{ext}");
        i += 1;
    }
    atomic_write(&dir.join(&final_name), &bytes)?;
    Ok(format!("assets/{final_name}"))
}

#[tauri::command]
fn read_file_base64(state: tauri::State<AppState>, path: String) -> Result<String, String> {
    use base64::engine::general_purpose::STANDARD as BASE64;
    use base64::Engine as _;

    let p = Path::new(&path);
    ensure_trusted(state.inner(), p)?;
    let bytes = std::fs::read(p).map_err(|e| format!("read failed: {e}"))?;
    Ok(BASE64.encode(bytes))
}

fn parse_reg_query_value(output: &str) -> Option<String> {
    output.lines().find_map(|line| {
        let mut parts = line.splitn(2, "REG_SZ");
        let _before = parts.next()?;
        let value = parts.next()?.trim();
        if value.is_empty() {
            None
        } else {
            Some(value.to_string())
        }
    })
}

fn reg_query_default(key: &str) -> Option<String> {
    let out = std::process::Command::new("reg")
        .args(["query", key, "/ve"])
        .output()
        .ok()?;
    parse_reg_query_value(&String::from_utf8_lossy(&out.stdout))
}

fn reg_query_named(key: &str, name: &str) -> Option<String> {
    let out = std::process::Command::new("reg")
        .args(["query", key, "/v", name])
        .output()
        .ok()?;
    parse_reg_query_value(&String::from_utf8_lossy(&out.stdout))
}

fn reg_add(key: &str, name: &str, data: &str) -> Result<(), String> {
    let mut args = vec!["add".to_string(), key.to_string()];
    if name.is_empty() {
        args.push("/ve".to_string());
    } else {
        args.extend(["/v".to_string(), name.to_string()]);
    }
    args.extend([
        "/t".to_string(),
        "REG_SZ".to_string(),
        "/d".to_string(),
        data.to_string(),
        "/f".to_string(),
    ]);
    run_reg(&args)
}

fn reg_delete_value(key: &str) -> Result<(), String> {
    run_reg(&["delete".to_string(), key.to_string(), "/ve".to_string(), "/f".to_string()])
}

fn reg_delete_key_tree(key: &str) -> Result<(), String> {
    run_reg(&["delete".to_string(), key.to_string(), "/f".to_string()])
}

fn run_reg(args: &[String]) -> Result<(), String> {
    let out = std::process::Command::new("reg")
        .args(args)
        .output()
        .map_err(|e| format!("reg failed: {e}"))?;
    if out.status.success() {
        Ok(())
    } else {
        Err(format!("reg failed: {}", String::from_utf8_lossy(&out.stderr)))
    }
}

#[tauri::command]
fn is_md_associated() -> bool {
    reg_query_default(r"HKCU\Software\Classes\.md").as_deref() == Some("EasyMD.Markdown")
}

#[tauri::command]
fn set_md_association(enable: bool) -> Result<(), String> {
    let exe = std::env::current_exe()
        .map_err(|e| format!("resolve exe failed: {e}"))?
        .to_string_lossy()
        .to_string();
    let md_key = r"HKCU\Software\Classes\.md";
    let prog_key = r"HKCU\Software\Classes\EasyMD.Markdown";
    let backup_key = r"HKCU\Software\EasyMD";
    if enable {
        let current = reg_query_default(md_key);
        if current.as_deref() != Some("EasyMD.Markdown") {
            if let Some(prev) = current {
                let _ = reg_add(backup_key, "PrevMdProgId", &prev);
            }
        }
        reg_add(prog_key, "", "Markdown Document")?;
        reg_add(&format!("{prog_key}\\DefaultIcon"), "", &format!("{exe},0"))?;
        reg_add(
            &format!("{prog_key}\\shell\\open\\command"),
            "",
            &format!("\"{exe}\" \"%1\""),
        )?;
        reg_add(md_key, "", "EasyMD.Markdown")?;
    } else {
        let prev = reg_query_named(backup_key, "PrevMdProgId");
        match prev {
            Some(p) if !p.is_empty() => reg_add(md_key, "", &p)?,
            _ => {
                let _ = reg_delete_value(md_key);
            }
        }
        let _ = reg_delete_key_tree(prog_key);
    }
    Ok(())
}

fn main() {
    let open_arg = std::env::args().skip(1).find(|a| {
        let lower = a.to_lowercase();
        (lower.ends_with(".md") || lower.ends_with(".markdown"))
            && std::path::Path::new(a).exists()
    });
    #[cfg(windows)]
    {
        let _singleton = singleton::acquire();
        if _singleton.is_none() {
            singleton::send_open_request(open_arg.as_deref().unwrap_or(""));
            return;
        }
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            open_arg: Mutex::new(open_arg),
            trusted_dirs: Mutex::new(HashSet::new()),
        })
        .setup(|app| {
            #[cfg(windows)]
            singleton::spawn_server(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_open_file_arg,
            trust_directory,
            read_file_bytes,
            write_text_file,
            save_session,
            load_session,
            save_image_file,
            read_file_base64,
            is_md_associated,
            set_md_association
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_reg_sz_value() {
        let out = "\r\nHKEY_CURRENT_USER\\Software\\Classes\\.md\r\n    (默认)    REG_SZ    EasyMD.Markdown\r\n\r\n";
        assert_eq!(parse_reg_query_value(out), Some("EasyMD.Markdown".to_string()));
    }

    #[test]
    fn parses_english_default_name() {
        let out = "HKEY_CURRENT_USER\\Software\\Classes\\.md\r\n    (Default)    REG_SZ    SomeOther.ProgId\r\n";
        assert_eq!(parse_reg_query_value(out), Some("SomeOther.ProgId".to_string()));
    }

    #[test]
    fn returns_none_when_not_set() {
        let out = "\r\nHKEY_CURRENT_USER\\Software\\Classes\\.md\r\n    value not set\r\n";
        assert_eq!(parse_reg_query_value(out), None);
    }

    #[test]
    fn formats_timestamp_utc8() {
        assert_eq!(format_timestamp(0), "19700101-080000000");
        // 2026-10-13 16:00:00 UTC -> 2026-10-14 00:00:00 UTC+8
        assert_eq!(format_timestamp(1_791_907_200 * 1_000_000_000), "20261014-000000000");
    }

    struct TempDir(PathBuf);

    impl TempDir {
        fn new() -> Self {
            let base = std::env::temp_dir().join(format!(
                "easymd-test-{}-{}",
                std::process::id(),
                now_unix_nanos()
            ));
            std::fs::create_dir_all(&base).unwrap();
            TempDir(base)
        }

        fn path(&self, name: &str) -> PathBuf {
            self.0.join(name)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn atomic_write_replaces_content() {
        let dir = TempDir::new();
        let target = dir.path("doc.md");
        atomic_write(&target, b"v1").unwrap();
        atomic_write(&target, b"v2").unwrap();
        assert_eq!(std::fs::read_to_string(&target).unwrap(), "v2");
        assert!(mtime_ns(&target).is_some());
    }

    #[test]
    fn backup_rotates_and_keeps_newest() {
        let dir = TempDir::new();
        let target = dir.path("doc.md");
        atomic_write(&target, b"original").unwrap();
        for i in 0..7 {
            atomic_write(&target, format!("v{i}").as_bytes()).unwrap();
            backup_existing(&target).unwrap();
        }
        let backup_dir = dir.path(BACKUP_DIR);
        let count = std::fs::read_dir(&backup_dir).unwrap().count();
        assert_eq!(count, MAX_BACKUPS);
        let mut names: Vec<String> = std::fs::read_dir(&backup_dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().to_string())
            .collect();
        names.sort();
        let oldest = names.first().unwrap();
        let content = std::fs::read_to_string(backup_dir.join(oldest)).unwrap();
        assert!(
            ["v2", "v3", "v4", "v5", "v6"].contains(&content.as_str()),
            "oldest kept backup should be one of the newest 5 versions, got {content}"
        );
    }

    #[test]
    fn external_modification_detected() {
        let dir = TempDir::new();
        let target = dir.path("doc.md");
        atomic_write(&target, b"v1").unwrap();
        let m = mtime_ns(&target).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(20));
        atomic_write(&target, b"external").unwrap();
        let changed = mtime_ns(&target).unwrap();
        assert_ne!(m, changed, "mtime must change after external write");
    }

    #[test]
    fn trust_model_rejects_unknown_dirs() {
        let dir = TempDir::new();
        let file = dir.path("doc.md");
        atomic_write(&file, b"hi").unwrap();
        let state = AppState {
            open_arg: Mutex::new(None),
            trusted_dirs: Mutex::new(HashSet::new()),
        };
        assert!(ensure_trusted(&state, &file).is_err());
        state
            .trusted_dirs
            .lock()
            .unwrap()
            .insert(std::fs::canonicalize(&dir.0).unwrap());
        assert!(ensure_trusted(&state, &file).is_ok());
    }
}
