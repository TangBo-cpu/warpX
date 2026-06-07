use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::io::{Read, Write};
use std::sync::mpsc::{self, Receiver};
use std::thread;
use std::time::{Duration, Instant};

#[allow(dead_code)]
#[path = "../src/pty_manager.rs"]
mod pty_manager;

const TEST_TIMEOUT: Duration = Duration::from_secs(10);

struct TestPty {
    writer: Box<dyn Write + Send>,
    reader: Receiver<Vec<u8>>,
    child: Box<dyn portable_pty::Child + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
}

impl Drop for TestPty {
    fn drop(&mut self) {
        if let Some(pid) = self.child.process_id() {
            pty_manager::kill_process_tree(pid);
        }
        let _ = self.child.kill();
    }
}

fn spawn_pwsh() -> TestPty {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 30,
            cols: 100,
            pixel_width: 0,
            pixel_height: 0,
        })
        .expect("open pty");

    let mut command = CommandBuilder::new("pwsh.exe");
    command.args(["-NoLogo", "-NoProfile"]);
    command.cwd(env!("CARGO_MANIFEST_DIR"));

    let child = pair.slave.spawn_command(command).expect("spawn pwsh.exe");
    let mut pty_reader = pair.master.try_clone_reader().expect("clone PTY reader");
    let writer = pair.master.take_writer().expect("take PTY writer");
    let (sender, receiver) = mpsc::channel();

    thread::spawn(move || {
        let mut buffer = [0_u8; 4096];
        while let Ok(read) = pty_reader.read(&mut buffer) {
            if read == 0 {
                break;
            }
            if sender.send(buffer[..read].to_vec()).is_err() {
                break;
            }
        }
    });

    TestPty {
        writer,
        reader: receiver,
        child,
        master: pair.master,
    }
}

fn write_input(pty: &mut TestPty, input: &str) {
    pty.writer.write_all(input.as_bytes()).expect("write PTY input");
    pty.writer.flush().expect("flush PTY input");
}

fn read_until(pty: &TestPty, marker: &str) -> String {
    let deadline = Instant::now() + TEST_TIMEOUT;
    let mut output = Vec::new();

    while Instant::now() < deadline {
        if let Ok(chunk) = pty.reader.recv_timeout(Duration::from_millis(100)) {
            output.extend(chunk);
            let text = String::from_utf8_lossy(&output).to_string();
            if text.contains(marker) {
                return text;
            }
        }
    }

    panic!(
        "timed out waiting for marker {marker:?}; output was:\n{}",
        String::from_utf8_lossy(&output)
    );
}

#[test]
fn pwsh_pty_supports_m0_core_interactions() {
    let mut pty = spawn_pwsh();

    write_input(
        &mut pty,
        "$OutputEncoding = [Console]::OutputEncoding = [Text.UTF8Encoding]::UTF8\r\n",
    );
    write_input(&mut pty, "Write-Output 'WRAPX_READY'\r\n");
    read_until(&pty, "WRAPX_READY");

    write_input(&mut pty, "Write-Output \"WRAPX_CWD=$(Get-Location)\"\r\n");
    let output = read_until(&pty, "WRAPX_CWD=");
    assert!(
        output.contains(env!("CARGO_MANIFEST_DIR")),
        "expected cwd to be {}; output was {output}",
        env!("CARGO_MANIFEST_DIR")
    );

    pty.master
        .resize(PtySize {
            rows: 40,
            cols: 120,
            pixel_width: 0,
            pixel_height: 0,
        })
        .expect("resize PTY");
    write_input(&mut pty, "Write-Output 'WRAPX_RESIZE_OK'\r\n");
    read_until(&pty, "WRAPX_RESIZE_OK");

    write_input(&mut pty, "$a = 1\r\n$b = 2\r\nWrite-Output \"WRAPX_SUM=$($a + $b)\"\r\n");
    read_until(&pty, "WRAPX_SUM=3");

    write_input(&mut pty, "Write-Output 'WRAPX_UNICODE=你好 WrapX'\r\n");
    read_until(&pty, "WRAPX_UNICODE=你好 WrapX");

    write_input(&mut pty, "while ($true) { Start-Sleep -Milliseconds 100 }\r\n");
    thread::sleep(Duration::from_millis(500));
    write_input(&mut pty, "\u{3}");
    thread::sleep(Duration::from_millis(500));
    write_input(&mut pty, "Write-Output 'WRAPX_AFTER_CTRL_C'\r\n");
    read_until(&pty, "WRAPX_AFTER_CTRL_C");
}

#[test]
fn pwsh_pty_buffers_output_while_reader_is_inactive() {
    let mut pty = spawn_pwsh();

    write_input(&mut pty, "Write-Output 'WRAPX_BUFFER_BEFORE'\r\n");
    read_until(&pty, "WRAPX_BUFFER_BEFORE");

    write_input(&mut pty, "1..25 | ForEach-Object { Write-Output \"WRAPX_BUFFER_LINE=$_\" }\r\n");
    thread::sleep(Duration::from_millis(500));

    let output = read_until(&pty, "WRAPX_BUFFER_LINE=25");
    assert!(output.contains("WRAPX_BUFFER_LINE=1"), "buffer missed first line: {output}");
    assert!(output.contains("WRAPX_BUFFER_LINE=25"), "buffer missed last line: {output}");
}

#[cfg(windows)]
#[test]
fn pwsh_pty_close_cleans_up_child_process_tree() {
    let mut pty = spawn_pwsh();

    write_input(&mut pty, "$p = Start-Process pwsh -ArgumentList '-NoLogo','-NoProfile','-NoExit','-Command','while ($true) { Start-Sleep -Seconds 1 }' -PassThru; $prefix = 'WRAPX_CHILD_' + 'PID='; Write-Output \"$prefix$($p.Id)\"\r\n");
    let output = read_until(&pty, "WRAPX_CHILD_PID=");
    let child_pid = parse_marker_u32(&output, "WRAPX_CHILD_PID=")
        .unwrap_or_else(|| panic!("parse child pid from PTY output:\n{output}"));

    assert!(process_exists(child_pid), "child process should exist before cleanup");

    if let Some(root_pid) = pty.child.process_id() {
        pty_manager::kill_process_tree(root_pid);
    }
    let _ = pty.child.kill();

    let deadline = Instant::now() + TEST_TIMEOUT;
    while Instant::now() < deadline {
        if !process_exists(child_pid) {
            return;
        }
        thread::sleep(Duration::from_millis(100));
    }

    panic!("child process {child_pid} survived process-tree cleanup");
}

#[cfg(windows)]
fn parse_marker_u32(output: &str, marker: &str) -> Option<u32> {
    let tail = output.split(marker).nth(1)?;
    let digits: String = tail
        .chars()
        .skip_while(|character| !character.is_ascii_digit())
        .take_while(|character| character.is_ascii_digit())
        .collect();

    digits.parse().ok()
}

#[cfg(windows)]
fn process_exists(pid: u32) -> bool {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};

    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if handle.is_null() {
            false
        } else {
            CloseHandle(handle);
            true
        }
    }
}
