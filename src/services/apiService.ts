import { db } from '../lib/firebase';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  setDoc
} from 'firebase/firestore';
import type { Member, Family, WaqfJadeedRecord, WaqfJadeedSpecialRecord, Payment } from '../types';

// Helper to determine Tanzeem
const calculateAge = (dob: string) => {
  if (!dob) return 0;
  const birthDate = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

export class ApiService {
  // --- Members ---

  static async getAllMembers(): Promise<Member[]> {
    const snapshot = await getDocs(collection(db, 'members'));
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Member));
  }

  static async createMember(member: any): Promise<Member> {
    const id = member.id || crypto.randomUUID();
    await setDoc(doc(db, 'members', id), { ...member, id });
    return { ...member, id } as Member;
  }

  static async updateMember(id: string, member: any): Promise<Member> {
    const ref = doc(db, 'members', id);
    await updateDoc(ref, member);
    const snap = await getDoc(ref);
    return { ...snap.data(), id: snap.id } as Member;
  }

  static async deleteMember(id: string): Promise<{ success: boolean }> {
    await deleteDoc(doc(db, 'members', id));
    return { success: true };
  }

  // --- Families ---

  static async getAllFamilies(): Promise<Family[]> {
    const snapshot = await getDocs(collection(db, 'families'));
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Family));
  }

  static async getFamily(id: string): Promise<Family | null> {
    const snap = await getDoc(doc(db, 'families', id));
    if (!snap.exists()) return null;
    return { ...snap.data(), id: snap.id } as Family;
  }

  static async createFamily(family: any): Promise<Family> {
    const id = family.id || crypto.randomUUID();
    await setDoc(doc(db, 'families', id), { ...family, id });
    return { ...family, id } as Family;
  }

  static async updateFamily(id: string, family: any): Promise<Family> {
    const ref = doc(db, 'families', id);
    await updateDoc(ref, family);
    const snap = await getDoc(ref);
    return { ...snap.data(), id: snap.id } as Family;
  }

  static async deleteFamily(id: string): Promise<{ success: boolean }> {
    await deleteDoc(doc(db, 'families', id));
    return { success: true };
  }

  // --- Stats (Client-Side implementation) ---

  static async getDashboardStats() {
    const [members, families] = await Promise.all([
      this.getAllMembers(),
      this.getAllFamilies()
    ]);

    const totalMembers = members.length;
    const maleMembers = members.filter((m: any) => m.gender === 'male').length;
    const femaleMembers = members.filter((m: any) => m.gender === 'female').length;

    const tanzeemStats = members.reduce((acc: any, m: any) => {
      if (m.tanzeem) acc[m.tanzeem] = (acc[m.tanzeem] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const halqaStats = members.reduce((acc: any, m: any) => {
      const h = m.halqa || '';
      if (!h) return acc;
      acc[h] = (acc[h] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Age Groups
    const ageGroups: Record<string, number> = {};
    members.forEach((m: any) => {
      let group = 'Above 60';
      const age = m.age || calculateAge(m.dateOfBirth);
      if (age < 7) group = 'Under 7';
      else if (age <= 15) group = '7-15';
      else if (age <= 25) group = '16-25';
      else if (age <= 40) group = '26-40';
      else if (age <= 60) group = '41-60';

      ageGroups[group] = (ageGroups[group] || 0) + 1;
    });

    const membersWithReligiousData = members.filter((m: any) =>
      m.religiousActivities && Object.keys(m.religiousActivities).length > 0
    ).length;

    // Recent members (30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentMembers = members.filter((m: any) => new Date(m.createdAt) >= thirtyDaysAgo).length;

    // Waqf-e-Jadeed Stats
    const wjSpecial = await this.getWaqfJadeedSpecialRecords();
    const waqfJadeedStats = {
      deceasedTotal: wjSpecial.filter((r: any) => r.isDeceased).length,
      deceasedMale: wjSpecial.filter((r: any) => r.isDeceased && r.gender === 'male').length,
      deceasedFemale: wjSpecial.filter((r: any) => r.isDeceased && r.gender === 'female').length,
      hazratMuhammadCount: wjSpecial.filter((r: any) => r.name === 'Hazrat Muhammad (pbuh)').length,
      hazratMessiahCount: wjSpecial.filter((r: any) => r.name === 'Hazrat Messiah Maoud (as)').length,
      totalSpecialPromise: wjSpecial.reduce((sum: number, r: any) => sum + (r.promiseAmount || 0) + (r.nagarparAmount || 0), 0),
      totalSpecialPaid: wjSpecial.reduce((sum: number, r: any) => sum + (r.paidAmount || 0), 0)
    };

    return {
      totalMembers,
      maleMembers,
      femaleMembers,
      totalFamilies: families.length,
      tanzeemStats,
      halqaStats,
      ageGroups,
      membersWithReligiousData,
      recentMembers,
      waqfJadeedStats
    };
  }

  // --- Waqf-e-Jadeed ---

  static async getWaqfJadeedRecords(year?: number, memberId?: string): Promise<WaqfJadeedRecord[]> {
    let q = query(collection(db, 'waqfJadeed'));
    if (year) q = query(q, where('year', '==', year));
    if (memberId) q = query(q, where('memberId', '==', memberId));

    const snapshot = await getDocs(q);
    const records = await Promise.all(snapshot.docs.map(async (d) => {
      const data = d.data();
      // Fetch payments
      const pQuery = query(collection(db, 'waqfJadeedPayments'), where('waqfJadeedId', '==', d.id));
      const pSnap = await getDocs(pQuery);
      const payments = pSnap.docs.map(pd => ({ ...pd.data(), id: pd.id } as Payment));
      return { ...data, id: d.id, payments } as WaqfJadeedRecord;
    }));
    return records;
  }

  static async saveWaqfJadeedRecord(data: any): Promise<WaqfJadeedRecord | null> {
    let records: any[] = [];
    if (data.id) {
      // Update existing via ID if known
    } else {
      const q = query(
        collection(db, 'waqfJadeed'),
        where('memberId', '==', data.memberId),
        where('year', '==', data.year)
      );
      const snap = await getDocs(q);
      records = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    }

    let id = data.id || (records.length > 0 ? records[0].id : crypto.randomUUID());

    const payload = { ...data, id, updatedAt: new Date().toISOString() };
    await setDoc(doc(db, 'waqfJadeed', id), payload, { merge: true });

    return this.getWaqfJadeedRecordById(id);
  }

  static async getWaqfJadeedRecordById(id: string): Promise<WaqfJadeedRecord | null> {
    const snap = await getDoc(doc(db, 'waqfJadeed', id));
    if (!snap.exists()) return null;

    const pQuery = query(collection(db, 'waqfJadeedPayments'), where('waqfJadeedId', '==', id));
    const pSnap = await getDocs(pQuery);
    const payments = pSnap.docs.map(pd => ({ ...pd.data(), id: pd.id } as Payment));

    return { ...snap.data(), id: snap.id, payments } as WaqfJadeedRecord;
  }

  static async addWaqfJadeedPayment(data: { memberId: string; year: number; amount: number; date: string; notes?: string }): Promise<WaqfJadeedRecord | null> {
    const record = await this.saveWaqfJadeedRecord({ memberId: data.memberId, year: data.year });

    if (!record) throw new Error('Failed to create/fetch record');

    const paymentId = crypto.randomUUID();
    await setDoc(doc(db, 'waqfJadeedPayments', paymentId), {
      id: paymentId,
      waqfJadeedId: record.id,
      amount: data.amount,
      date: data.date,
      notes: data.notes || ''
    });

    await this.recalculatePaidAmount(record.id);

    return this.getWaqfJadeedRecordById(record.id);
  }

  static async deleteWaqfJadeedPayment(id: string) {
    const snap = await getDoc(doc(db, 'waqfJadeedPayments', id));
    if (!snap.exists()) return { error: 'Not found' };

    const waqfJadeedId = snap.data().waqfJadeedId;
    await deleteDoc(doc(db, 'waqfJadeedPayments', id));

    const newTotal = await this.recalculatePaidAmount(waqfJadeedId);

    return { success: true, waqfJadeedId, newTotal };
  }

  static async recalculatePaidAmount(waqfJadeedId: string) {
    const q = query(collection(db, 'waqfJadeedPayments'), where('waqfJadeedId', '==', waqfJadeedId));
    const snap = await getDocs(q);
    const total = snap.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0);

    await updateDoc(doc(db, 'waqfJadeed', waqfJadeedId), {
      paidAmount: total,
      updatedAt: new Date().toISOString()
    });
    return total;
  }

  // --- Special Members ---

  static async getWaqfJadeedSpecialRecords(year?: number, familyId?: string): Promise<WaqfJadeedSpecialRecord[]> {
    let q = query(collection(db, 'waqfJadeedSpecial'));
    if (year) q = query(q, where('year', '==', year));
    if (familyId) q = query(q, where('familyId', '==', familyId));

    const snapshot = await getDocs(q);
    const records = await Promise.all(snapshot.docs.map(async (d) => {
      const data = d.data();
      const pQuery = query(collection(db, 'waqfJadeedPayments'), where('waqfJadeedId', '==', d.id));
      const pSnap = await getDocs(pQuery);
      const payments = pSnap.docs.map(pd => ({ ...pd.data(), id: pd.id } as Payment));
      return { ...data, id: d.id, payments } as WaqfJadeedSpecialRecord;
    }));
    return records;
  }

  static async saveWaqfJadeedSpecialRecord(data: any): Promise<WaqfJadeedSpecialRecord> {
    const id = data.id || crypto.randomUUID();
    await setDoc(doc(db, 'waqfJadeedSpecial', id), {
      ...data,
      id,
      updatedAt: new Date().toISOString()
    });
    const snap = await getDoc(doc(db, 'waqfJadeedSpecial', id));
    return { ...snap.data(), id: snap.id } as WaqfJadeedSpecialRecord;
  }

  static async deleteWaqfJadeedSpecialRecord(id: string): Promise<{ success: boolean }> {
    await deleteDoc(doc(db, 'waqfJadeedSpecial', id));
    return { success: true };
  }

  static async getWaqfJadeedSpecialRecordById(id: string): Promise<WaqfJadeedSpecialRecord | null> {
    const snap = await getDoc(doc(db, 'waqfJadeedSpecial', id));
    if (!snap.exists()) return null;

    const pQuery = query(collection(db, 'waqfJadeedPayments'), where('waqfJadeedId', '==', id));
    const pSnap = await getDocs(pQuery);
    const payments = pSnap.docs.map(pd => ({ ...pd.data(), id: pd.id } as Payment));

    return { ...snap.data(), id: snap.id, payments } as WaqfJadeedSpecialRecord;
  }

  static async addWaqfJadeedSpecialPayment(data: { specialId: string; amount: number; date: string; notes?: string }): Promise<WaqfJadeedSpecialRecord | null> {
    const paymentId = crypto.randomUUID();
    await setDoc(doc(db, 'waqfJadeedPayments', paymentId), {
      id: paymentId,
      waqfJadeedId: data.specialId,
      amount: data.amount,
      date: data.date,
      notes: data.notes || ''
    });

    await this.recalculateSpecialPaidAmount(data.specialId);
    return this.getWaqfJadeedSpecialRecordById(data.specialId);
  }

  static async recalculateSpecialPaidAmount(specialId: string) {
    const q = query(collection(db, 'waqfJadeedPayments'), where('waqfJadeedId', '==', specialId));
    const snap = await getDocs(q);
    const total = snap.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0);

    await updateDoc(doc(db, 'waqfJadeedSpecial', specialId), {
      paidAmount: total,
      updatedAt: new Date().toISOString()
    });
    return total;
  }

  static async deleteWaqfJadeedSpecialPayment(id: string) {
    // This is virtually same as normal payment delete but calls different recalculate
    const snap = await getDoc(doc(db, 'waqfJadeedPayments', id));
    if (!snap.exists()) return { error: 'Not found' };

    const waqfJadeedId = snap.data().waqfJadeedId;
    await deleteDoc(doc(db, 'waqfJadeedPayments', id));

    // Try to recalculate both ways or check which table reference exists?
    // Optimization: Just try special table. If it fails, it might be normal table.
    // Better approach: Generic payments don't distinguish parent type in DB.
    // But here we need to update the parent sum.
    // We can try updating Special table first.
    try {
      await this.recalculateSpecialPaidAmount(waqfJadeedId);
    } catch (e) {
      // If it fails (e.g. doc not found), it might be a normal record
      // checking normal record update
      await this.recalculatePaidAmount(waqfJadeedId);
    }

    return { success: true, waqfJadeedId };
  }
}