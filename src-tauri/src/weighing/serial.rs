// src-tauri/src/weighing/serial.rs

use serialport::{DataBits, Parity, StopBits};
// use std::io::Read;
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
            // IMPORTANT:
            // We are testing COM5 specifically.
            port: "COM5".to_string(),

            // Your weighing machine settings.
            baud_rate: 1200,
            data_bits: DataBits::Eight,
            stop_bits: StopBits::One,
            parity: Parity::None,
        }
    }
}

/// Starts the weighing-machine serial reader.
///
/// The reader continuously tries to connect to the configured
/// COM port. If the connection is lost, it automatically tries again.
pub fn start_serial_reader(app: AppHandle, settings: WeighingMachineSettings) {
    thread::spawn(move || {
        loop {
            println!("========================================");
            println!("KISAN KANTA SERIAL READER");
            println!("========================================");

            println!(
                "Trying weighing machine on {} @ {} baud",
                settings.port, settings.baud_rate
            );

            let _ = app.emit(
                "serial-status",
                format!(
                    "Connecting to {} @ {} baud...",
                    settings.port, settings.baud_rate
                ),
            );

            match open_serial_port(&settings) {
                Ok(mut port) => {
                    println!("SUCCESS: Weighing machine connected on {}", settings.port);

                    let _ = app.emit("serial-status", format!("Connected to {}", settings.port));

                    read_from_port(app.clone(), &mut *port, &settings.port);

                    println!("Serial reader stopped.");

                    let _ = app.emit(
                        "serial-status",
                        "Connection lost. Reconnecting...".to_string(),
                    );
                }

                Err(error) => {
                    eprintln!("FAILED: Could not open {}: {}", settings.port, error);

                    let _ = app.emit(
                        "serial-status",
                        format!("Could not connect to {}: {}", settings.port, error),
                    );
                }
            }

            // Wait before trying again.
            thread::sleep(Duration::from_secs(2));
        }
    });
}

/// Opens the configured serial port.
fn open_serial_port(
    settings: &WeighingMachineSettings,
) -> Result<Box<dyn serialport::SerialPort>, String> {
    println!("Opening serial port: {}", settings.port);

    serialport::new(&settings.port, settings.baud_rate)
        .data_bits(settings.data_bits)
        .stop_bits(settings.stop_bits)
        .parity(settings.parity)
        .timeout(Duration::from_millis(500))
        .open()
        .map_err(|error| format!("Unable to open {}: {}", settings.port, error))
}

/// Reads data continuously from the weighing machine.
fn read_from_port(app: AppHandle, port: &mut dyn serialport::SerialPort, port_name: &str) {
    println!("Waiting for weighing-machine data on {}...", port_name);

    let mut read_buffer = [0u8; 256];

    // Serial devices can send data in pieces.
    //
    // Example:
    //
    // Read 1 -> "75"
    // Read 2 -> "KG"
    // Read 3 -> "\r\n"
    //
    // Therefore we keep the data in this buffer until
    // a complete message is received.
    let mut message_buffer = String::new();

    loop {
        match port.read(&mut read_buffer) {
            Ok(bytes_read) => {
                if bytes_read == 0 {
                    continue;
                }

                let data = String::from_utf8_lossy(&read_buffer[..bytes_read]);

                // VERY IMPORTANT DIAGNOSTIC MESSAGE.
                //
                // If the other computer is connected but we see
                // nothing here, the weighing machine is not sending
                // data to our Rust program.
                println!("[SERIAL RAW] {} bytes: {:?}", bytes_read, data);

                // Send raw data to the frontend for diagnostics.
                let _ = app.emit("serial-raw-data", data.to_string());

                message_buffer.push_str(&data);

                // Convert carriage returns to newlines.
                //
                // This allows us to handle:
                //
                // \r
                // \n
                // \r\n
                //
                // from different weighing indicators.
                message_buffer = message_buffer.replace('\r', "\n");

                while let Some(position) = message_buffer.find('\n') {
                    let message = message_buffer[..position].trim().to_string();

                    message_buffer = message_buffer[position + 1..].to_string();

                    if message.is_empty() {
                        continue;
                    }

                    println!("[SERIAL MESSAGE] {:?}", message);

                    let _ = app.emit("serial-message", message.clone());

                    match parse_weight(&message) {
                        Some(weight) => {
                            println!("[WEIGHT PARSED] {}", weight);

                            let _ = app.emit("weight-update", weight);
                        }

                        None => {
                            println!("[WEIGHT PARSER] Could not parse: {:?}", message);
                        }
                    }
                }

                // Prevent unlimited buffer growth.
                if message_buffer.len() > 1024 {
                    eprintln!("[SERIAL] Buffer exceeded 1024 bytes. Resetting.");

                    message_buffer.clear();
                }
            }

            Err(error) if error.kind() == std::io::ErrorKind::TimedOut => {
                // Timeout is normal for a serial port.
                continue;
            }

            Err(error) => {
                eprintln!("[SERIAL ERROR] {}: {}", port_name, error);

                let _ = app.emit(
                    "serial-status",
                    format!("Serial error on {}: {}", port_name, error),
                );

                // Exit this reader.
                //
                // The outer loop will reconnect.
                return;
            }
        }
    }
}

/// Returns the currently available COM ports.
///
/// This can be used by the Settings page.
pub fn get_available_ports() -> Vec<String> {
    match serialport::available_ports() {
        Ok(ports) => ports.into_iter().map(|port| port.port_name).collect(),

        Err(error) => {
            eprintln!("Could not list COM ports: {}", error);

            Vec::new()
        }
    }
}
