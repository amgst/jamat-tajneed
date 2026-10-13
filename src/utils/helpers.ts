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
    'dafar-atfal': 'Daftar Atfal',
    'dafar-atfal-male': 'Daftar Atfal (Male)',
    'dafar-atfal-female': 'Daftar Atfal (Female)'
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
    'dafar-atfal': 'دفتر اطفال',
    'dafar-atfal-male': 'دفتر اطفال (لڑکے)',
    'dafar-atfal-female': 'دفتر اطفال (لڑکیاں)'
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

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

const containsArabicScript = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(value);
};

const titleCaseFromKey = (key: string): string => {
  const withSpaces = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return withSpaces.length ? withSpaces[0].toUpperCase() + withSpaces.slice(1) : key;
};

const formatCellValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return new Intl.NumberFormat().format(value);
  return String(value);
};

const exportToPDFViaCanvas = async (
  data: Array<Record<string, unknown>>,
  headers: string[],
  filename: string,
  title: string,
  options?: {
    showHeader?: boolean;
    showTitle?: boolean;
    showGeneratedOn?: boolean;
    rtl?: boolean;
    headerLabels?: Record<string, string>;
  }
): Promise<void> => {
  const showHeader = options?.showHeader ?? true;
  const showTitle = options?.showTitle ?? true;
  const showGeneratedOn = options?.showGeneratedOn ?? true;
  const rtl = options?.rtl ?? false;
  const headerLabels = options?.headerLabels;

  const container = document.createElement('div');
  container.setAttribute('dir', rtl ? 'rtl' : 'ltr');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '794px'; // ~A4 at 96dpi
  container.style.background = '#fff';
  container.style.padding = '20px';
  container.style.color = '#111';
  container.style.fontFamily =
    "Noto Nastaliq Urdu, Noto Naskh Arabic, Amiri, 'Segoe UI', Arial, sans-serif";

  const headerBlock = document.createElement('div');
  headerBlock.style.display = 'flex';
  headerBlock.style.flexDirection = 'column';
  headerBlock.style.gap = '6px';
  headerBlock.style.marginBottom = '12px';

  if (showTitle && title) {
    const titleEl = document.createElement('div');
    titleEl.textContent = title;
    titleEl.style.fontSize = '18px';
    titleEl.style.fontWeight = '700';
    titleEl.style.textAlign = rtl ? 'right' : 'left';
    headerBlock.appendChild(titleEl);
  }

  if (showGeneratedOn) {
    const genEl = document.createElement('div');
    genEl.textContent = `Generated on: ${dayjs().format('DD/MM/YYYY')}`;
    genEl.style.fontSize = '12px';
    genEl.style.opacity = '0.75';
    genEl.style.textAlign = rtl ? 'right' : 'left';
    headerBlock.appendChild(genEl);
  }

  container.appendChild(headerBlock);

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.tableLayout = 'fixed';
  table.style.fontSize = '12px';

  if (showHeader) {
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    headers.forEach(h => {
      const th = document.createElement('th');
      th.textContent = headerLabels?.[h] ?? titleCaseFromKey(h);
      th.style.border = '1px solid #e5e7eb';
      th.style.background = '#16a085';
      th.style.color = '#fff';
      th.style.padding = '8px 6px';
      th.style.textAlign = rtl ? 'right' : 'left';
      th.style.fontWeight = '700';
      th.style.wordBreak = 'break-word';
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    table.appendChild(thead);
  }

  const tbody = document.createElement('tbody');
  data.forEach((item, rowIndex) => {
    const tr = document.createElement('tr');
    if (rowIndex % 2 === 1) tr.style.background = '#fafafa';
    headers.forEach(h => {
      const td = document.createElement('td');
      td.textContent = formatCellValue(item?.[h]);
      td.setAttribute('dir', 'auto');
      td.style.border = '1px solid #e5e7eb';
      td.style.padding = '7px 6px';
      td.style.verticalAlign = 'top';
      td.style.textAlign = rtl ? 'right' : 'left';
      td.style.wordBreak = 'break-word';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);

  document.body.appendChild(container);
  try {
    await document.fonts.ready;
    const canvas = await html2canvas(container, {
      scale: Math.max(2, window.devicePixelRatio || 1),
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const margin = 10;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;

    const imgHeight = (canvas.height * usableWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, 'PNG', margin, position, usableWidth, imgHeight);
    heightLeft -= usableHeight;

    while (heightLeft > 0) {
      pdf.addPage();
      position = margin - (imgHeight - heightLeft);
      pdf.addImage(imgData, 'PNG', margin, position, usableWidth, imgHeight);
      heightLeft -= usableHeight;
    }

    pdf.save(`${filename}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
};

/**
 * Export data to CSV
 */
export const exportToCSV = (data: Array<Record<string, unknown>>, filename: string): void => {
  const csvContent = convertToCSV(data);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

/**
 * Export data to PDF
 */
export const exportToPDF = async (
  data: Array<Record<string, unknown>>,
  headers: string[],
  filename: string,
  title: string,
  options?: {
    fontSize?: number;
    showHeader?: boolean;
    showTitle?: boolean;
    showGeneratedOn?: boolean;
    rtl?: boolean;
    renderMode?: 'autoTable' | 'canvas';
    headerLabels?: Record<string, string>;
    titleAlign?: 'left' | 'center' | 'right';
    sections?: Array<{
      title: string;
      data: Array<Record<string, unknown>>;
      headers: string[];
      options?: {
        showHeader?: boolean;
        fontSize?: number;
      };
    }>;
  }
): Promise<void> => {
  const doc = new jsPDF();
  
  try {
    const rtl = options?.rtl ?? false;
    const headerLabels = options?.headerLabels;

    const needsArabicSupport =
      containsArabicScript(title) ||
      data.some(row => headers.some(h => containsArabicScript(row?.[h])));

    const renderMode = options?.renderMode ?? (needsArabicSupport ? 'canvas' : 'autoTable');
    if (renderMode === 'canvas') {
      await exportToPDFViaCanvas(data, headers, filename, title, {
        showHeader: options?.showHeader,
        showTitle: options?.showTitle,
        showGeneratedOn: options?.showGeneratedOn,
        rtl,
        headerLabels
      });
      return;
    }
  } catch (error) {
    console.error('Error in PDF export check:', error);
    throw error;
  }

  const showTitle = options?.showTitle ?? true;
  const showGeneratedOn = options?.showGeneratedOn ?? true;
  const rtl = options?.rtl ?? false;
  const headerLabels = options?.headerLabels;

  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 20;

  if (showTitle && title) {
    const titleAlign = options?.titleAlign ?? 'center';
    const isUrdu = /[\u0600-\u06FF]/.test(title);

    if (isUrdu) {
      // For Urdu, we use a hidden div + html2canvas to ensure correct shaping
      const titleContainer = document.createElement('div');
      titleContainer.style.position = 'fixed';
      titleContainer.style.left = '-10000px';
      titleContainer.style.width = '800px';
      titleContainer.style.textAlign = titleAlign;
      titleContainer.style.fontFamily = "'Noto Nastaliq Urdu', 'Amiri', serif";
      titleContainer.style.fontSize = '24px';
      titleContainer.style.lineHeight = '1.6';
      titleContainer.style.whiteSpace = 'pre-wrap';
      titleContainer.style.padding = '20px';
      titleContainer.style.direction = 'rtl';
      titleContainer.textContent = title;
      document.body.appendChild(titleContainer);

      try {
        const canvas = await html2canvas(titleContainer, {
          backgroundColor: null,
          scale: 2
        });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth - 28;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        doc.addImage(imgData, 'PNG', 14, currentY, imgWidth, imgHeight);
        currentY += imgHeight + 5;
      } finally {
        document.body.removeChild(titleContainer);
      }
    } else {
      doc.setFontSize(18);
      const titleLines = String(title).split('\n');
      let x = 14;
      if (titleAlign === 'center') x = pageWidth / 2;
      else if (titleAlign === 'right' || rtl) x = pageWidth - 14;
      doc.text(titleLines, x, currentY + 2, { align: titleAlign });
      currentY += (titleLines.length * 9) + 4;
    }
  }

  if (showGeneratedOn) {
    const genText = `Generated on: ${dayjs().format('DD/MM/YYYY')}`;
    doc.setFontSize(10);
    const genAlign = options?.titleAlign ?? (rtl ? 'right' : 'left');
    let genX = 14;
    if (genAlign === 'center') genX = pageWidth / 2;
    else if (genAlign === 'right') genX = pageWidth - 14;
    doc.text(genText, genX, currentY, { align: genAlign });
    currentY += 8;
  }

  const sections = options?.sections;
  const hasSections = sections && sections.length > 0;

  if (!hasSections && data.length === 0) return;

  const bodyFontSize = options?.fontSize ?? 8;
  const showHeader = options?.showHeader ?? true;

  // Load font for all tables
  try {
    const fontRes = await fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/amiri/Amiri-Regular.ttf');
    if (fontRes.ok) {
      const buffer = await fontRes.arrayBuffer();
      const base64Font = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      doc.addFileToVFS('Amiri-Regular.ttf', base64Font);
      doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
      doc.setFont('Amiri');
    }
  } catch (e) {
    console.error('Failed to load Amiri font', e);
  }

  if (hasSections) {
    for (const section of sections) {
      if (section.data.length === 0) continue;

      // Check if we need a new page for the section header
      if (currentY > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        currentY = 20;
      }

      // Render section title
      doc.setFontSize(14);
      doc.setFont('Amiri', 'normal');
      doc.text(section.title, rtl ? pageWidth - 14 : 14, currentY, { align: rtl ? 'right' : 'left' });
      currentY += 6;

      const sectionHeaders = section.headers;
      const sectionTableColumn = sectionHeaders.map(h => headerLabels?.[h] ?? titleCaseFromKey(h));
      const sectionTableRows = section.data.map(item =>
        sectionHeaders.map(header => formatCellValue(item?.[header]) as string | number)
      );

      autoTable(doc, {
        head: (section.options?.showHeader ?? showHeader) ? [sectionTableColumn] : [],
        body: sectionTableRows,
        startY: currentY + 2,
        theme: 'grid',
        styles: {
          fontSize: section.options?.fontSize ?? bodyFontSize,
          halign: rtl ? 'right' : 'left',
          font: 'Amiri'
        },
        columnStyles: sectionHeaders && sectionHeaders.length === 3 && sectionHeaders.includes('col1') ? {
          0: { cellWidth: (pageWidth - 28) / 3, halign: rtl ? 'right' : 'left' },
          1: { cellWidth: (pageWidth - 28) / 3, halign: rtl ? 'right' : 'left' },
          2: { cellWidth: (pageWidth - 28) / 3, halign: rtl ? 'right' : 'left' }
        } : undefined,
        headStyles: {
          fillColor: [22, 160, 133],
          halign: rtl ? 'right' : 'left',
          font: 'Amiri'
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 12;
    }
  } else {
    const tableColumn = headers.map(h => headerLabels?.[h] ?? titleCaseFromKey(h));
    const tableRows = data.map(item =>
      headers.map(header => formatCellValue(item?.[header]) as string | number)
    );

    autoTable(doc, {
      head: showHeader ? [tableColumn] : [],
      body: tableRows,
      startY: currentY + 5,
      theme: 'grid',
      styles: {
        fontSize: bodyFontSize,
        halign: rtl ? 'right' : 'left',
        font: 'Amiri'
      },
      columnStyles: headers && headers.length === 3 && headers.includes('col1') ? {
        0: { cellWidth: (pageWidth - 28) / 3, halign: rtl ? 'right' : 'left' },
        1: { cellWidth: (pageWidth - 28) / 3, halign: rtl ? 'right' : 'left' },
        2: { cellWidth: (pageWidth - 28) / 3, halign: rtl ? 'right' : 'left' }
      } : undefined,
      headStyles: {
        fillColor: [22, 160, 133],
        halign: rtl ? 'right' : 'left',
        font: 'Amiri'
      },
    });
  }

  doc.save(`${filename}.pdf`);
};

/**
 * Convert array of objects to CSV string
 */
const convertToCSV = (data: Array<Record<string, unknown>>): string => {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header] !== undefined && row[header] !== null ? row[header] : '';
        return typeof value === 'string' && value.includes(',')
          ? `"${value}"`
          : value;
      }).join(',')
    )
  ].join('\n');

  return csvContent;
};
