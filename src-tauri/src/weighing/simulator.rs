use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub fn start_simulator(app: AppHandle) {
    thread::spawn(move || {
        let mut weight = 10000.0;

        loop {
            if weight >= 30000.0 {
                weight = 10000.0;
            } else {
                weight += 500.0;
            }

            let _ = app.emit("weight-update", weight);

            thread::sleep(Duration::from_millis(500));
        }
    });
}
