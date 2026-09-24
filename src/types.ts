export type GarageCategory =
  | "Tires"
  | "Oils & Fluids"
  | "Braking"
  | "Drivetrain"
  | "Electrical"
  | "Hardware"
  | "Suspension"
  | "Exhaust"
  | "Other";

export const GARAGE_CATEGORIES: GarageCategory[] = [
  "Tires",
  "Oils & Fluids",
  "Braking",
  "Drivetrain",
  "Electrical",
  "Hardware",
  "Suspension",
  "Exhaust",
  "Other",
];

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: GarageCategory;
  stock_quantity: number;
  reorder_threshold: number;
  last_purchased_cost: number;
  selling_price: number;
  location_bin?: string;
  last_restocked_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ParsedItemPayload {
  part_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category: GarageCategory;
  matchedInventoryId?: string | null;
  matchedInventoryName?: string | null;
  currentStock?: number;
  isNewItem?: boolean;
}

export interface ParsedReceiptData {
  vendor_name: string;
  transaction_date: string;
  receipt_number: string;
  subtotal: number;
  tax: number;
  total_amount: number;
  notes?: string;
  items: ParsedItemPayload[];
}

export interface ReceiptRecord {
  id: string;
  vendor_name: string;
  transaction_date: string;
  receipt_number: string;
  subtotal: number;
  tax: number;
  total_amount: number;
  item_count: number;
  original_filename: string;
  google_drive_file_id: string;
  google_drive_web_link: string;
  drive_sync_status: "synced" | "local_only" | "pending";
  notes?: string;
  created_at: string;
}

export interface ReceiptItemDetail {
  id: string;
  receipt_id: string;
  part_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category: string;
  matched_inventory_id?: string;
}

export interface StockMovement {
  id: string;
  inventory_id: string;
  part_name: string;
  type: "RESTOCK_RECEIPT" | "JOB_USAGE" | "MANUAL_ADJUST" | "MANUAL_DECREMENT" | "SALE";
  delta: number;
  quantity_after: number;
  reason?: string;
  unit_cost?: number;
  receipt_id?: string;
  created_at: string;
}

export interface DriveConfigStatus {
  configured: boolean;
  folderId: string;
  hasAccessToken: boolean;
  archivedCount: number;
}

export interface StaffUser {
  id: string;
  username: string;
  name: string;
  company_email: string;
  access_code: string;
  role: "staff" | "admin";
  status: "active" | "inactive";
  first_login_completed: number;
  last_login_at?: string;
  created_at: string;
}

export interface StaffSession {
  id: string;
  username: string;
  name: string;
  company_email: string;
  role: "staff";
  first_login_completed?: boolean;
}

export interface SaleReceiptItem {
  id: string;
  sale_id?: string;
  inventory_id: string;
  part_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category: string;
}

export interface SaleReceipt {
  id: string;
  receipt_number: string;
  customer_name: string;
  customer_phone?: string;
  motorcycle_model?: string;
  subtotal: number;
  tax: number;
  total_amount: number;
  payment_method: string;
  staff_id: string;
  staff_username: string;
  staff_name: string;
  staff_email: string;
  notes?: string;
  created_at: string;
  items?: SaleReceiptItem[];
}

export interface StaffInventoryItem {
  id: string;
  sku: string;
  name: string;
  category: GarageCategory;
  stock_quantity: number;
  reorder_threshold: number;
  selling_price: number;
  location_bin?: string;
  last_restocked_at?: string;
}

export interface NotificationSettings {
  ownerEmail: string;
  globalThreshold: number | null;
  emailAlertsEnabled: boolean;
  lastAlertSentAt?: string;
}

export interface LowStockNotificationItem extends InventoryItem {
  severity: "critical" | "warning";
  deficit: number;
}
