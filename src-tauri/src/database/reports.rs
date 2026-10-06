use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::database::sqlite::open_connection;

#[derive(Debug, Deserialize)]
pub struct ReportFilterRequest {
    pub from_date: String,
    pub to_date: String,
    pub transaction_type: String,
    pub party_name: String,
    pub item_name: String,
    pub vehicle_no: String,
}

#[derive(Debug, Serialize)]
pub struct ReportRow {
    pub id: i64,
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
    pub first_weight_at: Option<String>,
    pub second_weight_at: Option<String>,
    pub created_at: String,
    pub created_by_name: Option<String>,
}

#[tauri::command]
pub fn get_weighment_reports(request: ReportFilterRequest) -> Result<Vec<ReportRow>, String> {
    let connection = open_connection()?;

    let mut statement = connection
        .prepare(
            r#"
            SELECT
                w.id,
                w.slip_no,
                v.vehicle_no,
                p.name,
                i.name,
                w.weighing_mode,
                w.first_weight,
                w.second_weight,
                w.net_weight,
                w.first_weight_at,
                w.second_weight_at,
                w.created_at,
                u.full_name
            FROM weighments w
            INNER JOIN vehicles v ON v.id = w.vehicle_id
            INNER JOIN parties p ON p.id = w.party_id
            INNER JOIN items i ON i.id = w.item_id
            LEFT JOIN users u ON u.id = w.created_by
            WHERE w.second_weight IS NOT NULL
              AND w.net_weight IS NOT NULL
              AND (?1 = '' OR date(w.created_at, 'localtime') >= date(?1))
              AND (?2 = '' OR date(w.created_at, 'localtime') <= date(?2))
              AND (?3 = '' OR w.weighing_mode = ?3)
              AND (?4 = '' OR UPPER(p.name) = UPPER(?4))
              AND (?5 = '' OR UPPER(i.name) = UPPER(?5))
              AND (?6 = '' OR UPPER(v.vehicle_no) = UPPER(?6))
            ORDER BY w.created_at DESC, w.id DESC
            "#,
        )
        .map_err(|error| format!("Failed to prepare report query: {error}"))?;

    let rows = statement
        .query_map(
            params![
                request.from_date.trim(),
                request.to_date.trim(),
                request.transaction_type.trim().to_uppercase(),
                request.party_name.trim(),
                request.item_name.trim(),
                request.vehicle_no.trim(),
            ],
            |row| {
                let transaction_type: String = row.get(5)?;
                let first_weight_label = if transaction_type == "PURCHASE" {
                    "GROSS WEIGHT".to_string()
                } else {
                    "TARE WEIGHT".to_string()
                };

                let second_weight_label = if transaction_type == "PURCHASE" {
                    "TARE WEIGHT".to_string()
                } else {
                    "GROSS WEIGHT".to_string()
                };

                Ok(ReportRow {
                    id: row.get(0)?,
                    slip_no: row.get(1)?,
                    vehicle_no: row.get(2)?,
                    party_name: row.get(3)?,
                    item_name: row.get(4)?,
                    transaction_type,
                    first_weight: row.get(6)?,
                    second_weight: row.get(7)?,
                    net_weight: row.get(8)?,
                    first_weight_label,
                    second_weight_label,
                    first_weight_at: row.get(9)?,
                    second_weight_at: row.get(10)?,
                    created_at: row.get(11)?,
                    created_by_name: row.get(12)?,
                })
            },
        )
        .map_err(|error| format!("Failed to read report rows: {error}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Failed to collect report rows: {error}"))
}
