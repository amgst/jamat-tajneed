export interface Member {
  id: string;
  name: string;
  fatherName: string;
  gender: 'male' | 'female';
  cnic?: string;
  dateOfBirth: string;
  age: number;
  phone: string;
  address: string;
  profilePhoto?: string;
  tanzeem: Tanzeem;
  familyId?: string;
  halqa?: string;
  specialCircumstances?: SpecialCircumstance[];
  lastTanzeemTransition?: TanzeemTransition;
  hasNewTanzeemTransition?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Family {
  id: string;
  headId: string; // Member ID of family head (Father/Guardian)
  familyName: string;
  memberIds: string[];
  totalMembers: number;
  halqa?: string;
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
  tanzeemStats: {
    [key in Tanzeem]: number;
  };
  halqaStats?: {
    [halqa: string]: number;
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
