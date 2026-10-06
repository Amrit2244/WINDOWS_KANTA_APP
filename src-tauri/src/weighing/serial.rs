// src-tauri/src/weighing/serial.rs

use serialport::{available_ports, DataBits, Parity, StopBits};
use std::io::Read;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

use super::parser::parse_weight;

#[derive(Debug, Clone)]
pub struct WeighingMachineSettings {
    pub baud_rate: u32,
    pub data_bits: DataBits,
    pub stop_bits: StopBits,
    pub parity: Parity,
}

impl Default for WeighingMachineSettings {
    fn default() -> Self {
        Self {
            baud_rate: 1200,
            data_bits: DataBits::Eight,
            stop_bits: StopBits::One,
            parity: Parity::None,
        }
    }
}

/// Automatically finds an available COM port
/// and connects to the weighing machine.
pub fn start_serial_reader(app: AppHandle, settings: WeighingMachineSettings) {
    thread::spawn(move || {
        loop {
            println!("Searching for weighing machine COM port...");

            let port_name = find_available_port(&settings);

            match port_name {
                Some(port_name) => {
                    println!("Weighing machine found on {}", port_name);

                    let _ = app.emit("serial-status", format!("Connected to {}", port_name));

                    read_from_port(app.clone(), port_name, &settings);
                }

                None => {
                    println!("No weighing machine COM port found.");

                    let _ = app.emit(
                        "serial-status",
                        "Searching for weighing machine...".to_string(),
                    );

                    // Check again after 2 seconds.
                    thread::sleep(Duration::from_secs(2));
                }
            }
        }
    });
}

/// Search all available COM ports and try to open them.
fn find_available_port(settings: &WeighingMachineSettings) -> Option<String> {
    let ports = match available_ports() {
        Ok(ports) => ports,

        Err(error) => {
            eprintln!("Could not list COM ports: {}", error);

            return None;
        }
    };

    for port_info in ports {
        let port_name = port_info.port_name;

        println!("Trying COM port: {}", port_name);

        let result = serialport::new(&port_name, settings.baud_rate)
            .data_bits(settings.data_bits)
            .stop_bits(settings.stop_bits)
            .parity(settings.parity)
            .timeout(Duration::from_millis(500))
            .open();

        match result {
            Ok(_) => {
                println!("Successfully opened {}", port_name);

                return Some(port_name);
            }

            Err(error) => {
                println!("Could not open {}: {}", port_name, error);
            }
        }
    }

    None
}

/// Read weight continuously from the selected COM port.
fn read_from_port(app: AppHandle, port_name: String, settings: &WeighingMachineSettings) {
    println!("Starting weight reader on {}", port_name);

    let port_result = serialport::new(&port_name, settings.baud_rate)
        .data_bits(settings.data_bits)
        .stop_bits(settings.stop_bits)
        .parity(settings.parity)
        .timeout(Duration::from_millis(500))
        .open();

    let mut port = match port_result {
        Ok(port) => port,

        Err(error) => {
            eprintln!("Could not open {}: {}", port_name, error);

            return;
        }
    };

    let mut read_buffer = [0u8; 256];

    // ---------------------------------------------------------
    // IMPORTANT:
    // Serial data can arrive one character at a time.
    //
    // Example:
    //
    // First read  -> "7"
    // Second read -> "5"
    // Third read  -> "K"
    // Fourth read -> "G"
    //
    // We therefore keep the data until \r or \n arrives.
    // ---------------------------------------------------------
    let mut message_buffer = String::new();

    loop {
        match port.read(&mut read_buffer) {
            Ok(bytes_read) => {
                if bytes_read == 0 {
                    continue;
                }

                let data = String::from_utf8_lossy(&read_buffer[..bytes_read]);

                println!("Raw weighing machine data: {:?}", data);

                // Add new data to our persistent buffer.
                message_buffer.push_str(&data);

                // -------------------------------------------------
                // Process complete messages.
                //
                // Your machine is sending:
                //
                // 75KG\r\n
                //
                // So \r or \n tells us that the message is complete.
                // -------------------------------------------------

                while let Some(position) = message_buffer.find('\n') {
                    // Take everything before \n.
                    let message = message_buffer[..position].trim().to_string();

                    // Remove processed message from buffer.
                    message_buffer = message_buffer[position + 1..].to_string();

                    if message.is_empty() {
                        continue;
                    }

                    println!("Complete weighing-machine message: {:?}", message);

                    // Parse the complete message.
                    if let Some(weight) = parse_weight(&message) {
                        println!("Parsed weight: {}", weight);

                        let _ = app.emit("weight-update", weight);
                    }
                }

                // -------------------------------------------------
                // Safety:
                // If something goes wrong and the device sends
                // endless data without \n, don't allow the buffer
                // to grow forever.
                // -------------------------------------------------

                if message_buffer.len() > 1024 {
                    eprintln!("Serial buffer exceeded 1024 bytes. Resetting.");

                    message_buffer.clear();
                }
            }

            Err(error) if error.kind() == std::io::ErrorKind::TimedOut => {
                continue;
            }

            Err(error) => {
                eprintln!("Serial connection lost on {}: {}", port_name, error);

                let _ = app.emit(
                    "serial-status",
                    format!("Connection lost from {}", port_name),
                );

                // Return to the automatic COM scanner.
                return;
            }
        }
    }
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
