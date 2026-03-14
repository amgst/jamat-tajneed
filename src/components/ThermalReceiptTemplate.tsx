import React from 'react';
import dayjs from 'dayjs';

export interface ThermalReceiptData {
    receiptNo: string;
    date: string;
    name: string;
    memberCode: string;
    amount: number;
    year: number;
    type: 'Waqf-e-Jadeed' | 'Waqf-e-Jadeed (Special)' | 'Tahreq Jadeed' | 'Tahreq Jadeed (Special)';
    bookNo?: string;
    receiptNoDisplay?: string | number;
    tanzeem?: string;
    gender?: 'male' | 'female';
}

export interface ThermalFamilyReceiptRow {
    name: string;
    promised: number;
    paid: number;
    tag?: string;
}

export interface ThermalFamilyReceiptData {
    familyName: string;
    familyNumber?: number;
    halqa?: string;
    headName?: string;
    headPhone?: string;
    year: number;
    totalPromise: number;
    totalPaid: number;
    totalBalance: number;
    rows: ThermalFamilyReceiptRow[];
}

function getFormattedName(data: ThermalReceiptData): string {
    if (!data.gender) return data.name;
    if (data.gender === 'female') return `محترمہ ${data.name} صاحبہ`;
    return `محترم ${data.name} صاحب`;
}

function getUrduType(data: ThermalReceiptData): string {
    if (data.type.includes('Special')) return 'وقف جدید (خصوصی)';
    if (data.type.includes('Waqf-e-Jadeed')) return 'وقف جدید';
    return data.type;
}

/**
 * Returns a full HTML document string for 58mm thermal printer.
 * Open in new window and call print() to send to thermal printer.
 */
export function getThermalReceiptDocument(data: ThermalReceiptData): string {
    const name = getFormattedName(data);
    const typeUrdu = getUrduType(data);
    const receiptLabel = data.bookNo
        ? `Book: ${data.bookNo}  Rcpt: ${data.receiptNoDisplay}`
        : `#${data.receiptNo}`;
    const dateStr = dayjs(data.date).format('DD MMM YYYY');
    const memberLine = data.memberCode ? `Code: ${data.memberCode}` : 'Special Pledge';

    return `<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
  <meta charset="UTF-8">
  <title>Waqf-e-Jadeed Receipt</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      font-size: 11px;
      line-height: 1.35;
      color: #000;
      background: #fff;
      width: 58mm;
      min-height: 100%;
      padding: 3mm 2mm;
      margin: 0 auto;
    }
    .receipt {
      width: 58mm;
      max-width: 58mm;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border-bottom: 1px dashed #000; margin: 4px 0; }
    .line { margin: 2px 0; }
    .mt { margin-top: 6px; }
    .mb { margin-bottom: 4px; }
    .amount { font-size: 14px; font-weight: bold; margin: 6px 0; }
    .urdu { font-family: 'Noto Nastaliq Urdu', 'Traditional Arabic', serif; }
    @media print {
      body { width: 58mm; margin: 0; padding: 2mm; }
      .receipt { width: 58mm !important; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="center bold mb">Jamat Tajneed</div>
    <div class="center" style="font-size:9px">Waqf-e-Jadeed Receipt</div>
    <div class="divider"></div>
    <div class="line">Rcpt: ${receiptLabel}</div>
    <div class="line">Date: ${dateStr}</div>
    <div class="divider mt"></div>
    <div class="line" style="font-size:9px">RECEIVED FROM</div>
    <div class="line urdu bold">${escapeHtml(name)}</div>
    <div class="line" style="font-size:9px">${escapeHtml(memberLine)}</div>
    ${data.tanzeem ? `<div class="line urdu">${escapeHtml(data.tanzeem)}</div>` : ''}
    <div class="divider mt"></div>
    <div class="line" style="font-size:9px">PAYMENT FOR</div>
    <div class="line urdu bold">${escapeHtml(typeUrdu)}</div>
    <div class="line">Year: ${data.year}</div>
    <div class="divider mt"></div>
    <div class="center amount">Rs. ${data.amount.toLocaleString()}</div>
    <div class="divider"></div>
    <div class="center" style="font-size:8px; margin-top:6px">Thank you</div>
    <div class="center" style="font-size:8px">${dayjs().format('DD MMM YYYY HH:mm')}</div>
  </div>
</body>
</html>`;
}

/**
 * Returns a full HTML document string for a 58mm thermal family receipt.
 */
export function getThermalFamilyReceiptDocument(data: ThermalFamilyReceiptData): string {
    const formatAmount = (value: number) => value.toLocaleString();
    const familyNumber = data.familyNumber ? `#${data.familyNumber}` : 'N/A';
    const rowsHtml = data.rows
        .map(row => {
            const tag = row.tag ? ` (${row.tag})` : '';
            return `<div class="row"><span class="name">${escapeHtml(row.name)}${escapeHtml(tag)}</span><span class="amt">${formatAmount(row.paid)}/${formatAmount(row.promised)}</span></div>`;
        })
        .join('');

    return `<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
  <meta charset="UTF-8">
  <title>Waqf-e-Jadeed Family Receipt</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', monospace;
      font-size: 10px;
      line-height: 1.35;
      color: #000;
      background: #fff;
      width: 58mm;
      min-height: 100%;
      padding: 3mm 2mm;
      margin: 0 auto;
    }
    .receipt {
      width: 58mm;
      max-width: 58mm;
    }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border-bottom: 1px dashed #000; margin: 4px 0; }
    .line { margin: 2px 0; }
    .amount { font-size: 12px; font-weight: bold; margin: 6px 0; }
    .rows { margin-top: 4px; }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 4px;
      margin: 2px 0;
    }
    .name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .amt {
      width: 24mm;
      text-align: right;
    }
    @media print {
      body { width: 58mm; margin: 0; padding: 2mm; }
      .receipt { width: 58mm !important; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="center bold">Jamat Tajneed</div>
    <div class="center" style="font-size:9px">Waqf-e-Jadeed Family Receipt</div>
    <div class="divider"></div>
    <div class="line"><span class="bold">Family:</span> ${escapeHtml(data.familyName)}</div>
    <div class="line"><span class="bold">Family No:</span> ${escapeHtml(familyNumber)}</div>
    ${data.halqa ? `<div class="line"><span class="bold">Halqa:</span> ${escapeHtml(data.halqa)}</div>` : ''}
    ${data.headName ? `<div class="line"><span class="bold">Head:</span> ${escapeHtml(data.headName)}</div>` : ''}
    ${data.headPhone ? `<div class="line"><span class="bold">Phone:</span> ${escapeHtml(data.headPhone)}</div>` : ''}
    <div class="line"><span class="bold">Year:</span> ${data.year}</div>
    <div class="divider"></div>
    <div class="line"><span class="bold">Total Promise:</span> Rs. ${formatAmount(data.totalPromise)}</div>
    <div class="line"><span class="bold">Total Paid:</span> Rs. ${formatAmount(data.totalPaid)}</div>
    <div class="line"><span class="bold">Balance:</span> Rs. ${formatAmount(data.totalBalance)}</div>
    <div class="divider"></div>
    <div class="line bold">Members (Paid/Promise)</div>
    <div class="rows">${rowsHtml || '<div class="line">No members found</div>'}</div>
    <div class="divider"></div>
    <div class="center" style="font-size:8px; margin-top:6px">Generated: ${dayjs().format('DD MMM YYYY HH:mm')}</div>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** React component for on-screen preview of 58mm thermal receipt */
export const ThermalReceiptTemplate: React.FC<{ data: ThermalReceiptData }> = ({ data }) => {
    const html = getThermalReceiptDocument(data);
    return (
        <div
            className="thermal-receipt-preview"
            style={{
                width: 220,
                maxWidth: '58mm',
                margin: '0 auto',
                padding: 8,
                background: '#fff',
                border: '1px solid #ddd',
                borderRadius: 4,
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
        >
            <iframe
                title="Thermal receipt preview"
                srcDoc={html}
                style={{
                    width: '100%',
                    minHeight: 400,
                    border: 'none',
                    background: '#fff',
                }}
            />
        </div>
    );
};
