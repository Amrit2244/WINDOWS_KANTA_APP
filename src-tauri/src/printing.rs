use base64::{engine::general_purpose, Engine as _};
use std::fs;
use std::path::PathBuf;
use std::process::Command;

#[tauri::command]
pub fn print_weighment_pdf(pdf_base64: String) -> Result<String, String> {
    // Decode PDF
    let pdf_bytes = general_purpose::STANDARD
        .decode(&pdf_base64)
        .map_err(|error| format!("Invalid PDF data: {error}"))?;

    // Create a unique temporary PDF
    let pdf_path: PathBuf = std::env::temp_dir().join("kisan_kanta_weighment_preview.pdf");

    fs::write(&pdf_path, pdf_bytes)
        .map_err(|error| format!("Could not create temporary PDF: {error}"))?;

    // Open PDF using Windows default PDF application.
    // This gives the user a preview before printing.
    Command::new("cmd")
        .args([
            "/C",
            "start",
            "",
            pdf_path
                .to_str()
                .ok_or_else(|| "Invalid PDF path".to_string())?,
        ])
        .spawn()
        .map_err(|error| format!("Could not open PDF preview: {error}"))?;

    Ok(format!("Print preview opened: {}", pdf_path.display()))
}
