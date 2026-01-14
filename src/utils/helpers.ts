import dayjs from 'dayjs';
import type { Tanzeem, TanzeemTransition } from '../types';

/**
 * Calculate age from date of birth
 */
export const calculateAge = (dateOfBirth: string): number => {
  return dayjs().diff(dayjs(dateOfBirth), 'year');
};

/**
 * Determine Tanzeem based on age and gender according to Jamaat Ahmadiyya rules
 * Boys: Under 7 → Saf-e-Awal | 7-15 → Atfal | 15-40 → Khuddam | 40+ → Ansar
 * Girls: Under 7 → Saf-e-Awal-Girls | 7-15 → Nasirat | 15+ → Lajna
 */
export const determineTanzeem = (age: number, gender: 'male' | 'female'): Tanzeem => {
  if (gender === 'male') {
    if (age < 7) return 'saf-e-awal';
    if (age < 15) return 'atfal';
    if (age < 40) return 'khuddam';
    return 'ansar';
  } else {
    if (age < 7) return 'saf-e-awal-girls';
    if (age < 15) return 'nasirat';
    return 'lajna';
  }
};

/**
 * Get Tanzeem display name
 */
export const getTanzeemDisplayName = (tanzeem: Tanzeem | string): string => {
  const names: Record<string, string> = {
    'saf-e-awal': 'Saf-e-Awal',
    'saf-e-awal-girls': 'Saf-e-Awal (Girls)',
    'atfal': 'Atfal',
    'nasirat': 'Nasirat',
    'khuddam': 'Khuddam',
    'lajna': 'Lajna',
    'ansar': 'Ansar',
    'dafar-atfal': 'Daftar Atfal'
  };
  return names[tanzeem] || tanzeem;
};

/**
 * Get Tanzeem Urdu display name
 */
export const getTanzeemUrduName = (tanzeem: Tanzeem | string): string => {
  const names: Record<string, string> = {
    'saf-e-awal': 'صف اول',
    'saf-e-awal-girls': 'صف اول (لڑکیاں)',
    'atfal': 'اطفال',
    'nasirat': 'ناصرات',
    'khuddam': 'خدام',
    'lajna': 'لجنہ',
    'ansar': 'انصار',
    'dafar-atfal': 'دفتر اطفال'
  };
  return names[tanzeem] || tanzeem;
};

/**
 * Check if member needs Tanzeem transition based on current age vs stored Tanzeem
 */
export const checkTanzeemTransition = (
  currentAge: number,
  gender: 'male' | 'female',
  currentTanzeem: Tanzeem
): { needsTransition: boolean; newTanzeem?: Tanzeem } => {
  const correctTanzeem = determineTanzeem(currentAge, gender);

  if (correctTanzeem !== currentTanzeem) {
    return {
      needsTransition: true,
      newTanzeem: correctTanzeem
    };
  }

  return { needsTransition: false };
};

/**
 * Create a Tanzeem transition record
 */
export const createTanzeemTransition = (
  memberId: string,
  fromTanzeem: Tanzeem,
  toTanzeem: Tanzeem
): TanzeemTransition => {
  return {
    memberId,
    fromTanzeem,
    toTanzeem,
    transitionDate: new Date().toISOString(),
    isNew: true
  };
};

/**
 * Format CNIC number
 */
export const formatCNIC = (cnic: string): string => {
  const cleaned = cnic.replace(/\D/g, '');
  if (cleaned.length === 13) {
    return `${cleaned.slice(0, 5)}-${cleaned.slice(5, 12)}-${cleaned.slice(12)}`;
  }
  return cnic;
};

/**
 * Validate CNIC number
 */
export const validateCNIC = (cnic: string): boolean => {
  const cleaned = cnic.replace(/\D/g, '');
  return cleaned.length === 13;
};

/**
 * Validate phone number
 */
export const validatePhone = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
};

/**
 * Generate unique ID
 */
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

/**
 * Format date for display
 */
export const formatDate = (date: string): string => {
  return dayjs(date).format('DD/MM/YYYY');
};

/**
 * Export data to CSV
 */
export const exportToCSV = (data: any[], filename: string): void => {
  const csvContent = convertToCSV(data);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

/**
 * Convert array of objects to CSV string
 */
const convertToCSV = (data: any[]): string => {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',')
          ? `"${value}"`
          : value;
      }).join(',')
    )
  ].join('\n');

  return csvContent;
};
