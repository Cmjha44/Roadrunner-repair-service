import { createClient } from "@libsql/client";
import path from "path";
import fs from "fs";

// Initialize SQLite database file in a persistent local directory
const DB_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, "motofix_garage.db");

export const dbClient = createClient({
  url: `file:${DB_PATH}`,
});

// Run migrations and create tables if not exists
export async function initDatabase() {
  await dbClient.execute(`
    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      sku TEXT UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      reorder_threshold INTEGER NOT NULL DEFAULT 2,
      last_purchased_cost REAL NOT NULL DEFAULT 0,
      selling_price REAL NOT NULL DEFAULT 0,
      location_bin TEXT,
      last_restocked_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await dbClient.execute(`
    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      vendor_name TEXT NOT NULL,
      transaction_date TEXT NOT NULL,
      receipt_number TEXT,
      subtotal REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      item_count INTEGER NOT NULL DEFAULT 0,
      original_filename TEXT,
      mime_type TEXT,
      image_data TEXT,
      google_drive_file_id TEXT,
      google_drive_web_link TEXT,
      drive_sync_status TEXT DEFAULT 'synced',
      notes TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await dbClient.execute(`
    CREATE TABLE IF NOT EXISTS receipt_items (
      id TEXT PRIMARY KEY,
      receipt_id TEXT NOT NULL,
      part_name TEXT NOT NULL,
      sku TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      total_price REAL NOT NULL DEFAULT 0,
      category TEXT NOT NULL,
      matched_inventory_id TEXT,
      FOREIGN KEY (receipt_id) REFERENCES receipts (id) ON DELETE CASCADE
    );
  `);

  await dbClient.execute(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      inventory_id TEXT NOT NULL,
      part_name TEXT NOT NULL,
      type TEXT NOT NULL,
      delta INTEGER NOT NULL,
      quantity_after INTEGER NOT NULL,
      reason TEXT,
      unit_cost REAL,
      receipt_id TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await dbClient.execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  await dbClient.execute(`
    CREATE TABLE IF NOT EXISTS staff_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      company_email TEXT NOT NULL,
      access_code TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      status TEXT NOT NULL DEFAULT 'active',
      first_login_completed INTEGER NOT NULL DEFAULT 0,
      last_login_at TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await dbClient.execute(`
    CREATE TABLE IF NOT EXISTS sales_receipts (
      id TEXT PRIMARY KEY,
      receipt_number TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      motorcycle_model TEXT,
      subtotal REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'Card',
      staff_id TEXT NOT NULL,
      staff_username TEXT NOT NULL,
      staff_name TEXT NOT NULL,
      staff_email TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await dbClient.execute(`
    CREATE TABLE IF NOT EXISTS sale_receipt_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      inventory_id TEXT NOT NULL,
      part_name TEXT NOT NULL,
      sku TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      total_price REAL NOT NULL DEFAULT 0,
      category TEXT NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales_receipts (id) ON DELETE CASCADE
    );
  `);

  // Check if inventory has initial starter data for common motorbike shop parts
  const countResult = await dbClient.execute("SELECT COUNT(*) as count FROM inventory");
  const count = Number(countResult.rows[0]?.count ?? 0);

  if (count === 0) {
    const initialParts = [
      {
        id: "part-1",
        sku: "MOT-7100-10W40",
        name: "Motul 7100 4T 10W-40 Synthetic Oil (1L)",
        category: "Oils & Fluids",
        stock_quantity: 8,
        reorder_threshold: 4,
        last_purchased_cost: 18.5,
        selling_price: 24.99,
        location_bin: "Shelf B-2",
        last_restocked_at: new Date(Date.now() - 3 * 86400000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "part-2",
        sku: "BRK-PAD-07BB",
        name: "Brembo Sintered Front Brake Pads 07BB",
        category: "Braking",
        stock_quantity: 3,
        reorder_threshold: 3,
        last_purchased_cost: 42.0,
        selling_price: 58.0,
        location_bin: "Bin 14",
        last_restocked_at: new Date(Date.now() - 7 * 86400000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "part-3",
        sku: "SPK-NGK-CR9E",
        name: "NGK Laser Iridium Spark Plug CR9EIA-9",
        category: "Electrical",
        stock_quantity: 1, // Below reorder threshold (2) to demonstrate low stock
        reorder_threshold: 4,
        last_purchased_cost: 11.2,
        selling_price: 16.5,
        location_bin: "Drawer E-1",
        last_restocked_at: new Date(Date.now() - 14 * 86400000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "part-4",
        sku: "CHN-DID-525VX3",
        name: "D.I.D 525VX3 X-Ring Drive Chain 120L",
        category: "Drivetrain",
        stock_quantity: 2,
        reorder_threshold: 2,
        last_purchased_cost: 89.0,
        selling_price: 125.0,
        location_bin: "Shelf D-4",
        last_restocked_at: new Date(Date.now() - 10 * 86400000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "part-5",
        sku: "TYR-MIC-ROAD6-F",
        name: "Michelin Road 6 Front Tire 120/70 ZR17",
        category: "Tires",
        stock_quantity: 2,
        reorder_threshold: 2,
        last_purchased_cost: 165.0,
        selling_price: 215.0,
        location_bin: "Tire Rack A",
        last_restocked_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "part-6",
        sku: "FLT-KN-KN204",
        name: "K&N Oil Filter KN-204-1 Black",
        category: "Oils & Fluids",
        stock_quantity: 0, // Out of stock to test low-stock filter
        reorder_threshold: 3,
        last_purchased_cost: 14.5,
        selling_price: 19.99,
        location_bin: "Shelf B-1",
        last_restocked_at: new Date(Date.now() - 20 * 86400000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "part-7",
        sku: "HRD-M8-TORX",
        name: "Stainless Steel M8x25 Brake Caliper Bolts (Pack of 4)",
        category: "Hardware",
        stock_quantity: 12,
        reorder_threshold: 4,
        last_purchased_cost: 8.5,
        selling_price: 14.0,
        location_bin: "Hardware Bin 08",
        last_restocked_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    for (const p of initialParts) {
      await dbClient.execute({
        sql: `INSERT INTO inventory (id, sku, name, category, stock_quantity, reorder_threshold, last_purchased_cost, selling_price, location_bin, last_restocked_at, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          p.id,
          p.sku,
          p.name,
          p.category,
          p.stock_quantity,
          p.reorder_threshold,
          p.last_purchased_cost,
          p.selling_price,
          p.location_bin,
          p.last_restocked_at,
          p.created_at,
          p.updated_at,
        ],
      });

      // Initial movement log
      await dbClient.execute({
        sql: `INSERT INTO stock_movements (id, inventory_id, part_name, type, delta, quantity_after, reason, unit_cost, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `mov-init-${p.id}`,
          p.id,
          p.name,
          "RESTOCK_RECEIPT",
          p.stock_quantity,
          p.stock_quantity,
          "Initial garage inventory intake",
          p.last_purchased_cost,
          p.last_restocked_at,
        ],
      });
    }

    // Insert sample approved receipt to populate the Expense Ledger & Drive link
    const sampleReceiptId = "rcpt-initial-sample";
    await dbClient.execute({
      sql: `INSERT INTO receipts (id, vendor_name, transaction_date, receipt_number, subtotal, tax, total_amount, item_count, original_filename, mime_type, google_drive_file_id, google_drive_web_link, drive_sync_status, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        sampleReceiptId,
        "Apex Moto Wholesalers Ltd",
        new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0],
        "INV-APX-9942",
        185.0,
        14.8,
        199.8,
        2,
        "apex_moto_invoice_9942.jpg",
        "image/jpeg",
        "1Zk9-ApEx_DriveFile9942",
        "https://drive.google.com/file/d/1Zk9-ApEx_DriveFile9942/view?usp=sharing",
        "synced",
        "Bulk fluids and fast-moving bolts restock for workshop bays",
        new Date(Date.now() - 3 * 86400000).toISOString(),
      ],
    });

    await dbClient.execute({
      sql: `INSERT INTO receipt_items (id, receipt_id, part_name, sku, quantity, unit_price, total_price, category, matched_inventory_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        "item-1",
        sampleReceiptId,
        "Motul 7100 4T 10W-40 Synthetic Oil (1L)",
        "MOT-7100-10W40",
        8,
        18.5,
        148.0,
        "Oils & Fluids",
        "part-1",
        "item-2",
        sampleReceiptId,
        "Stainless Steel M8x25 Brake Caliper Bolts (Pack of 4)",
        "HRD-M8-TORX",
        4,
        8.5,
        34.0,
        "Hardware",
        "part-7",
      ],
    });
  }

  // Check and seed default company email domain setting (working with gmail.com)
  await dbClient.execute(`
    INSERT OR IGNORE INTO app_settings (key, value)
    VALUES ('company_email_domain', 'gmail.com');
  `);

  // Migrate existing staff accounts and app_settings to gmail.com if they were previously motofixgarage.com
  await dbClient.execute(`
    UPDATE app_settings
    SET value = 'gmail.com'
    WHERE key = 'company_email_domain' AND (value = 'motofixgarage.com' OR value LIKE '%motofix%');
  `);

  await dbClient.execute(`
    UPDATE staff_users
    SET company_email = REPLACE(company_email, '@motofixgarage.com', '@gmail.com')
    WHERE company_email LIKE '%@motofixgarage.com';
  `);

  await dbClient.execute(`
    UPDATE sales_receipts
    SET staff_email = REPLACE(staff_email, '@motofixgarage.com', '@gmail.com')
    WHERE staff_email LIKE '%@motofixgarage.com';
  `);

  // Check and seed starter staff users if empty
  const staffCountResult = await dbClient.execute("SELECT COUNT(*) as count FROM staff_users");
  const staffCount = Number(staffCountResult.rows[0]?.count ?? 0);
  if (staffCount === 0) {
    const starterStaff = [
      {
        id: "staff-1",
        username: "alex.tech",
        name: "Alex Rivera",
        company_email: "alex.tech@gmail.com",
        access_code: "4829",
        role: "staff",
        status: "active",
        first_login_completed: 1,
        last_login_at: new Date(Date.now() - 3600000).toISOString(),
        created_at: new Date().toISOString(),
      },
      {
        id: "staff-2",
        username: "sam.counter",
        name: "Sam Miller",
        company_email: "sam.counter@gmail.com",
        access_code: "1234",
        role: "staff",
        status: "active",
        first_login_completed: 1,
        last_login_at: new Date(Date.now() - 7200000).toISOString(),
        created_at: new Date().toISOString(),
      },
    ];

    for (const s of starterStaff) {
      await dbClient.execute({
        sql: `INSERT INTO staff_users (id, username, name, company_email, access_code, role, status, first_login_completed, last_login_at, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          s.id,
          s.username,
          s.name,
          s.company_email,
          s.access_code,
          s.role,
          s.status,
          s.first_login_completed,
          s.last_login_at,
          s.created_at,
        ],
      });
    }

    // Seed a sample sales receipt logged by staff
    const sampleSaleId = "sale-init-001";
    await dbClient.execute({
      sql: `INSERT INTO sales_receipts (
              id, receipt_number, customer_name, customer_phone, motorcycle_model, subtotal, tax, total_amount, payment_method, staff_id, staff_username, staff_name, staff_email, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        sampleSaleId,
        "SALE-2026-0041",
        "Dave Jenkins",
        "(555) 234-8891",
        "Yamaha MT-07 (2022)",
        82.99,
        6.64,
        89.63,
        "Card",
        "staff-1",
        "alex.tech",
        "Alex Rivera",
        "alex.tech@gmail.com",
        "Customer walked in for oil change package & NGK spark plugs",
        new Date(Date.now() - 86400000).toISOString(),
      ],
    });

    await dbClient.execute({
      sql: `INSERT INTO sale_receipt_items (id, sale_id, inventory_id, part_name, sku, quantity, unit_price, total_price, category)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        "sitem-1",
        sampleSaleId,
        "part-1",
        "Motul 7100 4T 10W-40 Synthetic Oil (1L)",
        "MOT-7100-10W40",
        2,
        24.99,
        49.98,
        "Oils & Fluids",
        "sitem-2",
        sampleSaleId,
        "part-3",
        "NGK Laser Iridium Spark Plug CR9EIA-9",
        "SPK-NGK-CR9E",
        2,
        16.5,
        33.0,
        "Electrical",
      ],
    });
  }

  // Check and seed realistic 30-day sales history if fewer than 10 receipts exist
  const salesCountResult = await dbClient.execute("SELECT COUNT(*) as count FROM sales_receipts");
  const salesCount = Number(salesCountResult.rows[0]?.count ?? 0);

  if (salesCount <= 6) {
    // Additional sample sales across the last 30 days
    const extraSales = [
      {
        id: "sale-init-002",
        receipt_number: "SALE-2026-0038",
        customer_name: "Sarah Connor",
        customer_phone: "(555) 891-4412",
        motorcycle_model: "Honda CBR600RR (2021)",
        subtotal: 235.95,
        tax: 18.88,
        total_amount: 254.83,
        payment_method: "Card",
        staff_id: "staff-1",
        staff_username: "alex.tech",
        staff_name: "Alex Rivera",
        staff_email: "alex.tech@gmail.com",
        notes: "600RR Track prep: 4L Motul Synthetic, KN filter & front pads",
        created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
        items: [
          { inv_id: "part-1", name: "Motul 7100 4T 10W-40 Synthetic Oil (1L)", sku: "MOT-7100-10W40", qty: 4, price: 24.99, cat: "Oils & Fluids" },
          { inv_id: "part-6", name: "K&N Oil Filter KN-204-1 Black", sku: "FLT-KN-KN204", qty: 1, price: 19.99, cat: "Oils & Fluids" },
          { inv_id: "part-2", name: "Brembo Sintered Front Brake Pads 07BB", sku: "BRK-PAD-07BB", qty: 2, price: 58.0, cat: "Braking" },
        ],
      },
      {
        id: "sale-init-002b",
        receipt_number: "SALE-2026-0037",
        customer_name: "Rajesh Shrestha",
        customer_phone: "(555) 312-9901",
        motorcycle_model: "KTM Duke 390 (2023)",
        subtotal: 114.98,
        tax: 9.20,
        total_amount: 124.18,
        payment_method: "Cash",
        staff_id: "staff-2",
        staff_username: "sam.counter",
        staff_name: "Sam Miller",
        staff_email: "sam.counter@gmail.com",
        notes: "Duke 390 oil change and spark plug check",
        created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        items: [
          { inv_id: "part-1", name: "Motul 7100 4T 10W-40 Synthetic Oil (1L)", sku: "MOT-7100-10W40", qty: 2, price: 24.99, cat: "Oils & Fluids" },
          { inv_id: "part-3", name: "NGK Laser Iridium Spark Plug CR9EIA-9", sku: "SPK-NGK-CR9E", qty: 2, price: 16.5, cat: "Electrical" },
          { inv_id: "part-6", name: "K&N Oil Filter KN-204-1 Black", sku: "FLT-KN-KN204", qty: 1, price: 19.99, cat: "Oils & Fluids" },
        ],
      },
      {
        id: "sale-init-003",
        receipt_number: "SALE-2026-0034",
        customer_name: "Marco Rossi",
        customer_phone: "(555) 772-9011",
        motorcycle_model: "Ducati Monster 821",
        subtotal: 281.96,
        tax: 22.56,
        total_amount: 304.52,
        payment_method: "Card",
        staff_id: "staff-2",
        staff_username: "sam.counter",
        staff_name: "Sam Miller",
        staff_email: "sam.counter@gmail.com",
        notes: "Full service pack: spark plugs, brake pads, and oil",
        created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
        items: [
          { inv_id: "part-2", name: "Brembo Sintered Front Brake Pads 07BB", sku: "BRK-PAD-07BB", qty: 2, price: 58.0, cat: "Braking" },
          { inv_id: "part-1", name: "Motul 7100 4T 10W-40 Synthetic Oil (1L)", sku: "MOT-7100-10W40", qty: 4, price: 24.99, cat: "Oils & Fluids" },
          { inv_id: "part-3", name: "NGK Laser Iridium Spark Plug CR9EIA-9", sku: "SPK-NGK-CR9E", qty: 4, price: 16.5, cat: "Electrical" },
        ],
      },
      {
        id: "sale-init-003b",
        receipt_number: "SALE-2026-0032",
        customer_name: "Anita Thapa",
        customer_phone: "(555) 441-2099",
        motorcycle_model: "Royal Enfield Classic 350",
        subtotal: 168.0,
        tax: 13.44,
        total_amount: 181.44,
        payment_method: "Card",
        staff_id: "staff-1",
        staff_username: "alex.tech",
        staff_name: "Alex Rivera",
        staff_email: "alex.tech@gmail.com",
        notes: "Engine service & brake hardware upgrade",
        created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        items: [
          { inv_id: "part-1", name: "Motul 7100 4T 10W-40 Synthetic Oil (1L)", sku: "MOT-7100-10W40", qty: 3, price: 24.99, cat: "Oils & Fluids" },
          { inv_id: "part-2", name: "Brembo Sintered Front Brake Pads 07BB", sku: "BRK-PAD-07BB", qty: 1, price: 58.0, cat: "Braking" },
          { inv_id: "part-7", name: "Stainless Steel M8x25 Brake Caliper Bolts (Pack of 4)", sku: "HRD-M8-TORX", qty: 2, price: 13.0, cat: "Hardware" },
        ],
      },
      {
        id: "sale-init-004",
        receipt_number: "SALE-2026-0029",
        customer_name: "Brian O'Conner",
        customer_phone: "(555) 349-1120",
        motorcycle_model: "Kawasaki Ninja ZX-6R",
        subtotal: 456.0,
        tax: 36.48,
        total_amount: 492.48,
        payment_method: "Card",
        staff_id: "staff-1",
        staff_username: "alex.tech",
        staff_name: "Alex Rivera",
        staff_email: "alex.tech@gmail.com",
        notes: "Front Michelin Road 6 tires replacement and caliper bolts",
        created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
        items: [
          { inv_id: "part-5", name: "Michelin Road 6 Front Tire 120/70 ZR17", sku: "TYR-MIC-ROAD6-F", qty: 2, price: 215.0, cat: "Tires" },
          { inv_id: "part-7", name: "Stainless Steel M8x25 Brake Caliper Bolts (Pack of 4)", sku: "HRD-M8-TORX", qty: 2, price: 13.0, cat: "Hardware" },
        ],
      },
      {
        id: "sale-init-004b",
        receipt_number: "SALE-2026-0026",
        customer_name: "Carlos Gomez",
        customer_phone: "(555) 670-4491",
        motorcycle_model: "BMW R1250GS",
        subtotal: 215.0,
        tax: 17.20,
        total_amount: 232.20,
        payment_method: "Card",
        staff_id: "staff-2",
        staff_username: "sam.counter",
        staff_name: "Sam Miller",
        staff_email: "sam.counter@gmail.com",
        notes: "Front tire replacement",
        created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
        items: [
          { inv_id: "part-5", name: "Michelin Road 6 Front Tire 120/70 ZR17", sku: "TYR-MIC-ROAD6-F", qty: 1, price: 215.0, cat: "Tires" },
        ],
      },
      {
        id: "sale-init-004c",
        receipt_number: "SALE-2026-0024",
        customer_name: "Liam Neeson",
        customer_phone: "(555) 882-1902",
        motorcycle_model: "Harley Sportster S",
        subtotal: 182.97,
        tax: 14.64,
        total_amount: 197.61,
        payment_method: "Cash",
        staff_id: "staff-1",
        staff_username: "alex.tech",
        staff_name: "Alex Rivera",
        staff_email: "alex.tech@gmail.com",
        notes: "Fluids and filter change",
        created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
        items: [
          { inv_id: "part-1", name: "Motul 7100 4T 10W-40 Synthetic Oil (1L)", sku: "MOT-7100-10W40", qty: 4, price: 24.99, cat: "Oils & Fluids" },
          { inv_id: "part-6", name: "K&N Oil Filter KN-204-1 Black", sku: "FLT-KN-KN204", qty: 1, price: 19.99, cat: "Oils & Fluids" },
          { inv_id: "part-3", name: "NGK Laser Iridium Spark Plug CR9EIA-9", sku: "SPK-NGK-CR9E", qty: 4, price: 16.5, cat: "Electrical" },
        ],
      },
      {
        id: "sale-init-005",
        receipt_number: "SALE-2026-0022",
        customer_name: "Elena Vance",
        customer_phone: "(555) 601-3829",
        motorcycle_model: "Suzuki GSX-R750",
        subtotal: 290.96,
        tax: 23.28,
        total_amount: 314.24,
        payment_method: "Cash",
        staff_id: "staff-2",
        staff_username: "sam.counter",
        staff_name: "Sam Miller",
        staff_email: "sam.counter@gmail.com",
        notes: "Drive chain replacement & engine tune up",
        created_at: new Date(Date.now() - 19 * 86400000).toISOString(),
        items: [
          { inv_id: "part-4", name: "D.I.D 525VX3 X-Ring Drive Chain 120L", sku: "CHN-DID-525VX3", qty: 1, price: 125.0, cat: "Drivetrain" },
          { inv_id: "part-1", name: "Motul 7100 4T 10W-40 Synthetic Oil (1L)", sku: "MOT-7100-10W40", qty: 4, price: 24.99, cat: "Oils & Fluids" },
          { inv_id: "part-3", name: "NGK Laser Iridium Spark Plug CR9EIA-9", sku: "SPK-NGK-CR9E", qty: 4, price: 16.5, cat: "Electrical" },
        ],
      },
      {
        id: "sale-init-006",
        receipt_number: "SALE-2026-0017",
        customer_name: "Tyler Durden",
        customer_phone: "(555) 912-7744",
        motorcycle_model: "Triumph Bonneville T120",
        subtotal: 123.98,
        tax: 9.92,
        total_amount: 133.9,
        payment_method: "Card",
        staff_id: "staff-1",
        staff_username: "alex.tech",
        staff_name: "Alex Rivera",
        staff_email: "alex.tech@gmail.com",
        notes: "Routine maintenance and fresh filters",
        created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
        items: [
          { inv_id: "part-6", name: "K&N Oil Filter KN-204-1 Black", sku: "FLT-KN-KN204", qty: 2, price: 19.99, cat: "Oils & Fluids" },
          { inv_id: "part-2", name: "Brembo Sintered Front Brake Pads 07BB", sku: "BRK-PAD-07BB", qty: 1, price: 58.0, cat: "Braking" },
          { inv_id: "part-7", name: "Stainless Steel M8x25 Brake Caliper Bolts (Pack of 4)", sku: "HRD-M8-TORX", qty: 2, price: 13.0, cat: "Hardware" },
        ],
      },
    ];

    for (const es of extraSales) {
      await dbClient.execute({
        sql: `INSERT OR IGNORE INTO sales_receipts (
                id, receipt_number, customer_name, customer_phone, motorcycle_model, subtotal, tax, total_amount, payment_method, staff_id, staff_username, staff_name, staff_email, notes, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          es.id,
          es.receipt_number,
          es.customer_name,
          es.customer_phone,
          es.motorcycle_model,
          es.subtotal,
          es.tax,
          es.total_amount,
          es.payment_method,
          es.staff_id,
          es.staff_username,
          es.staff_name,
          es.staff_email,
          es.notes,
          es.created_at,
        ],
      });

      for (let i = 0; i < es.items.length; i++) {
        const it = es.items[i];
        await dbClient.execute({
          sql: `INSERT OR IGNORE INTO sale_receipt_items (id, sale_id, inventory_id, part_name, sku, quantity, unit_price, total_price, category)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            `${es.id}-item-${i}`,
            es.id,
            it.inv_id,
            it.name,
            it.sku,
            it.qty,
            it.price,
            Number((it.qty * it.price).toFixed(2)),
            it.cat,
          ],
        });
      }
    }
  }
}
