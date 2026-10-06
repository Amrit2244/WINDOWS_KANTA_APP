use bcrypt::{hash, verify, DEFAULT_COST};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;

use super::sqlite::database_path;

// ============================================================
// SETTINGS RESPONSE
// ============================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    // --------------------------------------------------------
    // COMPANY
    // --------------------------------------------------------
    pub company_name: String,
    pub company_address: String,
    pub company_phone: String,
    pub company_email: String,
    pub company_gstin: String,
    pub company_logo_path: String,
    pub slip_footer: String,

    // --------------------------------------------------------
    // WEIGHING MACHINE
    // --------------------------------------------------------
    pub weighing_mode: String,
    pub com_port: String,
    pub baud_rate: u32,
    pub data_bits: u8,
    pub stop_bits: u8,
    pub parity: String,
    pub auto_reconnect: bool,
    pub stable_weight_required: bool,
    pub weight_unit: String,
    pub decimal_places: u8,

    // --------------------------------------------------------
    // PRINTING
    // --------------------------------------------------------
    pub paper_size: String,
    pub orientation: String,
    pub print_preview: bool,
    pub printer_name: String,
    pub copies: u32,
    pub show_logo: bool,
    pub show_company_details: bool,
    pub show_operator: bool,
    pub show_signatures: bool,

    // --------------------------------------------------------
    // TALLY
    // --------------------------------------------------------
    pub tally_enabled: bool,
    pub tally_host: String,
    pub tally_port: u16,
    pub tally_company: String,
    pub tally_sales_enabled: bool,
    pub tally_purchase_enabled: bool,
    pub tally_auto_voucher: bool,
}

// ============================================================
// DATABASE
// ============================================================

fn open_database() -> Result<Connection, String> {
    super::sqlite::open_connection()
}

// ============================================================
// DEFAULT SETTINGS
// ============================================================

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            company_name: "KISAN DHARAM KANTA".to_string(),
            company_address: String::new(),
            company_phone: String::new(),
            company_email: String::new(),
            company_gstin: String::new(),
            company_logo_path: String::new(),
            slip_footer: "This is a computer-generated weighment slip.".to_string(),

            weighing_mode: "SIMULATOR".to_string(),
            com_port: "COM5".to_string(),
            baud_rate: 1200,
            data_bits: 8,
            stop_bits: 1,
            parity: "None".to_string(),
            auto_reconnect: true,
            stable_weight_required: false,
            weight_unit: "KG".to_string(),
            decimal_places: 2,

            paper_size: "A5".to_string(),
            orientation: "Portrait".to_string(),
            print_preview: true,
            printer_name: String::new(),
            copies: 1,
            show_logo: true,
            show_company_details: true,
            show_operator: true,
            show_signatures: true,

            tally_enabled: false,
            tally_host: "127.0.0.1".to_string(),
            tally_port: 9000,
            tally_company: String::new(),
            tally_sales_enabled: true,
            tally_purchase_enabled: true,
            tally_auto_voucher: false,
        }
    }
}

// ============================================================
// GET SETTING
// ============================================================

fn get_setting(connection: &Connection, key: &str, default: &str) -> Result<String, String> {
    let result = connection.query_row(
        r#"
        SELECT setting_value
        FROM app_settings
        WHERE setting_key = ?1
        "#,
        params![key],
        |row| row.get::<_, String>(0),
    );

    match result {
        Ok(value) => Ok(value),
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            connection
                .execute(
                    r#"
                    INSERT OR IGNORE INTO app_settings
                    (
                        setting_key,
                        setting_value
                    )
                    VALUES (?1, ?2)
                    "#,
                    params![key, default],
                )
                .map_err(|error| format!("Failed to create setting {key}: {error}"))?;

            Ok(default.to_string())
        }
        Err(error) => Err(format!("Failed to read setting {key}: {error}")),
    }
}

// ============================================================
// SAVE SETTING
// ============================================================

fn save_setting(connection: &Connection, key: &str, value: &str) -> Result<(), String> {
    connection
        .execute(
            r#"
            INSERT INTO app_settings
            (
                setting_key,
                setting_value,
                updated_at
            )
            VALUES (?1, ?2, CURRENT_TIMESTAMP)

            ON CONFLICT(setting_key)
            DO UPDATE SET
                setting_value = excluded.setting_value,
                updated_at = CURRENT_TIMESTAMP
            "#,
            params![key, value],
        )
        .map_err(|error| format!("Failed to save setting {key}: {error}"))?;

    Ok(())
}

// ============================================================
// BOOLEAN HELPER
// ============================================================

fn parse_bool(value: String) -> bool {
    matches!(value.to_lowercase().as_str(), "true" | "1" | "yes" | "on")
}

// ============================================================
// GET ALL SETTINGS
// ============================================================

#[tauri::command]
pub fn get_app_settings() -> Result<AppSettings, String> {
    let connection = open_database()?;
    let defaults = AppSettings::default();

    Ok(AppSettings {
        company_name: get_setting(&connection, "company_name", &defaults.company_name)?,

        company_address: get_setting(&connection, "company_address", &defaults.company_address)?,

        company_phone: get_setting(&connection, "company_phone", &defaults.company_phone)?,

        company_email: get_setting(&connection, "company_email", &defaults.company_email)?,

        company_gstin: get_setting(&connection, "company_gstin", &defaults.company_gstin)?,

        company_logo_path: get_setting(
            &connection,
            "company_logo_path",
            &defaults.company_logo_path,
        )?,

        slip_footer: get_setting(&connection, "slip_footer", &defaults.slip_footer)?,

        weighing_mode: get_setting(&connection, "weighing_mode", &defaults.weighing_mode)?,

        com_port: get_setting(&connection, "com_port", &defaults.com_port)?,

        baud_rate: get_setting(&connection, "baud_rate", &defaults.baud_rate.to_string())?
            .parse()
            .unwrap_or(defaults.baud_rate),

        data_bits: get_setting(&connection, "data_bits", &defaults.data_bits.to_string())?
            .parse()
            .unwrap_or(defaults.data_bits),

        stop_bits: get_setting(&connection, "stop_bits", &defaults.stop_bits.to_string())?
            .parse()
            .unwrap_or(defaults.stop_bits),

        parity: get_setting(&connection, "parity", &defaults.parity)?,

        auto_reconnect: parse_bool(get_setting(
            &connection,
            "auto_reconnect",
            &defaults.auto_reconnect.to_string(),
        )?),

        stable_weight_required: parse_bool(get_setting(
            &connection,
            "stable_weight_required",
            &defaults.stable_weight_required.to_string(),
        )?),

        weight_unit: get_setting(&connection, "weight_unit", &defaults.weight_unit)?,

        decimal_places: get_setting(
            &connection,
            "decimal_places",
            &defaults.decimal_places.to_string(),
        )?
        .parse()
        .unwrap_or(defaults.decimal_places),

        paper_size: get_setting(&connection, "paper_size", &defaults.paper_size)?,

        orientation: get_setting(&connection, "orientation", &defaults.orientation)?,

        print_preview: parse_bool(get_setting(
            &connection,
            "print_preview",
            &defaults.print_preview.to_string(),
        )?),

        printer_name: get_setting(&connection, "printer_name", &defaults.printer_name)?,

        copies: get_setting(&connection, "copies", &defaults.copies.to_string())?
            .parse()
            .unwrap_or(defaults.copies),

        show_logo: parse_bool(get_setting(
            &connection,
            "show_logo",
            &defaults.show_logo.to_string(),
        )?),

        show_company_details: parse_bool(get_setting(
            &connection,
            "show_company_details",
            &defaults.show_company_details.to_string(),
        )?),

        show_operator: parse_bool(get_setting(
            &connection,
            "show_operator",
            &defaults.show_operator.to_string(),
        )?),

        show_signatures: parse_bool(get_setting(
            &connection,
            "show_signatures",
            &defaults.show_signatures.to_string(),
        )?),

        tally_enabled: parse_bool(get_setting(
            &connection,
            "tally_enabled",
            &defaults.tally_enabled.to_string(),
        )?),

        tally_host: get_setting(&connection, "tally_host", &defaults.tally_host)?,

        tally_port: get_setting(&connection, "tally_port", &defaults.tally_port.to_string())?
            .parse()
            .unwrap_or(defaults.tally_port),

        tally_company: get_setting(&connection, "tally_company", &defaults.tally_company)?,

        tally_sales_enabled: parse_bool(get_setting(
            &connection,
            "tally_sales_enabled",
            &defaults.tally_sales_enabled.to_string(),
        )?),

        tally_purchase_enabled: parse_bool(get_setting(
            &connection,
            "tally_purchase_enabled",
            &defaults.tally_purchase_enabled.to_string(),
        )?),

        tally_auto_voucher: parse_bool(get_setting(
            &connection,
            "tally_auto_voucher",
            &defaults.tally_auto_voucher.to_string(),
        )?),
    })
}

// ============================================================
// SAVE ALL SETTINGS
// ============================================================

#[tauri::command]
pub fn save_app_settings(settings: AppSettings) -> Result<(), String> {
    let connection = open_database()?;

    save_setting(&connection, "company_name", &settings.company_name)?;

    save_setting(&connection, "company_address", &settings.company_address)?;

    save_setting(&connection, "company_phone", &settings.company_phone)?;

    save_setting(&connection, "company_email", &settings.company_email)?;

    save_setting(&connection, "company_gstin", &settings.company_gstin)?;

    save_setting(
        &connection,
        "company_logo_path",
        &settings.company_logo_path,
    )?;

    save_setting(&connection, "slip_footer", &settings.slip_footer)?;

    save_setting(&connection, "weighing_mode", &settings.weighing_mode)?;

    save_setting(&connection, "com_port", &settings.com_port)?;

    save_setting(&connection, "baud_rate", &settings.baud_rate.to_string())?;

    save_setting(&connection, "data_bits", &settings.data_bits.to_string())?;

    save_setting(&connection, "stop_bits", &settings.stop_bits.to_string())?;

    save_setting(&connection, "parity", &settings.parity)?;

    save_setting(
        &connection,
        "auto_reconnect",
        &settings.auto_reconnect.to_string(),
    )?;

    save_setting(
        &connection,
        "stable_weight_required",
        &settings.stable_weight_required.to_string(),
    )?;

    save_setting(&connection, "weight_unit", &settings.weight_unit)?;

    save_setting(
        &connection,
        "decimal_places",
        &settings.decimal_places.to_string(),
    )?;

    save_setting(&connection, "paper_size", &settings.paper_size)?;

    save_setting(&connection, "orientation", &settings.orientation)?;

    save_setting(
        &connection,
        "print_preview",
        &settings.print_preview.to_string(),
    )?;

    save_setting(&connection, "printer_name", &settings.printer_name)?;

    save_setting(&connection, "copies", &settings.copies.to_string())?;

    save_setting(&connection, "show_logo", &settings.show_logo.to_string())?;

    save_setting(
        &connection,
        "show_company_details",
        &settings.show_company_details.to_string(),
    )?;

    save_setting(
        &connection,
        "show_operator",
        &settings.show_operator.to_string(),
    )?;

    save_setting(
        &connection,
        "show_signatures",
        &settings.show_signatures.to_string(),
    )?;

    save_setting(
        &connection,
        "tally_enabled",
        &settings.tally_enabled.to_string(),
    )?;

    save_setting(&connection, "tally_host", &settings.tally_host)?;

    save_setting(&connection, "tally_port", &settings.tally_port.to_string())?;

    save_setting(&connection, "tally_company", &settings.tally_company)?;

    save_setting(
        &connection,
        "tally_sales_enabled",
        &settings.tally_sales_enabled.to_string(),
    )?;

    save_setting(
        &connection,
        "tally_purchase_enabled",
        &settings.tally_purchase_enabled.to_string(),
    )?;

    save_setting(
        &connection,
        "tally_auto_voucher",
        &settings.tally_auto_voucher.to_string(),
    )?;

    Ok(())
}

// ============================================================
// DATABASE INFO
// ============================================================

#[derive(Debug, Serialize)]
pub struct DatabaseInfo {
    pub path: String,
    pub exists: bool,
    pub size_bytes: u64,
}

#[tauri::command]
pub fn get_database_info() -> Result<DatabaseInfo, String> {
    let path = database_path()?;

    let metadata = fs::metadata(&path);

    match metadata {
        Ok(metadata) => Ok(DatabaseInfo {
            path: path.to_string_lossy().to_string(),
            exists: true,
            size_bytes: metadata.len(),
        }),

        Err(_) => Ok(DatabaseInfo {
            path: path.to_string_lossy().to_string(),
            exists: false,
            size_bytes: 0,
        }),
    }
}

// ============================================================
// OPEN DATA FOLDER
// ============================================================

#[tauri::command]
pub fn open_database_folder() -> Result<(), String> {
    let path = database_path()?;

    let folder = path
        .parent()
        .ok_or_else(|| "Database folder could not be determined.".to_string())?;

    Command::new("explorer")
        .arg(folder)
        .spawn()
        .map_err(|error| format!("Could not open database folder: {error}"))?;

    Ok(())
}

// ============================================================
// BACKUP DATABASE
// ============================================================

#[tauri::command]
pub fn backup_database() -> Result<String, String> {
    let source = database_path()?;

    if !source.exists() {
        return Err("Database file does not exist.".to_string());
    }

    let local_app_data = std::env::var("LOCALAPPDATA")
        .map_err(|error| format!("LOCALAPPDATA not found: {error}"))?;

    let backup_directory = PathBuf::from(local_app_data)
        .join("Kisan Kanta")
        .join("Backups");

    fs::create_dir_all(&backup_directory)
        .map_err(|error| format!("Could not create backup directory: {error}"))?;

    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();

    let destination = backup_directory.join(format!("kisan_kanta_backup_{}.db", timestamp));

    fs::copy(&source, &destination).map_err(|error| format!("Database backup failed: {error}"))?;

    Ok(destination.to_string_lossy().to_string())
}

// ============================================================
// CHANGE PASSWORD
// ============================================================

#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest {
    pub user_id: i64,
    pub current_password: String,
    pub new_password: String,
}

#[tauri::command]
pub fn change_user_password(request: ChangePasswordRequest) -> Result<(), String> {
    if request.current_password.is_empty() {
        return Err("Current password is required.".to_string());
    }

    if request.new_password.len() < 6 {
        return Err("New password must contain at least 6 characters.".to_string());
    }

    let connection = open_database()?;

    let password_hash: String = connection
        .query_row(
            r#"
            SELECT password_hash
            FROM users
            WHERE id = ?1
            "#,
            params![request.user_id],
            |row| row.get(0),
        )
        .map_err(|_| "User was not found.".to_string())?;

    let valid = verify(&request.current_password, &password_hash)
        .map_err(|error| format!("Password verification failed: {error}"))?;

    if !valid {
        return Err("Current password is incorrect.".to_string());
    }

    let new_hash = hash(&request.new_password, DEFAULT_COST)
        .map_err(|error| format!("Password hashing failed: {error}"))?;

    connection
        .execute(
            r#"
            UPDATE users
            SET password_hash = ?
            WHERE id = ?
            "#,
            params![new_hash, request.user_id],
        )
        .map_err(|error| format!("Could not change password: {error}"))?;

    Ok(())
}
