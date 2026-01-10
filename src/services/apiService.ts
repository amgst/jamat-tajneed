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
import type { Member, Family, WaqfJadeedRecord, WaqfJadeedSpecialRecord, TahreqJadeedRecord, TahreqJadeedSpecialRecord, Payment } from '../types';

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

  static async addWaqfJadeedPayment(data: { memberId: string; year: number; amount: number; date: string; notes?: string; bookId?: string; bookNo?: string; receiptNo?: number }): Promise<WaqfJadeedRecord | null> {
    const record = await this.saveWaqfJadeedRecord({ memberId: data.memberId, year: data.year });

    if (!record) throw new Error('Failed to create/fetch record');

    const paymentId = crypto.randomUUID();
    await setDoc(doc(db, 'waqfJadeedPayments', paymentId), {
      id: paymentId,
      waqfJadeedId: record.id,
      amount: data.amount,
      date: data.date,
      notes: data.notes || '',
      bookId: data.bookId || null,
      bookNo: data.bookNo || null,
      receiptNo: data.receiptNo || null
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

  static async addWaqfJadeedSpecialPayment(data: { specialId: string; amount: number; date: string; notes?: string; bookId?: string; bookNo?: string; receiptNo?: number }): Promise<WaqfJadeedSpecialRecord | null> {
    const paymentId = crypto.randomUUID();
    await setDoc(doc(db, 'waqfJadeedPayments', paymentId), {
      id: paymentId,
      waqfJadeedId: data.specialId,
      amount: data.amount,
      date: data.date,
      notes: data.notes || '',
      bookId: data.bookId || null,
      bookNo: data.bookNo || null,
      receiptNo: data.receiptNo || null
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

  // --- Tahreq Jadeed ---

  static async getTahreqJadeedRecords(year?: number, memberId?: string): Promise<TahreqJadeedRecord[]> {
    let q = query(collection(db, 'tahreqJadeed'));
    if (year) q = query(q, where('year', '==', year));
    if (memberId) q = query(q, where('memberId', '==', memberId));

    const snapshot = await getDocs(q);
    const records = await Promise.all(snapshot.docs.map(async (d) => {
      const data = d.data();
      // Fetch payments
      const pQuery = query(collection(db, 'waqfJadeedPayments'), where('waqfJadeedId', '==', d.id));
      const pSnap = await getDocs(pQuery);
      const payments = pSnap.docs.map(pd => ({ ...pd.data(), id: pd.id } as Payment));
      return { ...data, id: d.id, payments } as TahreqJadeedRecord;
    }));
    return records;
  }

  static async saveTahreqJadeedRecord(data: any): Promise<TahreqJadeedRecord | null> {
    let records: any[] = [];
    if (data.id) {
      // Update existing via ID if known
    } else {
      const q = query(
        collection(db, 'tahreqJadeed'),
        where('memberId', '==', data.memberId),
        where('year', '==', data.year)
      );
      const snap = await getDocs(q);
      records = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    }

    let id = data.id || (records.length > 0 ? records[0].id : crypto.randomUUID());

    const payload = { ...data, id, updatedAt: new Date().toISOString() };
    await setDoc(doc(db, 'tahreqJadeed', id), payload, { merge: true });

    return this.getTahreqJadeedRecordById(id);
  }

  static async getTahreqJadeedRecordById(id: string): Promise<TahreqJadeedRecord | null> {
    const snap = await getDoc(doc(db, 'tahreqJadeed', id));
    if (!snap.exists()) return null;

    const pQuery = query(collection(db, 'waqfJadeedPayments'), where('waqfJadeedId', '==', id));
    const pSnap = await getDocs(pQuery);
    const payments = pSnap.docs.map(pd => ({ ...pd.data(), id: pd.id } as Payment));

    return { ...snap.data(), id: snap.id, payments } as TahreqJadeedRecord;
  }

  static async addTahreqJadeedPayment(data: { memberId: string; year: number; amount: number; date: string; notes?: string }): Promise<TahreqJadeedRecord | null> {
    const record = await this.saveTahreqJadeedRecord({ memberId: data.memberId, year: data.year });

    if (!record) throw new Error('Failed to create/fetch record');

    const paymentId = crypto.randomUUID();
    await setDoc(doc(db, 'waqfJadeedPayments', paymentId), {
      id: paymentId,
      waqfJadeedId: record.id,
      amount: data.amount,
      date: data.date,
      notes: data.notes || ''
    });

    await this.recalculateTahreqPaidAmount(record.id);

    return this.getTahreqJadeedRecordById(record.id);
  }

  static async deleteTahreqJadeedPayment(id: string) {
    const snap = await getDoc(doc(db, 'waqfJadeedPayments', id));
    if (!snap.exists()) return { error: 'Not found' };

    const tahreqJadeedId = snap.data().waqfJadeedId;
    await deleteDoc(doc(db, 'waqfJadeedPayments', id));

    const newTotal = await this.recalculateTahreqPaidAmount(tahreqJadeedId);

    return { success: true, tahreqJadeedId, newTotal };
  }

  static async recalculateTahreqPaidAmount(tahreqJadeedId: string) {
    const q = query(collection(db, 'waqfJadeedPayments'), where('waqfJadeedId', '==', tahreqJadeedId));
    const snap = await getDocs(q);
    const total = snap.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0);

    await updateDoc(doc(db, 'tahreqJadeed', tahreqJadeedId), {
      paidAmount: total,
      updatedAt: new Date().toISOString()
    });
    return total;
  }

  // --- Tahreq Special Members ---

  static async getTahreqJadeedSpecialRecords(year?: number, familyId?: string): Promise<TahreqJadeedSpecialRecord[]> {
    let q = query(collection(db, 'tahreqJadeedSpecial'));
    if (year) q = query(q, where('year', '==', year));
    if (familyId) q = query(q, where('familyId', '==', familyId));

    const snapshot = await getDocs(q);
    const records = await Promise.all(snapshot.docs.map(async (d) => {
      const data = d.data();
      const pQuery = query(collection(db, 'waqfJadeedPayments'), where('waqfJadeedId', '==', d.id));
      const pSnap = await getDocs(pQuery);
      const payments = pSnap.docs.map(pd => ({ ...pd.data(), id: pd.id } as Payment));
      return { ...data, id: d.id, payments } as TahreqJadeedSpecialRecord;
    }));
    return records;
  }

  static async saveTahreqJadeedSpecialRecord(data: any): Promise<TahreqJadeedSpecialRecord> {
    const id = data.id || crypto.randomUUID();
    await setDoc(doc(db, 'tahreqJadeedSpecial', id), {
      ...data,
      id,
      updatedAt: new Date().toISOString()
    });
    const snap = await getDoc(doc(db, 'tahreqJadeedSpecial', id));
    return { ...snap.data(), id: snap.id } as TahreqJadeedSpecialRecord;
  }

  static async deleteTahreqJadeedSpecialRecord(id: string): Promise<{ success: boolean }> {
    await deleteDoc(doc(db, 'tahreqJadeedSpecial', id));
    return { success: true };
  }

  static async getTahreqJadeedSpecialRecordById(id: string): Promise<TahreqJadeedSpecialRecord | null> {
    const snap = await getDoc(doc(db, 'tahreqJadeedSpecial', id));
    if (!snap.exists()) return null;

    const pQuery = query(collection(db, 'waqfJadeedPayments'), where('waqfJadeedId', '==', id));
    const pSnap = await getDocs(pQuery);
    const payments = pSnap.docs.map(pd => ({ ...pd.data(), id: pd.id } as Payment));

    return { ...snap.data(), id: snap.id, payments } as TahreqJadeedSpecialRecord;
  }

  static async addTahreqJadeedSpecialPayment(data: { specialId: string; amount: number; date: string; notes?: string }): Promise<TahreqJadeedSpecialRecord | null> {
    const paymentId = crypto.randomUUID();
    await setDoc(doc(db, 'waqfJadeedPayments', paymentId), {
      id: paymentId,
      waqfJadeedId: data.specialId,
      amount: data.amount,
      date: data.date,
      notes: data.notes || ''
    });

    await this.recalculateTahreqSpecialPaidAmount(data.specialId);
    return this.getTahreqJadeedSpecialRecordById(data.specialId);
  }

  static async recalculateTahreqSpecialPaidAmount(specialId: string) {
    const q = query(collection(db, 'waqfJadeedPayments'), where('waqfJadeedId', '==', specialId));
    const snap = await getDocs(q);
    const total = snap.docs.reduce((sum, d) => sum + (d.data().amount || 0), 0);

    await updateDoc(doc(db, 'tahreqJadeedSpecial', specialId), {
      paidAmount: total,
      updatedAt: new Date().toISOString()
    });
    return total;
  }

  static async deleteTahreqJadeedSpecialPayment(id: string) {
    // This is virtually same as normal payment delete but calls different recalculate
    const snap = await getDoc(doc(db, 'waqfJadeedPayments', id));
    if (!snap.exists()) return { error: 'Not found' };

    const tahreqJadeedId = snap.data().waqfJadeedId;
    await deleteDoc(doc(db, 'waqfJadeedPayments', id));

    // Try to recalculate both ways or check which table reference exists?
    // Optimization: Just try special table. If it fails, it might be normal table.
    // Better approach: Generic payments don't distinguish parent type in DB.
    // But here we need to update the parent sum.
    // We can try updating Special table first.
    try {
      await this.recalculateTahreqSpecialPaidAmount(tahreqJadeedId);
    } catch (e) {
      // If it fails (e.g. doc not found), it might be a normal record
      // checking normal record update
      await this.recalculateTahreqPaidAmount(tahreqJadeedId);
    }

    return { success: true, tahreqJadeedId };
  }

  // --- Payment Plans ---

  static async createPaymentPlan(data: any): Promise<any> {
    const id = crypto.randomUUID();
    const plan = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'paymentPlans', id), plan);
    return plan;
  }

  static async getPaymentPlans(memberId?: string): Promise<any[]> {
    let q = query(collection(db, 'paymentPlans'));
    if (memberId) {
      q = query(q, where('memberId', '==', memberId));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  }

  static async updatePaymentPlan(id: string, data: any): Promise<any> {
    const updatedData = {
      ...data,
      updatedAt: new Date().toISOString()
    };
    await updateDoc(doc(db, 'paymentPlans', id), updatedData);
    const snap = await getDoc(doc(db, 'paymentPlans', id));
    return { ...snap.data(), id: snap.id };
  }

  static async deletePaymentPlan(id: string): Promise<void> {
    await deleteDoc(doc(db, 'paymentPlans', id));
  }

  // --- Payment Reminders ---

  static async createPaymentReminder(data: any): Promise<any> {
    const id = crypto.randomUUID();
    const reminder = {
      ...data,
      id,
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'paymentReminders', id), reminder);
    return reminder;
  }

  static async getPaymentReminders(filters?: { memberId?: string, status?: string, type?: string }): Promise<any[]> {
    let q: any = query(collection(db, 'paymentReminders'));

    if (filters?.memberId) {
      q = query(q, where('memberId', '==', filters.memberId));
    }

    if (filters?.status) {
      q = query(q, where('status', '==', filters.status));
    }

    if (filters?.type) {
      q = query(q, where('type', '==', filters.type));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...(doc.data() as any), id: doc.id }));
  }

  static async updatePaymentReminder(id: string, data: any): Promise<any> {
    await updateDoc(doc(db, 'paymentReminders', id), data);
    const snap = await getDoc(doc(db, 'paymentReminders', id));
    return { ...snap.data(), id: snap.id };
  }

  static async deletePaymentReminder(id: string): Promise<void> {
    await deleteDoc(doc(db, 'paymentReminders', id));
  }

  // --- Financial Reports ---

  static async createFinancialReport(data: any): Promise<any> {
    const id = crypto.randomUUID();
    const report = {
      ...data,
      id,
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'financialReports', id), report);
    return report;
  }

  static async getFinancialReports(filters?: { year?: number, reportType?: string }): Promise<any[]> {
    let q: any = query(collection(db, 'financialReports'));

    if (filters?.year) {
      q = query(q, where('year', '==', filters.year));
    }

    if (filters?.reportType) {
      q = query(q, where('reportType', '==', filters.reportType));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...(doc.data() as any), id: doc.id }));
  }

  static async getFinancialReportById(id: string): Promise<any | null> {
    const snap = await getDoc(doc(db, 'financialReports', id));
    if (!snap.exists()) return null;
    return { ...snap.data(), id: snap.id };
  }

  // --- Global Settings / Targets ---

  static async getTargetAmount(year: number): Promise<number> {
    const docId = `waqf_target_${year}`;
    const snap = await getDoc(doc(db, 'settings', docId));
    if (!snap.exists()) return 0;
    return snap.data().amount || 0;
  }

  static async saveTargetAmount(year: number, amount: number): Promise<void> {
    const docId = `waqf_target_${year}`;
    await setDoc(doc(db, 'settings', docId), {
      amount,
      year,
      updatedAt: new Date().toISOString()
    });
  }

  // --- Multi-year Comparison Data ---

  static async getMultiYearComparisonData(years: number[]): Promise<any> {
    const comparisonData: any = {};

    for (const year of years) {
      // Get Waqf-e-Jadeed data
      const waqfRecords = await this.getWaqfJadeedRecords(year);
      const tahreqRecords = await this.getTahreqJadeedRecords(year);

      const waqfPromised = waqfRecords.reduce((sum, record) => sum + (record.promiseAmount || 0), 0);
      const waqfReceived = waqfRecords.reduce((sum, record) => sum + (record.paidAmount || 0), 0);

      const tahreqPromised = tahreqRecords.reduce((sum, record) => sum + (record.promiseAmount || 0), 0);
      const tahreqReceived = tahreqRecords.reduce((sum, record) => sum + (record.paidAmount || 0), 0);

      comparisonData[year] = {
        waqf: {
          promised: waqfPromised,
          received: waqfReceived,
          members: waqfRecords.length
        },
        tahreq: {
          promised: tahreqPromised,
          received: tahreqReceived,
          members: tahreqRecords.length
        },
        total: {
          promised: waqfPromised + tahreqPromised,
          received: waqfReceived + tahreqReceived,
          members: [...new Set([...waqfRecords.map(r => r.memberId), ...tahreqRecords.map(r => r.memberId)])].length
        }
      };
    }

    return comparisonData;
  }

  // --- Receipt Books ---

  static async createReceiptBook(bookNo: string): Promise<any> {
    // Check if exists
    const q = query(collection(db, 'receiptBooks'), where('bookNo', '==', bookNo));
    const snap = await getDocs(q);
    if (!snap.empty) {
      throw new Error('Book number already exists');
    }

    const id = crypto.randomUUID();
    const book = {
      id,
      bookNo,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'receiptBooks', id), book);
    return book;
  }

  static async getReceiptBooks(): Promise<any[]> {
    const q = query(collection(db, 'receiptBooks'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
  }
}