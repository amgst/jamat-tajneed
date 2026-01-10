export interface ReligiousActivities {
  // Prayer Information
  fiveDailyPrayers: number; // پنجگانہ نماز کا قیام / کتنی نمازیں پڑھتے ہیں
  congregationalPrayers: number; // تعداد با جماعت نمازیں
  weeklyTahajjud: boolean; // ہفتہ وار نماز تہجد
  dailyRecitation: boolean; // روزانہ تلاوت
  fridayPrayer: boolean; // نماز جمعه
  twoNaflDaily: boolean; // دو نوافل روزانہ

  // Religious Practices
  weeklyVoluntaryFast: boolean; // ہفتہ وار نفلی روزه
  prayerMovement: boolean; // دعائیہ تحریک
  dailyThreePrayers: boolean; // روزانہ 3 دعائیں پڑھتے ہیں
  sermonListening: boolean; // خطبہ حضور انور
  listenedThisWeek: boolean; // کیا this week سنتے
  quranRecitation: boolean; // قرآن ناظرہ آتا ہے
  prayerWithTranslation: boolean; // نماز با ترجمہ آتی ہے
  prayerLetterWriting: boolean; // دعائیہ خط لکھتے ہیں
  willWritten: boolean; // وصیت

  // Media & Technology
  mtaDish: boolean; // MTA بذریعہ ڈش
  mtaCable: boolean; // MTA بذریعہ کیبل
  mtaInternet: boolean; // MTA بذریعہ انٹرنیٹ
  internetAccess: boolean; // انٹرنیٹ

  // Additional Info
  notes?: string; // نوٹس
  lastUpdated: string;
}

export interface Member {
  id: string;
  name: string;
  fatherName?: string;
  husbandName?: string;
  gender: 'male' | 'female';
  cnic?: string;
  dateOfBirth: string;
  age: number;
  phone?: string;
  address: string;
  profilePhoto?: string;
  tanzeem: Tanzeem;
  familyId?: string;
  halqa?: string;
  hasNewTanzeemTransition?: boolean;
  talem?: string;
  isDeceased?: boolean;
  dateOfDeath?: string;
  graveNumber?: string;

  // Religious Activities (per member)
  religiousActivities?: ReligiousActivities;

  // Legacy fields (keeping for backward compatibility)
  "پنجگانہ نماز کا قیام / کتنی نمازیں پڑھتے ہیں"?: string;
  "تعداد با جماعت نمازیں"?: string;
  "ہفتہ وار نماز تہجد"?: string;
  "روزانہ تلاوت"?: string;
  "نماز جمعه"?: string;
  "دو نوافل روزانہ"?: string;
  "ہفتہ وار نفلی روزه"?: string;
  "دعائیہ تحریک"?: string;
  "روزانہ 3 دعائیں پڑھتے ہیں"?: string;
  "خطبہ حضور انور"?: string;
  "کیا this week سنتے"?: string;
  "قرآن ناظرہ آتا ہے"?: string;
  "نماز با ترجمہ آتی ہے"?: string;
  "دعائیہ خط لکھتے ہیں"?: string;
  "وصیت"?: string;

  createdAt: string;
  updatedAt: string;
}

export interface Family {
  id: string;
  headId: string; // Member ID of family head (Father/Guardian)
  familyName: string;
  familyNumber?: number; // Manual family number assignment
  memberIds: string[];
  totalMembers: number;
  halqa?: string;
  familyHistory?: string; // Family history and background notes
  createdAt: string;
  updatedAt: string;
}

export type Tanzeem =
  | 'saf-e-awal'         // Boys under 7
  | 'saf-e-awal-girls'   // Girls under 7
  | 'atfal'              // Boys 7-15
  | 'nasirat'            // Girls 7-15
  | 'khuddam'            // Boys 15-40
  | 'lajna'              // Girls 15+
  | 'ansar';             // Boys 40+

export interface TanzeemTransition {
  memberId: string;
  fromTanzeem: Tanzeem;
  toTanzeem: Tanzeem;
  transitionDate: string;
  isNew?: boolean; // Flag for new transitions
}

export interface SpecialCircumstance {
  memberId: string;
  type: 'disability' | 'health' | 'other';
  description: string;
  affectsTanzeem?: boolean;
  createdAt: string;
}

export interface DashboardStats {
  totalMembers: number;
  maleMembers: number;
  femaleMembers: number;
  totalFamilies: number;
  membersWithReligiousData: number;
  recentMembers: number;
  tanzeemStats: {
    [key in Tanzeem]: number;
  };
  ageGroups: {
    [key: string]: number;
  };
  halqaStats?: {
    [halqa: string]: number;
  };
  waqfJadeedStats?: {
    deceasedTotal: number;
    deceasedMale: number;
    deceasedFemale: number;
    hazratMuhammadCount: number;
    hazratMessiahCount: number;
    totalSpecialPromise: number;
    totalSpecialPaid: number;
  };
}

export interface AuthUser {
  uid: string;
  email: string;
  displayName?: string;
}

export interface ImportResult {
  success: number;
  errors: string[];
  total: number;
}

export interface SearchFilters {
  name?: string;
  phone?: string;
  gender?: 'male' | 'female';
  tanzeem?: Tanzeem;
  halqa?: string;
  ageMin?: number;
  ageMax?: number;
  familyId?: string;
}


export interface ReceiptBook {
  id: string;
  bookNo: string;
  status: 'active' | 'completed';
  createdAt: string;
}

export interface Payment {
  id: string;
  waqfJadeedId: string;
  amount: number;
  date: string;
  notes?: string;
  bookId?: string;
  bookNo?: string;
  receiptNo?: number;
}

export interface PaymentPlan {
  id: string;
  memberId: string;
  year: number;
  totalAmount: number;
  startDate: string;
  endDate: string;
  frequency: 'monthly' | 'quarterly' | 'half-yearly' | 'yearly';
  installmentAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  remainingAmount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentReminder {
  id: string;
  memberId: string;
  memberName: string;
  type: 'upcoming' | 'overdue';
  dueDate: string;
  amount: number;
  year: number;
  programType: 'Waqf-e-Jadeed' | 'Tahreq Jadeed';
  sentAt?: string;
  status: 'pending' | 'sent' | 'failed';
  createdAt: string;
}

export interface FinancialReport {
  id: string;
  year: number;
  month?: number;
  reportType: 'monthly' | 'annual' | 'comparison';
  totalPromised: number;
  totalReceived: number;
  totalMembers: number;
  tanzeemBreakdown: {
    [key in Tanzeem]: {
      promised: number;
      received: number;
      members: number;
    };
  };
  createdAt: string;
  periodStart?: string;
  periodEnd?: string;
}

export interface WaqfJadeedRecord {
  id: string;
  memberId: string;
  year: number;
  promiseAmount: number;
  nagarparAmount?: number;
  paidAmount: number;
  notes?: string;
  updatedAt: string;
  payments?: Payment[];
}

export interface WaqfJadeedSpecialRecord {
  id: string;
  familyId: string;
  year: number;
  name: string;
  gender: 'male' | 'female';
  isDeceased: boolean;
  promiseAmount: number;
  nagarparAmount?: number;
  paidAmount: number;
  notes?: string;
  updatedAt: string;
  payments?: Payment[];
}

export interface TahreqJadeedRecord {
  id: string;
  memberId: string;
  year: number;
  promiseAmount: number;
  nagarparAmount?: number;
  paidAmount: number;
  notes?: string;
  updatedAt: string;
  payments?: Payment[];
}

export interface TahreqJadeedSpecialRecord {
  id: string;
  familyId: string;
  year: number;
  name: string;
  gender: 'male' | 'female';
  isDeceased: boolean;
  promiseAmount: number;
  nagarparAmount?: number;
  paidAmount: number;
  notes?: string;
  updatedAt: string;
  payments?: Payment[];
}
