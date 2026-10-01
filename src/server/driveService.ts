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

/**
 * Ensures or creates a designated "Road Runner Moto Repair Shop" folder in Google Drive
 */
export async function getOrCreateWorkshopDriveFolder(accessToken: string, customFolderName = "Road Runner Moto Repair Shop Archive"): Promise<string> {
  try {
    // 1. Search if the folder already exists
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(customFolderName)}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
      }
    }

    // 2. Otherwise create the folder in root
    const createRes = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: customFolderName,
        mimeType: "application/vnd.google-apps.folder",
      }),
    });

    if (createRes.ok) {
      const folderData = await createRes.json();
      return folderData.id;
    }
  } catch (err) {
    console.warn("Could not query/create workshop Drive folder:", err);
  }
  return "root";
}

/**
 * Uploads a text/JSON file directly into Google Drive (e.g. database backup or sale receipt)
 */
export async function uploadJsonFileToDrive({
  filename,
  jsonData,
  folderId = "root",
  accessToken,
}: {
  filename: string;
  jsonData: any;
  folderId?: string;
  accessToken: string;
}): Promise<{ fileId: string; webLink: string } | null> {
  try {
    const boundary = "-------driveJsonBoundary" + Date.now();
    const delimiter = "\r\n--" + boundary + "\r\n";
    const closeDelim = "\r\n--" + boundary + "--";

    const contentStr = typeof jsonData === "string" ? jsonData : JSON.stringify(jsonData, null, 2);

    const metadata = {
      name: filename,
      mimeType: "application/json",
      parents: folderId && folderId !== "root" ? [folderId] : undefined,
    };

    const multipartRequestBody = Buffer.concat([
      Buffer.from(
        delimiter +
          "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
          JSON.stringify(metadata) +
          delimiter +
          "Content-Type: application/json; charset=UTF-8\r\n\r\n"
      ),
      Buffer.from(contentStr),
      Buffer.from(closeDelim),
    ]);

    const driveRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
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
      const data = await driveRes.json();
      return {
        fileId: data.id,
        webLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
      };
    }
  } catch (err) {
    console.error("Failed to upload JSON file to Google Drive:", err);
  }
  return null;
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
  const simulatedDriveId = `gdrive_${Date.now()}_${fileHash}`;
  return {
    fileId: simulatedDriveId,
    webLink: `https://drive.google.com/file/d/${simulatedDriveId}/view?usp=sharing`,
    syncStatus: accessToken ? "pending" : "local_only",
    localPath: `/api/receipts/archive/${safeName}`,
  };
}
