import type { Member, Family, AuthUser } from '../types';

// File paths for JSON storage
const DATA_FILES = {
  MEMBERS: '/data/members.json',
  FAMILIES: '/data/families.json',
  AUTH_USER: '/data/auth.json'
};

// SECURITY: Hardcoded credentials removed. This application uses Firebase Authentication exclusively.
// Local storage authentication functions are disabled for security.

// Helper functions for file-based storage
const readFromFile = async <T>(filePath: string): Promise<T[]> => {
  try {
    // First try to read from the static JSON file
    const response = await fetch(filePath);
    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    }
  } catch (error) {
    console.log(`Static file ${filePath} not found, checking localStorage`);
  }

  // Fallback to localStorage if static file is not available
  const key = filePath.replace('/data/', '').replace('.json', '');
  const fallbackData = localStorage.getItem(`file_${key}`);
  if (fallbackData) {
    try {
      const parsed = JSON.parse(fallbackData);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

const saveToFile = async <T>(filePath: string, data: T[]): Promise<void> => {
  try {
    // Save to localStorage for persistence
    const key = filePath.replace('/data/', '').replace('.json', '');
    localStorage.setItem(`file_${key}`, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving data:`, error);
  }
};



const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Initialize with sample data if empty
const initializeSampleData = async () => {
  const members = await readFromFile<Member>(DATA_FILES.MEMBERS);
  if (members.length === 0) {
    const sampleMembers: Member[] = [
      {
        id: '1',
        name: 'Muhammad Ahmed Khan',
        fatherName: 'Muhammad Ali Khan',
        gender: 'male',
        cnic: '35202-1234567-8',
        dateOfBirth: '1990-05-15',
        age: 34,
        phone: '03001234567',
        address: 'House # 123, Street 1, Muridke, Sheikhupura',
        tanzeem: 'khuddam',
        halqa: 'Muridke Center',
        profilePhoto: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        hasNewTanzeemTransition: false,
      },
      {
        id: '2',
        name: 'Fatima Ahmed Khan',
        fatherName: 'Muhammad Ahmed Khan',
        gender: 'female',
        cnic: '35202-9876543-2',
        dateOfBirth: '1995-08-20',
        age: 29,
        phone: '03009876543',
        address: 'House # 123, Street 1, Muridke, Sheikhupura',
        tanzeem: 'lajna',
        halqa: 'Muridke Center',
        profilePhoto: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        hasNewTanzeemTransition: false,
      }
    ];

    await saveToFile(DATA_FILES.MEMBERS, sampleMembers);

    const sampleFamilies: Family[] = [
      {
        id: 'family-1',
        familyName: 'Khan Family',
        headId: '1',
        memberIds: ['1', '2'],
        totalMembers: 2,
        halqa: 'Muridke Center',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ];

    await saveToFile(DATA_FILES.FAMILIES, sampleFamilies);
  }
};

// Auth Services - DISABLED FOR SECURITY
// This application uses Firebase Authentication exclusively.
// These functions are disabled to prevent security vulnerabilities from hardcoded credentials.
export const signIn = async (_pin: string): Promise<AuthUser> => {
  throw new Error('Local authentication is disabled. Please use Firebase Authentication.');
};

// Legacy signIn function - DISABLED FOR SECURITY
export const signInWithCredentials = async (_email: string, _password: string): Promise<AuthUser> => {
  throw new Error('Local authentication is disabled. Please use Firebase Authentication.');
};

// NOTE: These functions are for data storage only, not authentication.
// Authentication is handled by Firebase Auth via AuthContext.
export const logout = async (): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      localStorage.removeItem('file_auth');
      resolve();
    }, 500);
  });
};

// NOTE: This function is for data storage only, not authentication.
// Authentication state is managed by Firebase Auth via AuthContext.
export const onAuthChange = (callback: (user: AuthUser | null) => void): (() => void) => {
  const storedUser = localStorage.getItem('file_auth');
  if (storedUser) {
    try {
      const user = JSON.parse(storedUser);
      callback(user);
    } catch {
      callback(null);
    }
  } else {
    callback(null);
  }

  return () => { };
};

// Member Services
export const addMember = async (member: Omit<Member, 'id'>): Promise<string> => {
  return new Promise(async (resolve) => {
    setTimeout(async () => {
      const members = await readFromFile<Member>(DATA_FILES.MEMBERS);
      const newMember: Member = {
        ...member,
        id: generateId(),
      };
      members.push(newMember);
      await saveToFile(DATA_FILES.MEMBERS, members);
      resolve(newMember.id);
    }, 500);
  });
};

export const updateMember = async (id: string, updates: Partial<Member>): Promise<void> => {
  return new Promise(async (resolve) => {
    setTimeout(async () => {
      const members = await readFromFile<Member>(DATA_FILES.MEMBERS);
      const index = members.findIndex(m => m.id === id);
      if (index !== -1) {
        members[index] = {
          ...members[index],
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        await saveToFile(DATA_FILES.MEMBERS, members);
      }
      resolve();
    }, 500);
  });
};

export const deleteMember = async (id: string): Promise<void> => {
  return new Promise(async (resolve) => {
    setTimeout(async () => {
      const members = await readFromFile<Member>(DATA_FILES.MEMBERS);
      const filteredMembers = members.filter(m => m.id !== id);
      await saveToFile(DATA_FILES.MEMBERS, filteredMembers);
      resolve();
    }, 300);
  });
};

export const getMember = async (id: string): Promise<Member | null> => {
  return new Promise(async (resolve) => {
    setTimeout(async () => {
      const members = await readFromFile<Member>(DATA_FILES.MEMBERS);
      const member = members.find(m => m.id === id) || null;
      resolve(member);
    }, 200);
  });
};

export const getAllMembers = async (): Promise<Member[]> => {
  return new Promise(async (resolve) => {
    setTimeout(async () => {
      const members = await readFromFile<Member>(DATA_FILES.MEMBERS);
      const sortedMembers = members.sort((a, b) => a.name.localeCompare(b.name));
      resolve(sortedMembers);
    }, 300);
  });
};

export const getMembersByTanzeem = async (tanzeem: string): Promise<Member[]> => {
  return new Promise(async (resolve) => {
    setTimeout(async () => {
      const members = await readFromFile<Member>(DATA_FILES.MEMBERS);
      const tanzeemMembers = members
        .filter(m => m.tanzeem === tanzeem)
        .sort((a, b) => a.name.localeCompare(b.name));
      resolve(tanzeemMembers);
    }, 300);
  });
};

// Family Services
export const addFamily = async (family: Omit<Family, 'id'>): Promise<string> => {
  return new Promise(async (resolve) => {
    setTimeout(async () => {
      const families = await readFromFile<Family>(DATA_FILES.FAMILIES);
      const newFamily: Family = {
        ...family,
        id: generateId(),
      };
      families.push(newFamily);
      await saveToFile(DATA_FILES.FAMILIES, families);
      resolve(newFamily.id);
    }, 500);
  });
};

export const updateFamily = async (id: string, updates: Partial<Family>): Promise<void> => {
  return new Promise(async (resolve) => {
    setTimeout(async () => {
      const families = await readFromFile<Family>(DATA_FILES.FAMILIES);
      const index = families.findIndex(f => f.id === id);
      if (index !== -1) {
        families[index] = {
          ...families[index],
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        await saveToFile(DATA_FILES.FAMILIES, families);
      }
      resolve();
    }, 500);
  });
};

export const deleteFamily = async (id: string): Promise<void> => {
  return new Promise(async (resolve) => {
    setTimeout(async () => {
      const families = await readFromFile<Family>(DATA_FILES.FAMILIES);
      const filteredFamilies = families.filter(f => f.id !== id);
      await saveToFile(DATA_FILES.FAMILIES, filteredFamilies);
      resolve();
    }, 300);
  });
};

export const getFamily = async (id: string): Promise<Family | null> => {
  return new Promise(async (resolve) => {
    setTimeout(async () => {
      const families = await readFromFile<Family>(DATA_FILES.FAMILIES);
      const family = families.find(f => f.id === id) || null;
      resolve(family);
    }, 200);
  });
};

export const getAllFamilies = async (): Promise<Family[]> => {
  return new Promise(async (resolve) => {
    setTimeout(async () => {
      const families = await readFromFile<Family>(DATA_FILES.FAMILIES);
      const sortedFamilies = families.sort((a, b) => a.familyName.localeCompare(b.familyName));
      resolve(sortedFamilies);
    }, 300);
  });
};

// Initialize sample data on module load
initializeSampleData();