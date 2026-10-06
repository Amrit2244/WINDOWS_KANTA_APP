use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;

// Database location
pub fn database_path() -> Result<PathBuf, String> {
    let local_app_data = std::env::var("LOCALAPPDATA")
        .map_err(|error| format!("Could not find LOCALAPPDATA: {error}"))?;

    let app_directory = PathBuf::from(local_app_data).join("Kisan Kanta");

    fs::create_dir_all(&app_directory)
        .map_err(|error| format!("Failed to create Kisan Kanta data directory: {error}"))?;

    Ok(app_directory.join("kisan_kanta.db"))
}

// Open SQLite database
pub fn open_connection() -> Result<Connection, String> {
    let path = database_path()?;

    Connection::open(path).map_err(|error| format!("Database error: {error}"))
}

/// Initialize the SQLite database.
pub fn initialize_database() -> Result<(), String> {
    // NEW:
    // Database is now stored outside the project directory.
    let database_path = database_path()?;

    println!("Kisan Kanta database: {}", database_path.display());

    let connection = Connection::open(&database_path)
        .map_err(|error| format!("Failed to open database: {error}"))?;

    connection
        .execute_batch(
            r#"
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS users (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                username        TEXT NOT NULL UNIQUE,
                password_hash   TEXT NOT NULL,
                full_name       TEXT NOT NULL,
                role            TEXT NOT NULL DEFAULT 'operator',
                active          INTEGER NOT NULL DEFAULT 1,
                created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS parties (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                name            TEXT NOT NULL UNIQUE,
                address         TEXT,
                phone           TEXT,
                gstin           TEXT,
                opening_balance REAL NOT NULL DEFAULT 0,
                balance_type    TEXT NOT NULL DEFAULT 'credit',
                active          INTEGER NOT NULL DEFAULT 1,
                created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS items (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT NOT NULL UNIQUE,
                code        TEXT UNIQUE,
                unit        TEXT NOT NULL DEFAULT 'KG',
                active      INTEGER NOT NULL DEFAULT 1,
                created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS vehicles (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                vehicle_no  TEXT NOT NULL UNIQUE,
                owner_name  TEXT,
                active      INTEGER NOT NULL DEFAULT 1,
                created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

                    CREATE TABLE IF NOT EXISTS app_settings (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            setting_key     TEXT NOT NULL UNIQUE,
            setting_value   TEXT NOT NULL DEFAULT '',
            updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
            CREATE TABLE IF NOT EXISTS weighments (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                slip_no          TEXT NOT NULL UNIQUE,
                vehicle_id       INTEGER NOT NULL,
                party_id         INTEGER NOT NULL,
                item_id          INTEGER NOT NULL,
                first_weight     REAL,
                first_weight_at  TEXT,
                second_weight    REAL,
                second_weight_at TEXT,
                weighing_mode    TEXT NOT NULL,
                net_weight       REAL,
                remarks          TEXT,
                created_by       INTEGER,
                created_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

                FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
                FOREIGN KEY (party_id) REFERENCES parties(id),
                FOREIGN KEY (item_id) REFERENCES items(id),
                FOREIGN KEY (created_by) REFERENCES users(id)
            );

            CREATE INDEX IF NOT EXISTS idx_weighments_slip_no
                ON weighments(slip_no);

            CREATE INDEX IF NOT EXISTS idx_weighments_vehicle
                ON weighments(vehicle_id);

            CREATE INDEX IF NOT EXISTS idx_weighments_party
                ON weighments(party_id);

            CREATE INDEX IF NOT EXISTS idx_weighments_item
                ON weighments(item_id);

            CREATE INDEX IF NOT EXISTS idx_weighments_created_at
                ON weighments(created_at);
            "#,
        )
        .map_err(|error| format!("Failed to create database tables: {error}"))?;

    println!("Database initialized successfully.");

    Ok(())
}
