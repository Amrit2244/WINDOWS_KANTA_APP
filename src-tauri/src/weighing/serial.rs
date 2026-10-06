// src-tauri/src/weighing/serial.rs

use serialport::{available_ports, DataBits, Parity, SerialPort, StopBits};
use std::io::Read;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

use super::parser::parse_weight;

#[derive(Debug, Clone)]
pub struct WeighingMachineSettings {
    pub port: String,
    pub baud_rate: u32,
    pub data_bits: DataBits,
    pub stop_bits: StopBits,
    pub parity: Parity,
}

impl Default for WeighingMachineSettings {
    fn default() -> Self {
        Self {
            port: "COM5".to_string(),
            baud_rate: 1200,
            data_bits: DataBits::Eight,
            stop_bits: StopBits::One,
            parity: Parity::None,
        }
    }
}

/// Starts the real weighing-machine serial reader.
///
/// The serial reader runs in a background thread so it does not
/// block the Tauri application or the React frontend.
pub fn start_serial_reader(app: AppHandle, settings: WeighingMachineSettings) {
    thread::spawn(move || {
        println!(
            "Starting weighing machine on {} @ {} baud",
            settings.port, settings.baud_rate
        );

        let port_result = serialport::new(&settings.port, settings.baud_rate)
            .data_bits(settings.data_bits)
            .stop_bits(settings.stop_bits)
            .parity(settings.parity)
            .timeout(Duration::from_millis(500))
            .open();

        let mut port = match port_result {
            Ok(port) => {
                println!(
                    "Weighing machine connected successfully on {}",
                    settings.port
                );

                let _ = app.emit("serial-status", format!("Connected to {}", settings.port));

                port
            }

            Err(error) => {
                eprintln!(
                    "Could not open weighing machine port {}: {}",
                    settings.port, error
                );

                let _ = app.emit("serial-status", format!("Connection failed: {}", error));

                return;
            }
        };

        let mut buffer = [0u8; 256];

        loop {
            match port.read(&mut buffer) {
                Ok(bytes_read) => {
                    if bytes_read == 0 {
                        continue;
                    }

                    let data = String::from_utf8_lossy(&buffer[..bytes_read]);

                    println!("Raw weighing machine data: {:?}", data);

                    // A weighing indicator normally sends data continuously.
                    //
                    // We process every received chunk and try to extract
                    // a numeric weight from it.
                    for line in data.lines() {
                        if let Some(weight) = parse_weight(line) {
                            println!("Parsed weight: {}", weight);

                            let _ = app.emit("weight-update", weight);
                        }
                    }
                }

                Err(error) if error.kind() == std::io::ErrorKind::TimedOut => {
                    // Timeout is normal. Continue waiting for the next
                    // weighing-machine message.
                    continue;
                }

                Err(error) => {
                    eprintln!("Serial read error: {}", error);

                    let _ = app.emit("serial-status", format!("Serial read error: {}", error));

                    thread::sleep(Duration::from_millis(500));
                }
            }
        }
    });
}

/// Returns the COM ports currently available on Windows.
pub fn get_available_ports() -> Vec<String> {
    match available_ports() {
        Ok(ports) => ports.into_iter().map(|port| port.port_name).collect(),

        Err(error) => {
            eprintln!("Could not list serial ports: {}", error);
            Vec::new()
        }
    }
}
