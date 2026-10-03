import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

export interface TrackerRow {
  appliedOn: string;
  company: string;
  role: string;
  location: string;
  stipend: number;
  source: string;
  jobUrl: string;
  applicationId: string;
  status: string;
  notes: string;
  runId: string;
}

const SHEET = "Applications";
const columns: { header: string; key: keyof TrackerRow; width: number }[] = [
  { header: "Applied on", key: "appliedOn", width: 12 },
  { header: "Company", key: "company", width: 18 },
  { header: "Role", key: "role", width: 34 },
  { header: "Location", key: "location", width: 12 },
  { header: "Stipend (₹/month)", key: "stipend", width: 16 },
  { header: "Source", key: "source", width: 12 },
  { header: "Job URL", key: "jobUrl", width: 36 },
  { header: "Application ID", key: "applicationId", width: 15 },
  { header: "Status", key: "status", width: 12 },
  { header: "Notes", key: "notes", width: 40 },
  { header: "Run", key: "runId", width: 22 },
];

export async function readTracker(file: string): Promise<TrackerRow[]> {
  if (!fs.existsSync(file)) return [];
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(file);
  const sheet = book.getWorksheet(SHEET);
  if (!sheet) return [];

  const rows: TrackerRow[] = [];
  sheet.eachRow((row, index) => {
    if (index === 1) return;
    const cell = (i: number) => {
      const value = row.getCell(i + 1).value;
      if (value && typeof value === "object" && "text" in value) return String(value.text);
      return value == null ? "" : String(value);
    };
    const record = Object.fromEntries(columns.map((c, i) => [c.key, cell(i)])) as unknown as TrackerRow;
    record.stipend = Number(record.stipend) || 0;
    if (record.applicationId || record.jobUrl) rows.push(record);
  });
  return rows;
}

export async function writeTracker(file: string, rows: TrackerRow[]) {
  const book = new ExcelJS.Workbook();
  book.creator = "HulChul career operator";
  const sheet = book.addWorksheet(SHEET, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = columns;
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEFF2" } };
  for (const row of rows) sheet.addRow(row);
  sheet.getColumn("stipend").numFmt = "#,##0";

  fs.mkdirSync(path.dirname(file), { recursive: true });

  const tmp = file + ".tmp.xlsx";
  await book.xlsx.writeFile(tmp);
  fs.renameSync(tmp, file);
}

export async function upsertTrackerRow(file: string, row: TrackerRow) {
  const rows = await readTracker(file);
  const index = rows.findIndex(
    (r) => (row.applicationId && r.applicationId === row.applicationId) || (row.jobUrl && r.jobUrl === row.jobUrl),
  );
  if (index >= 0) rows[index] = { ...rows[index], ...row };
  else rows.push(row);
  await writeTracker(file, rows);
  return index >= 0 ? "updated" : "added";
}
