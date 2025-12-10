const API_BASE = 'http://localhost:3001/api';

// Optional local JSON mode toggle via Settings
const getStorageMode = (): 'api' | 'json' => {
  const mode = localStorage.getItem('storage_mode');
  return mode === 'json' ? 'json' : 'api';
};

// Lazy import to avoid bundling when not used
let jsonImpl: any | null = null;
async function ensureJsonImpl() {
  if (!jsonImpl) {
    jsonImpl = await import('./jsonStorage');
  }
  return jsonImpl;
}

export class ApiService {
  static async getAllMembers() {
    if (getStorageMode() === 'json') {
      const { getAllMembers } = await ensureJsonImpl();
      return getAllMembers();
    }
    const response = await fetch(`${API_BASE}/members`);
    return response.json();
  }

  static async getAllFamilies() {
    if (getStorageMode() === 'json') {
      const { getAllFamilies } = await ensureJsonImpl();
      return getAllFamilies();
    }
    const response = await fetch(`${API_BASE}/families`);
    return response.json();
  }

  static async getDashboardStats() {
    if (getStorageMode() === 'json') {
      const { getAllMembers, getAllFamilies } = await ensureJsonImpl();
      const [members, families] = await Promise.all([getAllMembers(), getAllFamilies()]);
      const totalMembers = members.length;
      const maleMembers = members.filter((m: any) => m.gender === 'male').length;
      const femaleMembers = members.filter((m: any) => m.gender === 'female').length;
      const tanzeemStats = members.reduce((acc: any, m: any) => {
        acc[m.tanzeem] = (acc[m.tanzeem] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const halqaStats = members.reduce((acc: any, m: any) => {
        const h = m.halqa || '';
        if (!h) return acc;
        acc[h] = (acc[h] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      return { totalMembers, maleMembers, femaleMembers, totalFamilies: families.length, tanzeemStats, halqaStats };
    }
    const response = await fetch(`${API_BASE}/stats`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  }

  static async createMember(member: any) {
    if (getStorageMode() === 'json') {
      const { addMember } = await ensureJsonImpl();
      const id = await addMember(member);
      return { id, ...member };
    }
    const response = await fetch(`${API_BASE}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(member)
    });
    return response.json();
  }

  static async updateMember(id: string, member: any) {
    if (getStorageMode() === 'json') {
      const { updateMember } = await ensureJsonImpl();
      await updateMember(id, member);
      return { id, ...member };
    }
    const response = await fetch(`${API_BASE}/members/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(member)
    });
    return response.json();
  }

  static async deleteMember(id: string) {
    if (getStorageMode() === 'json') {
      const { deleteMember } = await ensureJsonImpl();
      await deleteMember(id);
      return { success: true };
    }
    const response = await fetch(`${API_BASE}/members/${id}`, {
      method: 'DELETE'
    });
    return response.json();
  }

  static async updateFamily(id: string, family: any) {
    if (getStorageMode() === 'json') {
      const { updateFamily } = await ensureJsonImpl();
      await updateFamily(id, family);
      return { id, ...family };
    }
    const response = await fetch(`${API_BASE}/families/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(family)
    });
    return response.json();
  }

  static async getWaqfJadeedRecords(year?: number, memberId?: string) {
    if (getStorageMode() === 'json') {
      // Not implementing JSON for this new feature
      return [];
    }
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    if (memberId) params.append('memberId', memberId);

    const response = await fetch(`${API_BASE}/waqf-jadeed?${params.toString()}`);
    return response.json();
  }

  static async saveWaqfJadeedRecord(data: any) {
    if (getStorageMode() === 'json') {
      // Not implementing JSON for this new feature
      return null;
    }
    const response = await fetch(`${API_BASE}/waqf-jadeed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  }

  static async addWaqfJadeedPayment(data: { memberId: string; year: number; amount: number; date: string; notes?: string }) {
    if (getStorageMode() === 'json') return null;
    const response = await fetch(`${API_BASE}/waqf-jadeed/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  }

  static async deleteWaqfJadeedPayment(id: string) {
    if (getStorageMode() === 'json') return { success: false };
    const response = await fetch(`${API_BASE}/waqf-jadeed/payment/${id}`, {
      method: 'DELETE'
    });
    return response.json();
  }

  // --- Special Members ---

  static async getWaqfJadeedSpecialRecords(year?: number, familyId?: string) {
    if (getStorageMode() === 'json') return [];
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    if (familyId) params.append('familyId', familyId);

    const response = await fetch(`${API_BASE}/waqf-jadeed/special?${params.toString()}`);
    return response.json();
  }

  static async saveWaqfJadeedSpecialRecord(data: any) {
    if (getStorageMode() === 'json') return null;
    const response = await fetch(`${API_BASE}/waqf-jadeed/special`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  }

  static async deleteWaqfJadeedSpecialRecord(id: string) {
    if (getStorageMode() === 'json') return { success: false };
    const response = await fetch(`${API_BASE}/waqf-jadeed/special/${id}`, {
      method: 'DELETE'
    });
    return response.json();
  }
}