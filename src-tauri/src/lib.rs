mod database;
mod models;
mod printing;
mod weighing;

use models::weighment::{Weighment, WeighmentResponse};

#[tauri::command]
fn get_app_name() -> String {
    "Kisan Kanta".to_string()
}

#[tauri::command]
fn get_test_weighment() -> WeighmentResponse {
    let weighment = Weighment::new(
        "PB10AB1234".to_string(),
        "ABC Traders".to_string(),
        35000.0,
        12000.0,
    );

    WeighmentResponse {
        vehicle_no: weighment.vehicle_no.clone(),
        party_name: weighment.party_name.clone(),
        gross_weight: weighment.gross_weight,
        tare_weight: weighment.tare_weight,
        net_weight: weighment.net_weight(),
    }
}

#[tauri::command]
fn get_serial_ports() -> Vec<String> {
    weighing::serial::get_available_ports()
}

#[tauri::command]
fn get_weighing_machine_settings() -> String {
    let settings = weighing::serial::WeighingMachineSettings::default();

    format!(
        "Port: {}, Baud Rate: {}, Data Bits: 8, Stop Bits: 1, Parity: None",
        settings.port, settings.baud_rate
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            database::sqlite::initialize_database().map_err(|error| error.to_string())?;

            // START REAL WEIGHING MACHINE
            weighing::serial::start_serial_reader(
                app.handle().clone(),
                weighing::serial::WeighingMachineSettings::default(),
            );

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_name,
            get_test_weighment,
            get_serial_ports,
            get_weighing_machine_settings,
            database::commands::register_user,
            database::commands::login_user,
            database::commands::create_party,
            database::commands::create_item,
            database::commands::create_vehicle,
            // Weighment
            database::commands::create_first_weight,
            database::commands::get_pending_weighment,
            database::commands::complete_second_weight,
            // Master-data dropdowns
            database::commands::get_vehicles,
            database::commands::get_parties,
            database::commands::get_items,
            // Reports
            database::reports::get_weighment_reports,
            // Printing
            printing::print_weighment_pdf,
            // Settings
            database::settings::get_app_settings,
            database::settings::save_app_settings,
            database::settings::get_database_info,
            database::settings::open_database_folder,
            database::settings::backup_database,
            database::settings::change_user_password,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
