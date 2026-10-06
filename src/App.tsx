import { useEffect, useState, type CSSProperties } from "react";

import "./App.css";

import { invoke } from "@tauri-apps/api/core";

import { listen } from "@tauri-apps/api/event";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ============================================================

// TYPES

// ============================================================

// NEW: These are the pages in our application.
const APP_VERSION = "2.11.9";

type Page =
  | "dashboard"
  | "weighing"
  | "users"
  | "parties"
  | "items"
  | "vehicles"
  | "reports"
  | "settings";

// NEW: Information returned from Rust after login.

interface User {
  id: number;

  username: string;

  full_name: string;

  role: string;
}

interface VehicleOption {
  id: number;

  vehicle_no: string;
}

interface PartyOption {
  id: number;

  name: string;
}

interface ItemOption {
  id: number;

  name: string;
}

interface ReportRow {
  id: number;
  slip_no: string;
  vehicle_no: string;
  party_name: string;
  item_name: string;
  transaction_type: string;
  first_weight: number;
  second_weight: number;
  net_weight: number;
  first_weight_label: string;
  second_weight_label: string;
  first_weight_at: string | null;
  second_weight_at: string | null;
  created_at: string;
  created_by_name: string | null;
}

interface AppSettings {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_gstin: string;
  company_logo_path: string;
  slip_footer: string;
  weighing_mode: string;
  com_port: string;
  baud_rate: number;
  data_bits: number;
  stop_bits: number;
  parity: string;
  auto_reconnect: boolean;
  stable_weight_required: boolean;
  weight_unit: string;
  decimal_places: number;
  paper_size: string;
  orientation: string;
  print_preview: boolean;
  printer_name: string;
  copies: number;
  show_logo: boolean;
  show_company_details: boolean;
  show_operator: boolean;
  show_signatures: boolean;
  tally_enabled: boolean;
  tally_host: string;
  tally_port: number;
  tally_company: string;
  tally_sales_enabled: boolean;
  tally_purchase_enabled: boolean;
  tally_auto_voucher: boolean;
}

interface DatabaseInfo {
  path: string;
  exists: boolean;
  size_bytes: number;
}

export default function App() {
  // ============================================================

  // AUTHENTICATION

  // ============================================================

  // NEW:

  // false = show Login/Register

  // true  = show main application

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // NEW:

  // Stores the logged-in user's information.

  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // NEW:

  // Controls whether we show Login or Registration.

  const [authPage, setAuthPage] = useState<"login" | "register">("login");

  // Login fields

  const [loginUsername, setLoginUsername] = useState("");

  const [loginPassword, setLoginPassword] = useState("");

  const [loginError, setLoginError] = useState("");

  //new

  const [transactionType, setTransactionType] = useState<"SALES" | "PURCHASE">(
    "PURCHASE",
  );

  const [weighingTab, setWeighingTab] = useState<"FIRST" | "SECOND">("FIRST");

  const [itemName, setItemName] = useState("");

  const [generatedSlipNo, setGeneratedSlipNo] = useState("");

  const [secondSlipNo, setSecondSlipNo] = useState("");

  const [pendingWeighment, setPendingWeightment] = useState<{
    id: number;

    slip_no: string;

    vehicle_no: string;

    party_name: string;

    item_name: string;

    transaction_type: string;

    first_weight: number;

    first_weight_label: string;
  } | null>(null);

  const [completedWeightment, setCompletedWeightment] = useState<{
    slip_no: string;
    vehicle_no: string;
    party_name: string;
    item_name: string;
    transaction_type: string;
    first_weight: number;
    second_weight: number;
    net_weight: number;
    first_weight_label: string;
    second_weight_label: string;

    // NEW: timestamps returned by Rust
    first_weight_at: string | null;
    second_weight_at: string | null;
  } | null>(null);

  // ============================================================

  // APPLICATION PAGE

  // ============================================================

  // NEW:

  // This controls which page is displayed.

  const [currentPage, setCurrentPage] = useState<Page>("dashboard");

  const [reportFromDate, setReportFromDate] = useState("");
  const [reportToDate, setReportToDate] = useState("");
  const [reportTransactionType, setReportTransactionType] = useState("");
  const [reportParty, setReportParty] = useState("");
  const [reportItem, setReportItem] = useState("");
  const [reportVehicle, setReportVehicle] = useState("");
  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);

  // ============================================================
  // APPLICATION SETTINGS
  // ============================================================

  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [databaseInfo, setDatabaseInfo] = useState<DatabaseInfo | null>(null);

  const [settingsSection, setSettingsSection] = useState<
    | "company"
    | "weighing"
    | "printing"
    | "database"
    | "security"
    | "tally"
    | "application"
  >("company");

  const [currentSettingsPassword, setCurrentSettingsPassword] = useState("");
  const [newSettingsPassword, setNewSettingsPassword] = useState("");

  // ============================================================

  // WEIGHING

  // ============================================================

  const [vehicleNo, setVehicleNo] = useState("");

  const [partyName, setPartyName] = useState("");

  const [liveWeight, setLiveWeight] = useState(0);

  const [firstWeight, setFirstWeight] = useState<number | null>(null);

  const [secondWeight, setSecondWeight] = useState<number | null>(null);

  // FIX: firstWeight/secondWeight must exist before netWeight is calculated.

  // Rust remains the authoritative net weight after completion.

  const netWeight =
    completedWeightment?.net_weight ??
    (firstWeight !== null && secondWeight !== null
      ? transactionType === "PURCHASE"
        ? Math.max(firstWeight - secondWeight, 0)
        : Math.max(secondWeight - firstWeight, 0)
      : 0);

  // ============================================================

  // USER REGISTRATION FORM

  // ============================================================

  const [newFullName, setNewFullName] = useState("");

  const [newUsername, setNewUsername] = useState("");

  const [newPassword, setNewPassword] = useState("");

  const [newRole, setNewRole] = useState("operator");

  // ============================================================

  // PARTY FORM

  // ============================================================

  const [partyFormName, setPartyFormName] = useState("");

  const [partyAddress, setPartyAddress] = useState("");

  const [partyPhone, setPartyPhone] = useState("");

  const [partyGstin, setPartyGstin] = useState("");

  // ============================================================

  // ITEM FORM

  // ============================================================

  // IMPORTANT: separate state for Item Registration.

  // The weighing screen uses itemName; registration uses itemFormName.

  const [itemFormName, setItemFormName] = useState("");

  const [itemCode, setItemCode] = useState("");

  const [itemUnit, setItemUnit] = useState("KG");

  // ============================================================

  // VEHICLE FORM

  // ============================================================

  const [newVehicleNo, setNewVehicleNo] = useState("");

  const [ownerName, setOwnerName] = useState("");

  // ============================================================

  // MASTER DATA USED BY WEIGHING DROPDOWNS

  // ============================================================

  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);

  const [parties, setParties] = useState<PartyOption[]>([]);

  const [items, setItems] = useState<ItemOption[]>([]);

  const [loadingMasterData, setLoadingMasterData] = useState(false);

  // ============================================================
  // ESTIMATED WEIGHT SLIP
  // ============================================================

  // NEW: Controls the Estimated Weight Slip editor.
  const [showEstimatedSlip, setShowEstimatedSlip] = useState(false);

  // NEW: Temporary gross weight used ONLY for estimated printing.
  const [estimatedGrossWeight, setEstimatedGrossWeight] = useState("");

  // NEW: Temporary tare weight used ONLY for estimated printing.
  const [estimatedTareWeight, setEstimatedTareWeight] = useState("");

  const estimatedGross = Number(estimatedGrossWeight) || 0;
  const estimatedTare = Number(estimatedTareWeight) || 0;

  const estimatedNetWeight = Math.max(estimatedGross - estimatedTare, 0);
  // ============================================================

  // NET WEIGHT

  // ============================================================

  // CHANGED:

  // Net weight is calculated from first and second weight.

  // const netWeight =

  //   firstWeight !== null &&

  //   secondWeight !== null

  //     ? Math.abs(firstWeight - secondWeight)

  //     : 0;

  // ============================================================

  // LISTEN TO RUST WEIGHT SIMULATOR

  // ============================================================

  // NEW:

  // Rust sends "weight-update" events.

  // React listens to those events here.

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      unlisten = await listen<number>(
        "weight-update",

        (event) => {
          console.log(
            "Weight from Rust:",

            event.payload,
          );

          setLiveWeight(event.payload);
        },
      );
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  // ============================================================

  // LOGIN

  // ============================================================

  // Added new functions
  // ============================================================
  // ESTIMATED WEIGHT SLIP
  // ============================================================

  function openEstimatedSlip(
    row:
      | ReportRow
      | {
          slip_no: string;
          vehicle_no: string;
          party_name: string;
          item_name: string;
          transaction_type: string;
          first_weight: number;
          second_weight: number;
          net_weight: number;
          first_weight_label: string;
          second_weight_label: string;
          first_weight_at?: string | null;
          second_weight_at?: string | null;
          created_by_name?: string | null;
        },
  ) {
    // Convert the saved transaction into normal
    // Gross / Tare fields for the estimate editor.

    const gross =
      row.first_weight_label === "GROSS WEIGHT"
        ? row.first_weight
        : row.second_weight;

    const tare =
      row.first_weight_label === "TARE WEIGHT"
        ? row.first_weight
        : row.second_weight;

    setEstimatedGrossWeight(gross.toFixed(2));
    setEstimatedTareWeight(tare.toFixed(2));

    setShowEstimatedSlip(true);
  }

  // ============================================================
  // PRINT ESTIMATED WEIGHT SLIP
  // ============================================================

  async function printEstimatedSlip(
    row:
      | ReportRow
      | {
          slip_no: string;
          vehicle_no: string;
          party_name: string;
          item_name: string;
          transaction_type: string;
          first_weight: number;
          second_weight: number;
          net_weight: number;
          first_weight_label: string;
          second_weight_label: string;
          first_weight_at?: string | null;
          second_weight_at?: string | null;
          created_by_name?: string | null;
        },
  ) {
    // ==========================================================
    // READ ESTIMATED VALUES
    // ==========================================================

    const grossWeight = Number(estimatedGrossWeight);
    const tareWeight = Number(estimatedTareWeight);

    // ==========================================================
    // VALIDATION
    // ==========================================================

    if (!Number.isFinite(grossWeight) || grossWeight <= 0) {
      alert("Please enter a valid gross weight.");
      return;
    }

    if (!Number.isFinite(tareWeight) || tareWeight <= 0) {
      alert("Please enter a valid tare weight.");
      return;
    }

    if (grossWeight < tareWeight) {
      alert("Gross weight cannot be less than tare weight.");
      return;
    }

    // IMPORTANT:
    // This is only an estimated calculation.
    // Nothing is written back to SQLite.

    const estimatedNetWeight = grossWeight - tareWeight;

    const operatorName =
      row.created_by_name || currentUser?.full_name || "Authorized Operator";

    try {
      // ========================================================
      // CREATE A5 PDF
      // ========================================================

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a5",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const left = 8;
      const right = pageWidth - 8;

      // ========================================================
      // OUTER BORDER
      // ========================================================

      pdf.setLineWidth(0.7);

      pdf.rect(left, 7, right - left, pageHeight - 14);

      // ========================================================
      // HEADER
      // ========================================================

      let y = 16;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(19);

      pdf.text("KISAN DHARAM KANTA", pageWidth / 2, y, {
        align: "center",
      });

      y += 7;

      pdf.setFontSize(11);

      pdf.text("ESTIMATED WEIGHT SLIP", pageWidth / 2, y, {
        align: "center",
      });

      y += 5;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);

      pdf.text("For Estimation / Printing Purpose Only", pageWidth / 2, y, {
        align: "center",
      });

      // ========================================================
      // SEPARATOR
      // ========================================================

      y += 7;

      pdf.setLineWidth(0.5);

      pdf.line(left + 4, y, right - 4, y);

      // ========================================================
      // SLIP INFORMATION
      // ========================================================

      y += 7;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);

      pdf.text(`Slip No: ${row.slip_no}`, left + 5, y);

      pdf.text(row.transaction_type, right - 5, y, {
        align: "right",
      });

      // ========================================================
      // MAIN DETAILS
      // ========================================================

      y += 5;

      autoTable(pdf, {
        startY: y,

        margin: {
          left: left + 4,
          right: left + 4,
        },

        theme: "grid",

        body: [
          ["Vehicle Number", row.vehicle_no],
          ["Party Name", row.party_name],
          ["Item", row.item_name],
          ["Gross Weight", `${grossWeight.toFixed(2)} KG`],
          ["Tare Weight", `${tareWeight.toFixed(2)} KG`],
        ],

        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 2.7,
          lineWidth: 0.2,
          valign: "middle",
        },

        columnStyles: {
          0: {
            fontStyle: "bold",
            cellWidth: 48,
          },

          1: {
            cellWidth: "auto",
          },
        },
      });

      // ========================================================
      // FIND TABLE END
      // ========================================================

      const tableEndY =
        (
          pdf as jsPDF & {
            lastAutoTable?: {
              finalY: number;
            };
          }
        ).lastAutoTable?.finalY ?? y + 50;

      // ========================================================
      // ESTIMATED NET WEIGHT
      // ========================================================

      y = tableEndY + 8;

      const netBoxHeight = 23;

      pdf.setLineWidth(0.8);

      pdf.rect(left + 4, y, right - left - 8, netBoxHeight);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);

      pdf.text("ESTIMATED NET WEIGHT", pageWidth / 2, y + 7, {
        align: "center",
      });

      pdf.setFontSize(17);

      pdf.text(`${estimatedNetWeight.toFixed(2)} KG`, pageWidth / 2, y + 17, {
        align: "center",
      });

      // ========================================================
      // TIME INFORMATION
      // ========================================================

      y += netBoxHeight + 8;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);

      pdf.text(
        `In: ${formatReportDate(row.first_weight_at ?? null)}`,
        left + 5,
        y,
      );

      pdf.text(
        `Out: ${formatReportDate(row.second_weight_at ?? null)}`,
        right - 5,
        y,
        {
          align: "right",
        },
      );

      // ========================================================
      // SIGNATURE SECTION
      // ========================================================

      y += 17;

      const signatureWidth = 45;

      const leftSignatureX = left + 12;

      const rightSignatureX = right - 12;

      pdf.setLineWidth(0.5);

      // Operator signature

      pdf.line(leftSignatureX, y, leftSignatureX + signatureWidth, y);

      // Customer signature

      pdf.line(rightSignatureX - signatureWidth, y, rightSignatureX, y);

      pdf.setFontSize(7.5);

      pdf.text(operatorName, leftSignatureX + signatureWidth / 2, y + 5, {
        align: "center",
      });

      pdf.text("Operator / User", leftSignatureX + signatureWidth / 2, y + 9, {
        align: "center",
      });

      pdf.text(
        "Customer Signature",
        rightSignatureX - signatureWidth / 2,
        y + 5,
        {
          align: "center",
        },
      );

      pdf.text(
        "Party Representative",
        rightSignatureX - signatureWidth / 2,
        y + 9,
        {
          align: "center",
        },
      );

      // ========================================================
      // FOOTER
      // ========================================================

      y += 19;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.5);

      pdf.text(
        "ESTIMATED SLIP - NOT A DATABASE WEIGHMENT RECORD",
        pageWidth / 2,
        y,
        {
          align: "center",
        },
      );

      // ========================================================
      // CONVERT PDF TO BASE64
      // ========================================================

      const dataUri = pdf.output("datauristring");

      const pdfBase64 = dataUri.substring(dataUri.indexOf(",") + 1);

      // ========================================================
      // SEND TO WINDOWS PRINTER
      // ========================================================

      const result = await invoke<string>("print_weighment_pdf", {
        pdfBase64,
      });

      console.log("Estimated slip sent to printer:", result);

      alert("Estimated weight slip sent to printer.");

      // Close modal after successful printing.

      setShowEstimatedSlip(false);
    } catch (error) {
      console.error("Estimated slip printing failed:", error);

      alert(`Estimated slip printing failed.\n\n${String(error)}`);
    }
  }

  async function saveFirstWeight() {
    if (!vehicleNo.trim()) {
      alert("Vehicle number is required.");

      return;
    }

    if (!partyName.trim()) {
      alert("Party name is required.");

      return;
    }

    if (!itemName.trim()) {
      alert("Item name is required.");

      return;
    }

    if (liveWeight <= 0) {
      alert("Live weight must be greater than zero.");

      return;
    }

    try {
      const result = await invoke<{
        id: number;

        slip_no: string;

        vehicle_no: string;

        party_name: string;

        item_name: string;

        transaction_type: string;

        first_weight: number;

        first_weight_label: string;
      }>("create_first_weight", {
        request: {
          vehicle_no: vehicleNo,

          party_name: partyName,

          item_name: itemName,

          transaction_type: transactionType,

          first_weight: liveWeight,

          created_by: currentUser?.id ?? null,
        },
      });

      setGeneratedSlipNo(result.slip_no);

      setFirstWeight(result.first_weight);

      // FIX: automatically prepare the SECOND WEIGHT tab.

      setSecondSlipNo(result.slip_no);

      setWeighingTab("SECOND");

      alert(`First weight saved.\nSlip No:${result.slip_no}`);

      console.log("First Weight:", result);
    } catch (error) {
      console.error(error);

      alert(String(error));
    }
  }

  //new second weight saved function

  async function fetchPendingWeighment() {
    if (!secondSlipNo.trim()) {
      alert("Please enter the slip number.");

      return;
    }

    try {
      const result = await invoke<{
        id: number;

        slip_no: string;

        vehicle_no: string;

        party_name: string;

        item_name: string;

        transaction_type: string;

        first_weight: number;

        first_weight_label: string;
      }>("get_pending_weighment", {
        slip_no: secondSlipNo.trim(),
      });

      setPendingWeightment(result);

      setLiveWeight(0);

      alert(`Weighment found.\nVehicle:${result.vehicle_no}`);
    } catch (error) {
      console.error(error);

      setPendingWeightment(null);

      alert(String(error));
    }
  }

  // New complete the second weight function

  async function saveSecondWeight() {
    if (!pendingWeighment) {
      alert("Please fetch the slip number");

      return;
    }

    if (liveWeight <= 0) {
      alert("Live weight must be greater than zero.");

      return;
    }

    try {
      const result = await invoke<{
        slip_no: string;
        vehicle_no: string;
        party_name: string;
        item_name: string;
        transaction_type: string;
        first_weight: number;
        second_weight: number;
        net_weight: number;
        first_weight_label: string;
        second_weight_label: string;

        // NEW
        first_weight_at: string | null;
        second_weight_at: string | null;
      }>("complete_second_weight", {
        request: {
          slip_no: pendingWeighment.slip_no,

          second_weight: liveWeight,
        },
      });

      setCompletedWeightment(result);

      setFirstWeight(result.first_weight);

      setSecondWeight(result.second_weight);

      setTransactionType(
        result.transaction_type === "SALES" ? "SALES" : "PURCHASE",
      );

      alert(
        `Weighment completed. \n\n` +
          `Slip:${result.slip_no}\n` +
          `Net Weight:${result.net_weight.toFixed(2)}KG`,
      );
    } catch (error) {
      console.error(error);

      alert(String(error));
    }

    // ============================================================
  }

  // ============================================================
  // REPORTS / PRINT / EXPORT
  // ============================================================

  async function loadReports() {
    setReportLoading(true);
    try {
      const result = await invoke<ReportRow[]>("get_weighment_reports", {
        request: {
          from_date: reportFromDate,
          to_date: reportToDate,
          transaction_type: reportTransactionType,
          party_name: reportParty,
          item_name: reportItem,
          vehicle_no: reportVehicle,
        },
      });
      setReportRows(result);
    } catch (error) {
      console.error(error);
      alert(String(error));
    } finally {
      setReportLoading(false);
    }
  }

  useEffect(() => {
    if (isLoggedIn && currentPage === "reports") {
      loadReports();
    }
  }, [isLoggedIn, currentPage]);

  // ============================================================
  // SETTINGS
  // ============================================================

  async function loadAppSettings() {
    setSettingsLoading(true);

    try {
      const [settings, database] = await Promise.all([
        invoke<AppSettings>("get_app_settings"),
        invoke<DatabaseInfo>("get_database_info"),
      ]);

      setAppSettings(settings);
      setDatabaseInfo(database);
    } catch (error) {
      console.error("Failed to load settings:", error);
      alert(`Could not load settings.\n\n${String(error)}`);
    } finally {
      setSettingsLoading(false);
    }
  }

  async function saveAppSettings() {
    if (!appSettings) {
      return;
    }

    setSettingsSaving(true);

    try {
      await invoke("save_app_settings", {
        settings: appSettings,
      });

      alert("Settings saved successfully.");
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert(`Could not save settings.\n\n${String(error)}`);
    } finally {
      setSettingsSaving(false);
    }
  }

  async function backupDatabase() {
    try {
      const path = await invoke<string>("backup_database");
      alert(`Database backup completed successfully.\n\n${path}`);
    } catch (error) {
      console.error("Database backup failed:", error);
      alert(`Database backup failed.\n\n${String(error)}`);
    }
  }

  async function openDatabaseFolder() {
    try {
      await invoke("open_database_folder");
    } catch (error) {
      console.error("Could not open database folder:", error);
      alert(String(error));
    }
  }

  function updateSetting<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) {
    setAppSettings((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [key]: value,
      };
    });
  }

  useEffect(() => {
    if (isLoggedIn && currentPage === "settings") {
      loadAppSettings();
    }
  }, [isLoggedIn, currentPage]);

  function formatReportDate(value: string | null) {
    return value ? value.replace("T", " ") : "-";
  }

  async function printSlip(
    row:
      | ReportRow
      | {
          slip_no: string;
          vehicle_no: string;
          party_name: string;
          item_name: string;
          transaction_type: string;
          first_weight: number;
          second_weight: number;
          net_weight: number;
          first_weight_label: string;
          second_weight_label: string;
          first_weight_at?: string | null;
          second_weight_at?: string | null;
          created_by_name?: string | null;
        },
  ) {
    const operatorName =
      row.created_by_name || currentUser?.full_name || "Authorized Operator";

    const transaction =
      row.transaction_type === "PURCHASE" ? "PURCHASE" : "SALES";

    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a5",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const left = 8;
      const right = pageWidth - 8;

      // ============================================================
      // OUTER BORDER
      // ============================================================

      pdf.setLineWidth(0.7);
      pdf.rect(left, 7, right - left, pageHeight - 14);

      // ============================================================
      // HEADER
      // ============================================================

      let y = 16;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(19);

      pdf.text("KISAN DHARAM KANTA", pageWidth / 2, y, { align: "center" });

      y += 7;

      pdf.setFontSize(10);

      pdf.text("WEIGHMENT SLIP", pageWidth / 2, y, { align: "center" });

      y += 5;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);

      pdf.text("Computerized Weighbridge Receipt", pageWidth / 2, y, {
        align: "center",
      });

      // ============================================================
      // HEADER SEPARATOR
      // ============================================================

      y += 7;

      pdf.setLineWidth(0.6);

      pdf.line(left + 4, y, right - 4, y);

      // ============================================================
      // SLIP INFORMATION
      // ============================================================

      y += 7;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);

      pdf.text(`Slip No: ${row.slip_no}`, left + 5, y);

      pdf.text(transaction, right - 5, y, { align: "right" });

      // ============================================================
      // MAIN DETAILS TABLE
      // ============================================================

      y += 5;

      autoTable(pdf, {
        startY: y,
        margin: {
          left: left + 4,
          right: left + 4,
        },

        theme: "grid",

        head: [],

        body: [
          ["Vehicle Number", row.vehicle_no],
          ["Party Name", row.party_name],
          ["Item", row.item_name],
          [row.first_weight_label, `${row.first_weight.toFixed(2)} KG`],
          [row.second_weight_label, `${row.second_weight.toFixed(2)} KG`],
        ],

        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 2.7,
          lineWidth: 0.2,
          valign: "middle",
        },

        columnStyles: {
          0: {
            fontStyle: "bold",
            cellWidth: 48,
          },

          1: {
            cellWidth: "auto",
          },
        },

        didParseCell: (data) => {
          if (data.column.index === 0) {
            data.cell.styles.fontStyle = "bold";
          }
        },
      });

      const tableEndY =
        (
          pdf as jsPDF & {
            lastAutoTable?: { finalY: number };
          }
        ).lastAutoTable?.finalY ?? y + 50;

      // ============================================================
      // NET WEIGHT
      // ============================================================

      y = tableEndY + 8;

      const netBoxHeight = 23;

      pdf.setLineWidth(0.8);

      pdf.rect(left + 4, y, right - left - 8, netBoxHeight);

      pdf.setFont("helvetica", "bold");

      pdf.setFontSize(8);

      pdf.text("NET WEIGHT", pageWidth / 2, y + 7, { align: "center" });

      pdf.setFontSize(17);

      pdf.text(`${row.net_weight.toFixed(2)} KG`, pageWidth / 2, y + 17, {
        align: "center",
      });

      // ============================================================
      // DATE / TIME
      // ============================================================

      y += netBoxHeight + 8;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);

      pdf.text(
        `First: ${formatReportDate(row.first_weight_at ?? null)}`,
        left + 5,
        y,
      );

      pdf.text(
        `Second: ${formatReportDate(row.second_weight_at ?? null)}`,
        right - 5,
        y,
        { align: "right" },
      );

      // ============================================================
      // SIGNATURE SECTION
      // ============================================================

      y += 17;

      const signatureWidth = 45;

      const leftSignatureX = left + 12;

      const rightSignatureX = right - 12;

      pdf.setLineWidth(0.5);

      // Operator signature line
      pdf.line(leftSignatureX, y, leftSignatureX + signatureWidth, y);

      // Customer signature line
      pdf.line(rightSignatureX - signatureWidth, y, rightSignatureX, y);

      pdf.setFontSize(7.5);

      pdf.text(operatorName, leftSignatureX + signatureWidth / 2, y + 5, {
        align: "center",
      });

      pdf.text("Operator / User", leftSignatureX + signatureWidth / 2, y + 9, {
        align: "center",
      });

      pdf.text(
        "Customer Signature",
        rightSignatureX - signatureWidth / 2,
        y + 5,
        { align: "center" },
      );

      pdf.text(
        "Party Representative",
        rightSignatureX - signatureWidth / 2,
        y + 9,
        { align: "center" },
      );

      // ============================================================
      // FOOTER
      // ============================================================

      y += 19;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.5);

      pdf.text(
        "This is a computer-generated weighment slip.",
        pageWidth / 2,
        y,
        { align: "center" },
      );

      // ============================================================
      // OPEN PREVIEW
      // ============================================================

      const dataUri = pdf.output("datauristring");

      const pdfBase64 = dataUri.substring(dataUri.indexOf(",") + 1);

      const previewResult = await invoke<string>("print_weighment_pdf", {
        pdfBase64: pdfBase64,
      });

      console.log("Print preview opened:", previewResult);
    } catch (error) {
      console.error("Print preview failed:", error);

      alert(`Print preview failed.\n\n${String(error)}`);
    }
  }

  function exportReportsToExcel() {
    if (!reportRows.length) {
      alert("There are no report records to export.");
      return;
    }
    const rows = reportRows.map((r) => ({
      "Slip No": r.slip_no,
      Date: formatReportDate(r.created_at),
      Transaction: r.transaction_type,
      "Vehicle No": r.vehicle_no,
      Party: r.party_name,
      Item: r.item_name,
      "First Weight": r.first_weight,
      "Second Weight": r.second_weight,
      "Net Weight (KG)": r.net_weight,
      Operator: r.created_by_name || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 14 },
      { wch: 20 },
      { wch: 12 },
      { wch: 16 },
      { wch: 28 },
      { wch: 22 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 24 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Weighment Report");
    XLSX.writeFile(
      wb,
      `Kisan_Kanta_Report_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  }

  function exportReportsToPdf() {
    if (!reportRows.length) {
      alert("There are no report records to export.");
      return;
    }
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });
    pdf.setFontSize(18);
    pdf.text("KISAN DHARAM KANTA", 14, 14);
    pdf.setFontSize(11);
    pdf.text("WEIGHMENT REPORT", 14, 21);
    pdf.setFontSize(9);
    pdf.text(`Generated by: ${currentUser?.full_name || "User"}`, 14, 27);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, 14, 32);
    autoTable(pdf, {
      startY: 37,
      head: [
        [
          "Slip",
          "Date",
          "Type",
          "Vehicle",
          "Party",
          "Item",
          "First",
          "Second",
          "Net",
          "Operator",
        ],
      ],
      body: reportRows.map((r) => [
        r.slip_no,
        formatReportDate(r.created_at),
        r.transaction_type,
        r.vehicle_no,
        r.party_name,
        r.item_name,
        `${r.first_weight.toFixed(2)} KG`,
        `${r.second_weight.toFixed(2)} KG`,
        `${r.net_weight.toFixed(2)} KG`,
        r.created_by_name || "",
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fontStyle: "bold" },
      margin: { left: 10, right: 10 },
    });
    pdf.save(`Kisan_Kanta_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  // LOAD MASTER DATA FOR WEIGHING DROPDOWNS

  // ============================================================

  async function loadMasterData() {
    setLoadingMasterData(true);

    try {
      const [vehicleResult, partyResult, itemResult] = await Promise.all([
        invoke<VehicleOption[]>("get_vehicles"),

        invoke<PartyOption[]>("get_parties"),

        invoke<ItemOption[]>("get_items"),
      ]);

      setVehicles(vehicleResult);

      setParties(partyResult);

      setItems(itemResult);
    } catch (error) {
      console.error("Failed to load master data:", error);
    } finally {
      setLoadingMasterData(false);
    }
  }

  useEffect(() => {
    if (isLoggedIn) {
      loadMasterData();
    }
  }, [isLoggedIn]);

  // Calls the Rust login_user command.

  async function handleLogin() {
    setLoginError("");

    if (!loginUsername.trim() || !loginPassword) {
      setLoginError("Please enter username and password.");

      return;
    }

    try {
      const user = await invoke<User>("login_user", {
        request: {
          username: loginUsername.trim(),

          password: loginPassword,
        },
      });

      console.log(
        "Logged in user:",

        user,
      );

      setCurrentUser(user);

      setIsLoggedIn(true);

      setCurrentPage("dashboard");

      setLoginUsername("");

      setLoginPassword("");
    } catch (error) {
      console.error(error);

      setLoginError(String(error));
    }
  }

  // ============================================================

  // LOGOUT

  // ============================================================

  // NEW:

  function handleLogout() {
    setCurrentUser(null);

    setIsLoggedIn(false);

    setAuthPage("login");

    setCurrentPage("dashboard");
  }

  // ============================================================

  // USER REGISTRATION

  // ============================================================

  // NEW:

  async function handleRegisterUser() {
    if (!newFullName.trim()) {
      alert("Full name is required.");

      return;
    }

    if (!newUsername.trim()) {
      alert("Username is required.");

      return;
    }

    if (!newPassword) {
      alert("Password is required.");

      return;
    }

    if (newPassword.length < 6) {
      alert("Password must contain at least 6 characters.");

      return;
    }

    try {
      await invoke("register_user", {
        request: {
          full_name: newFullName.trim(),

          username: newUsername.trim(),

          password: newPassword,

          role: newRole,
        },
      });

      alert("User registered successfully.\n\nYou can now login.");

      // Clear registration form

      setNewFullName("");

      setNewUsername("");

      setNewPassword("");

      setNewRole("operator");

      // NEW:

      // Go back to Login page.

      setAuthPage("login");
    } catch (error) {
      console.error(error);

      alert(String(error));
    }
  }

  // ============================================================

  // PARTY REGISTRATION

  // ============================================================

  // NEW:

  async function handleCreateParty() {
    if (!partyFormName.trim()) {
      alert("Party name is required.");

      return;
    }

    try {
      await invoke("create_party", {
        request: {
          name: partyFormName.trim(),

          address: partyAddress.trim(),

          phone: partyPhone.trim(),

          gstin: partyGstin.trim(),
        },
      });

      alert("Party created successfully.");

      setPartyFormName("");

      setPartyAddress("");

      setPartyPhone("");

      setPartyGstin("");

      await loadMasterData();
    } catch (error) {
      console.error(error);

      alert(String(error));
    }
  }

  // ============================================================

  // ITEM REGISTRATION

  // ============================================================

  // NEW:

  async function handleCreateItem() {
    if (!itemFormName.trim()) {
      alert("Item name is required.");

      return;
    }

    try {
      await invoke("create_item", {
        request: {
          name: itemFormName.trim(),

          code: itemCode.trim(),

          unit: itemUnit,
        },
      });

      alert("Item created successfully.");

      setItemFormName("");

      setItemCode("");

      setItemUnit("KG");

      await loadMasterData();
    } catch (error) {
      console.error(error);

      alert(String(error));
    }
  }

  // ============================================================

  // VEHICLE REGISTRATION

  // ============================================================

  // NEW:

  async function handleCreateVehicle() {
    if (!newVehicleNo.trim()) {
      alert("Vehicle number is required.");

      return;
    }

    try {
      await invoke("create_vehicle", {
        request: {
          vehicle_no: newVehicleNo

            .trim()

            .toUpperCase(),

          owner_name: ownerName.trim(),
        },
      });

      alert("Vehicle created successfully.");

      setNewVehicleNo("");

      setOwnerName("");

      await loadMasterData();
    } catch (error) {
      console.error(error);

      alert(String(error));
    }
  }

  // ============================================================

  // WEIGHING FUNCTIONS

  // ============================================================

  function resetWeighment() {
    setTransactionType("PURCHASE");

    setWeighingTab("FIRST");

    setVehicleNo("");

    setPartyName("");

    setItemName("");

    setGeneratedSlipNo("");

    setSecondSlipNo("");

    setPendingWeightment(null);

    setCompletedWeightment(null);

    setLiveWeight(0);

    setFirstWeight(null);

    setSecondWeight(null);
  }

  // ============================================================

  // LOGIN / REGISTER SCREEN

  // ============================================================

  // NEW:

  // If user is NOT logged in,

  // show Login or Registration page.

  if (!isLoggedIn) {
    // ========================================================

    // REGISTRATION PAGE

    // ========================================================

    if (authPage === "register") {
      return (
        <div className="login-page">
          <div className="login-card">
            <div className="login-logo">K</div>

            <h1>CREATE USER</h1>

            <p className="login-subtitle">Register a new Kisan Kanta user</p>

            {/* FULL NAME */}

            <div className="form-group">
              <label>Full Name *</label>

              <input
                type="text"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="Enter full name"
              />
            </div>

            {/* USERNAME */}

            <div className="form-group">
              <label>Username *</label>

              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Enter username"
              />
            </div>

            {/* PASSWORD */}

            <div className="form-group">
              <label>Password *</label>

              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
              />
            </div>

            {/* ROLE */}

            <div className="form-group">
              <label>Role</label>

              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              >
                <option value="operator">Operator</option>

                <option value="admin">Admin</option>
              </select>
            </div>

            {/* CREATE USER */}

            <button
              className="primary-button login-button"
              onClick={handleRegisterUser}
            >
              Create Account
            </button>

            {/* BACK TO LOGIN */}

            <button
              className="auth-link-button"
              onClick={() => setAuthPage("login")}
            >
              ← Back to Login
            </button>
          </div>
        </div>
      );
    }

    // ========================================================

    // LOGIN PAGE

    // ========================================================

    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">K</div>

          <h1>KISAN KANTA</h1>

          <p className="login-subtitle">Weighbridge Management System</p>

          {/* USERNAME */}

          <div className="form-group">
            <label>Username</label>

            <input
              type="text"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              placeholder="Enter username"
            />
          </div>

          {/* PASSWORD */}

          <div className="form-group">
            <label>Password</label>

            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="Enter password"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleLogin();
                }
              }}
            />
          </div>

          {/* LOGIN ERROR */}

          {loginError && <div className="error-message">{loginError}</div>}

          {/* LOGIN BUTTON */}

          <button className="primary-button login-button" onClick={handleLogin}>
            Login
          </button>

          {/* ==================================================



              NEW:



              REGISTER USER LINK



              ================================================== */}

          <div className="register-link">
            <span>Don't have an account?</span>

            <button onClick={() => setAuthPage("register")}>
              Register User
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================

  // DASHBOARD PAGE

  // ============================================================

  function DashboardPage() {
    return (
      <section className="dashboard">
        <div className="welcome-card">
          <div>
            <span className="label">WELCOME</span>

            <h2>Welcome, {currentUser?.full_name}</h2>

            <p>Kisan Kanta weighing management system</p>
          </div>

          <div className="user-badge">{currentUser?.role}</div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <span>LIVE WEIGHT</span>

            <strong>{liveWeight.toFixed(0)} KG</strong>
          </div>

          <div className="stat-card">
            <span>FIRST WEIGHT</span>

            <strong>
              {firstWeight !== null ? `${firstWeight.toFixed(0)} KG` : "--"}
            </strong>
          </div>

          <div className="stat-card">
            <span>SECOND WEIGHT</span>

            <strong>
              {secondWeight !== null ? `${secondWeight.toFixed(0)} KG` : "--"}
            </strong>
          </div>

          <div className="stat-card green-stat">
            <span>NET WEIGHT</span>

            <strong>{netWeight.toFixed(0)} KG</strong>
          </div>
        </div>
      </section>
    );
  }

  // ============================================================

  // WEIGHING PAGE

  // ============================================================

  function WeighingPage() {
    // FIX: Purchase = first weight is Gross.

    //       Sales    = first weight is Tare.

    const firstWeightLabel =
      transactionType === "PURCHASE" ? "GROSS WEIGHT" : "TARE WEIGHT";

    const secondWeightLabel =
      transactionType === "PURCHASE" ? "TARE WEIGHT" : "GROSS WEIGHT";

    return (
      <section className="dashboard">
        {/* ===================================================== */}
        {/* LIVE WEIGHT                                           */}
        {/* ===================================================== */}
        <div className="weight-card">
          <div className="weight-header">
            <div>
              <span className="label">LIVE WEIGHT</span>

              <h3>Weighing Machine</h3>
            </div>

            <div className="live-indicator">
              <span></span>
              LIVE
            </div>
          </div>

          <div className="weight-display">
            <strong>{liveWeight.toFixed(2)}</strong>

            <span>KG</span>
          </div>

          <div className="machine-info">
            <span>COM Port</span>

            {/* <strong>Simulator</strong> */}
            <strong>{appSettings?.com_port ?? "COM5"}</strong>
          </div>
        </div>
        {/* ===================================================== */}
        {/* FIRST / SECOND WEIGHT TABS                            */}
        {/* ===================================================== */}
        <div className="weighing-tabs">
          <button
            type="button"
            className={`weighing-tab ${
              weighingTab === "FIRST" ? "active" : ""
            }`}
            onClick={() => setWeighingTab("FIRST")}
          >
            FIRST WEIGHT
          </button>

          <button
            type="button"
            className={`weighing-tab ${
              weighingTab === "SECOND" ? "active" : ""
            }`}
            onClick={() => setWeighingTab("SECOND")}
          >
            SECOND WEIGHT
          </button>
        </div>
        {/* ===================================================== */}
        {/* FIRST WEIGHT                                          */}
        {/* ===================================================== */}
        {weighingTab === "FIRST" && (
          <>
            <div className="form-card">
              <div className="card-title">
                <h3>First Weight</h3>

                <span>New Weighment</span>
              </div>

              {/* SALES / PURCHASE RADIO BUTTONS */}

              <div className="transaction-type">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="transactionType"
                    checked={transactionType === "PURCHASE"}
                    onChange={() => setTransactionType("PURCHASE")}
                  />

                  <span>Purchase</span>
                </label>

                <label className="radio-option">
                  <input
                    type="radio"
                    name="transactionType"
                    checked={transactionType === "SALES"}
                    onChange={() => setTransactionType("SALES")}
                  />

                  <span>Sales</span>
                </label>
              </div>

              <div className="weight-role-card">
                <strong>{transactionType}</strong>

                <span>
                  First weight will be recorded as <b>{firstWeightLabel}</b>.
                </span>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Vehicle Number *</label>

                  <select
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value)}
                  >
                    <option value="">
                      {loadingMasterData
                        ? "Loading vehicles..."
                        : "-- Select Vehicle --"}
                    </option>

                    {vehicles.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.vehicle_no}>
                        {vehicle.vehicle_no}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Party Name *</label>

                  <select
                    value={partyName}
                    onChange={(e) => setPartyName(e.target.value)}
                  >
                    <option value="">
                      {loadingMasterData
                        ? "Loading parties..."
                        : "-- Select Party --"}
                    </option>

                    {parties.map((party) => (
                      <option key={party.id} value={party.name}>
                        {party.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Item Name *</label>

                  <select
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                  >
                    <option value="">
                      {loadingMasterData
                        ? "Loading items..."
                        : "-- Select Item --"}
                    </option>

                    {items.map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="weights-grid">
              <div className="weight-small-card">
                <span>{firstWeightLabel}</span>

                <strong>
                  {firstWeight !== null
                    ? `${firstWeight.toFixed(2)} KG`
                    : `${liveWeight.toFixed(2)} KG`}
                </strong>

                <button
                  className="primary-button"
                  type="button"
                  onClick={saveFirstWeight}
                >
                  Capture & Save {firstWeightLabel}
                </button>
              </div>

              <div className="net-card">
                <span>SLIP NUMBER</span>

                <strong>{generatedSlipNo || "--"}</strong>

                <small>
                  {generatedSlipNo
                    ? "FIRST WEIGHT SAVED"
                    : "Generated automatically"}
                </small>
              </div>
            </div>
          </>
        )}
        {/* ===================================================== */}
        {/* SECOND WEIGHT                                         */}
        {/* ===================================================== */}{" "}
        {weighingTab === "SECOND" && (
          <>
            {" "}
            <div className="form-card">
              {" "}
              <div className="card-title">
                <h3>Second Weight</h3>{" "}
                <span>Enter First Weight Slip Number</span>{" "}
              </div>{" "}
              <div className="form-grid">
                {" "}
                <div className="form-group">
                  <label>Slip Number </label>{" "}
                  <input
                    type="text"
                    value={secondSlipNo}
                    onChange={(e) => setSecondSlipNo(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        fetchPendingWeighment();
                      }
                    }}
                    placeholder="KK-000001"
                  />{" "}
                </div>{" "}
                <div className="form-group">
                  <label>Transaction Type</label>{" "}
                  <input
                    type="text"
                    value={
                      pendingWeighment?.transaction_type ||
                      "Enter slip number and fetch"
                    }
                    readOnly
                  />{" "}
                </div>{" "}
                <div className="form-group">
                  <label>First Weight</label>{" "}
                  <input
                    type="text"
                    value={
                      pendingWeighment
                        ? `${pendingWeighment.first_weight.toFixed(2)} KG (${pendingWeighment.first_weight_label})`
                        : "--"
                    }
                    readOnly
                  />{" "}
                </div>{" "}
              </div>{" "}
              <button
                className="primary-button"
                type="button"
                onClick={fetchPendingWeighment}
              >
                Fetch Weighment{" "}
              </button>{" "}
            </div>{" "}
            {pendingWeighment && (
              <div className="form-card pending-card">
                {" "}
                <div className="card-title">
                  <h3>Weighment Details</h3>
                  <span>{pendingWeighment.slip_no}</span>{" "}
                </div>{" "}
                <div className="form-grid">
                  {" "}
                  <div className="form-group">
                    <label>Vehicle Number</label>{" "}
                    <input value={pendingWeighment.vehicle_no} readOnly />{" "}
                  </div>{" "}
                  <div className="form-group">
                    <label>Party Name</label>{" "}
                    <input value={pendingWeighment.party_name} readOnly />{" "}
                  </div>{" "}
                  <div className="form-group">
                    <label>Item Name</label>{" "}
                    <input value={pendingWeighment.item_name} readOnly />{" "}
                  </div>{" "}
                </div>{" "}
                <div className="weight-role-card">
                  <strong>{secondWeightLabel}</strong>{" "}
                  <span>
                    Current live weight will be saved as the second weight.{" "}
                  </span>{" "}
                </div>{" "}
                <div className="weights-grid">
                  {" "}
                  <div className="weight-small-card">
                    <span>LIVE {secondWeightLabel}</span>{" "}
                    <strong>{liveWeight.toFixed(2)} KG</strong>{" "}
                    <button
                      className="primary-button"
                      type="button"
                      onClick={saveSecondWeight}
                    >
                      Capture & Complete{" "}
                    </button>{" "}
                  </div>{" "}
                  <div className="net-card">
                    <span>NET WEIGHT</span>{" "}
                    <strong>
                      {" "}
                      {secondWeight !== null && firstWeight !== null
                        ? transactionType === "PURCHASE"
                          ? Math.max(firstWeight - secondWeight, 0).toFixed(2)
                          : Math.max(secondWeight - firstWeight, 0).toFixed(2)
                        : "--"}{" "}
                    </strong>
                    <small>KG</small>{" "}
                  </div>{" "}
                </div>{" "}
              </div>
            )}{" "}
            {completedWeightment && (
              <div className="form-card">
                {" "}
                <div className="card-title">
                  <h3>Weighment Completed</h3>

                  <span>{completedWeightment.slip_no}</span>
                </div>{" "}
                <div className="weighment-summary">
                  {" "}
                  <div className="weight-small-card">
                    {" "}
                    <span>{completedWeightment.first_weight_label}</span>{" "}
                    <strong>
                      {" "}
                      {completedWeightment.first_weight.toFixed(2)} KG{" "}
                    </strong>{" "}
                  </div>{" "}
                  <div className="weight-small-card">
                    {" "}
                    <span>{completedWeightment.second_weight_label}</span>{" "}
                    <strong>
                      {" "}
                      {completedWeightment.second_weight.toFixed(2)} KG{" "}
                    </strong>{" "}
                  </div>{" "}
                  <div className="net-card">
                    <span>NET WEIGHT</span>{" "}
                    <strong>{completedWeightment.net_weight.toFixed(2)}</strong>
                    <small>KG</small>{" "}
                  </div>{" "}
                </div>{" "}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() =>
                      printSlip({
                        ...completedWeightment,
                        created_by_name: currentUser?.full_name,
                      })
                    }
                  >
                    Print Slip
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() =>
                      openEstimatedSlip({
                        ...completedWeightment,
                        created_by_name: currentUser?.full_name,
                      })
                    }
                  >
                    Estimated Weight Slip
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={resetWeighment}
                  >
                    New Weighment{" "}
                  </button>
                </div>{" "}
              </div>
            )}{" "}
          </>
        )}
        {/* DEVELOPMENT TEST */}{" "}
        {showEstimatedSlip && completedWeightment && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 99999,
              padding: 20,
            }}
          >
            <div
              style={{
                width: "min(650px, 100%)",
                maxHeight: "90vh",
                overflowY: "auto",
                background: "#ffffff",
                borderRadius: 16,
                padding: 24,
                boxShadow: "0 25px 70px rgba(0,0,0,0.25)",
              }}
            >
              <div className="card-title">
                <div>
                  <h3>Estimated Weight Slip</h3>
                  <span>Temporary values — not saved to database</span>
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowEstimatedSlip(false)}
                >
                  ✕
                </button>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>Slip Number</label>
                  <input value={completedWeightment.slip_no} readOnly />
                </div>

                <div className="form-group">
                  <label>Transaction Type</label>
                  <input
                    value={completedWeightment.transaction_type}
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label>Vehicle Number</label>
                  <input value={completedWeightment.vehicle_no} readOnly />
                </div>

                <div className="form-group">
                  <label>Party Name</label>
                  <input value={completedWeightment.party_name} readOnly />
                </div>

                <div className="form-group">
                  <label>Item Name</label>
                  <input value={completedWeightment.item_name} readOnly />
                </div>

                <div className="form-group">
                  <label>In Time</label>
                  <input
                    value={formatReportDate(
                      completedWeightment.first_weight_at,
                    )}
                    readOnly
                  />
                </div>

                <div className="form-group">
                  <label>Out Time</label>
                  <input
                    value={formatReportDate(
                      completedWeightment.second_weight_at,
                    )}
                    readOnly
                  />
                </div>

                {/* ONLY THESE TWO FIELDS ARE EDITABLE */}

                <div className="form-group">
                  <label>Gross Weight *</label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={estimatedGrossWeight}
                    onChange={(e) => setEstimatedGrossWeight(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Tare Weight *</label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={estimatedTareWeight}
                    onChange={(e) => setEstimatedTareWeight(e.target.value)}
                  />
                </div>
              </div>

              <div
                className="net-card"
                style={{
                  marginTop: 20,
                  textAlign: "center",
                }}
              >
                <span>ESTIMATED NET WEIGHT</span>

                <strong>{estimatedNetWeight.toFixed(2)}</strong>

                <small>KG</small>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 20,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowEstimatedSlip(false)}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() =>
                    printEstimatedSlip({
                      ...completedWeightment,
                      created_by_name: currentUser?.full_name,
                    })
                  }
                >
                  Print Estimated Slip
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="quick-test">
          {" "}
          <div>
            <strong>Development Mode</strong>{" "}
            <span>Enter a weight to test the weighing workflow.</span>{" "}
          </div>{" "}
          <input
            type="number"
            value={liveWeight}
            onChange={(e) => setLiveWeight(Number(e.target.value))}
            placeholder="Live weight"
          />{" "}
          <button type="button" onClick={resetWeighment}>
            New Weighment{" "}
          </button>{" "}
        </div>{" "}
      </section>
    );
  }

  // ============================================================

  // USER PAGE

  // ============================================================

  function UsersPage() {
    return (
      <section className="page-section">
        <div className="page-header">
          <div>
            <h2>User Registration</h2>

            <p>Create application users</p>
          </div>
        </div>

        <div className="form-card">
          <div className="form-grid">
            <div className="form-group">
              <label>Full Name *</label>

              <input
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="Full name"
              />
            </div>

            <div className="form-group">
              <label>Username *</label>

              <input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Username"
              />
            </div>

            <div className="form-group">
              <label>Password *</label>

              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Password"
              />
            </div>

            <div className="form-group">
              <label>Role</label>

              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              >
                <option value="operator">Operator</option>

                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <button className="primary-button" onClick={handleRegisterUser}>
            Create User
          </button>
        </div>
      </section>
    );
  }

  // ============================================================

  // PARTY PAGE

  // ============================================================

  function PartyPage() {
    return (
      <section className="page-section">
        <div className="page-header">
          <div>
            <h2>Party Registration</h2>

            <p>Register customers and suppliers</p>
          </div>
        </div>

        <div
          className="form-card"
          style={{
            position: "relative",

            zIndex: 999999,

            pointerEvents: "auto",

            isolation: "isolate",
          }}
        >
          <div className="form-grid">
            <div className="form-group">
              <label>Party Name *</label>

              <input
                type="text"
                tabIndex={0}
                disabled={false}
                readOnly={false}
                autoComplete="off"
                style={{
                  position: "relative",

                  zIndex: 1000000,

                  pointerEvents: "auto",

                  userSelect: "text",
                }}
                onPointerDown={(e) => e.stopPropagation()}
                value={partyFormName}
                onChange={(e) => setPartyFormName(e.target.value)}
                placeholder="ABC Traders"
              />
            </div>

            <div className="form-group">
              <label>Phone</label>

              <input
                type="text"
                tabIndex={0}
                disabled={false}
                readOnly={false}
                autoComplete="off"
                style={{
                  position: "relative",

                  zIndex: 1000000,

                  pointerEvents: "auto",

                  userSelect: "text",
                }}
                onPointerDown={(e) => e.stopPropagation()}
                value={partyPhone}
                onChange={(e) => setPartyPhone(e.target.value)}
                placeholder="Phone number"
              />
            </div>

            <div className="form-group">
              <label>GSTIN</label>

              <input
                type="text"
                tabIndex={0}
                disabled={false}
                readOnly={false}
                autoComplete="off"
                style={{
                  position: "relative",

                  zIndex: 1000000,

                  pointerEvents: "auto",

                  userSelect: "text",
                }}
                onPointerDown={(e) => e.stopPropagation()}
                value={partyGstin}
                onChange={(e) => setPartyGstin(e.target.value)}
                placeholder="GSTIN"
              />
            </div>

            <div className="form-group">
              <label>Address</label>

              <input
                type="text"
                tabIndex={0}
                disabled={false}
                readOnly={false}
                autoComplete="off"
                style={{
                  position: "relative",

                  zIndex: 1000000,

                  pointerEvents: "auto",

                  userSelect: "text",
                }}
                onPointerDown={(e) => e.stopPropagation()}
                value={partyAddress}
                onChange={(e) => setPartyAddress(e.target.value)}
                placeholder="Address"
              />
            </div>
          </div>

          <button className="primary-button" onClick={handleCreateParty}>
            Save Party
          </button>
        </div>
      </section>
    );
  }

  // ============================================================

  // ITEM PAGE

  // ============================================================

  function ItemPage() {
    return (
      <section className="page-section">
        <div className="page-header">
          <div>
            <h2>Item Registration</h2>

            <p>Register materials and products</p>
          </div>
        </div>

        <div
          className="form-card"
          style={{
            position: "relative",

            zIndex: 999999,

            pointerEvents: "auto",

            isolation: "isolate",
          }}
        >
          <div className="form-grid">
            <div className="form-group">
              <label>Item Name *</label>

              <input
                type="text"
                tabIndex={0}
                disabled={false}
                readOnly={false}
                autoComplete="off"
                style={{
                  position: "relative",

                  zIndex: 1000000,

                  pointerEvents: "auto",

                  userSelect: "text",
                }}
                onPointerDown={(e) => e.stopPropagation()}
                value={itemFormName}
                onChange={(e) => setItemFormName(e.target.value)}
                placeholder="Stone"
              />
            </div>

            <div className="form-group">
              <label>Item Code</label>

              <input
                type="text"
                tabIndex={0}
                disabled={false}
                readOnly={false}
                autoComplete="off"
                style={{
                  position: "relative",

                  zIndex: 1000000,

                  pointerEvents: "auto",

                  userSelect: "text",
                }}
                onPointerDown={(e) => e.stopPropagation()}
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value)}
                placeholder="STONE-001"
              />
            </div>

            <div className="form-group">
              <label>Unit</label>

              <select
                value={itemUnit}
                onChange={(e) => setItemUnit(e.target.value)}
              >
                <option value="KG">KG</option>

                <option value="TON">TON</option>

                <option value="QUINTAL">QUINTAL</option>
              </select>
            </div>
          </div>

          <button className="primary-button" onClick={handleCreateItem}>
            Save Item
          </button>
        </div>
      </section>
    );
  }

  // ============================================================

  // VEHICLE PAGE

  // ============================================================

  function VehiclesPage() {
    return (
      <section className="page-section">
        <div className="page-header">
          <div>
            <h2>Vehicle Registration</h2>

            <p>Register vehicles</p>
          </div>
        </div>

        <div
          className="form-card"
          style={{
            position: "relative",

            zIndex: 999999,

            pointerEvents: "auto",

            isolation: "isolate",
          }}
        >
          <div className="form-grid">
            <div className="form-group">
              <label>Vehicle Number *</label>

              <input
                type="text"
                tabIndex={0}
                disabled={false}
                readOnly={false}
                autoComplete="off"
                style={{
                  position: "relative",

                  zIndex: 1000000,

                  pointerEvents: "auto",

                  userSelect: "text",
                }}
                onPointerDown={(e) => e.stopPropagation()}
                value={newVehicleNo}
                onChange={(e) => setNewVehicleNo(e.target.value)}
                placeholder="PB10AB1234"
              />
            </div>

            <div className="form-group">
              <label>Owner Name</label>

              <input
                type="text"
                tabIndex={0}
                disabled={false}
                readOnly={false}
                autoComplete="off"
                style={{
                  position: "relative",

                  zIndex: 1000000,

                  pointerEvents: "auto",

                  userSelect: "text",
                }}
                onPointerDown={(e) => e.stopPropagation()}
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Owner name"
              />
            </div>
          </div>

          <button className="primary-button" onClick={handleCreateVehicle}>
            Save Vehicle
          </button>
        </div>
      </section>
    );
  }

  // ============================================================

  // REPORTS PAGE

  // ============================================================

  function ReportsPage() {
    return (
      <section className="page-section">
        <div className="page-header">
          <div>
            <h2>Weighment Reports</h2>
            <p>Search, print, export and review completed weighments</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="secondary-button" onClick={exportReportsToExcel}>
              Export Excel
            </button>
            <button className="secondary-button" onClick={exportReportsToPdf}>
              Export PDF
            </button>
            <button className="primary-button" onClick={loadReports}>
              Refresh Report
            </button>
          </div>
        </div>
        <div className="form-card">
          <div className="form-grid">
            <div className="form-group">
              <label>From Date</label>
              <input
                type="date"
                value={reportFromDate}
                onChange={(e) => setReportFromDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>To Date</label>
              <input
                type="date"
                value={reportToDate}
                onChange={(e) => setReportToDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Transaction</label>
              <select
                value={reportTransactionType}
                onChange={(e) => setReportTransactionType(e.target.value)}
              >
                <option value="">All</option>
                <option value="PURCHASE">Purchase</option>
                <option value="SALES">Sales</option>
              </select>
            </div>
            <div className="form-group">
              <label>Vehicle</label>
              <select
                value={reportVehicle}
                onChange={(e) => setReportVehicle(e.target.value)}
              >
                <option value="">All Vehicles</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.vehicle_no}>
                    {v.vehicle_no}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Party</label>
              <select
                value={reportParty}
                onChange={(e) => setReportParty(e.target.value)}
              >
                <option value="">All Parties</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Item</label>
              <select
                value={reportItem}
                onChange={(e) => setReportItem(e.target.value)}
              >
                <option value="">All Items</option>
                {items.map((i) => (
                  <option key={i.id} value={i.name}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            className="primary-button"
            onClick={loadReports}
            disabled={reportLoading}
          >
            {reportLoading ? "Loading..." : "Apply Filters"}
          </button>
        </div>
        <div className="form-card" style={{ marginTop: 16, overflowX: "auto" }}>
          <div className="card-title">
            <h3>Completed Weighments</h3>
            <span>{reportRows.length} records</span>
          </div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: 1050,
            }}
          >
            <thead>
              <tr>
                {[
                  "Slip",
                  "Date",
                  "Type",
                  "Vehicle",
                  "Party",
                  "Item",
                  "First",
                  "Second",
                  "Net",
                  "Operator",
                  "Action",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: 10,
                      borderBottom: "1px solid #ddd",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reportRows.map((r) => (
                <tr key={r.id}>
                  <td style={{ padding: 9 }}>{r.slip_no}</td>
                  <td style={{ padding: 9, whiteSpace: "nowrap" }}>
                    {formatReportDate(r.created_at)}
                  </td>
                  <td style={{ padding: 9 }}>{r.transaction_type}</td>
                  <td style={{ padding: 9 }}>{r.vehicle_no}</td>
                  <td style={{ padding: 9 }}>{r.party_name}</td>
                  <td style={{ padding: 9 }}>{r.item_name}</td>
                  <td style={{ padding: 9 }}>{r.first_weight.toFixed(2)}</td>
                  <td style={{ padding: 9 }}>{r.second_weight.toFixed(2)}</td>
                  <td style={{ padding: 9, fontWeight: 700 }}>
                    {r.net_weight.toFixed(2)}
                  </td>
                  <td style={{ padding: 9 }}>{r.created_by_name || "-"}</td>
                  <td style={{ padding: 9 }}>
                    <button
                      className="secondary-button"
                      onClick={() => printSlip(r)}
                    >
                      Print Slip
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => openEstimatedSlip(r)}
                    >
                      Estimated
                    </button>
                  </td>
                </tr>
              ))}
              {!reportRows.length && (
                <tr>
                  <td colSpan={11} style={{ padding: 30, textAlign: "center" }}>
                    No completed weighments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  }
  // ============================================================

  // SETTINGS PAGE

  // ============================================================

  function SettingsPage() {
    const inputStyle: CSSProperties = {
      width: "100%",
      boxSizing: "border-box",
    };

    const sectionButtonStyle = (active: boolean): CSSProperties => ({
      width: "100%",
      textAlign: "left",
      padding: "12px 14px",
      borderRadius: 8,
      border: active ? "1px solid #111827" : "1px solid #e5e7eb",
      background: active ? "#111827" : "#ffffff",
      color: active ? "#ffffff" : "#111827",
      cursor: "pointer",
      fontWeight: active ? 700 : 500,
    });

    const settingsCardStyle: CSSProperties = {
      background: "#ffffff",
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      padding: 24,
    };

    if (settingsLoading || !appSettings) {
      return (
        <section className="page-section">
          <div className="page-header">
            <div>
              <h2>Settings</h2>
              <p>Application configuration</p>
            </div>
          </div>
          <div>
            <strong>Kisan Kanta</strong>
            <div>Version {APP_VERSION}</div>
          </div>
          <div className="empty-card">
            {settingsLoading
              ? "Loading settings..."
              : "Settings are not available."}
          </div>
        </section>
      );
    }

    return (
      <section className="page-section">
        <div className="page-header">
          <div>
            <h2>Settings</h2>
            <p>
              Configure company, weighing machine, printing, database, security
              and Tally integration.
            </p>
          </div>

          <button
            className="primary-button"
            type="button"
            onClick={saveAppSettings}
            disabled={settingsSaving}
          >
            {settingsSaving ? "Saving..." : "Save All Settings"}
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "230px minmax(0, 1fr)",
            gap: 20,
            alignItems: "start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {(
              [
                ["company", "🏢 Company"],
                ["weighing", "⚖ Weighing Machine"],
                ["printing", "🖨 Printing"],
                ["database", "🗄 Database"],
                ["security", "🔐 Security"],
                ["tally", "📊 Tally Integration"],
                ["application", "⚙ Application"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                style={sectionButtonStyle(settingsSection === key)}
                onClick={() => setSettingsSection(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ minWidth: 0 }}>
            {settingsSection === "company" && (
              <div style={settingsCardStyle}>
                <div className="card-title">
                  <h3>Company / Weighbridge</h3>
                  <span>Details used on the weighment slip</span>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label>Company Name</label>
                    <input
                      style={inputStyle}
                      value={appSettings.company_name}
                      onChange={(e) =>
                        updateSetting("company_name", e.target.value)
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      style={inputStyle}
                      value={appSettings.company_phone}
                      onChange={(e) =>
                        updateSetting("company_phone", e.target.value)
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>Email</label>
                    <input
                      style={inputStyle}
                      value={appSettings.company_email}
                      onChange={(e) =>
                        updateSetting("company_email", e.target.value)
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>GSTIN</label>
                    <input
                      style={inputStyle}
                      value={appSettings.company_gstin}
                      onChange={(e) =>
                        updateSetting(
                          "company_gstin",
                          e.target.value.toUpperCase(),
                        )
                      }
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                    <label>Address</label>
                    <textarea
                      style={inputStyle}
                      value={appSettings.company_address}
                      onChange={(e) =>
                        updateSetting("company_address", e.target.value)
                      }
                      rows={3}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                    <label>Logo Path</label>
                    <input
                      style={inputStyle}
                      value={appSettings.company_logo_path}
                      onChange={(e) =>
                        updateSetting("company_logo_path", e.target.value)
                      }
                      placeholder={"C:\\Kisan Kanta\\logo.png"}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                    <label>Slip Footer</label>
                    <input
                      style={inputStyle}
                      value={appSettings.slip_footer}
                      onChange={(e) =>
                        updateSetting("slip_footer", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {settingsSection === "weighing" && (
              <div style={settingsCardStyle}>
                <div className="card-title">
                  <h3>Weighing Machine</h3>
                  <span>Serial communication and weight options</span>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label>Connection Mode</label>
                    <select
                      value={appSettings.weighing_mode}
                      onChange={(e) =>
                        updateSetting("weighing_mode", e.target.value)
                      }
                    >
                      <option value="SIMULATOR">Simulator</option>
                      <option value="SERIAL">Serial / COM Port</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>COM Port</label>
                    <input
                      value={appSettings.com_port}
                      onChange={(e) =>
                        updateSetting("com_port", e.target.value.toUpperCase())
                      }
                      placeholder="COM5"
                    />
                  </div>

                  <div className="form-group">
                    <label>Baud Rate</label>
                    <select
                      value={appSettings.baud_rate}
                      onChange={(e) =>
                        updateSetting("baud_rate", Number(e.target.value))
                      }
                    >
                      <option value={1200}>1200</option>
                      <option value={2400}>2400</option>
                      <option value={4800}>4800</option>
                      <option value={9600}>9600</option>
                      <option value={19200}>19200</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Data Bits</label>
                    <select
                      value={appSettings.data_bits}
                      onChange={(e) =>
                        updateSetting("data_bits", Number(e.target.value))
                      }
                    >
                      <option value={7}>7</option>
                      <option value={8}>8</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Stop Bits</label>
                    <select
                      value={appSettings.stop_bits}
                      onChange={(e) =>
                        updateSetting("stop_bits", Number(e.target.value))
                      }
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Parity</label>
                    <select
                      value={appSettings.parity}
                      onChange={(e) => updateSetting("parity", e.target.value)}
                    >
                      <option value="None">None</option>
                      <option value="Even">Even</option>
                      <option value="Odd">Odd</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Weight Unit</label>
                    <select
                      value={appSettings.weight_unit}
                      onChange={(e) =>
                        updateSetting("weight_unit", e.target.value)
                      }
                    >
                      <option value="KG">KG</option>
                      <option value="TON">TON</option>
                      <option value="LB">LB</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Decimal Places</label>
                    <select
                      value={appSettings.decimal_places}
                      onChange={(e) =>
                        updateSetting("decimal_places", Number(e.target.value))
                      }
                    >
                      <option value={0}>0</option>
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                    </select>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    marginTop: 20,
                  }}
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={appSettings.auto_reconnect}
                      onChange={(e) =>
                        updateSetting("auto_reconnect", e.target.checked)
                      }
                      style={{ marginRight: 8 }}
                    />
                    Auto reconnect
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={appSettings.stable_weight_required}
                      onChange={(e) =>
                        updateSetting(
                          "stable_weight_required",
                          e.target.checked,
                        )
                      }
                      style={{ marginRight: 8 }}
                    />
                    Require stable weight before capture
                  </label>
                </div>
              </div>
            )}

            {settingsSection === "printing" && (
              <div style={settingsCardStyle}>
                <div className="card-title">
                  <h3>Printing</h3>
                  <span>A5 weighment slip and printer configuration</span>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label>Paper Size</label>
                    <select
                      value={appSettings.paper_size}
                      onChange={(e) =>
                        updateSetting("paper_size", e.target.value)
                      }
                    >
                      <option value="A5">A5</option>
                      <option value="A4">A4</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Orientation</label>
                    <select
                      value={appSettings.orientation}
                      onChange={(e) =>
                        updateSetting("orientation", e.target.value)
                      }
                    >
                      <option value="Portrait">Portrait</option>
                      <option value="Landscape">Landscape</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Printer Name</label>
                    <input
                      value={appSettings.printer_name}
                      onChange={(e) =>
                        updateSetting("printer_name", e.target.value)
                      }
                      placeholder="Leave blank for Windows default printer"
                    />
                  </div>

                  <div className="form-group">
                    <label>Copies</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={appSettings.copies}
                      onChange={(e) =>
                        updateSetting(
                          "copies",
                          Math.max(1, Number(e.target.value) || 1),
                        )
                      }
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 12,
                    marginTop: 20,
                  }}
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={appSettings.print_preview}
                      onChange={(e) =>
                        updateSetting("print_preview", e.target.checked)
                      }
                      style={{ marginRight: 8 }}
                    />
                    Show print preview before printing
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={appSettings.show_logo}
                      onChange={(e) =>
                        updateSetting("show_logo", e.target.checked)
                      }
                      style={{ marginRight: 8 }}
                    />
                    Show company logo
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={appSettings.show_company_details}
                      onChange={(e) =>
                        updateSetting("show_company_details", e.target.checked)
                      }
                      style={{ marginRight: 8 }}
                    />
                    Show company details
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={appSettings.show_operator}
                      onChange={(e) =>
                        updateSetting("show_operator", e.target.checked)
                      }
                      style={{ marginRight: 8 }}
                    />
                    Show operator name
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={appSettings.show_signatures}
                      onChange={(e) =>
                        updateSetting("show_signatures", e.target.checked)
                      }
                      style={{ marginRight: 8 }}
                    />
                    Show signature section
                  </label>
                </div>
              </div>
            )}

            {settingsSection === "database" && (
              <div style={settingsCardStyle}>
                <div className="card-title">
                  <h3>Database</h3>
                  <span>Local SQLite database management</span>
                </div>

                <div
                  style={{
                    padding: 18,
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    background: "#f9fafb",
                  }}
                >
                  <strong>
                    {databaseInfo?.exists
                      ? "● Database Connected"
                      : "● Database Not Found"}
                  </strong>

                  <p style={{ margin: "10px 0 0", wordBreak: "break-word" }}>
                    <strong>Location:</strong> {databaseInfo?.path || "Unknown"}
                  </p>

                  <p style={{ margin: "8px 0 0" }}>
                    <strong>Size:</strong>{" "}
                    {databaseInfo
                      ? `${(databaseInfo.size_bytes / 1024).toFixed(2)} KB`
                      : "0 KB"}
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    marginTop: 20,
                  }}
                >
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={openDatabaseFolder}
                  >
                    Open Data Folder
                  </button>

                  <button
                    className="primary-button"
                    type="button"
                    onClick={backupDatabase}
                  >
                    Backup Database
                  </button>

                  <button
                    className="secondary-button"
                    type="button"
                    onClick={loadAppSettings}
                  >
                    Refresh Database Status
                  </button>
                </div>

                <p style={{ marginTop: 18, fontSize: 13, color: "#6b7280" }}>
                  Database backups are created separately so your weighment
                  records can be restored later.
                </p>
              </div>
            )}

            {settingsSection === "security" && (
              <div style={settingsCardStyle}>
                <div className="card-title">
                  <h3>Security</h3>
                  <span>Current user and password management</span>
                </div>

                <div
                  style={{
                    padding: 18,
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    background: "#f9fafb",
                    marginBottom: 22,
                  }}
                >
                  <p style={{ margin: 0 }}>
                    <strong>Full Name:</strong> {currentUser?.full_name || "-"}
                  </p>
                  <p style={{ margin: "8px 0 0" }}>
                    <strong>Username:</strong> {currentUser?.username || "-"}
                  </p>
                  <p style={{ margin: "8px 0 0" }}>
                    <strong>Role:</strong> {currentUser?.role || "-"}
                  </p>
                </div>

                <h4>Change Password</h4>

                <div className="form-grid">
                  <div className="form-group">
                    <label>Current Password</label>
                    <input
                      type="password"
                      value={currentSettingsPassword}
                      onChange={(e) =>
                        setCurrentSettingsPassword(e.target.value)
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label>New Password</label>
                    <input
                      type="password"
                      value={newSettingsPassword}
                      onChange={(e) => setNewSettingsPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                    />
                  </div>
                </div>

                <button
                  className="primary-button"
                  type="button"
                  onClick={async () => {
                    if (!currentUser) {
                      alert("No logged-in user.");
                      return;
                    }

                    if (!currentSettingsPassword || !newSettingsPassword) {
                      alert("Enter both current and new password.");
                      return;
                    }

                    try {
                      await invoke("change_user_password", {
                        request: {
                          user_id: currentUser.id,
                          current_password: currentSettingsPassword,
                          new_password: newSettingsPassword,
                        },
                      });

                      alert("Password changed successfully.");
                      setCurrentSettingsPassword("");
                      setNewSettingsPassword("");
                    } catch (error) {
                      console.error(error);
                      alert(String(error));
                    }
                  }}
                >
                  Change Password
                </button>
              </div>
            )}

            {settingsSection === "tally" && (
              <div style={settingsCardStyle}>
                <div className="card-title">
                  <h3>Tally Integration</h3>
                  <span>
                    Prepare automatic sales and purchase voucher integration
                  </span>
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label>Tally Server</label>
                    <input
                      value={appSettings.tally_host}
                      onChange={(e) =>
                        updateSetting("tally_host", e.target.value)
                      }
                      placeholder="127.0.0.1"
                    />
                  </div>

                  <div className="form-group">
                    <label>Tally Port</label>
                    <input
                      type="number"
                      min={1}
                      max={65535}
                      value={appSettings.tally_port}
                      onChange={(e) =>
                        updateSetting(
                          "tally_port",
                          Number(e.target.value) || 9000,
                        )
                      }
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                    <label>Tally Company Name</label>
                    <input
                      value={appSettings.tally_company}
                      onChange={(e) =>
                        updateSetting("tally_company", e.target.value)
                      }
                      placeholder="Company name as configured in Tally"
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    marginTop: 20,
                  }}
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={appSettings.tally_enabled}
                      onChange={(e) =>
                        updateSetting("tally_enabled", e.target.checked)
                      }
                      style={{ marginRight: 8 }}
                    />
                    Enable Tally Integration
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={appSettings.tally_sales_enabled}
                      onChange={(e) =>
                        updateSetting("tally_sales_enabled", e.target.checked)
                      }
                      style={{ marginRight: 8 }}
                    />
                    Enable Sales Voucher Creation
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={appSettings.tally_purchase_enabled}
                      onChange={(e) =>
                        updateSetting(
                          "tally_purchase_enabled",
                          e.target.checked,
                        )
                      }
                      style={{ marginRight: 8 }}
                    />
                    Enable Purchase Voucher Creation
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      checked={appSettings.tally_auto_voucher}
                      onChange={(e) =>
                        updateSetting("tally_auto_voucher", e.target.checked)
                      }
                      style={{ marginRight: 8 }}
                    />
                    Automatically create Tally voucher after completed weighment
                  </label>
                </div>

                <div
                  style={{
                    marginTop: 20,
                    padding: 12,
                    borderRadius: 8,
                    background: "#f3f4f6",
                    fontSize: 13,
                  }}
                >
                  Tally communication will be connected to the weighment
                  workflow when the Tally integration module is enabled.
                </div>
              </div>
            )}

            {settingsSection === "application" && (
              <div style={settingsCardStyle}>
                <div className="card-title">
                  <h3>Application</h3>
                  <span>Kisan Kanta system information</span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 12,
                  }}
                >
                  {[
                    ["Application", "Kisan Kanta"],
                    ["Version", 2.3],
                    ["Frontend", "React + TypeScript"],
                    ["Desktop Runtime", "Tauri"],
                    ["Backend", "Rust"],
                    ["Database", "SQLite"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      style={{
                        padding: 16,
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                      }}
                    >
                      <strong>{label}</strong>
                      <div style={{ marginTop: 6 }}>{value}</div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    marginTop: 20,
                    padding: 16,
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    background: "#f9fafb",
                  }}
                >
                  <strong>Database Location</strong>
                  <p style={{ margin: "8px 0 0", wordBreak: "break-word" }}>
                    {databaseInfo?.path || "Unknown"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  function renderPage() {
    switch (currentPage) {
      case "dashboard":
        return DashboardPage();

      case "weighing":
        return WeighingPage();

      case "users":
        return UsersPage();

      case "parties":
        return PartyPage();

      case "items":
        return ItemPage();

      case "vehicles":
        return VehiclesPage();

      case "reports":
        return ReportsPage();

      case "settings":
        return SettingsPage();

      default:
        return DashboardPage();
    }
  }

  // ============================================================

  // MAIN APPLICATION

  // ============================================================

  return (
    <div className="app">
      {/* ======================================================



          SIDEBAR



          ====================================================== */}

      <aside className="sidebar">
        <div className="logo">
          <div className="logo-box">K</div>

          <div>
            <h1>KISAN</h1>

            <span>DHARAM KANTA</span>
            <p>{APP_VERSION}</p>
          </div>
        </div>

        <nav>
          {/* DASHBOARD */}

          <button
            className={`nav-item ${
              currentPage === "dashboard" ? "active" : ""
            }`}
            onClick={() => setCurrentPage("dashboard")}
          >
            <span>⌂</span>
            Dashboard
          </button>

          {/* WEIGHING */}

          <button
            className={`nav-item ${currentPage === "weighing" ? "active" : ""}`}
            onClick={() => setCurrentPage("weighing")}
          >
            <span>⚖</span>
            Weighing
          </button>

          {/* MASTER */}

          <div className="nav-section-title">MASTER</div>

          {/* USERS */}

          <button
            className={`nav-item ${currentPage === "users" ? "active" : ""}`}
            onClick={() => setCurrentPage("users")}
          >
            <span>♙</span>
            Users
          </button>

          {/* PARTIES */}

          <button
            className={`nav-item ${currentPage === "parties" ? "active" : ""}`}
            onClick={() => setCurrentPage("parties")}
          >
            <span>♙</span>
            Parties
          </button>

          {/* ITEMS */}

          <button
            className={`nav-item ${currentPage === "items" ? "active" : ""}`}
            onClick={() => setCurrentPage("items")}
          >
            <span>▦</span>
            Items
          </button>

          {/* VEHICLES */}

          <button
            className={`nav-item ${currentPage === "vehicles" ? "active" : ""}`}
            onClick={() => setCurrentPage("vehicles")}
          >
            <span>🚛</span>
            Vehicles
          </button>

          {/* REPORTS */}

          <div className="nav-section-title">REPORTS</div>

          <button
            className={`nav-item ${currentPage === "reports" ? "active" : ""}`}
            onClick={() => setCurrentPage("reports")}
          >
            <span>▤</span>
            Reports
          </button>

          {/* SETTINGS */}

          <button
            className={`nav-item ${currentPage === "settings" ? "active" : ""}`}
            onClick={() => setCurrentPage("settings")}
          >
            <span>⚙</span>
            Settings
          </button>

          {/* LOGOUT */}

          <button className="nav-item logout-item" onClick={handleLogout}>
            <span>↪</span>
            Logout
          </button>
        </nav>

        {/* CONNECTION STATUS */}

        <div className="connection">
          <div className="status-dot"></div>

          <div>
            <strong>Weighing Machine</strong>

            <span>Simulator</span>
          </div>
        </div>
      </aside>

      {/* ======================================================



          MAIN



          ====================================================== */}

      <main className="main">
        {/* TOP BAR */}

        <header className="topbar">
          <div>
            <h2>Kisan Kanta</h2>

            <p>
              {currentPage === "dashboard" ? "Weighing Dashboard" : currentPage}
            </p>
          </div>

          {/* LOGGED-IN USER */}

          <div className="header-user">
            <strong>{currentUser?.full_name}</strong>

            <span>{currentUser?.role}</span>
          </div>
        </header>

        {/* CURRENT PAGE */}

        {renderPage()}
      </main>
    </div>
  );
}
