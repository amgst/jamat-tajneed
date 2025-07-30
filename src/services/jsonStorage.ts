import type { Member, Family, AuthUser } from '../types';

// Mock data storage using localStorage for persistence
const STORAGE_KEYS = {
  MEMBERS: 'tajneed_members',
  FAMILIES: 'tajneed_families',
  AUTH_USER: 'tajneed_auth_user'
};

// Mock admin user
const MOCK_ADMIN: AuthUser = {
  uid: 'admin-123',
  email: 'admin@tajneed.com',
  displayName: 'System Administrator'
};

const ADMIN_PASSWORD = 'admin';

// Helper functions for localStorage
const getFromStorage = <T>(key: string): T[] => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error(`Error reading from localStorage key ${key}:`, error);
    return [];
  }
};

const saveToStorage = <T>(key: string, data: T[]): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving to localStorage key ${key}:`, error);
  }
};

const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Initialize with sample data if empty
const initializeSampleData = () => {
  const members = getFromStorage<Member>(STORAGE_KEYS.MEMBERS);
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
      },
      {
        id: '3',
        name: 'Abdullah Ahmed Khan',
        fatherName: 'Muhammad Ahmed Khan',
        gender: 'male',
        cnic: '35202-5555555-5',
        dateOfBirth: '2010-03-10',
        age: 14,
        phone: '03005555555',
        address: 'House # 123, Street 1, Muridke, Sheikhupura',
        tanzeem: 'atfal',
        halqa: 'Muridke Center',
        profilePhoto: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        hasNewTanzeemTransition: false,
      },
      {
        id: '4',
        name: 'Ayesha Ahmed Khan',
        fatherName: 'Muhammad Ahmed Khan',
        gender: 'female',
        cnic: '35202-6666666-6',
        dateOfBirth: '2012-09-22',
        age: 12,
        phone: '03066666666',
        address: 'House # 123, Street 1, Muridke, Sheikhupura',
        tanzeem: 'nasirat',
        halqa: 'Muridke Center',
        profilePhoto: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        hasNewTanzeemTransition: false,
      },
      {
        id: '5',
        name: 'Muhammad Tariq Hassan',
        fatherName: 'Ghulam Ahmad Hassan',
        gender: 'male',
        cnic: '35202-1111111-1',
        dateOfBirth: '1975-12-03',
        age: 49,
        phone: '03011111111',
        address: 'House # 45, Main Road, Muridke, Sheikhupura',
        tanzeem: 'ansar',
        halqa: 'Muridke West',
        profilePhoto: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        hasNewTanzeemTransition: false,
      },
      {
        id: '6',
        name: 'Aisha Tariq Hassan',
        fatherName: 'Muhammad Tariq Hassan',
        gender: 'female',
        cnic: '35202-2222222-2',
        dateOfBirth: '1985-07-14',
        age: 39,
        phone: '03022222222',
        address: 'House # 45, Main Road, Muridke, Sheikhupura',
        tanzeem: 'lajna',
        halqa: 'Muridke West',
        profilePhoto: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        hasNewTanzeemTransition: false,
      },
      {
        id: '7',
        name: 'Hassan Tariq',
        fatherName: 'Muhammad Tariq Hassan',
        gender: 'male',
        cnic: '35202-3333333-3',
        dateOfBirth: '2018-11-08',
        age: 6,
        phone: '03033333333',
        address: 'House # 45, Main Road, Muridke, Sheikhupura',
        tanzeem: 'saf-e-awal',
        halqa: 'Muridke West',
        profilePhoto: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        hasNewTanzeemTransition: false,
      },
      {
        id: '8',
        name: 'Zainab Tariq',
        fatherName: 'Muhammad Tariq Hassan',
        gender: 'female',
        cnic: '35202-4444444-4',
        dateOfBirth: '2019-06-15',
        age: 5,
        phone: '03044444444',
        address: 'House # 45, Main Road, Muridke, Sheikhupura',
        tanzeem: 'saf-e-awal-girls',
        halqa: 'Muridke West',
        profilePhoto: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        hasNewTanzeemTransition: false,
      },
      {
        id: '9',
        name: 'Muhammad Usman Malik',
        fatherName: 'Abdul Rahman Malik',
        gender: 'male',
        cnic: '35202-7777777-7',
        dateOfBirth: '2000-04-25',
        age: 24,
        phone: '03077777777',
        address: 'House # 156, Model Town, Muridke, Sheikhupura',
        tanzeem: 'khuddam',
        halqa: 'Muridke East',
        profilePhoto: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        hasNewTanzeemTransition: true,
      },
      {
        id: '10',
        name: 'Omar Usman Malik',
        fatherName: 'Muhammad Usman Malik',
        gender: 'male',
        cnic: '35202-8888888-8',
        dateOfBirth: '2016-06-17',
        age: 8,
        phone: '03088888888',
        address: 'House # 156, Model Town, Muridke, Sheikhupura',
        tanzeem: 'atfal',
        halqa: 'Muridke East',
        profilePhoto: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        hasNewTanzeemTransition: true,
      }
    ];

    saveToStorage(STORAGE_KEYS.MEMBERS, sampleMembers);

    // Create sample families
    const sampleFamilies: Family[] = [
      {
        id: 'family-1',
        familyName: 'Khan Family',
        headId: '1',
        memberIds: ['1', '2', '3', '4'],
        totalMembers: 4,
        halqa: 'Muridke Center',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'family-2',
        familyName: 'Hassan Family',
        headId: '5',
        memberIds: ['5', '6', '7', '8'],
        totalMembers: 4,
        halqa: 'Muridke West',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'family-3',
        familyName: 'Malik Family',
        headId: '9',
        memberIds: ['9', '10'],
        totalMembers: 2,
        halqa: 'Muridke East',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ];

    saveToStorage(STORAGE_KEYS.FAMILIES, sampleFamilies);
  }
};

// Initialize sample data on module load
initializeSampleData();

// Auth Services
export const signIn = async (email: string, password: string): Promise<AuthUser> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (email === 'admin' && password === ADMIN_PASSWORD) {
        localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(MOCK_ADMIN));
        resolve(MOCK_ADMIN);
      } else {
        reject(new Error('Invalid username or password'));
      }
    }, 1000); // Simulate network delay
  });
};

export const logout = async (): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
      resolve();
    }, 500);
  });
};

export const onAuthChange = (callback: (user: AuthUser | null) => void): (() => void) => {
  // Check for existing user
  const storedUser = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
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

  // Return cleanup function (not needed for localStorage)
  return () => {};
};

// Member Services
export const addMember = async (member: Omit<Member, 'id'>): Promise<string> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const members = getFromStorage<Member>(STORAGE_KEYS.MEMBERS);
      const newMember: Member = {
        ...member,
        id: generateId(),
      };
      members.push(newMember);
      saveToStorage(STORAGE_KEYS.MEMBERS, members);
      resolve(newMember.id);
    }, 500);
  });
};

export const updateMember = async (id: string, updates: Partial<Member>): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const members = getFromStorage<Member>(STORAGE_KEYS.MEMBERS);
      const index = members.findIndex(m => m.id === id);
      if (index !== -1) {
        members[index] = {
          ...members[index],
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        saveToStorage(STORAGE_KEYS.MEMBERS, members);
      }
      resolve();
    }, 500);
  });
};

export const deleteMember = async (id: string): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const members = getFromStorage<Member>(STORAGE_KEYS.MEMBERS);
      const filteredMembers = members.filter(m => m.id !== id);
      saveToStorage(STORAGE_KEYS.MEMBERS, filteredMembers);
      resolve();
    }, 300);
  });
};

export const getMember = async (id: string): Promise<Member | null> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const members = getFromStorage<Member>(STORAGE_KEYS.MEMBERS);
      const member = members.find(m => m.id === id) || null;
      resolve(member);
    }, 200);
  });
};

export const getAllMembers = async (): Promise<Member[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const members = getFromStorage<Member>(STORAGE_KEYS.MEMBERS);
      // Sort by name
      const sortedMembers = members.sort((a, b) => a.name.localeCompare(b.name));
      resolve(sortedMembers);
    }, 300);
  });
};

export const getMembersByFamily = async (familyId: string): Promise<Member[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const members = getFromStorage<Member>(STORAGE_KEYS.MEMBERS);
      const familyMembers = members
        .filter(m => m.familyId === familyId)
        .sort((a, b) => a.name.localeCompare(b.name));
      resolve(familyMembers);
    }, 300);
  });
};

export const getMembersByTanzeem = async (tanzeem: string): Promise<Member[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const members = getFromStorage<Member>(STORAGE_KEYS.MEMBERS);
      const tanzeemMembers = members
        .filter(m => m.tanzeem === tanzeem)
        .sort((a, b) => a.name.localeCompare(b.name));
      resolve(tanzeemMembers);
    }, 300);
  });
};

// Family Services
export const addFamily = async (family: Omit<Family, 'id'>): Promise<string> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const families = getFromStorage<Family>(STORAGE_KEYS.FAMILIES);
      const newFamily: Family = {
        ...family,
        id: generateId(),
      };
      families.push(newFamily);
      saveToStorage(STORAGE_KEYS.FAMILIES, families);
      resolve(newFamily.id);
    }, 500);
  });
};

export const updateFamily = async (id: string, updates: Partial<Family>): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const families = getFromStorage<Family>(STORAGE_KEYS.FAMILIES);
      const index = families.findIndex(f => f.id === id);
      if (index !== -1) {
        families[index] = {
          ...families[index],
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        saveToStorage(STORAGE_KEYS.FAMILIES, families);
      }
      resolve();
    }, 500);
  });
};

export const deleteFamily = async (id: string): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const families = getFromStorage<Family>(STORAGE_KEYS.FAMILIES);
      const filteredFamilies = families.filter(f => f.id !== id);
      saveToStorage(STORAGE_KEYS.FAMILIES, filteredFamilies);
      resolve();
    }, 300);
  });
};

export const getFamily = async (id: string): Promise<Family | null> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const families = getFromStorage<Family>(STORAGE_KEYS.FAMILIES);
      const family = families.find(f => f.id === id) || null;
      resolve(family);
    }, 200);
  });
};

export const getAllFamilies = async (): Promise<Family[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const families = getFromStorage<Family>(STORAGE_KEYS.FAMILIES);
      // Sort by family name
      const sortedFamilies = families.sort((a, b) => a.familyName.localeCompare(b.familyName));
      resolve(sortedFamilies);
    }, 300);
  });
};
