import type { Member, Family, AuthUser } from '../types';

// File paths for JSON storage
const DATA_FILES = {
  MEMBERS: '/data/members.json',
  FAMILIES: '/data/families.json',
  AUTH_USER: '/data/auth.json'
};

// Mock admin user
const MOCK_ADMIN: AuthUser = {
  uid: 'admin-123',
  email: 'admin@tajneed.com',
  displayName: 'System Administrator'
};

const ADMIN_PASSWORD = 'admin';
const ADMIN_PIN = '1234';

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
    
    // Try to save to actual JSON file via API
    const filename = filePath.replace('/data/', '');
    try {
      const response = await fetch('http://localhost:3001/api/save-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename,
          data
        })
      });
      
      if (response.ok) {
        console.log(`Data saved to localStorage and ${filename} file updated`);
      } else {
        throw new Error(`API save failed: ${response.statusText}`);
      }
    } catch (apiError) {
      console.warn('API save failed, falling back to download:', apiError);
      // Fallback: trigger download only if API fails
      downloadJSON(data, filename);
    }
  } catch (error) {
    console.error(`Error saving data:`, error);
  }
};

const downloadJSON = (data: any, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

// Auth Services
export const signIn = async (pin: string): Promise<AuthUser> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (pin === ADMIN_PIN) {
        localStorage.setItem('file_auth', JSON.stringify(MOCK_ADMIN));
        resolve(MOCK_ADMIN);
      } else {
        reject(new Error('Invalid PIN'));
      }
    }, 1000);
  });
};

// Legacy signIn function for backward compatibility
export const signInWithCredentials = async (email: string, password: string): Promise<AuthUser> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (email === 'admin' && password === ADMIN_PASSWORD) {
        localStorage.setItem('file_auth', JSON.stringify(MOCK_ADMIN));
        resolve(MOCK_ADMIN);
      } else {
        reject(new Error('Invalid username or password'));
      }
    }, 1000);
  });
};

export const logout = async (): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      localStorage.removeItem('file_auth');
      resolve();
    }, 500);
  });
};

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

  return () => {};
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