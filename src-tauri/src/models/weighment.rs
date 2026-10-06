use serde::Serialize;

#[derive(Debug, Clone)]
pub struct Weighment {
    pub vehicle_no: String,
    pub party_name: String,
    pub gross_weight: f64,
    pub tare_weight: f64,
}

impl Weighment {
    pub fn new(
        vehicle_no: String,
        party_name: String,
        gross_weight: f64,
        tare_weight: f64,
    ) -> Self {
        Self {
            vehicle_no,
            party_name,
            gross_weight,
            tare_weight,
        }
    }

    pub fn net_weight(&self) -> f64 {
        if self.gross_weight >= self.tare_weight {
            self.gross_weight - self.tare_weight
        } else {
            0.0
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct WeighmentResponse {
    pub vehicle_no: String,
    pub party_name: String,
    pub gross_weight: f64,
    pub tare_weight: f64,
    pub net_weight: f64,
}
