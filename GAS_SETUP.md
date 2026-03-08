# Setup Google Apps Script (Backend)

Karena aplikasi ini menggunakan Google Sheets sebagai database tanpa API Key, Anda perlu membuat Google Apps Script sebagai jembatan (API) untuk menerima data dari aplikasi React ini.

## Langkah-langkah:

1. Buka Google Spreadsheet Anda.
2. Klik menu **Ekstensi > Apps Script**.
3. Hapus semua kode yang ada, lalu paste kode di bawah ini:

```javascript
const SPREADSHEET_ID = "1lx1RCPVopdDGOhAPbsVWLZ38MNNlQ45crDfX2cRGo0U";
const EMPLOYEE_SHEET = "Employees";
const ATTENDANCE_SHEET = "Attendance";
const FOLDER_ID = "1FLclKu3dim_6-v0aXpa9GirUNuRZfUSL";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const { id, name, shift, status, latitude, longitude, photoBase64, notes } = data;

    // 1. Save Photo to Drive
    let photoUrl = "";
    if (photoBase64) {
      const folder = DriveApp.getFolderById(FOLDER_ID);
      const contentType = photoBase64.substring(5, photoBase64.indexOf(';'));
      const bytes = Utilities.base64Decode(photoBase64.split(',')[1]);
      const blob = Utilities.newBlob(bytes, contentType, `Photo_${id}_${new Date().getTime()}`);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      photoUrl = file.getUrl();
    }

    // 2. Save to Sheet
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(ATTENDANCE_SHEET);
    
    // Format Timestamp (MM/DD/YYYY HH:mm:ss)
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MM/dd/yyyy HH:mm:ss");
    
    // Format: timestamp, id, name, shift, status, latitude, longitude, photo, Notes
    sheet.appendRow([timestamp, id, name, shift, status, latitude, longitude, photoUrl, notes]);

    return ContentService.createTextOutput(JSON.stringify({ success: true, message: "Attendance recorded successfully" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Handle CORS Preflight
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
}
```

4. Klik **Simpan** (ikon disket).
5. Klik **Terapkan (Deploy) > Deployment baru (New deployment)**.
6. Pilih jenis: **Aplikasi Web (Web App)**.
7. Deskripsi: "API Absensi".
8. Akses: **Siapa saja (Anyone)**.
9. Klik **Terapkan (Deploy)**.
10. Berikan izin akses (Authorize access) ke akun Google Anda jika diminta.
11. Copy **URL Web App** yang dihasilkan.
12. Masukkan URL tersebut ke dalam Environment Variables di Vercel dengan nama `VITE_GAS_URL`.

Jika Anda menjalankan secara lokal, tambahkan file `.env` di root folder dan isi dengan:
`VITE_GAS_URL="URL_WEB_APP_ANDA"`
