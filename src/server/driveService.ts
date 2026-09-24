import fs from "fs";
import path from "path";
import crypto from "crypto";

const ARCHIVE_DIR = path.join(process.cwd(), "data", "receipt_archive");
if (!fs.existsSync(ARCHIVE_DIR)) {
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
}

export interface DriveArchiveResult {
  fileId: string;
  webLink: string;
  syncStatus: "synced" | "local_only" | "pending";
  localPath: string;
}

export async function archiveReceiptFile({
  filename,
  mimeType,
  base64Data,
  folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || "root",
  accessToken = process.env.GOOGLE_DRIVE_ACCESS_TOKEN,
}: {
  filename: string;
  mimeType: string;
  base64Data: string;
  folderId?: string;
  accessToken?: string;
}): Promise<DriveArchiveResult> {
  // 1. Always store a local copy for local-first reliability in the garage
  const fileHash = crypto.randomBytes(6).toString("hex");
  const ext = mimeType.includes("pdf") ? ".pdf" : mimeType.includes("png") ? ".png" : ".jpg";
  const safeName = `${Date.now()}-${fileHash}-${filename.replace(/[^a-zA-Z0-9_-]/g, "_")}${ext}`;
  const localFilePath = path.join(ARCHIVE_DIR, safeName);

  let cleanBase64 = base64Data;
  if (base64Data.startsWith("data:")) {
    const commaIdx = base64Data.indexOf(",");
    if (commaIdx !== -1) {
      cleanBase64 = base64Data.slice(commaIdx + 1);
    }
  }

  const buffer = Buffer.from(cleanBase64, "base64");
  fs.writeFileSync(localFilePath, buffer);

  // 2. If Google Drive access token is available, upload directly to Google Drive v3 API
  if (accessToken && accessToken.trim()) {
    try {
      const boundary = "-------314159265358979323846";
      const delimiter = "\r\n--" + boundary + "\r\n";
      const closeDelim = "\r\n--" + boundary + "--";

      const metadata = {
        name: filename || `Receipt-${new Date().toISOString().split("T")[0]}${ext}`,
        mimeType: mimeType || "image/jpeg",
        parents: folderId && folderId !== "root" ? [folderId] : undefined,
      };

      const multipartRequestBody = Buffer.concat([
        Buffer.from(
          delimiter +
            "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
            JSON.stringify(metadata) +
            delimiter +
            `Content-Type: ${mimeType || "image/jpeg"}\r\n` +
            "Content-Transfer-Encoding: base64\r\n\r\n"
        ),
        Buffer.from(cleanBase64),
        Buffer.from(closeDelim),
      ]);

      const driveRes = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken.trim()}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body: multipartRequestBody,
        }
      );

      if (driveRes.ok) {
        const driveData = await driveRes.json();
        return {
          fileId: driveData.id,
          webLink:
            driveData.webViewLink ||
            `https://drive.google.com/file/d/${driveData.id}/view?usp=sharing`,
          syncStatus: "synced",
          localPath: `/api/receipts/archive/${safeName}`,
        };
      } else {
        console.warn("Google Drive upload API failed with status:", driveRes.status);
      }
    } catch (err) {
      console.error("Error uploading to Google Drive API:", err);
    }
  }

  // 3. Fallback: Local-first archive record with Drive ID format & link
  // Allows full offline garage operation while still preserving the exact Drive metadata structure
  const simulatedDriveId = `gdrive_${Date.now()}_${fileHash}`;
  return {
    fileId: simulatedDriveId,
    webLink: `https://drive.google.com/file/d/${simulatedDriveId}/view?usp=sharing`,
    syncStatus: accessToken ? "pending" : "local_only",
    localPath: `/api/receipts/archive/${safeName}`,
  };
}
