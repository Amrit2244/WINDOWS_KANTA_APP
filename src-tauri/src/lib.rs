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

// Get all COM ports currently detected by Windows.
#[tauri::command]
fn get_serial_ports() -> Vec<String> {
    weighing::serial::get_available_ports()
}

// Get the default weighing-machine communication settings.
#[tauri::command]
fn get_weighing_machine_settings() -> String {
    let settings = weighing::serial::WeighingMachineSettings::default();

    format!(
        "Automatic COM Detection, Baud Rate: {}, Data Bits: 8, Stop Bits: 1, Parity: None",
        settings.baud_rate
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // ---------------------------------------------------------
        // APPLICATION STARTUP
        // ---------------------------------------------------------
        .setup(|app| {
            // Initialize SQLite database.
            database::sqlite::initialize_database().map_err(|error| error.to_string())?;

            // -----------------------------------------------------
            // START AUTOMATIC WEIGHING MACHINE DETECTION
            // -----------------------------------------------------
            //
            // Kisan Kanta will:
            //
            // 1. Scan all available COM ports.
            // 2. Try the configured serial settings.
            // 3. Connect to an available port.
            // 4. Read weight data.
            // 5. Send weight-update events to React.
            // 6. If disconnected, automatically scan again.
            //
            weighing::serial::start_serial_reader(
                app.handle().clone(),
                weighing::serial::WeighingMachineSettings::default(),
            );

            Ok(())
        })
        // ---------------------------------------------------------
        // TAURI COMMANDS
        // ---------------------------------------------------------
        .invoke_handler(tauri::generate_handler![
            // -----------------------------------------------------
            // Application
            // -----------------------------------------------------
            get_app_name,
            get_test_weighment,
            // -----------------------------------------------------
            // Serial / Weighing Machine
            // -----------------------------------------------------
            get_serial_ports,
            get_weighing_machine_settings,
            // -----------------------------------------------------
            // Authentication
            // -----------------------------------------------------
            database::commands::register_user,
            database::commands::login_user,
            // -----------------------------------------------------
            // Master Data
            // -----------------------------------------------------
            database::commands::create_party,
            database::commands::create_item,
            database::commands::create_vehicle,
            // -----------------------------------------------------
            // Weighment
            // -----------------------------------------------------
            database::commands::create_first_weight,
            database::commands::get_pending_weighment,
            database::commands::complete_second_weight,
            // -----------------------------------------------------
            // Master-data dropdowns
            // -----------------------------------------------------
            database::commands::get_vehicles,
            database::commands::get_parties,
            database::commands::get_items,
            // -----------------------------------------------------
            // Reports
            // -----------------------------------------------------
            database::reports::get_weighment_reports,
            // -----------------------------------------------------
            // Printing
            // -----------------------------------------------------
            printing::print_weighment_pdf,
            // -----------------------------------------------------
            // Settings
            // -----------------------------------------------------
            database::settings::get_app_settings,
            database::settings::save_app_settings,
            database::settings::get_database_info,
            database::settings::open_database_folder,
            database::settings::backup_database,
            database::settings::change_user_password,
        ])
        // ---------------------------------------------------------
        // START TAURI APPLICATION
        // ---------------------------------------------------------
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
