// pub fn parse_weight(data: &str) -> Option<f64> {
//     let cleaned = data.replace("kg", "").replace("KG", "").trim().to_string();

//     let number: String = cleaned
//         .chars()
//         .filter(|c| c.is_ascii_digit() || *c == '.')
//         .collect();

//     if number.is_empty() {
//         return None;
//     }

//     number.parse::<f64>().ok()
// }
pub fn parse_weight(data: &str) -> Option<f64> {
    let cleaned = data.replace("kg", "").replace("KG", "").trim().to_string();

    let number: String = cleaned
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '.')
        .collect();

    if number.is_empty() {
        return None;
    }

    number.parse::<f64>().ok()
}
