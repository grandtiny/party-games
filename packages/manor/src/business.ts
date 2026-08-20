import type {
  ManorBusinessArea,
  ManorBusinessKind,
  ManorBusinessRecordView
} from "@party-games/shared";

export interface ManorBusinessTransaction {
  kind: ManorBusinessKind;
  area: ManorBusinessArea;
  itemName: string;
  quantity: number;
  unitPrice: number;
}

export interface ManorBusinessRecordState extends ManorBusinessTransaction {
  id: number;
  totalCoins: number;
  createdAt: number;
}

export const MANOR_BUSINESS_RECORD_LIMIT = 50;

export function appendManorBusinessTransactions(
  records: ManorBusinessRecordState[],
  nextId: number,
  transactions: readonly ManorBusinessTransaction[],
  now: number
): { records: ManorBusinessRecordState[]; nextId: number } {
  const appended = transactions.map((transaction, index) => ({
    ...transaction,
    id: nextId + index,
    totalCoins: transaction.quantity * transaction.unitPrice,
    createdAt: now
  }));
  const nextRecords = [...appended.reverse(), ...records].slice(0, MANOR_BUSINESS_RECORD_LIMIT);
  return { records: nextRecords, nextId: nextId + transactions.length };
}

export function cloneManorBusinessRecords(
  records: readonly ManorBusinessRecordState[]
): ManorBusinessRecordState[] {
  return records.map((record) => ({ ...record }));
}

export function toManorBusinessRecordViews(
  records: readonly ManorBusinessRecordState[]
): ManorBusinessRecordView[] {
  return cloneManorBusinessRecords(records);
}

export function validateManorBusinessRecords(
  records: readonly ManorBusinessRecordState[],
  nextId: number
): void {
  if (!Number.isInteger(nextId) || nextId < 1 || records.length > MANOR_BUSINESS_RECORD_LIMIT) {
    throw new Error("经营流水状态无效");
  }
  const ids = new Set<number>();
  for (const record of records) {
    if (
      !Number.isInteger(record.id) ||
      record.id < 1 ||
      record.id >= nextId ||
      ids.has(record.id) ||
      (record.kind !== "purchase" && record.kind !== "sale") ||
      (record.area !== "farm" && record.area !== "pasture") ||
      typeof record.itemName !== "string" ||
      record.itemName.length < 1 ||
      !Number.isInteger(record.quantity) ||
      record.quantity < 1 ||
      !Number.isInteger(record.unitPrice) ||
      record.unitPrice < 0 ||
      record.totalCoins !== record.quantity * record.unitPrice ||
      !Number.isInteger(record.createdAt) ||
      record.createdAt < 0
    ) {
      throw new Error("经营流水记录无效");
    }
    ids.add(record.id);
  }
}
