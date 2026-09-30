export type Role = 'admin' | 'phc_staff';

export interface User {
  id: number;
  username: string;
  role: Role;
  phcId: number | null;
  displayName?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface ToastMsg {
  id: number;
  type: 'success' | 'error' | 'info';
  msg: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface Medicine {
  id: number;
  name: string;
  category: string;
  unit: string;
  reorderLevel: number;
  criticalLevel: number;
}

export interface PHC {
  id: number;
  name: string;
  city?: string;
  zone?: string;
  lat?: number | null;
  lng?: number | null;
}

export interface StaffMedicineRow {
  inventoryId: number;
  phcId: number;
  medicineId: number;
  currentQuantity: number;
  lastUpdated: string;
  medicine: Medicine;
  phc: PHC;
}

export type AdjustReason = 'received' | 'dispensed' | 'wasted' | 'transfer_in' | 'transfer_out';

export interface FootfallRow {
  date: string;
  outpatient: number;
  admissions: number;
  discharges: number;
  triageMild: number;
  triageModerate: number;
  triageSevere: number;
  phcId: number;
}

export interface BedsStatusRow {
  phcId: number;
  bedsTotal: number;
  bedsOccupied: number;
  bedsEmergencyReserved: number;
  staffOnDuty: number;
  staffTotal: number;
  activeEmergency: boolean;
}

export type BedsAdjustReason = 'admission' | 'discharge' | 'emergency_reserve_change' | 'transfer';

export interface AttendanceRow {
  id: number;
  staffMemberName: string;
  staffRole: string;
  isPresent: boolean;
  lastMarked: string;
  phcId: number;
}

export type EmergencyType = 'Dengue' | 'Cardiac' | 'Respiratory' | 'MassCasualty' | 'Other';
export type EmergencySeverity = 'low' | 'moderate' | 'high';

export interface EmergencyRow {
  id: number;
  type: EmergencyType;
  severity: EmergencySeverity;
  patientCount: number;
  notes?: string;
  isActive: boolean;
  reportedById: number;
  createdAt: string;
  resolvedAt?: string;
  phc: PHC;
}

export interface AdminPHCSummary {
  id: number;
  name: string;
  city: string;
  zone: string;
  lat?: number | null;
  lng?: number | null;
  bedsTotal: number;
  bedsOccupied: number;
  bedsOccupiedPct: number;
  bedsEmergencyReserved: number;
  staffTotal: number;
  staffOnDuty: number;
  staffOnDutyPct: number;
  activeEmergency: boolean;
  stockHealth: number;
  lastPatientCount: number;
  lastUpdated: string;
}

export interface AdminDashboardKPI {
  totalBeds: number;
  occupiedBeds: number;
  totalStaff: number;
  onDutyStaff: number;
  activeEmergencies: number;
  avgStockHealth: number;
}

export type AlertType = 'stock' | 'beds' | 'staff' | 'emergency' | 'forecast';
export type AlertSeverity = 'low' | 'moderate' | 'high' | 'critical';

export interface AlertRow {
  id: number;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  createdAt: string;
  phc: PHC;
}

export interface AdminDashboard {
  phcs: AdminPHCSummary[];
  kpis: AdminDashboardKPI;
  alerts: AlertRow[];
  forecastAlerts?: AlertRow[];
  transfers: { proposedCount: number };
}

export interface MedicineSuggestion {
  id: string;
  sourcePhcId: number;
  destPhcId: number;
  sourcePhcName: string;
  destPhcName: string;
  medicineId: number;
  medicineName: string;
  proposedQty: number;
  rationale: string;
  riskScore: number;
  sourceStock: number;
  destStock: number;
  destReorderLevel: number;
  estimatedDaysShortfall: number;
}

export interface StaffSuggestion {
  id: string;
  sourcePhcId: number;
  destPhcId: number;
  sourcePhcName: string;
  destPhcName: string;
  role: string;
  rationale: string;
  gapCount: number;
  distanceKm: number;
}

export interface BedsSuggestion {
  id: string;
  sourcePhcId: number;
  destPhcId: number;
  sourcePhcName: string;
  destPhcName: string;
  rationale: string;
  freeBedsAtSource: number;
  overflowAtDest: number;
  distanceKm: number;
}

export interface SuggestionResponse {
  medicines: MedicineSuggestion[];
  staff: StaffSuggestion[];
  beds: BedsSuggestion[];
  generatedAt: string;
  analyticsConnected: boolean;
}

export interface TransferProposeBody {
  sourcePhcId: number;
  destPhcId: number;
  medicineId: number;
  proposedQty: number;
  rationale: string;
  riskScore: number;
}

export type TransferStatus = 'proposed' | 'approved' | 'rejected' | 'executed';
export type TransferProposedBy = 'ai' | 'manual';

export interface TransferRow {
  id: number;
  sourcePhcId: number;
  destPhcId: number;
  medicineId: number;
  proposedQty: number;
  rationale: string;
  riskScore: number;
  status: TransferStatus;
  proposedBy: TransferProposedBy;
  adminId: number | null;
  createdAt: string;
  decidedAt: string | null;
  executedAt: string | null;
  sourcePhc: { id: number; name: string; city: string };
  destPhc: { id: number; name: string; city: string };
  medicine: { id: number; name: string; unit: string };
  admin: { id: number; displayName: string } | null;
}

export interface TransferListResponse {
  rows: TransferRow[];
  counts: Record<string, number>;
}

export interface AdminMedicineRow {
  phcId: number;
  phcName: string;
  medicineId: number;
  medicineName: string;
  category: string;
  unit: string;
  currentQuantity: number;
  reorderLevel: number;
  criticalLevel: number;
  dailyRate: number;
  dors: number;
  riskScore: number;
}

export interface AdminBedsRow {
  phcId: number;
  name: string;
  city: string;
  bedsTotal: number;
  bedsOccupied: number;
  bedsOccupiedPct: number;
  bedsEmergencyReserved: number;
  staffTotal: number;
  staffOnDuty: number;
  staffOnDutyPct: number;
  activeEmergency: boolean;
}

export interface StaffPHCSummary {
  phcId: number;
  name: string;
  staffTotal: number;
  staffOnDuty: number;
  staffOnDutyPct: number;
}

export interface RosterRow {
  id: number;
  staffMemberName: string;
  staffRole: string;
  isPresent: boolean;
  phcId: number;
  phc: PHC;
}

export interface AdminStaffResponse {
  summary: StaffPHCSummary[];
  rosters: RosterRow[];
}

export interface FootfallHistoryPoint {
  date: string;
  outpatient: number;
  admissions: number;
  discharges: number;
}

export interface FootfallByPHC {
  phcId: number;
  phcName: string;
  series: FootfallHistoryPoint[];
}

export interface FootfallHistoryResponse {
  aggregate: FootfallHistoryPoint[];
  byPhc: FootfallByPHC[];
}

export interface BedsHistoryPoint {
  date: string;
  bedsOccupied: number;
}

export interface BedsHistoryByPHC {
  phcId: number;
  phcName: string;
  bedsTotal: number;
  series: BedsHistoryPoint[];
}

export interface BedsHistoryResponse {
  byPhc: BedsHistoryByPHC[];
}
