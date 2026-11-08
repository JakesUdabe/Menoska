import { readMigratedStorage, writeStorage } from "./storage-keys";

const KEY = "menoska_worksheets";
const OLD_KEY = "abi_worksheets";

export type WorksheetMap = Record<string, unknown>;

function readAll(): WorksheetMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = readMigratedStorage(KEY, OLD_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as WorksheetMap) : {};
  } catch {
    return {};
  }
}

function writeAll(map: WorksheetMap) {
  writeStorage(KEY, JSON.stringify(map));
}

export function loadWorksheet<T>(toolId: string): T | null {
  const all = readAll();
  const value = all[toolId];
  return value === undefined ? null : (value as T);
}

export function persistWorksheet(toolId: string, data: unknown) {
  if (typeof window === "undefined") return;
  const all = readAll();
  all[toolId] = data;
  writeAll(all);
}

export function clearWorksheet(toolId: string) {
  if (typeof window === "undefined") return;
  const all = readAll();
  delete all[toolId];
  writeAll(all);
}
