import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initDatabase, dbClient } from "./src/server/db.ts";
import { parseReceiptWithOpenSourceOcr } from "./src/server/openSourceOcrParser.ts";
import { archiveReceiptFile } from "./src/server/driveService.ts";
import crypto from "crypto";

const PORT = 3000;

async function startServer() {
  const app = express();

  // Increase payload limit for raw receipt photos and scanned documents
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Initialize SQLite tables and seed starter data
  try {
    await initDatabase();
    console.log("Local SQLite database initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize SQLite database:", err);
  }

  // ---------------- API ROUTES ----------------

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      app: "MotoFix Garage",
      time: new Date().toISOString(),
      database: "SQLite (Local-first)",
    });
  });

  // Serve archived receipt files
  const ARCHIVE_DIR = path.join(process.cwd(), "data", "receipt_archive");
  app.use("/api/receipts/archive", express.static(ARCHIVE_DIR));

  // 1. RECEIPT PARSING (Open Source OCR: Tesseract.js)
  app.post("/api/receipts/parse", async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Missing imageBase64 in request body." });
      }

      console.log("Processing receipt with Open Source OCR (Tesseract.js)...");
      const parsedData = await parseReceiptWithOpenSourceOcr(imageBase64, mimeType || "image/jpeg");

      // Match extracted line items against existing inventory in SQLite
      const inventoryRows = await dbClient.execute("SELECT id, sku, name, category, stock_quantity, last_purchased_cost FROM inventory");
      const inventoryList = inventoryRows.rows;

      const itemsWithMatchInfo = parsedData.items.map((item) => {
        // Try exact SKU match first
        let matched = null;
        if (item.sku && item.sku.trim()) {
          matched = inventoryList.find(
            (inv) =>
              String(inv.sku || "").toLowerCase() === item.sku.trim().toLowerCase()
          );
        }

        // Try exact/close name match if SKU didn't match
        if (!matched && item.part_name) {
          const cleanItemName = item.part_name.toLowerCase().trim();
          matched = inventoryList.find((inv) => {
            const cleanInvName = String(inv.name || "").toLowerCase().trim();
            return (
              cleanInvName === cleanItemName ||
              cleanInvName.includes(cleanItemName) ||
              cleanItemName.includes(cleanInvName)
            );
          });
        }

        return {
          ...item,
          matchedInventoryId: matched ? String(matched.id) : null,
          matchedInventoryName: matched ? String(matched.name) : null,
          currentStock: matched ? Number(matched.stock_quantity) : 0,
          isNewItem: !matched,
        };
      });

      res.json({
        success: true,
        data: {
          ...parsedData,
          items: itemsWithMatchInfo,
        },
      });
    } catch (err: any) {
      console.error("Receipt parsing failed:", err);
      res.status(500).json({
        error: err?.message || "Failed to parse receipt with Open Source OCR.",
      });
    }
  });

  // 2. APPROVE RECEIPT & SYNC INVENTORY & ARCHIVE TO GOOGLE DRIVE
  app.post("/api/receipts/approve", async (req, res) => {
    try {
      const {
        vendor_name,
        transaction_date,
        receipt_number,
        subtotal,
        tax,
        total_amount,
        notes,
        items,
        original_filename,
        mime_type,
        raw_image_data,
      } = req.body;

      if (!vendor_name || !total_amount || !items || !Array.isArray(items)) {
        return res.status(400).json({ error: "Invalid receipt payload." });
      }

      // 1. Google Drive & Local Archiving
      let driveResult = {
        fileId: `drive-local-${Date.now()}`,
        webLink: "",
        syncStatus: "local_only" as "synced" | "local_only" | "pending",
        localPath: "",
      };

      if (raw_image_data) {
        // Read app drive settings if stored
        const settingRow = await dbClient.execute({
          sql: "SELECT value FROM app_settings WHERE key = 'google_drive_folder_id'",
          args: [],
        });
        const folderId = (settingRow.rows[0]?.value as string) || process.env.GOOGLE_DRIVE_FOLDER_ID;

        driveResult = await archiveReceiptFile({
          filename: original_filename || `Receipt_${vendor_name.replace(/\s+/g, "_")}`,
          mimeType: mime_type || "image/jpeg",
          base64Data: raw_image_data,
          folderId,
          accessToken: process.env.GOOGLE_DRIVE_ACCESS_TOKEN,
        });
      }

      const receiptId = `rcpt-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
      const now = new Date().toISOString();

      // 2. Insert into receipts table
      await dbClient.execute({
        sql: `INSERT INTO receipts (
          id, vendor_name, transaction_date, receipt_number, subtotal, tax, total_amount, item_count,
          original_filename, mime_type, image_data, google_drive_file_id, google_drive_web_link,
          drive_sync_status, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          receiptId,
          vendor_name,
          transaction_date || now.split("T")[0],
          receipt_number || "",
          Number(subtotal) || 0,
          Number(tax) || 0,
          Number(total_amount),
          items.length,
          original_filename || "receipt_scan.jpg",
          mime_type || "image/jpeg",
          raw_image_data || null,
          driveResult.fileId,
          driveResult.webLink,
          driveResult.syncStatus,
          notes || "",
          now,
        ],
      });

      // 3. Process line items and perform inventory matching & sync
      const inventoryRows = await dbClient.execute("SELECT * FROM inventory");
      const currentInventory = inventoryRows.rows;

      for (const item of items) {
        const itemId = `item-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
        const qty = Math.max(1, Number(item.quantity) || 1);
        const unitCost = Number(item.unit_price) || 0;
        const lineTotal = Number(item.total_price) || qty * unitCost;
        const itemSku = (item.sku || "").trim();
        const itemName = (item.part_name || "Motorcycle Part").trim();
        const itemCat = item.category || "Other";

        // Matching logic:
        let matched = null;
        if (item.matchedInventoryId) {
          matched = currentInventory.find((i) => String(i.id) === String(item.matchedInventoryId));
        }
        if (!matched && itemSku) {
          matched = currentInventory.find(
            (i) => String(i.sku || "").toLowerCase() === itemSku.toLowerCase()
          );
        }
        if (!matched) {
          matched = currentInventory.find(
            (i) => String(i.name || "").toLowerCase() === itemName.toLowerCase()
          );
        }

        let targetInventoryId: string;
        let qtyAfter: number;

        if (matched) {
          // Existing part: increment stock_quantity, update last_purchased_cost, update last_restocked_at
          targetInventoryId = String(matched.id);
          const currentStock = Number(matched.stock_quantity) || 0;
          qtyAfter = currentStock + qty;

          await dbClient.execute({
            sql: `UPDATE inventory SET 
                    stock_quantity = ?, 
                    last_purchased_cost = ?, 
                    last_restocked_at = ?, 
                    updated_at = ?
                  WHERE id = ?`,
            args: [qtyAfter, unitCost, now, now, targetInventoryId],
          });
        } else {
          // New part: create new inventory entry with default reorder threshold 2
          targetInventoryId = `part-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
          qtyAfter = qty;
          const defaultSellingPrice = Number((unitCost * 1.35).toFixed(2));

          await dbClient.execute({
            sql: `INSERT INTO inventory (
                    id, sku, name, category, stock_quantity, reorder_threshold, 
                    last_purchased_cost, selling_price, location_bin, last_restocked_at, 
                    created_at, updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              targetInventoryId,
              itemSku || `GEN-${Date.now().toString().slice(-6)}`,
              itemName,
              itemCat,
              qtyAfter,
              2, // default reorder threshold
              unitCost,
              defaultSellingPrice,
              "General Storage",
              now,
              now,
              now,
            ],
          });
        }

        // Record line item in receipt_items
        await dbClient.execute({
          sql: `INSERT INTO receipt_items (
                  id, receipt_id, part_name, sku, quantity, unit_price, total_price, category, matched_inventory_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            itemId,
            receiptId,
            itemName,
            itemSku,
            qty,
            unitCost,
            lineTotal,
            itemCat,
            targetInventoryId,
          ],
        });

        // Record stock movement log
        await dbClient.execute({
          sql: `INSERT INTO stock_movements (
                  id, inventory_id, part_name, type, delta, quantity_after, reason, unit_cost, receipt_id, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            `mov-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
            targetInventoryId,
            itemName,
            "RESTOCK_RECEIPT",
            qty,
            qtyAfter,
            `Receipt intake from ${vendor_name} (#${receipt_number || "N/A"})`,
            unitCost,
            receiptId,
            now,
          ],
        });
      }

      res.json({
        success: true,
        receiptId,
        driveFileId: driveResult.fileId,
        driveWebLink: driveResult.webLink,
        driveSyncStatus: driveResult.syncStatus,
        message: "Receipt verified, inventory synchronized, and document archived.",
      });
    } catch (err: any) {
      console.error("Failed to approve receipt:", err);
      res.status(500).json({ error: err?.message || "Failed to commit receipt." });
    }
  });

  // 3. INVENTORY DASHBOARD API (Search, Filter, Sort)
  app.get("/api/inventory", async (req, res) => {
    try {
      const { search, category, low_stock, sort_by, sort_dir } = req.query;

      let query = "SELECT * FROM inventory WHERE 1=1";
      const args: any[] = [];

      if (search && typeof search === "string" && search.trim()) {
        query += " AND (name LIKE ? OR sku LIKE ? OR location_bin LIKE ?)";
        const term = `%${search.trim()}%`;
        args.push(term, term, term);
      }

      if (category && typeof category === "string" && category !== "ALL") {
        query += " AND category = ?";
        args.push(category);
      }

      if (low_stock === "true") {
        const thresholdNum = req.query.threshold !== undefined && req.query.threshold !== "" ? Number(req.query.threshold) : NaN;
        if (!isNaN(thresholdNum)) {
          query += " AND stock_quantity <= ?";
          args.push(thresholdNum);
        } else {
          query += " AND stock_quantity <= reorder_threshold";
        }
      }

      // Sort logic
      const validSortCols: Record<string, string> = {
        name: "name",
        category: "category",
        stock_quantity: "stock_quantity",
        unit_cost: "last_purchased_cost",
        last_purchased_cost: "last_purchased_cost",
        last_restocked_at: "last_restocked_at",
      };

      const sortCol = validSortCols[String(sort_by || "").toLowerCase()] || "name";
      const direction = String(sort_dir || "").toLowerCase() === "desc" ? "DESC" : "ASC";

      query += ` ORDER BY ${sortCol} ${direction}`;

      const result = await dbClient.execute({ sql: query, args });
      res.json({ items: result.rows });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to query inventory." });
    }
  });

  // 4. QUICK DECREMENT FOR MECHANIC WORKSHOP JOBS (-1, -5)
  app.post("/api/inventory/:id/decrement", async (req, res) => {
    try {
      const { id } = req.params;
      const amount = Math.max(1, Number(req.body.amount) || 1);
      const reason = req.body.reason || `Mechanic pulled ${amount} unit(s) for repair job`;

      const partResult = await dbClient.execute({
        sql: "SELECT * FROM inventory WHERE id = ?",
        args: [id],
      });

      if (partResult.rows.length === 0) {
        return res.status(404).json({ error: "Part not found." });
      }

      const part = partResult.rows[0];
      const currentStock = Number(part.stock_quantity) || 0;
      const newStock = Math.max(0, currentStock - amount);
      const now = new Date().toISOString();

      await dbClient.execute({
        sql: "UPDATE inventory SET stock_quantity = ?, updated_at = ? WHERE id = ?",
        args: [newStock, now, id],
      });

      // Record stock movement
      await dbClient.execute({
        sql: `INSERT INTO stock_movements (
                id, inventory_id, part_name, type, delta, quantity_after, reason, unit_cost, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `mov-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
          id,
          part.name,
          "JOB_USAGE",
          -amount,
          newStock,
          reason,
          part.last_purchased_cost,
          now,
        ],
      });

      res.json({
        success: true,
        newStock,
        partName: part.name,
        isLowStock: newStock <= Number(part.reorder_threshold),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to decrement inventory." });
    }
  });

  // 5. QUICK INCREMENT / RESTOCK (+1, +5)
  app.post("/api/inventory/:id/increment", async (req, res) => {
    try {
      const { id } = req.params;
      const amount = Math.max(1, Number(req.body.amount) || 1);
      const reason = req.body.reason || `Manual stock adjustment (+${amount})`;

      const partResult = await dbClient.execute({
        sql: "SELECT * FROM inventory WHERE id = ?",
        args: [id],
      });

      if (partResult.rows.length === 0) {
        return res.status(404).json({ error: "Part not found." });
      }

      const part = partResult.rows[0];
      const currentStock = Number(part.stock_quantity) || 0;
      const newStock = currentStock + amount;
      const now = new Date().toISOString();

      await dbClient.execute({
        sql: "UPDATE inventory SET stock_quantity = ?, last_restocked_at = ?, updated_at = ? WHERE id = ?",
        args: [newStock, now, now, id],
      });

      // Record stock movement
      await dbClient.execute({
        sql: `INSERT INTO stock_movements (
                id, inventory_id, part_name, type, delta, quantity_after, reason, unit_cost, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          `mov-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
          id,
          part.name,
          "MANUAL_ADJUST",
          amount,
          newStock,
          reason,
          part.last_purchased_cost,
          now,
        ],
      });

      res.json({ success: true, newStock, partName: part.name });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to increment inventory." });
    }
  });

  // 6. CREATE NEW INVENTORY PART MANUALLY
  app.post("/api/inventory", async (req, res) => {
    try {
      const { sku, name, category, stock_quantity, reorder_threshold, last_purchased_cost, selling_price, location_bin } = req.body;
      if (!name || !category) {
        return res.status(400).json({ error: "Part name and category are required." });
      }

      const id = `part-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
      const now = new Date().toISOString();
      const stock = Math.max(0, Number(stock_quantity) || 0);
      const cost = Math.max(0, Number(last_purchased_cost) || 0);

      await dbClient.execute({
        sql: `INSERT INTO inventory (
                id, sku, name, category, stock_quantity, reorder_threshold, 
                last_purchased_cost, selling_price, location_bin, last_restocked_at, 
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          sku || `SKU-${Date.now().toString().slice(-6)}`,
          name.trim(),
          category,
          stock,
          Number(reorder_threshold) || 2,
          cost,
          Number(selling_price) || Number((cost * 1.35).toFixed(2)),
          location_bin || "Workshop Storage",
          stock > 0 ? now : null,
          now,
          now,
        ],
      });

      if (stock > 0) {
        await dbClient.execute({
          sql: `INSERT INTO stock_movements (
                  id, inventory_id, part_name, type, delta, quantity_after, reason, unit_cost, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            `mov-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
            id,
            name,
            "MANUAL_ADJUST",
            stock,
            stock,
            "Initial manual stock creation",
            cost,
            now,
          ],
        });
      }

      res.json({ success: true, id });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to create part." });
    }
  });

  // 7. EDIT INVENTORY PART
  app.patch("/api/inventory/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { sku, name, category, reorder_threshold, selling_price, location_bin } = req.body;
      const now = new Date().toISOString();

      await dbClient.execute({
        sql: `UPDATE inventory SET
                sku = COALESCE(?, sku),
                name = COALESCE(?, name),
                category = COALESCE(?, category),
                reorder_threshold = COALESCE(?, reorder_threshold),
                selling_price = COALESCE(?, selling_price),
                location_bin = COALESCE(?, location_bin),
                updated_at = ?
              WHERE id = ?`,
        args: [
          sku || null,
          name || null,
          category || null,
          reorder_threshold !== undefined ? Number(reorder_threshold) : null,
          selling_price !== undefined ? Number(selling_price) : null,
          location_bin || null,
          now,
          id,
        ],
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to update part." });
    }
  });

  // 7b. TOP-SELLING SPARE PARTS ANALYTICS (30 Days receipts ledger)
  app.get(["/api/inventory/top-selling", "/api/inventory/analytics/top-selling"], async (req, res) => {
    try {
      const days = Number(req.query.days) || 30;
      const limit = Number(req.query.limit) || 8;
      const sinceDate = new Date(Date.now() - days * 86400000).toISOString();

      // Aggregate top-selling items from sales receipts ledger
      const topItemsResult = await dbClient.execute({
        sql: `
          SELECT 
            sri.part_name,
            sri.sku,
            sri.category,
            SUM(sri.quantity) as total_quantity_sold,
            SUM(sri.total_price) as total_revenue,
            AVG(sri.unit_price) as avg_unit_price,
            COUNT(DISTINCT sr.id) as receipts_count,
            MAX(sr.created_at) as last_sold_at,
            inv.stock_quantity as current_stock,
            inv.reorder_threshold as reorder_threshold,
            inv.location_bin as location_bin
          FROM sale_receipt_items sri
          JOIN sales_receipts sr ON sri.sale_id = sr.id
          LEFT JOIN inventory inv ON (inv.sku = sri.sku OR inv.name = sri.part_name)
          WHERE sr.created_at >= ?
          GROUP BY sri.part_name
          ORDER BY total_quantity_sold DESC, total_revenue DESC
          LIMIT ?
        `,
        args: [sinceDate, limit],
      });

      // Category breakdown
      const categoryResult = await dbClient.execute({
        sql: `
          SELECT 
            sri.category,
            SUM(sri.quantity) as category_units,
            SUM(sri.total_price) as category_revenue
          FROM sale_receipt_items sri
          JOIN sales_receipts sr ON sri.sale_id = sr.id
          WHERE sr.created_at >= ?
          GROUP BY sri.category
          ORDER BY category_units DESC
        `,
        args: [sinceDate],
      });

      const items = topItemsResult.rows.map((row) => {
        const rawName = String(row.part_name || "");
        // Shorten name for clean bar chart x-axis display
        let shortName = rawName;
        if (rawName.length > 20) {
          shortName = rawName.substring(0, 18).trim() + "…";
        }

        return {
          fullName: rawName,
          name: shortName,
          sku: String(row.sku || "N/A"),
          category: String(row.category || "General"),
          quantity: Number(row.total_quantity_sold || 0),
          revenue: Number(Number(row.total_revenue || 0).toFixed(2)),
          avgUnitPrice: Number(Number(row.avg_unit_price || 0).toFixed(2)),
          receiptsCount: Number(row.receipts_count || 0),
          lastSoldAt: row.last_sold_at,
          currentStock: row.current_stock !== null ? Number(row.current_stock) : null,
          reorderThreshold: row.reorder_threshold !== null ? Number(row.reorder_threshold) : 2,
          locationBin: row.location_bin ? String(row.location_bin) : null,
        };
      });

      const totalQuantity = items.reduce((acc, it) => acc + it.quantity, 0);
      const totalRevenue = Number(items.reduce((acc, it) => acc + it.revenue, 0).toFixed(2));

      const categories = categoryResult.rows.map((row) => ({
        category: String(row.category || "General"),
        units: Number(row.category_units || 0),
        revenue: Number(Number(row.category_revenue || 0).toFixed(2)),
        percentage: totalQuantity > 0 ? Math.round((Number(row.category_units || 0) / totalQuantity) * 100) : 0,
      }));

      res.json({
        days,
        items,
        totalQuantity,
        totalRevenue,
        categories,
        topItem: items[0] || null,
      });
    } catch (err: any) {
      console.error("Top selling parts query error:", err);
      res.status(500).json({ error: err?.message || "Failed to load top selling parts." });
    }
  });

  // 8. RECEIPT HISTORY / EXPENSE LEDGER (Sorting & Filtering)
  app.get("/api/receipts", async (req, res) => {
    try {
      const { vendor, date_from, date_to, sort_by, sort_dir } = req.query;

      let query = "SELECT id, vendor_name, transaction_date, receipt_number, subtotal, tax, total_amount, item_count, original_filename, google_drive_file_id, google_drive_web_link, drive_sync_status, notes, created_at FROM receipts WHERE 1=1";
      const args: any[] = [];

      if (vendor && typeof vendor === "string" && vendor.trim()) {
        query += " AND vendor_name LIKE ?";
        args.push(`%${vendor.trim()}%`);
      }

      if (date_from && typeof date_from === "string") {
        query += " AND transaction_date >= ?";
        args.push(date_from);
      }

      if (date_to && typeof date_to === "string") {
        query += " AND transaction_date <= ?";
        args.push(date_to);
      }

      // Sort logic
      const validSortCols: Record<string, string> = {
        date: "transaction_date",
        total_amount: "total_amount",
        vendor_name: "vendor_name",
        item_count: "item_count",
        created_at: "created_at",
      };

      const sortCol = validSortCols[String(sort_by || "").toLowerCase()] || "transaction_date";
      const direction = String(sort_dir || "").toLowerCase() === "asc" ? "ASC" : "DESC";

      query += ` ORDER BY ${sortCol} ${direction}`;

      const result = await dbClient.execute({ sql: query, args });
      res.json({ receipts: result.rows });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to fetch receipts." });
    }
  });

  // 9. RECEIPT DETAILS WITH LINE ITEMS & RAW IMAGE
  app.get("/api/receipts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const receiptRes = await dbClient.execute({
        sql: "SELECT * FROM receipts WHERE id = ?",
        args: [id],
      });

      if (receiptRes.rows.length === 0) {
        return res.status(404).json({ error: "Receipt not found." });
      }

      const itemsRes = await dbClient.execute({
        sql: "SELECT * FROM receipt_items WHERE receipt_id = ?",
        args: [id],
      });

      res.json({
        receipt: receiptRes.rows[0],
        items: itemsRes.rows,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to fetch receipt details." });
    }
  });

  // 10. STOCK MOVEMENTS AUDIT LOG
  app.get("/api/movements", async (req, res) => {
    try {
      const { limit = 50, inventory_id } = req.query;
      let query = "SELECT * FROM stock_movements";
      const args: any[] = [];

      if (inventory_id) {
        query += " WHERE inventory_id = ?";
        args.push(inventory_id);
      }

      query += " ORDER BY created_at DESC LIMIT ?";
      args.push(Number(limit));

      const result = await dbClient.execute({ sql: query, args });
      res.json({ movements: result.rows });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to fetch movements." });
    }
  });

  // 11. GOOGLE DRIVE BACKUP SETTINGS & SYNC STATUS
  app.get("/api/drive/status", async (req, res) => {
    try {
      const folderSetting = await dbClient.execute({
        sql: "SELECT value FROM app_settings WHERE key = 'google_drive_folder_id'",
        args: [],
      });

      const totalArchived = await dbClient.execute(
        "SELECT COUNT(*) as count FROM receipts WHERE google_drive_file_id IS NOT NULL"
      );

      res.json({
        configured: Boolean(process.env.GOOGLE_DRIVE_ACCESS_TOKEN || folderSetting.rows[0]?.value),
        folderId: (folderSetting.rows[0]?.value as string) || process.env.GOOGLE_DRIVE_FOLDER_ID || "root",
        hasAccessToken: Boolean(process.env.GOOGLE_DRIVE_ACCESS_TOKEN),
        archivedCount: Number(totalArchived.rows[0]?.count || 0),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to check Drive status." });
    }
  });

  app.post("/api/drive/config", async (req, res) => {
    try {
      const { folderId } = req.body;
      if (folderId) {
        await dbClient.execute({
          sql: "INSERT INTO app_settings (key, value) VALUES ('google_drive_folder_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
          args: [folderId.trim()],
        });
      }
      res.json({ success: true, folderId });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to update Drive config." });
    }
  });

  // 12. FULL LOCAL DATABASE EXPORT (JSON BACKUP)
  app.get("/api/backup/export", async (req, res) => {
    try {
      const inventory = await dbClient.execute("SELECT * FROM inventory");
      const receipts = await dbClient.execute("SELECT id, vendor_name, transaction_date, receipt_number, subtotal, tax, total_amount, item_count, google_drive_file_id, google_drive_web_link, notes, created_at FROM receipts");
      const movements = await dbClient.execute("SELECT * FROM stock_movements ORDER BY created_at DESC LIMIT 500");

      res.setHeader("Content-Disposition", `attachment; filename="motofix_backup_${new Date().toISOString().split("T")[0]}.json"`);
      res.json({
        app: "MotoFix Garage",
        exportDate: new Date().toISOString(),
        database: "SQLite",
        inventory: inventory.rows,
        receipts: receipts.rows,
        movements: movements.rows,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to generate backup export." });
    }
  });

  // 13. STAFF AUTHENTICATION & PORTAL CONFIG
  app.get("/api/staff/config", async (req, res) => {
    try {
      const domainRow = await dbClient.execute({
        sql: "SELECT value FROM app_settings WHERE key = 'company_email_domain'",
        args: [],
      });
      const companyDomain = (domainRow.rows[0]?.value as string) || "motofixgarage.com";

      // Also get active staff count
      const activeCount = await dbClient.execute("SELECT COUNT(*) as count FROM staff_users WHERE status = 'active'");

      res.json({
        companyDomain,
        activeStaffCount: Number(activeCount.rows[0]?.count || 0),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load staff config." });
    }
  });

  app.post("/api/staff/login", async (req, res) => {
    try {
      const { company_email, username, access_code } = req.body;

      if (!company_email || !username || !access_code) {
        return res.status(400).json({
          error: "Company email, staff username, and access code are all required.",
        });
      }

      const trimmedEmail = String(company_email).trim().toLowerCase();
      const trimmedUsername = String(username).trim().toLowerCase();
      const trimmedCode = String(access_code).trim();

      // Check configured company email domain
      const domainRow = await dbClient.execute({
        sql: "SELECT value FROM app_settings WHERE key = 'company_email_domain'",
        args: [],
      });
      const requiredDomain = ((domainRow.rows[0]?.value as string) || "motofixgarage.com").toLowerCase().replace(/^@/, "");

      // Verify that the email is a valid company email format
      const emailDomain = trimmedEmail.split("@")[1]?.toLowerCase();
      if (!emailDomain) {
        return res.status(400).json({
          error: "Invalid email format. Please provide your official company email address.",
        });
      }

      // Find staff user
      const userRes = await dbClient.execute({
        sql: "SELECT * FROM staff_users WHERE LOWER(username) = ? AND status = 'active'",
        args: [trimmedUsername],
      });

      if (userRes.rows.length === 0) {
        return res.status(401).json({
          error: "Staff account not found or deactivated. Please check username or contact garage owner.",
        });
      }

      const staff = userRes.rows[0];

      // Verify company email
      const staffRegisteredEmail = String(staff.company_email).trim().toLowerCase();
      const emailMatchesExact = staffRegisteredEmail === trimmedEmail;
      const domainMatches = emailDomain === requiredDomain;

      if (!emailMatchesExact && !domainMatches) {
        return res.status(403).json({
          error: `Company email verification failed. Email must match authorized domain (@${requiredDomain}) or registered email (${staffRegisteredEmail}).`,
        });
      }

      // Verify Access Code
      if (String(staff.access_code).trim() !== trimmedCode) {
        return res.status(401).json({
          error: "Incorrect staff access code/PIN. Please verify your code.",
        });
      }

      // Mark first login as completed & update last_login_at
      const now = new Date().toISOString();
      await dbClient.execute({
        sql: "UPDATE staff_users SET first_login_completed = 1, last_login_at = ? WHERE id = ?",
        args: [now, staff.id],
      });

      res.json({
        success: true,
        staff: {
          id: staff.id,
          username: staff.username,
          name: staff.name,
          company_email: trimmedEmail,
          role: "staff",
          first_login_completed: true,
        },
        message: `Welcome, ${staff.name}! Staff access granted for sales & inventory lookup.`,
      });
    } catch (err: any) {
      console.error("Staff login failed:", err);
      res.status(500).json({ error: err?.message || "Failed to process staff login." });
    }
  });

  // 14. STAFF INVENTORY (Sanitized: NO wholesale cost, NO sensitive margins)
  app.get("/api/staff/inventory", async (req, res) => {
    try {
      const { search, category, low_stock } = req.query;

      let query = "SELECT id, sku, name, category, stock_quantity, reorder_threshold, selling_price, location_bin, last_restocked_at FROM inventory WHERE 1=1";
      const args: any[] = [];

      if (search && typeof search === "string" && search.trim()) {
        query += " AND (name LIKE ? OR sku LIKE ? OR location_bin LIKE ?)";
        const term = `%${search.trim()}%`;
        args.push(term, term, term);
      }

      if (category && typeof category === "string" && category !== "ALL") {
        query += " AND category = ?";
        args.push(category);
      }

      if (low_stock === "true") {
        query += " AND stock_quantity <= reorder_threshold";
      }

      query += " ORDER BY name ASC";

      const result = await dbClient.execute({ sql: query, args });
      res.json({ items: result.rows });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to fetch staff inventory." });
    }
  });

  // 15. LOG SELL RECEIPT (Customer Checkout / Part Sale)
  app.post("/api/sales", async (req, res) => {
    try {
      const {
        customer_name,
        customer_phone,
        motorcycle_model,
        payment_method = "Card",
        notes,
        items,
        staff_id,
        staff_username,
        staff_name,
        staff_email,
      } = req.body;

      if (!customer_name || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          error: "Customer name and at least one line item are required to log a sale.",
        });
      }

      // Generate Sales Receipt Number: SALE-YYYY-XXXX
      const countRes = await dbClient.execute("SELECT COUNT(*) as count FROM sales_receipts");
      const nextNum = Number(countRes.rows[0]?.count || 0) + 42;
      const receiptNumber = `SALE-${new Date().getFullYear()}-${String(nextNum).padStart(4, "0")}`;

      let subtotal = 0;
      for (const item of items) {
        const qty = Number(item.quantity) || 1;
        const price = Number(item.unit_price) || 0;
        subtotal += qty * price;
      }

      const taxRate = 0.08; // 8% shop sales tax
      const tax = Number((subtotal * taxRate).toFixed(2));
      const totalAmount = Number((subtotal + tax).toFixed(2));
      const saleId = `sale-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
      const now = new Date().toISOString();

      // Insert into sales_receipts table
      await dbClient.execute({
        sql: `INSERT INTO sales_receipts (
                id, receipt_number, customer_name, customer_phone, motorcycle_model,
                subtotal, tax, total_amount, payment_method,
                staff_id, staff_username, staff_name, staff_email, notes, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          saleId,
          receiptNumber,
          customer_name.trim(),
          customer_phone?.trim() || null,
          motorcycle_model?.trim() || null,
          subtotal,
          tax,
          totalAmount,
          payment_method,
          staff_id || "staff-counter",
          staff_username || "staff",
          staff_name || "Staff Member",
          staff_email || "staff@motofixgarage.com",
          notes?.trim() || null,
          now,
        ],
      });

      // Insert line items and update inventory stock
      const recordedItems: any[] = [];
      for (const item of items) {
        const sitemId = `sitem-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
        const qty = Number(item.quantity) || 1;
        const unitPrice = Number(item.unit_price) || 0;
        const lineTotal = Number((qty * unitPrice).toFixed(2));

        // Insert into sale_receipt_items
        await dbClient.execute({
          sql: `INSERT INTO sale_receipt_items (
                  id, sale_id, inventory_id, part_name, sku, quantity, unit_price, total_price, category
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            sitemId,
            saleId,
            item.inventory_id,
            item.part_name,
            item.sku || "",
            qty,
            unitPrice,
            lineTotal,
            item.category || "Other",
          ],
        });

        // Decrement stock in inventory
        const invRow = await dbClient.execute({
          sql: "SELECT stock_quantity, name FROM inventory WHERE id = ?",
          args: [item.inventory_id],
        });

        let currentStock = 0;
        if (invRow.rows.length > 0) {
          currentStock = Number(invRow.rows[0].stock_quantity);
          const newStock = Math.max(0, currentStock - qty);

          await dbClient.execute({
            sql: "UPDATE inventory SET stock_quantity = ?, updated_at = ? WHERE id = ?",
            args: [newStock, now, item.inventory_id],
          });

          // Record stock movement
          await dbClient.execute({
            sql: `INSERT INTO stock_movements (
                    id, inventory_id, part_name, type, delta, quantity_after, reason, created_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              `mov-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
              item.inventory_id,
              item.part_name,
              "SALE",
              -qty,
              newStock,
              `Customer sale #${receiptNumber} logged by ${staff_name || "Staff"} (${customer_name})`,
              now,
            ],
          });
        }

        recordedItems.push({
          id: sitemId,
          inventory_id: item.inventory_id,
          part_name: item.part_name,
          sku: item.sku,
          quantity: qty,
          unit_price: unitPrice,
          total_price: lineTotal,
          category: item.category,
        });
      }

      res.json({
        success: true,
        receipt: {
          id: saleId,
          receipt_number: receiptNumber,
          customer_name,
          customer_phone,
          motorcycle_model,
          subtotal,
          tax,
          total_amount: totalAmount,
          payment_method,
          staff_id,
          staff_username,
          staff_name,
          staff_email,
          notes,
          created_at: now,
          items: recordedItems,
        },
        message: `Sale receipt #${receiptNumber} successfully logged and inventory updated!`,
      });
    } catch (err: any) {
      console.error("Failed to log sale receipt:", err);
      res.status(500).json({ error: err?.message || "Failed to log sale receipt." });
    }
  });

  // 16. LIST SALES RECEIPTS
  app.get("/api/sales", async (req, res) => {
    try {
      const { staff_username, limit = 50 } = req.query;

      let query = "SELECT * FROM sales_receipts";
      const args: any[] = [];

      if (staff_username) {
        query += " WHERE staff_username = ?";
        args.push(staff_username);
      }

      query += " ORDER BY created_at DESC LIMIT ?";
      args.push(Number(limit));

      const salesRes = await dbClient.execute({ sql: query, args });

      res.json({ sales: salesRes.rows });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to fetch sales." });
    }
  });

  // 17. GET SINGLE SALE RECEIPT WITH ITEMS
  app.get("/api/sales/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const saleRes = await dbClient.execute({
        sql: "SELECT * FROM sales_receipts WHERE id = ?",
        args: [id],
      });

      if (saleRes.rows.length === 0) {
        return res.status(404).json({ error: "Sale receipt not found." });
      }

      const itemsRes = await dbClient.execute({
        sql: "SELECT * FROM sale_receipt_items WHERE sale_id = ?",
        args: [id],
      });

      res.json({
        receipt: saleRes.rows[0],
        items: itemsRes.rows,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to fetch sale receipt details." });
    }
  });

  // 18. ADMIN STAFF MANAGEMENT (List, Add, Update, Delete)
  app.get("/api/staff/users", async (req, res) => {
    try {
      const result = await dbClient.execute("SELECT id, username, name, company_email, access_code, role, status, first_login_completed, last_login_at, created_at FROM staff_users ORDER BY created_at ASC");
      res.json({ staff: result.rows });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to fetch staff users." });
    }
  });

  app.post("/api/staff/users", async (req, res) => {
    try {
      const { username, name, company_email, access_code } = req.body;

      if (!username || !name || !company_email || !access_code) {
        return res.status(400).json({ error: "Username, full name, company email, and access code are required." });
      }

      const id = `staff-${Date.now()}`;
      const now = new Date().toISOString();

      await dbClient.execute({
        sql: `INSERT INTO staff_users (id, username, name, company_email, access_code, role, status, first_login_completed, created_at)
              VALUES (?, ?, ?, ?, ?, 'staff', 'active', 0, ?)`,
        args: [
          id,
          String(username).trim().toLowerCase(),
          String(name).trim(),
          String(company_email).trim().toLowerCase(),
          String(access_code).trim(),
          now,
        ],
      });

      res.json({ success: true, id, message: `Staff member ${name} created successfully.` });
    } catch (err: any) {
      if (err?.message?.includes("UNIQUE constraint failed")) {
        return res.status(409).json({ error: "A staff member with this username already exists." });
      }
      res.status(500).json({ error: err?.message || "Failed to create staff member." });
    }
  });

  app.patch("/api/staff/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, company_email, access_code, status } = req.body;

      await dbClient.execute({
        sql: `UPDATE staff_users SET
                name = COALESCE(?, name),
                company_email = COALESCE(?, company_email),
                access_code = COALESCE(?, access_code),
                status = COALESCE(?, status)
              WHERE id = ?`,
        args: [
          name ? String(name).trim() : null,
          company_email ? String(company_email).trim().toLowerCase() : null,
          access_code ? String(access_code).trim() : null,
          status || null,
          id,
        ],
      });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to update staff member." });
    }
  });

  app.delete("/api/staff/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await dbClient.execute({
        sql: "DELETE FROM staff_users WHERE id = ?",
        args: [id],
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to delete staff member." });
    }
  });

  // 19. NOTIFICATION SYSTEM: SETTINGS & LOW-STOCK DISPATCH
  app.get("/api/notifications/settings", async (req, res) => {
    try {
      const settingsRes = await dbClient.execute({
        sql: "SELECT key, value FROM app_settings WHERE key IN ('owner_notification_email', 'global_low_stock_threshold', 'email_alerts_enabled', 'last_low_stock_email_sent_at')",
      });

      const map: Record<string, string> = {};
      for (const row of settingsRes.rows) {
        map[String(row.key)] = String(row.value);
      }

      res.json({
        ownerEmail: map["owner_notification_email"] || "chandra.jha44@gmail.com",
        globalThreshold: map["global_low_stock_threshold"] ? Number(map["global_low_stock_threshold"]) : null,
        emailAlertsEnabled: map["email_alerts_enabled"] !== "false",
        lastAlertSentAt: map["last_low_stock_email_sent_at"] || null,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to fetch notification settings." });
    }
  });

  app.post("/api/notifications/settings", async (req, res) => {
    try {
      const { ownerEmail, globalThreshold, emailAlertsEnabled } = req.body;

      if (ownerEmail !== undefined) {
        await dbClient.execute({
          sql: "INSERT INTO app_settings (key, value) VALUES ('owner_notification_email', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
          args: [String(ownerEmail).trim()],
        });
      }

      if (globalThreshold !== undefined) {
        const val = globalThreshold === null || globalThreshold === "" ? "" : String(Number(globalThreshold));
        await dbClient.execute({
          sql: "INSERT INTO app_settings (key, value) VALUES ('global_low_stock_threshold', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
          args: [val],
        });
      }

      if (emailAlertsEnabled !== undefined) {
        await dbClient.execute({
          sql: "INSERT INTO app_settings (key, value) VALUES ('email_alerts_enabled', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
          args: [emailAlertsEnabled ? "true" : "false"],
        });
      }

      res.json({ success: true, message: "Notification preferences saved." });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to save notification settings." });
    }
  });

  // Check low stock and format notification items
  app.get("/api/notifications/low-stock-check", async (req, res) => {
    try {
      const customThreshold = req.query.threshold !== undefined && req.query.threshold !== ""
        ? Number(req.query.threshold)
        : null;

      let sql = "SELECT * FROM inventory WHERE ";
      const args: any[] = [];

      if (customThreshold !== null && !isNaN(customThreshold)) {
        sql += "stock_quantity <= ?";
        args.push(customThreshold);
      } else {
        sql += "stock_quantity <= reorder_threshold";
      }

      sql += " ORDER BY stock_quantity ASC, name ASC";

      const result = await dbClient.execute({ sql, args });

      const items = result.rows.map((row) => {
        const stock = Number(row.stock_quantity || 0);
        const threshold = customThreshold !== null && !isNaN(customThreshold)
          ? customThreshold
          : Number(row.reorder_threshold || 2);
        const deficit = Math.max(1, threshold - stock + 2); // recommended replenishment
        const severity = stock <= 0 ? "critical" : "warning";

        return {
          ...row,
          stock_quantity: stock,
          reorder_threshold: Number(row.reorder_threshold || 2),
          effective_threshold: threshold,
          deficit,
          severity,
        };
      });

      const criticalCount = items.filter((i) => i.severity === "critical").length;
      const warningCount = items.filter((i) => i.severity === "warning").length;

      res.json({
        items,
        totalLowStock: items.length,
        criticalCount,
        warningCount,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to check low stock notifications." });
    }
  });

  // Send or generate low stock email alert
  app.post("/api/notifications/send-email", async (req, res) => {
    try {
      const { recipient_email, threshold } = req.body;

      // Determine recipient email
      let targetEmail = recipient_email;
      if (!targetEmail) {
        const emailRow = await dbClient.execute("SELECT value FROM app_settings WHERE key = 'owner_notification_email'");
        targetEmail = emailRow.rows[0]?.value ? String(emailRow.rows[0].value) : "chandra.jha44@gmail.com";
      }

      // Query low-stock parts
      let sql = "SELECT * FROM inventory WHERE ";
      const args: any[] = [];
      const thresholdNum = threshold !== undefined && threshold !== "" ? Number(threshold) : null;

      if (thresholdNum !== null && !isNaN(thresholdNum)) {
        sql += "stock_quantity <= ?";
        args.push(thresholdNum);
      } else {
        sql += "stock_quantity <= reorder_threshold";
      }
      sql += " ORDER BY stock_quantity ASC, name ASC";

      const queryRes = await dbClient.execute({ sql, args });
      const parts = queryRes.rows;

      const nowIso = new Date().toISOString();
      const dateFormatted = new Date().toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      // Record last alert timestamp in DB
      await dbClient.execute({
        sql: "INSERT INTO app_settings (key, value) VALUES ('last_low_stock_email_sent_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        args: [nowIso],
      });

      const criticalParts = parts.filter((p) => Number(p.stock_quantity) <= 0);
      const lowParts = parts.filter((p) => Number(p.stock_quantity) > 0);

      // Compose Email Subject and Body
      const subject = `[MotoFix Garage Alert] ⚠️ Low-Stock Warning: ${parts.length} spare parts below threshold (${dateFormatted})`;

      const bodyText = `
MOTOFIX MOTORBIKE REPAIR SHOP - LOW STOCK ALERT
Date: ${dateFormatted}
Recipient: ${targetEmail}
Status: ${criticalParts.length} OUT OF STOCK, ${lowParts.length} LOW STOCK

============================================================
ATTENTION REQUIRED:
The following spare parts have fallen at or below their reorder threshold
and require urgent replenishment to prevent mechanic bay repair delays.
============================================================

${criticalParts.length > 0 ? "CRITICAL (OUT OF STOCK - 0 ON HAND):\n" + criticalParts.map(p => `• [${p.sku}] ${p.name}\n  Category: ${p.category} | Bin: ${p.location_bin || 'N/A'}\n  Current Stock: 0 | Reorder Threshold: ${p.reorder_threshold}\n  Estimated Unit Cost: $${Number(p.last_purchased_cost || 0).toFixed(2)}`).join("\n\n") + "\n\n" : ""}
${lowParts.length > 0 ? "LOW STOCK WARNING (AT OR BELOW THRESHOLD):\n" + lowParts.map(p => `• [${p.sku}] ${p.name}\n  Category: ${p.category} | Bin: ${p.location_bin || 'N/A'}\n  Current Stock: ${p.stock_quantity} | Reorder Threshold: ${p.reorder_threshold}\n  Estimated Unit Cost: $${Number(p.last_purchased_cost || 0).toFixed(2)}`).join("\n\n") : ""}

============================================================
NEXT STEPS:
1. Contact parts distributors (Motul, Brembo, NGK, Michelin).
2. Scan & upload purchase invoices to MotoFix Garage OS when parts arrive.
3. Inventory counts will automatically increment upon receipt approval.

MotoFix Garage OS Notification System
Automated local-first alert from SQLite Database
`.trim();

      // HTML Email format for rich email clients
      const bodyHtml = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid #1e293b;">
  <div style="background: #f59e0b; padding: 20px; color: #020617;">
    <h1 style="margin: 0; font-size: 20px; font-weight: 900; letter-spacing: -0.5px;">MOTOFIX GARAGE • INVENTORY ALERT</h1>
    <p style="margin: 4px 0 0 0; font-size: 13px; font-weight: 600;">⚠️ ${parts.length} Spare Parts Below Minimum Reorder Threshold</p>
  </div>
  <div style="padding: 24px;">
    <p style="font-size: 14px; line-height: 1.5; color: #cbd5e1; margin-top: 0;">
      Hello Shop Owner, our automated inventory monitor detected parts that have fallen below safety reorder stock. Here is your reorder requisition list as of <strong>${dateFormatted}</strong>:
    </p>
    <div style="margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
        <thead>
          <tr style="border-bottom: 2px solid #334155; color: #94a3b8; font-family: monospace;">
            <th style="padding: 8px 4px;">PART NAME &amp; SKU</th>
            <th style="padding: 8px 4px; text-align: center;">STOCK</th>
            <th style="padding: 8px 4px; text-align: center;">THRESHOLD</th>
            <th style="padding: 8px 4px; text-align: right;">EST. COST</th>
          </tr>
        </thead>
        <tbody>
          ${parts.map((p) => {
            const isZero = Number(p.stock_quantity) <= 0;
            return `
            <tr style="border-bottom: 1px solid #1e293b; background: ${isZero ? 'rgba(239, 68, 68, 0.08)' : 'transparent'};">
              <td style="padding: 10px 4px;">
                <strong style="color: ${isZero ? '#f87171' : '#f1f5f9'};">${p.name}</strong><br/>
                <span style="font-size: 11px; color: #64748b; font-family: monospace;">${p.sku} • ${p.category} ${p.location_bin ? '• ' + p.location_bin : ''}</span>
              </td>
              <td style="padding: 10px 4px; text-align: center;">
                <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-family: monospace; font-size: 11px; background: ${isZero ? '#ef4444' : '#f59e0b'}; color: #020617;">
                  ${p.stock_quantity}
                </span>
              </td>
              <td style="padding: 10px 4px; text-align: center; font-family: monospace; color: #94a3b8;">
                ${p.reorder_threshold}
              </td>
              <td style="padding: 10px 4px; text-align: right; font-family: monospace; color: #38bdf8; font-weight: bold;">
                $${Number(p.last_purchased_cost || 0).toFixed(2)}
              </td>
            </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
    <div style="background: #1e293b; border-radius: 8px; padding: 14px; font-size: 12px; color: #94a3b8; margin-top: 20px;">
      💡 <em>Tip: Once your supplier delivery arrives, scan or drag-and-drop the supplier receipt into MotoFix Garage OS to auto-sync inventory quantities and archive the original document in Google Drive.</em>
    </div>
  </div>
  <div style="background: #090d16; padding: 14px 24px; border-top: 1px solid #1e293b; font-size: 11px; color: #64748b; text-align: center; font-family: monospace;">
    MotoFix Garage OS • Automated Reorder Notice • Generated locally from SQLite database
  </div>
</div>
`.trim();

      // Encode mailto URL for immediate 1-click fallback
      const mailtoUrl = `mailto:${encodeURIComponent(targetEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;

      res.json({
        success: true,
        emailSentTo: targetEmail,
        partsCount: parts.length,
        criticalCount: criticalParts.length,
        warningCount: lowParts.length,
        subject,
        bodyText,
        bodyHtml,
        mailtoUrl,
        sentAt: nowIso,
        message: `Low-stock notification advisory prepared for ${targetEmail} (${parts.length} parts flagged).`,
      });
    } catch (err: any) {
      console.error("Failed to send low-stock notification:", err);
      res.status(500).json({ error: err?.message || "Failed to dispatch low-stock notification." });
    }
  });

  // ---------------- VITE MIDDLEWARE / SPA FALLBACK ----------------
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🏍️ MotoFix Garage server running at http://localhost:${PORT}`);
  });
}

startServer();
