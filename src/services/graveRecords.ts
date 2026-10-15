import { collection, doc, getDocs, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface GraveRecord {
  id: string;
  deceasedFullName: string;
  parentNames: string;
  husbandName: string;
  relativeContact: string;
  dateOfBirth: string;
  dateOfDeath: string;
  ageAtDeath: number | null;
  gender: string;
  graveNumber: string;
  notes: string;
  createdAt: string;
}

const textFields = ['deceasedFullName', 'parentNames', 'husbandName', 'relativeContact', 'dateOfBirth', 'dateOfDeath', 'gender', 'graveNumber', 'notes', 'createdAt'] as const;

// Copy only the record fields: image data and unknown properties never reach Firestore.
export function parseGraveExport(input: unknown): GraveRecord[] {
  const rows = Array.isArray(input) ? input : input && typeof input === 'object'
    ? ((input as Record<string, unknown>).records ?? (input as Record<string, unknown>).graves) : undefined;
  if (!Array.isArray(rows) || !rows.length) throw new Error('Provide a non-empty JSON array, or an object containing a records or graves array.');
  const ids = new Set<string>();
  return rows.map((row: unknown, index) => {
    const label = `Record ${index + 1}`;
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`${label}: expected an object.`);
    const value = row as Record<string, unknown>;
    if (typeof value.id !== 'string' || !value.id.trim() || value.id.includes('/') || value.id.length > 500) throw new Error(`${label}: a valid original record id is required.`);
    if (ids.has(value.id)) throw new Error(`${label}: duplicate record id in this file.`);
    ids.add(value.id);
    const record = { id: value.id } as GraveRecord;
    for (const key of textFields) {
      if (value[key] !== undefined && value[key] !== null && typeof value[key] !== 'string') throw new Error(`${label}: ${key} must be text.`);
      record[key] = (value[key] as string | undefined) ?? '';
    }
    if (!record.deceasedFullName.trim()) throw new Error(`${label}: deceasedFullName is required.`);
    const age = value.ageAtDeath;
    if (age !== undefined && age !== null && (typeof age !== 'number' || !Number.isFinite(age) || age < 0)) throw new Error(`${label}: ageAtDeath must be a non-negative number.`);
    record.ageAtDeath = typeof age === 'number' ? age : null;
    return record;
  });
}

export async function getGraveRecords(): Promise<GraveRecord[]> {
  const snapshot = await getDocs(collection(db, 'graves'));
  return snapshot.docs.map(item => ({ ...item.data(), id: item.id }) as GraveRecord);
}

export async function updateGraveRecord(record: GraveRecord): Promise<GraveRecord> {
  const validated = parseGraveExport([record])[0];
  const { id, ...data } = validated;
  await updateDoc(doc(db, 'graves', id), data);
  return validated;
}

export async function importGraveRecords(records: GraveRecord[]) {
  // Stable source IDs allow retries after a partially completed import.
  const existing = new Set((await getGraveRecords()).map(record => record.id));
  const pending = records.filter(record => !existing.has(record.id));
  let imported = 0;
  try {
    for (let offset = 0; offset < pending.length; offset += 400) {
      const batch = writeBatch(db);
      const chunk = pending.slice(offset, offset + 400);
      for (const record of chunk) {
        batch.set(doc(db, 'graves', record.id), record);
      }
      await batch.commit();
      imported += chunk.length;
    }
  } catch {
    throw new Error(`Import stopped after ${imported} records were saved. Check your connection and database permissions, then retry; existing IDs will be skipped.`);
  }
  return { imported, skipped: records.length - pending.length };
}
