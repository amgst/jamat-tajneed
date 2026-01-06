/**
 * Input Validation Utilities
 * Provides comprehensive validation functions for user input to prevent security vulnerabilities
 */

// XSS Prevention - Sanitize HTML content
export const sanitizeHtml = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  
  // Remove potentially dangerous HTML tags and attributes
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .trim();
};

// SQL Injection Prevention - Escape special characters
export const sanitizeForDatabase = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  
  // Remove SQL injection patterns
  return input
    .replace(/['";\\]/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    .replace(/xp_/gi, '')
    .replace(/exec/gi, '')
    .replace(/execute/gi, '')
    .trim();
};

// General input sanitization
export const sanitizeInput = (input: string, options: {
  maxLength?: number;
  allowHtml?: boolean;
  allowSpecialChars?: boolean;
} = {}): string => {
  if (!input || typeof input !== 'string') return '';
  
  const { maxLength = 1000, allowHtml = false } = options;
  
  let sanitized = input.trim();
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Sanitize HTML if not allowed
  if (!allowHtml) {
    sanitized = sanitizeHtml(sanitized);
  }
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
};

// Email validation
export const validateEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

// Phone number validation (Pakistani format)
export const validatePhone = (phone: string): boolean => {
  if (!phone || typeof phone !== 'string') return false;
  
  // Remove spaces, dashes, and plus signs for validation
  const cleaned = phone.replace(/[\s\-+]/g, '');
  
  // Pakistani phone numbers: 10 digits starting with 0, or 12 digits starting with 92
  const phoneRegex = /^(0|92)?[0-9]{10}$/;
  return phoneRegex.test(cleaned);
};

// CNIC validation (Pakistani format)
export const validateCNIC = (cnic: string): boolean => {
  if (!cnic || typeof cnic !== 'string') return false;
  
  // Remove dashes and spaces
  const cleaned = cnic.replace(/[\s\-]/g, '');
  
  // Pakistani CNIC: 13 digits
  const cnicRegex = /^[0-9]{13}$/;
  return cnicRegex.test(cleaned);
};

// Name validation
export const validateName = (name: string, minLength: number = 2, maxLength: number = 100): boolean => {
  if (!name || typeof name !== 'string') return false;
  
  const trimmed = name.trim();
  
  // Check length
  if (trimmed.length < minLength || trimmed.length > maxLength) return false;
  
  // Allow letters, spaces, hyphens, apostrophes, and common Urdu/Arabic characters
  const nameRegex = /^[a-zA-Z\s\-'\.\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+$/;
  return nameRegex.test(trimmed);
};

// Address validation
export const validateAddress = (address: string, maxLength: number = 500): boolean => {
  if (!address || typeof address !== 'string') return false;
  
  const trimmed = address.trim();
  
  // Check length
  if (trimmed.length === 0 || trimmed.length > maxLength) return false;
  
  // Allow alphanumeric, spaces, common punctuation, and Urdu/Arabic characters
  const addressRegex = /^[a-zA-Z0-9\s\-'\.\,\#\/\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+$/;
  return addressRegex.test(trimmed);
};

// Number validation
export const validateNumber = (value: string | number, min?: number, max?: number): boolean => {
  if (typeof value === 'number') {
    if (min !== undefined && value < min) return false;
    if (max !== undefined && value > max) return false;
    return !isNaN(value) && isFinite(value);
  }
  
  if (typeof value === 'string') {
    const num = parseFloat(value);
    if (isNaN(num) || !isFinite(num)) return false;
    if (min !== undefined && num < min) return false;
    if (max !== undefined && num > max) return false;
    return true;
  }
  
  return false;
};

// Date validation
export const validateDate = (date: string | Date): boolean => {
  if (!date) return false;
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return false;
  
  // Check if date is not too far in the future (e.g., 150 years)
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 150);
  
  // Check if date is not too far in the past (e.g., 150 years ago)
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 150);
  
  return dateObj >= minDate && dateObj <= maxDate;
};

// URL validation
export const validateUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const urlObj = new URL(url);
    // Only allow http and https protocols
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

// Validate member data before saving
export const validateMemberData = (data: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Validate name
  if (!data.name || !validateName(data.name)) {
    errors.push('Name is required and must be 2-100 characters');
  }
  
  // Validate father name if provided
  if (data.fatherName && !validateName(data.fatherName)) {
    errors.push('Father name must be 2-100 characters');
  }
  
  // Validate husband name if provided
  if (data.husbandName && !validateName(data.husbandName)) {
    errors.push('Husband name must be 2-100 characters');
  }
  
  // Validate gender
  if (!data.gender || !['male', 'female'].includes(data.gender)) {
    errors.push('Gender must be either male or female');
  }
  
  // Validate CNIC if provided
  if (data.cnic && !validateCNIC(data.cnic)) {
    errors.push('CNIC must be 13 digits');
  }
  
  // Validate phone if provided
  if (data.phone && !validatePhone(data.phone)) {
    errors.push('Phone number is invalid');
  }
  
  // Validate address
  if (!data.address || !validateAddress(data.address)) {
    errors.push('Address is required and must be valid');
  }
  
  // Validate date of birth
  if (!data.dateOfBirth || !validateDate(data.dateOfBirth)) {
    errors.push('Date of birth is required and must be valid');
  }
  
  // Validate age
  if (data.age !== undefined && !validateNumber(data.age, 0, 150)) {
    errors.push('Age must be between 0 and 150');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// Sanitize member data
export const sanitizeMemberData = (data: any): any => {
  const sanitized: any = {};
  
  if (data.name) sanitized.name = sanitizeInput(data.name, { maxLength: 100 });
  if (data.fatherName) sanitized.fatherName = sanitizeInput(data.fatherName, { maxLength: 100 });
  if (data.husbandName) sanitized.husbandName = sanitizeInput(data.husbandName, { maxLength: 100 });
  if (data.address) sanitized.address = sanitizeInput(data.address, { maxLength: 500 });
  if (data.phone) sanitized.phone = sanitizeInput(data.phone, { maxLength: 20 });
  if (data.halqa) sanitized.halqa = sanitizeInput(data.halqa, { maxLength: 100 });
  if (data.cnic) sanitized.cnic = sanitizeInput(data.cnic, { maxLength: 20 });
  
  // Preserve non-string fields
  if (data.gender) sanitized.gender = data.gender;
  if (data.dateOfBirth) sanitized.dateOfBirth = data.dateOfBirth;
  if (data.age !== undefined) sanitized.age = data.age;
  if (data.tanzeem) sanitized.tanzeem = data.tanzeem;
  if (data.isDeceased !== undefined) sanitized.isDeceased = data.isDeceased;
  if (data.graveNumber) sanitized.graveNumber = sanitizeInput(data.graveNumber, { maxLength: 50 });
  
  return sanitized;
};

