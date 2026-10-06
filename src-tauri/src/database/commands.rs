use crate::database::sqlite::open_connection;

use bcrypt::{hash, verify, DEFAULT_COST};

use rusqlite::{params, Connection};

use serde::{Deserialize, Serialize};

// ============================================================

// DATABASE CONNECTION

// ============================================================

fn open_database() -> Result<Connection, String> {
    let connection = open_connection()?;

    Ok(connection)
}

// ============================================================

// USER

// ============================================================

#[derive(Debug, Deserialize)]

pub struct RegisterUserRequest {
    pub username: String,

    pub password: String,

    pub full_name: String,

    pub role: String,
}

#[derive(Debug, Serialize)]

pub struct UserResponse {
    pub id: i64,

    pub username: String,

    pub full_name: String,

    pub role: String,
}

#[tauri::command]

pub fn register_user(request: RegisterUserRequest) -> Result<UserResponse, String> {
    // --------------------------------------------------------

    // Validate input

    // --------------------------------------------------------

    let username = request.username.trim().to_string();

    let password = request.password.trim().to_string();

    let full_name = request.full_name.trim().to_string();

    let role = request.role.trim().to_string();

    if username.is_empty() {
        return Err("Username is required.".to_string());
    }

    if password.is_empty() {
        return Err("Password is required.".to_string());
    }

    if full_name.is_empty() {
        return Err("Full name is required.".to_string());
    }

    if role.is_empty() {
        return Err("Role is required.".to_string());
    }

    // --------------------------------------------------------

    // Hash password

    // --------------------------------------------------------

    let password_hash = hash(&password, DEFAULT_COST)
        .map_err(|error| format!("Password hashing failed: {error}"))?;

    let connection = open_database()?;

    // --------------------------------------------------------

    // Insert user

    // --------------------------------------------------------

    connection
        .execute(
            r#"

            INSERT INTO users

            (

                username,

                password_hash,

                full_name,

                role

            )

            VALUES (?1, ?2, ?3, ?4)

            "#,
            params![username, password_hash, full_name, role],
        )
        .map_err(|error| format!("Failed to create user: {error}"))?;

    let id = connection.last_insert_rowid();

    Ok(UserResponse {
        id,

        username,

        full_name,

        role,
    })
}

// ============================================================

// LOGIN

// ============================================================

#[derive(Debug, Deserialize)]

pub struct LoginRequest {
    pub username: String,

    pub password: String,
}

#[derive(Debug, Serialize)]

pub struct LoginResponse {
    pub id: i64,

    pub username: String,

    pub full_name: String,

    pub role: String,
}

#[tauri::command]

pub fn login_user(request: LoginRequest) -> Result<LoginResponse, String> {
    let username = request.username.trim().to_string();

    if username.is_empty() {
        return Err("Username is required.".to_string());
    }

    if request.password.is_empty() {
        return Err("Password is required.".to_string());
    }

    let connection = open_database()?;

    let result = connection.query_row(
        r#"

        SELECT

            id,

            username,

            password_hash,

            full_name,

            role

        FROM users

        WHERE username = ?1

        AND active = 1

        "#,
        params![username],
        |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
            ))
        },
    );

    let (id, username, password_hash, full_name, role) =
        result.map_err(|_| "Invalid username or password".to_string())?;

    let password_valid = verify(&request.password, &password_hash)
        .map_err(|error| format!("Password verification failed: {error}"))?;

    if !password_valid {
        return Err("Invalid username or password".to_string());
    }

    Ok(LoginResponse {
        id,

        username,

        full_name,

        role,
    })
}

// ============================================================

// PARTY

// ============================================================

#[derive(Debug, Deserialize)]

pub struct CreatePartyRequest {
    pub name: String,

    pub address: String,

    pub phone: String,

    pub gstin: String,
}

#[tauri::command]

pub fn create_party(request: CreatePartyRequest) -> Result<i64, String> {
    let name = request.name.trim().to_string();

    let address = request.address.trim().to_string();

    let phone = request.phone.trim().to_string();

    let gstin = request.gstin.trim().to_string();

    if name.is_empty() {
        return Err("Party name is required.".to_string());
    }

    let connection = open_database()?;

    connection
        .execute(
            r#"

            INSERT INTO parties

            (

                name,

                address,

                phone,

                gstin

            )

            VALUES (?1, ?2, ?3, ?4)

            "#,
            params![name, address, phone, gstin],
        )
        .map_err(|error| format!("Failed to create party: {error}"))?;

    Ok(connection.last_insert_rowid())
}

// ============================================================

// ITEM

// ============================================================

#[derive(Debug, Deserialize)]

pub struct CreateItemRequest {
    pub name: String,

    pub code: String,

    pub unit: String,
}

#[tauri::command]

pub fn create_item(request: CreateItemRequest) -> Result<i64, String> {
    let name = request.name.trim().to_string();

    let code = request.code.trim().to_string();

    let unit = request.unit.trim().to_string();

    if name.is_empty() {
        return Err("Item name is required.".to_string());
    }

    if unit.is_empty() {
        return Err("Item unit is required.".to_string());
    }

    let connection = open_database()?;

    connection
        .execute(
            r#"

            INSERT INTO items

            (

                name,

                code,

                unit

            )

            VALUES (?1, ?2, ?3)

            "#,
            params![name, code, unit],
        )
        .map_err(|error| format!("Failed to create item: {error}"))?;

    Ok(connection.last_insert_rowid())
}

// ============================================================

// VEHICLE

// ============================================================

#[derive(Debug, Deserialize)]

pub struct CreateVehicleRequest {
    pub vehicle_no: String,

    pub owner_name: String,
}

#[tauri::command]

pub fn create_vehicle(request: CreateVehicleRequest) -> Result<i64, String> {
    let vehicle_no = request.vehicle_no.trim().to_uppercase();

    let owner_name = request.owner_name.trim().to_string();

    if vehicle_no.is_empty() {
        return Err("Vehicle number is required.".to_string());
    }

    let connection = open_database()?;

    connection
        .execute(
            r#"

            INSERT INTO vehicles

            (

                vehicle_no,

                owner_name

            )

            VALUES (?1, ?2)

            "#,
            params![vehicle_no, owner_name],
        )
        .map_err(|error| format!("Failed to create vehicle: {error}"))?;

    Ok(connection.last_insert_rowid())
}

// ============================================================

// MASTER DATA DROPDOWNS

// ============================================================

//

// These commands are used by App.tsx to load:

//

// 1. Vehicle dropdown

// 2. Party dropdown

// 3. Item dropdown

//

// Only active records are returned.

// ============================================================

// ------------------------------------------------------------

// VEHICLE DROPDOWN

// ------------------------------------------------------------

#[derive(Debug, Serialize)]

pub struct VehicleOption {
    pub id: i64,

    pub vehicle_no: String,
}

#[tauri::command]

pub fn get_vehicles() -> Result<Vec<VehicleOption>, String> {
    let connection = open_database()?;

    let mut statement = connection
        .prepare(
            r#"

            SELECT

                id,

                vehicle_no

            FROM vehicles

            WHERE active = 1

            ORDER BY vehicle_no

            "#,
        )
        .map_err(|error| format!("Failed to prepare vehicle query: {error}"))?;

    let rows = statement
        .query_map([], |row| {
            Ok(VehicleOption {
                id: row.get(0)?,

                vehicle_no: row.get(1)?,
            })
        })
        .map_err(|error| format!("Failed to read vehicles: {error}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to collect vehicles: {error}"))
}

// ------------------------------------------------------------

// PARTY DROPDOWN

// ------------------------------------------------------------

#[derive(Debug, Serialize)]

pub struct PartyOption {
    pub id: i64,

    pub name: String,
}

#[tauri::command]

pub fn get_parties() -> Result<Vec<PartyOption>, String> {
    let connection = open_database()?;

    let mut statement = connection
        .prepare(
            r#"

            SELECT

                id,

                name

            FROM parties

            WHERE active = 1

            ORDER BY name

            "#,
        )
        .map_err(|error| format!("Failed to prepare party query: {error}"))?;

    let rows = statement
        .query_map([], |row| {
            Ok(PartyOption {
                id: row.get(0)?,

                name: row.get(1)?,
            })
        })
        .map_err(|error| format!("Failed to read parties: {error}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to collect parties: {error}"))
}

// ------------------------------------------------------------

// ITEM DROPDOWN

// ------------------------------------------------------------

#[derive(Debug, Serialize)]

pub struct ItemOption {
    pub id: i64,

    pub name: String,
}

#[tauri::command]

pub fn get_items() -> Result<Vec<ItemOption>, String> {
    let connection = open_database()?;

    let mut statement = connection
        .prepare(
            r#"

            SELECT

                id,

                name

            FROM items

            WHERE active = 1

            ORDER BY name

            "#,
        )
        .map_err(|error| format!("Failed to prepare item query: {error}"))?;

    let rows = statement
        .query_map([], |row| {
            Ok(ItemOption {
                id: row.get(0)?,

                name: row.get(1)?,
            })
        })
        .map_err(|error| format!("Failed to read items: {error}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to collect items: {error}"))
}

// ============================================================

// WEIGHMENT

// ============================================================

//

// SALES:

//     First Weight  = TARE

//     Second Weight = GROSS

//     Net            = GROSS - TARE

//

// PURCHASE:

//     First Weight  = GROSS

//     Second Weight = TARE

//     Net            = GROSS - TARE

// ============================================================

#[derive(Debug, Deserialize)]

pub struct CreateFirstWeightRequest {
    pub vehicle_no: String,

    pub party_name: String,

    pub item_name: String,

    pub transaction_type: String,

    pub first_weight: f64,

    pub created_by: Option<i64>,
}

#[derive(Debug, Serialize)]

pub struct FirstWeightResponse {
    pub id: i64,

    pub slip_no: String,

    pub vehicle_no: String,

    pub party_name: String,

    pub item_name: String,

    pub transaction_type: String,

    pub first_weight: f64,

    pub first_weight_label: String,
}

// ============================================================

// CREATE FIRST WEIGHT

// ============================================================

#[tauri::command]

pub fn create_first_weight(
    request: CreateFirstWeightRequest,
) -> Result<FirstWeightResponse, String> {
    // --------------------------------------------------------

    // Normalize input

    // --------------------------------------------------------

    let vehicle_no = request.vehicle_no.trim().to_string();

    let party_name = request.party_name.trim().to_string();

    let item_name = request.item_name.trim().to_string();

    let transaction_type = request.transaction_type.trim().to_uppercase();

    // --------------------------------------------------------

    // Validate

    // --------------------------------------------------------

    if vehicle_no.is_empty() {
        return Err("Please select a vehicle.".to_string());
    }

    if party_name.is_empty() {
        return Err("Please select a party.".to_string());
    }

    if item_name.is_empty() {
        return Err("Please select an item.".to_string());
    }

    if transaction_type != "SALES" && transaction_type != "PURCHASE" {
        return Err("Transaction type must be SALES or PURCHASE.".to_string());
    }

    if request.first_weight <= 0.0 {
        return Err("First weight must be greater than zero.".to_string());
    }

    let connection = open_database()?;

    // --------------------------------------------------------

    // Find vehicle

    // --------------------------------------------------------

    let vehicle_id: i64 = connection
        .query_row(
            r#"

            SELECT id

            FROM vehicles

            WHERE UPPER(vehicle_no) = UPPER(?1)

            AND active = 1

            "#,
            params![vehicle_no],
            |row| row.get(0),
        )
        .map_err(|_| "Vehicle not found. Please register the vehicle first.".to_string())?;

    // --------------------------------------------------------

    // Find party

    // --------------------------------------------------------

    let party_id: i64 = connection
        .query_row(
            r#"

            SELECT id

            FROM parties

            WHERE UPPER(name) = UPPER(?1)

            AND active = 1

            "#,
            params![party_name],
            |row| row.get(0),
        )
        .map_err(|_| "Party not found. Please register the party first.".to_string())?;

    // --------------------------------------------------------

    // Find item

    // --------------------------------------------------------

    let item_id: i64 = connection
        .query_row(
            r#"

            SELECT id

            FROM items

            WHERE UPPER(name) = UPPER(?1)

            AND active = 1

            "#,
            params![item_name],
            |row| row.get(0),
        )
        .map_err(|_| "Item not found. Please register the item first.".to_string())?;

    // --------------------------------------------------------

    // CHANGED:

    //

    // Use a unique temporary slip number.

    //

    // The old code used:

    //

    //     "TEMP"

    //

    // Because slip_no is UNIQUE, a second incomplete

    // weighment could fail.

    //

    // Now we use the current timestamp.

    // --------------------------------------------------------

    let temporary_slip = format!(
        "TEMP-{}",
        chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)
    );

    connection
        .execute(
            r#"

            INSERT INTO weighments

            (

                slip_no,

                vehicle_id,

                party_id,

                item_id,

                first_weight,

                first_weight_at,

                weighing_mode,

                created_by

            )

            VALUES

            (

                ?1,

                ?2,

                ?3,

                ?4,

                ?5,

                CURRENT_TIMESTAMP,

                ?6,

                ?7

            )

            "#,
            params![
                temporary_slip,
                vehicle_id,
                party_id,
                item_id,
                request.first_weight,
                transaction_type,
                request.created_by
            ],
        )
        .map_err(|error| format!("Failed to save first weight: {error}"))?;

    let id = connection.last_insert_rowid();

    // --------------------------------------------------------

    // Generate actual slip number

    // --------------------------------------------------------

    let slip_no = format!("KK-{:06}", id);

    connection
        .execute(
            r#"

            UPDATE weighments

            SET slip_no = ?1

            WHERE id = ?2

            "#,
            params![slip_no, id],
        )
        .map_err(|error| format!("Failed to generate slip number: {error}"))?;

    // --------------------------------------------------------

    // Determine first-weight label

    // --------------------------------------------------------

    let first_weight_label = if transaction_type == "PURCHASE" {
        "GROSS WEIGHT".to_string()
    } else {
        "TARE WEIGHT".to_string()
    };

    Ok(FirstWeightResponse {
        id,

        slip_no,

        vehicle_no,

        party_name,

        item_name,

        transaction_type,

        first_weight: request.first_weight,

        first_weight_label,
    })
}

// ============================================================

// SECOND WEIGHT

// ============================================================

#[derive(Debug, Serialize)]

pub struct PendingWeighmentResponse {
    pub id: i64,

    pub slip_no: String,

    pub vehicle_no: String,

    pub party_name: String,

    pub item_name: String,

    pub transaction_type: String,

    pub first_weight: f64,

    pub first_weight_label: String,
}

// ============================================================

// GET PENDING WEIGHMENT

// ============================================================

#[tauri::command(rename_all = "snake_case")]

pub fn get_pending_weighment(slip_no: String) -> Result<PendingWeighmentResponse, String> {
    let slip_no_input = slip_no.trim().to_string();

    if slip_no_input.is_empty() {
        return Err("Please enter a slip number.".to_string());
    }

    let connection = open_database()?;

    let result = connection.query_row(
        r#"

        SELECT

            w.id,

            w.slip_no,

            v.vehicle_no,

            p.name,

            i.name,

            w.weighing_mode,

            w.first_weight

        FROM weighments w

        INNER JOIN vehicles v

            ON v.id = w.vehicle_id

        INNER JOIN parties p

            ON p.id = w.party_id

        INNER JOIN items i

            ON i.id = w.item_id

        WHERE w.slip_no = ?1

        AND w.second_weight IS NULL

        "#,
        params![slip_no_input],
        |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, f64>(6)?,
            ))
        },
    );

    let (id, slip_no, vehicle_no, party_name, item_name, transaction_type, first_weight) =
        result
            .map_err(|_| "Slip number not found or weighment is already completed.".to_string())?;

    let first_weight_label = if transaction_type == "PURCHASE" {
        "GROSS WEIGHT".to_string()
    } else {
        "TARE WEIGHT".to_string()
    };

    Ok(PendingWeighmentResponse {
        id,

        slip_no,

        vehicle_no,

        party_name,

        item_name,

        transaction_type,

        first_weight,

        first_weight_label,
    })
}

// ============================================================

// COMPLETE SECOND WEIGHT

// ============================================================

#[derive(Debug, Serialize)]

pub struct CompletedWeighmentResponse {
    pub slip_no: String,

    pub vehicle_no: String,

    pub party_name: String,

    pub item_name: String,

    pub transaction_type: String,

    pub first_weight: f64,

    pub second_weight: f64,

    pub net_weight: f64,

    pub first_weight_label: String,

    pub second_weight_label: String,

    // NEW
    pub first_weight_at: Option<String>,

    pub second_weight_at: Option<String>,
}

// ============================================================

// SAVE SECOND WEIGHT

// ============================================================

// ============================================================

// COMPLETE SECOND WEIGHT

// ============================================================

#[derive(Debug, Deserialize)]
pub struct CompleteSecondWeightRequest {
    pub slip_no: String,
    pub second_weight: f64,
}

#[tauri::command]

pub fn complete_second_weight(
    request: CompleteSecondWeightRequest,
) -> Result<CompletedWeighmentResponse, String> {
    let connection = open_database()?;

    // --------------------------------------------------------

    // VALIDATE SECOND WEIGHT

    // --------------------------------------------------------

    if request.second_weight <= 0.0 {
        return Err("Second weight must be greater than zero.".to_string());
    }

    // --------------------------------------------------------

    // FIND PENDING WEIGHMENT

    // --------------------------------------------------------

    let result = connection.query_row(
        r#"

        SELECT

            w.id,

            w.slip_no,

            v.vehicle_no,

            p.name,

            i.name,

            w.weighing_mode,

            w.first_weight,

            w.first_weight_at

        FROM weighments w

        INNER JOIN vehicles v

            ON v.id = w.vehicle_id

        INNER JOIN parties p

            ON p.id = w.party_id

        INNER JOIN items i

            ON i.id = w.item_id

        WHERE w.slip_no = ?1

          AND w.second_weight IS NULL

        "#,
        params![request.slip_no.trim()],
        |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, f64>(6)?,
                row.get::<_, Option<String>>(7)?,
            ))
        },
    );

    let (
        id,
        slip_no,
        vehicle_no,
        party_name,
        item_name,
        transaction_type,
        first_weight,
        first_weight_at,
    ) = result
        .map_err(|_| "Slip number not found or weighment is already completed.".to_string())?;

    // --------------------------------------------------------

    // CALCULATE NET WEIGHT

    // --------------------------------------------------------

    let transaction_type_upper = transaction_type.to_uppercase();

    let (net_weight, first_weight_label, second_weight_label) =
        match transaction_type_upper.as_str() {
            // SALES:

            // First  = TARE

            // Second = GROSS

            // Net    = GROSS - TARE
            "SALES" => {
                if request.second_weight < first_weight {
                    return Err("Gross weight cannot be less than tare weight.".to_string());
                }

                (
                    request.second_weight - first_weight,
                    "TARE WEIGHT".to_string(),
                    "GROSS WEIGHT".to_string(),
                )
            }

            // PURCHASE:

            // First  = GROSS

            // Second = TARE

            // Net    = GROSS - TARE
            "PURCHASE" => {
                if first_weight < request.second_weight {
                    return Err("Tare weight cannot be greater than gross weight.".to_string());
                }

                (
                    first_weight - request.second_weight,
                    "GROSS WEIGHT".to_string(),
                    "TARE WEIGHT".to_string(),
                )
            }

            _ => {
                return Err("Invalid transaction type. Use SALES or PURCHASE.".to_string());
            }
        };

    // --------------------------------------------------------

    // SAVE SECOND WEIGHT

    // --------------------------------------------------------

    connection
        .execute(
            r#"

            UPDATE weighments

            SET

                second_weight = ?1,

                second_weight_at = CURRENT_TIMESTAMP,

                net_weight = ?2

            WHERE id = ?3

            "#,
            params![request.second_weight, net_weight, id],
        )
        .map_err(|error| format!("Failed to save second weight: {error}"))?;

    // --------------------------------------------------------

    // READ SECOND WEIGHT TIME

    // --------------------------------------------------------

    let second_weight_at: Option<String> = connection
        .query_row(
            r#"

            SELECT second_weight_at

            FROM weighments

            WHERE id = ?1

            "#,
            params![id],
            |row| row.get(0),
        )
        .map_err(|error| format!("Failed to read second weight timestamp: {error}"))?;

    // --------------------------------------------------------

    // RETURN COMPLETED WEIGHMENT

    // --------------------------------------------------------

    Ok(CompletedWeighmentResponse {
        slip_no,

        vehicle_no,

        party_name,

        item_name,

        transaction_type,

        first_weight,

        second_weight: request.second_weight,

        net_weight,

        first_weight_label,

        second_weight_label,

        first_weight_at,

        second_weight_at,
    })
}
