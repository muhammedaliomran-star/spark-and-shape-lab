import * as XLSX from "xlsx";

/**
 * Clean data export to XLSX with auto-column width and RTL orientation
 */
export function exportToExcel(
  sheets: Array<{
    sheetName: string;
    data: Array<Record<string, any>>;
  }>,
  fileName: string
) {
  const wb = XLSX.utils.book_new();

  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.data);
    // RTL view
    if (!ws["!views"]) ws["!views"] = [];
    ws["!views"].push({ RTL: true });

    // Calculate auto column widths
    if (s.data.length > 0) {
      const keys = Object.keys(s.data[0]);
      ws["!cols"] = keys.map((key) => {
        const maxLen = Math.max(
          key.length,
          ...s.data.map((row) => (row[key] != null ? String(row[key]).length : 0))
        );
        return { wch: Math.min(Math.max(maxLen + 4, 12), 45) };
      });
    }

    XLSX.utils.book_append_sheet(wb, ws, s.sheetName.slice(0, 31));
  }

  const cleanName = fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`;
  XLSX.writeFile(wb, cleanName);
}

/**
 * Parse an uploaded Excel/CSV file to JSON array
 */
export async function parseExcelFile(file: File): Promise<Array<Record<string, any>>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
          defval: "",
        });
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}
