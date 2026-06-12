import React, { useMemo, useState, useEffect } from 'react';
import {
    Card,
    Table,
    Typography,
    Tabs,
    Row,
    Col,
    Statistic,
    Progress,
    Tag,
    Button,
    Space,
    Select,
    InputNumber,
    Input,
    App
} from 'antd';
import {
    FilterOutlined,
    DownloadOutlined,
    HistoryOutlined,
    UserOutlined,
    LineChartOutlined,
    PieChartOutlined,
    BookOutlined,
    DollarOutlined,
    FilePdfOutlined,
    TeamOutlined,
    BarChartOutlined
} from '@ant-design/icons';
import type { Member, WaqfJadeedRecord, WaqfJadeedSpecialRecord, Payment, Family, FitranaExtra } from '../types';
import { getTanzeemDisplayName, exportToCSV, exportToPDF } from '../utils/helpers';
import { ApiService } from '../services/apiService';
import dayjs from 'dayjs';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const { Title, Text } = Typography;

interface WaqfReportsProps {
    members: Member[];
    records: ({ member: Member; promise: number; paid: number; record?: WaqfJadeedRecord })[];
    specialRecords: WaqfJadeedSpecialRecord[];
    allPayments: Payment[];
    prevRecords: WaqfJadeedRecord[];
    prevSpecialRecords: WaqfJadeedSpecialRecord[];
    selectedYear: number;
    allRecords: WaqfJadeedRecord[];
    families?: Family[];
}

const WaqfReports: React.FC<WaqfReportsProps> = ({
    members,
    records,
    specialRecords,
    allPayments,
    prevRecords,
    prevSpecialRecords,
    selectedYear,
    allRecords,
    families = []
}) => {
    const { message } = App.useApp();
    const [activeReport, setActiveReport] = useState('halqa');
    const [selectedBook, setSelectedBook] = useState<string | null>(null);
    const [fitranaOverrides, setFitranaOverrides] = useState<Record<string, { fitrana: number; eidFund: number; sadqa: number }>>({});
    const [fitranaExtraRows, setFitranaExtraRows] = useState<FitranaExtra[]>([]);
    const [fitranaSort, setFitranaSort] = useState<{
        field: 'fitrana' | 'eidFund' | 'sadqa' | 'no' | 'familyName' | null;
        order: 'ascend' | 'descend' | null;
    }>({
        field: null,
        order: null
    });
    const [fitranaTableKey, setFitranaTableKey] = useState(0);
    const [lajnaVisits, setLajnaVisits] = useState<number>(0);
    const [lajnaEvents, setLajnaEvents] = useState<number>(0);
    const [lajnaConverted, setLajnaConverted] = useState<number>(0);
    const [lajnaOtherEfforts, setLajnaOtherEfforts] = useState<string>('');

    const resetFitranaSort = () => {
        setFitranaSort({ field: null, order: null });
        setFitranaTableKey(prev => prev + 1);
    };

    useEffect(() => {
        const loadExtras = async () => {
            try {
                const extras = await ApiService.getFitranaExtras(selectedYear);
                setFitranaExtraRows(extras);
            } catch (error) {
                console.error('Failed to load Fitrana extra rows', error);
                message.error('Failed to load extra rows');
            }
        };
        loadExtras();
    }, [selectedYear]);

    useEffect(() => {
        const style = document.createElement('style');
        style.innerHTML = `
      .fitrana-paid-row {
        background-color: #f6ffed !important;
      }
      .fitrana-paid-row:hover {
        background-color: #d9f7be !important;
      }
    `;
        document.head.appendChild(style);
        return () => {
            document.head.removeChild(style);
        };
    }, []);

    // --- Data Calculations ---

    const uniqueBooks = useMemo(() => {
        const books = new Set<string>();
        allPayments.forEach(p => {
            if (p.bookNo) books.add(p.bookNo.toString());
        });
        return Array.from(books).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }, [allPayments]);

    // Set initial book if none selected
    React.useEffect(() => {
        if (!selectedBook && uniqueBooks.length > 0) {
            setSelectedBook(uniqueBooks[0]);
        }
    }, [uniqueBooks, selectedBook]);

    const halqaStats = useMemo(() => {
        const stats: Record<string, { promised: number; paid: number; count: number }> = {};

        // Regular members
        records.forEach(r => {
            const halqa = r.member.halqa || 'No Halqa';
            if (!stats[halqa]) stats[halqa] = { promised: 0, paid: 0, count: 0 };
            stats[halqa].promised += r.promise;
            stats[halqa].paid += r.paid;
            stats[halqa].count++;
        });

        return Object.entries(stats).map(([name, data]) => ({
            name,
            ...data,
            percent: data.promised > 0 ? Math.round((data.paid / data.promised) * 100) : 0
        })).sort((a, b) => b.percent - a.percent);
    }, [records]);

    const tanzeemStats = useMemo(() => {
        const stats: Record<string, { promised: number; paid: number; count: number }> = {};

        records.forEach(r => {
            let display = getTanzeemDisplayName(r.member.tanzeem);
            // Group child tanzeems into Daftar Atfal (Male/Female)
            if (['atfal', 'nasirat', 'saf-e-awal', 'saf-e-awal-girls'].includes(r.member.tanzeem || '')) {
                const gender = r.member.gender?.toLowerCase() || 'male';
                display = gender === 'female' ? getTanzeemDisplayName('dafar-atfal-female') : getTanzeemDisplayName('dafar-atfal-male');
            }
            if (!stats[display]) stats[display] = { promised: 0, paid: 0, count: 0 };
            stats[display].promised += r.promise;
            stats[display].paid += r.paid;
            stats[display].count++;
        });

        // Special records (often deceased/others)
        if (specialRecords.length > 0) {
            if (!stats['Special/Deceased']) stats['Special/Deceased'] = { promised: 0, paid: 0, count: 0 };
            specialRecords.forEach(sr => {
                stats['Special/Deceased'].promised += (sr.promiseAmount || 0) + (sr.nagarparAmount || 0);
                stats['Special/Deceased'].paid += (sr.paidAmount || 0);
                stats['Special/Deceased'].count++;
            });
        }

        return Object.entries(stats).map(([name, data]) => ({
            name,
            ...data,
            percent: data.promised > 0 ? Math.round((data.paid / data.promised) * 100) : 0
        })).sort((a, b) => b.percent - a.percent);
    }, [records, specialRecords]);

    const defaulters = useMemo(() => {
        const list = records
            .filter(r => r.promise > r.paid)
            .map(r => ({
                key: r.member.id,
                name: r.member.name,
                halqa: r.member.halqa,
                tanzeem: r.member.tanzeem,
                promised: r.promise,
                paid: r.paid,
                balance: r.promise - r.paid
            }))
            .sort((a, b) => b.balance - a.balance);

        // Also include special records that have balance
        specialRecords.forEach(sr => {
            const promised = (sr.promiseAmount || 0) + (sr.nagarparAmount || 0);
            if (promised > sr.paidAmount) {
                list.push({
                    key: sr.id,
                    name: `${sr.name} (Special)`,
                    halqa: 'N/A',
                    tanzeem: 'special' as any,
                    promised: promised,
                    paid: sr.paidAmount,
                    balance: promised - sr.paidAmount
                });
            }
        });

        return list;
    }, [records, specialRecords]);

    const transactionLogs = useMemo(() => {
        return allPayments.map(p => {
            // Find member or special record name
            let name = 'Unknown';
            const memberRecord = records.find(r => r.record?.id === p.waqfJadeedId);
            if (memberRecord) {
                name = memberRecord.member.name;
            } else {
                const special = specialRecords.find(sr => sr.id === p.waqfJadeedId);
                if (special) name = `${special.name} (Special)`;
            }

            return {
                Date: dayjs(p.date).format('DD MMM YYYY'),
                Member: name,
                'Book #': p.bookNo || 'N/A',
                'Receipt #': p.receiptNo || 'N/A',
                Amount: p.amount,
                key: p.id
            };
        }).sort((a, b) => dayjs(b.Date).unix() - dayjs(a.Date).unix());
    }, [allPayments, records, specialRecords]);

    const comparisonStats = useMemo(() => {
        const stats: Record<string, { currentPaid: number; prevPaid: number; currentPromise: number; prevPromise: number }> = {};

        // Current Year Halqa Stats
        records.forEach(r => {
            const halqa = r.member.halqa || 'No Halqa';
            if (!stats[halqa]) stats[halqa] = { currentPaid: 0, prevPaid: 0, currentPromise: 0, prevPromise: 0 };
            stats[halqa].currentPaid += r.paid;
            stats[halqa].currentPromise += r.promise;
        });
        specialRecords.forEach(sr => {
            const halqa = 'Special';
            if (!stats[halqa]) stats[halqa] = { currentPaid: 0, prevPaid: 0, currentPromise: 0, prevPromise: 0 };
            stats[halqa].currentPaid += sr.paidAmount || 0;
            stats[halqa].currentPromise += (sr.promiseAmount || 0) + (sr.nagarparAmount || 0);
        });

        // Previous Year Halqa Stats
        prevRecords.forEach(r => {
            // Find member to get their halqa
            const member = members.find(m => m.id === r.memberId);
            const halqa = member?.halqa || 'No Halqa';
            if (!stats[halqa]) stats[halqa] = { currentPaid: 0, prevPaid: 0, currentPromise: 0, prevPromise: 0 };
            stats[halqa].prevPaid += r.paidAmount || 0;
            stats[halqa].prevPromise += (r.promiseAmount || 0) + (r.nagarparAmount || 0);
        });
        prevSpecialRecords.forEach(sr => {
            const halqa = 'Special';
            if (!stats[halqa]) stats[halqa] = { currentPaid: 0, prevPaid: 0, currentPromise: 0, prevPromise: 0 };
            stats[halqa].prevPaid += sr.paidAmount || 0;
            stats[halqa].prevPromise += (sr.promiseAmount || 0) + (sr.nagarparAmount || 0);
        });

        return Object.entries(stats).map(([name, data]) => ({
            name,
            ...data,
            diff: data.currentPaid - data.prevPaid,
            percentChange: data.prevPaid > 0 ? ((data.currentPaid - data.prevPaid) / data.prevPaid) * 100 : 0
        })).sort((a, b) => b.diff - a.diff);
    }, [records, specialRecords, prevRecords, prevSpecialRecords, members]);


    const ansarReport = useMemo(() => {
        const ansarRecords = records
            .filter(r => r.member.tanzeem === 'ansar')
            .sort((a, b) =>
                (a.member.serialNo ?? Number.MAX_SAFE_INTEGER) - (b.member.serialNo ?? Number.MAX_SAFE_INTEGER)
            );

        const rows = ansarRecords.map((r, index) => ({
            key: r.member.id,
            no: r.member.serialNo ?? index + 1,
            name: r.member.name,
            fatherName: r.member.fatherName || '',
            halqa: r.member.halqa || 'No Halqa',
            promised: r.promise,
            paid: r.paid,
            balance: r.promise - r.paid
        }));

        const totals = rows.reduce(
            (acc, r) => {
                acc.promised += r.promised;
                acc.paid += r.paid;
                acc.balance += r.balance;
                return acc;
            },
            { promised: 0, paid: 0, balance: 0 }
        );

        return { rows, totals };
    }, [records]);

    const summaryReport = useMemo(() => {
        const totalPromised = records.reduce((s, r) => s + r.promise, 0)
            + specialRecords.reduce((s, sr) => s + (sr.promiseAmount || 0) + (sr.nagarparAmount || 0), 0);
        const totalPaid = records.reduce((s, r) => s + r.paid, 0)
            + specialRecords.reduce((s, sr) => s + (sr.paidAmount || 0), 0);
        const participants = records.filter(r => r.promise > 0 || r.paid > 0).length + specialRecords.length;

        const rows = [
            {
                key: 'overall',
                section: 'Overall',
                name: 'Total',
                count: participants,
                promised: totalPromised,
                paid: totalPaid,
                percent: totalPromised > 0 ? Math.round((totalPaid / totalPromised) * 100) : 0
            },
            ...tanzeemStats.map(t => ({
                key: `tanzeem-${t.name}`,
                section: 'Tanzeem',
                name: t.name,
                count: t.count,
                promised: t.promised,
                paid: t.paid,
                percent: t.percent
            })),
            ...halqaStats.map(h => ({
                key: `halqa-${h.name}`,
                section: 'Halqa',
                name: h.name,
                count: h.count,
                promised: h.promised,
                paid: h.paid,
                percent: h.percent
            }))
        ];

        return {
            rows,
            totalPromised,
            totalPaid,
            balance: totalPromised - totalPaid,
            participants,
            percent: totalPromised > 0 ? Math.round((totalPaid / totalPromised) * 100) : 0
        };
    }, [records, specialRecords, tanzeemStats, halqaStats]);

    const lajnaQuarterlyStats = useMemo(() => {
        const lajnaMembers = members.filter(m => m.tanzeem === 'lajna');
        const nasiratMembers = members.filter(m => m.tanzeem === 'nasirat');
        const bachganMembers = members.filter(m => m.tanzeem === 'saf-e-awal-girls');

        const femaleRecords = records.filter(r =>
            ['lajna', 'nasirat', 'saf-e-awal-girls'].includes(r.member.tanzeem || '')
        );
        const lajnaRecords = femaleRecords.filter(r => r.member.tanzeem === 'lajna');
        const childFemaleRecords = femaleRecords.filter(r =>
            ['nasirat', 'saf-e-awal-girls'].includes(r.member.tanzeem || '')
        );

        const safEAwal = femaleRecords.filter(r => r.promise > 0 && r.paid >= r.promise).length;
        const safEDoem = femaleRecords.filter(r => r.paid > 0 && r.paid < r.promise).length;
        const mujahidat = childFemaleRecords.filter(r => r.paid >= 1000).length;

        const totalPromise = femaleRecords.reduce((s, r) => s + r.promise, 0);
        const totalPaid = femaleRecords.reduce((s, r) => s + r.paid, 0);

        // "ممبرات جو مرحومین کی طرف سے چندہ ادا کرتی ہیں"
        // = deceased female special records (someone in the family paying on behalf of a deceased female)
        const deceasedFemale = specialRecords.filter(sr => sr.isDeceased && sr.gender === 'female').length;

        return {
            tajneedLajna: lajnaMembers.length,
            wjMembersLajna: lajnaRecords.filter(r => r.promise > 0 || r.paid > 0).length,
            bachgan: bachganMembers.length,
            nasirat: nasiratMembers.length,
            deceasedPayers: deceasedFemale,
            safEAwal,
            safEDoem,
            mujahidat,
            totalPromise,
            totalPaid,
            percent: totalPromise > 0 ? (totalPaid / totalPromise) * 100 : 0
        };
    }, [members, records, specialRecords]);

    const bookDetails = useMemo(() => {
        if (!selectedBook) return [];

        const data = [];
        // Generate receipts 1 to 100
        for (let i = 1; i <= 100; i++) {
            const receiptPrefix = i;
            const paymentsForReceipt = allPayments.filter(p =>
                p.bookNo?.toString() === selectedBook &&
                p.receiptNo?.toString() === receiptPrefix.toString()
            );

            if (paymentsForReceipt.length === 0) {
                data.push({
                    key: i,
                    receiptNo: i,
                    status: 'Pending',
                    name: 'N/A',
                    amount: 0,
                    date: 'N/A',
                    isMultiple: false
                });
                continue;
            }

            // Group multiple payments
            const names: string[] = [];
            let totalAmount = 0;
            const dates: string[] = [];

            paymentsForReceipt.forEach(payment => {
                totalAmount += payment.amount || 0;
                dates.push(dayjs(payment.date).format('DD MMM YYYY'));

                let memberName = 'Unknown';
                // Try finding in regular records first (using allRecords to bypass filters)
                const rawRecord = allRecords.find(r => r.id === payment.waqfJadeedId);
                if (rawRecord) {
                    const member = members.find(m => m.id === rawRecord.memberId);
                    if (member) {
                        memberName = member.name;
                    }
                } else {
                    // Try special records
                    const special = specialRecords.find(sr => sr.id === payment.waqfJadeedId);
                    if (special) memberName = `${special.name} (Special)`;
                }
                names.push(memberName);
            });

            data.push({
                key: i,
                receiptNo: i,
                status: 'Paid',
                name: names.join(', '),
                amount: totalAmount,
                date: [...new Set(dates)].join(', '),
                isMultiple: paymentsForReceipt.length > 1
            });
        }
        return data;
    }, [selectedBook, allPayments, records, specialRecords, allRecords, members]);

    const bookStats = useMemo(() => {
        const used = bookDetails.filter(d => d.status === 'Paid');
        const totalAmount = used.reduce((sum, d) => sum + d.amount, 0);
        return {
            count: used.length,
            totalAmount
        };
    }, [bookDetails]);

    const handleExportLajnaQuarterlyPDF = async () => {
        const s = lajnaQuarterlyStats;

        // Renders a value inside a dashed-underline blank, like a paper form
        const blank = (value: string | number, minW = '90px') =>
            `<span style="display:inline-block;min-width:${minW};border-bottom:2px dashed #000;text-align:center;font-weight:bold;font-size:19px;padding:0 12px;margin:0 6px;vertical-align:bottom;">${value}</span>`;

        // One full-width form row with optional right-side label prefix
        const row = (content: string) =>
            `<div style="display:flex;align-items:flex-end;border-bottom:1px dashed #bbb;padding:10px 0;min-height:48px;">
               <div style="flex:1;text-align:right;direction:rtl;">${content}</div>
             </div>`;

        const printDiv = document.createElement('div');
        printDiv.setAttribute('dir', 'rtl');
        printDiv.style.cssText = [
            'position:fixed', 'left:-9999px', 'top:0',
            'width:794px', 'background:#fff', 'color:#000',
            'font-family:"Noto Nastaliq Urdu","Noto Naskh Arabic","Amiri",Arial,sans-serif',
            'font-size:17px', 'line-height:1.8', 'padding:0'
        ].join(';');

        printDiv.innerHTML = `
        <div style="margin:30px 36px;border:1.5px solid #000;padding:0 28px 28px 28px;">

          <!-- top dashed separator matching the paper form -->
          <div style="border-bottom:2px dashed #000;margin-bottom:0;"></div>

          <!-- Title -->
          <div style="text-align:center;padding:18px 0 4px 0;">
            <span style="font-size:24px;font-weight:bold;letter-spacing:1px;">وقف جدید (سہ ماہی)</span>
          </div>

          <!-- Row 1: Tajneed Lajna -->
          ${row(`تجنید لجنہ اماءاللہ ${blank(s.tajneedLajna, '110px')}`)}

          <!-- Row 2: WJ Members + Bachgan + Nasirat -->
          ${row(`وقف جدید میں شامل ممبرات ${blank(s.wjMembersLajna, '100px')} &nbsp; بچگان ${blank(s.bachgan, '80px')} &nbsp; ناصرات ${blank(s.nasirat, '80px')}`)}

          <!-- Row 3: Marhoomeen -->
          ${row(`تعداد ممبرات جو مرحومین کی طرف سے چندہ ادا کرتی ہیں ${blank(s.deceasedPayers, '100px')}`)}

          <!-- Row 4: Saf-e-Awal + Saf-e-Doem -->
          ${row(`تعداد صف اول ${blank(s.safEAwal, '90px')} &nbsp;&nbsp;&nbsp;&nbsp; تعداد صف دوم ${blank(s.safEDoem, '90px')}`)}

          <!-- Row 5: Mujahidat -->
          ${row(`نفقہ مجاہدین اور مجاہدات کی تعداد (1000 روپے یا اس سے زائد ادا کرنے والے بچے) ${blank(s.mujahidat, '100px')}`)}

          <!-- Row 6: Events + Converted -->
          ${row(`ہفتہ، یوم، عشرہ وقف جدید ${blank(lajnaEvents, '80px')} &nbsp;&nbsp; نادہند کو ہند بنایا ${blank(lajnaConverted, '80px')}`)}

          <!-- Row 7: Visits + Other efforts -->
          ${row(`تعداد دورہ جات ${blank(lajnaVisits, '80px')} &nbsp;&nbsp; دیگر مساعی ${blank(lajnaOtherEfforts || '___', '220px')}`)}

          <!-- Row 8: Financial summary -->
          ${row(`وعدہ ${blank(`Rs. ${s.totalPromise.toLocaleString()}`, '160px')} &nbsp;&nbsp; وصولی ${blank(`Rs. ${s.totalPaid.toLocaleString()}`, '160px')} &nbsp;&nbsp; فیصد ${blank(s.percent.toFixed(1) + '%', '80px')}`)}

          <!-- Footer -->
          <div style="text-align:left;margin-top:18px;font-size:12px;color:#666;direction:ltr;">
            Generated: ${dayjs().format('DD/MM/YYYY')} &nbsp;|&nbsp; Year: ${selectedYear}
          </div>
        </div>`;

        document.body.appendChild(printDiv);
        try {
            const canvas = await html2canvas(printDiv, { scale: 2, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageW = pdf.internal.pageSize.getWidth();
            const imgH = (canvas.height * pageW) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pageW, imgH);
            pdf.save(`Lajna_WJ_Quarterly_${selectedYear}.pdf`);
            message.success('Lajna Quarterly Report generated');
        } catch (err) {
            console.error(err);
            message.error('Failed to generate PDF');
        } finally {
            document.body.removeChild(printDiv);
        }
    };

    // --- Export Functions ---

    const exportReport = (data: any[], filename: string) => {
        exportToCSV(data, `${filename}_${selectedYear}.csv`);
    };

    const handleExportHalqaPDF = async () => {
        const rows = halqaStats.map(r => ({
            halqa: r.name,
            members: r.count,
            promised: r.promised,
            paid: r.paid,
            progress: `${r.percent}%`
        }));
        await exportToPDF(
            rows,
            ['halqa', 'members', 'promised', 'paid', 'progress'],
            `halqa_performance_${selectedYear}`,
            `Waqf-e-Jadeed - Halqa Performance - ${selectedYear}`
        );
        message.success('Halqa PDF exported');
    };

    const handleExportTanzeemSummaryPDF = async () => {
        const rows = tanzeemStats.map(r => ({
            tanzeem: r.name,
            members: r.count,
            promised: r.promised,
            paid: r.paid,
            progress: `${r.percent}%`
        }));
        await exportToPDF(
            rows,
            ['tanzeem', 'members', 'promised', 'paid', 'progress'],
            `tanzeem_summary_${selectedYear}`,
            `Waqf-e-Jadeed - Tanzeem Summary - ${selectedYear}`
        );
        message.success('Tanzeem PDF exported');
    };

    const handleExportAnsarPDF = async () => {
        const rows: Array<Record<string, unknown>> = ansarReport.rows.map(r => ({
            no: r.no,
            name: r.name,
            fatherName: r.fatherName,
            halqa: r.halqa,
            promised: r.promised,
            paid: r.paid,
            balance: r.balance
        }));
        if (rows.length > 0) {
            rows.push({
                no: '',
                name: 'Total',
                fatherName: '',
                halqa: '',
                promised: ansarReport.totals.promised,
                paid: ansarReport.totals.paid,
                balance: ansarReport.totals.balance
            });
        }
        await exportToPDF(
            rows,
            ['no', 'name', 'fatherName', 'halqa', 'promised', 'paid', 'balance'],
            `ansar_report_${selectedYear}`,
            `Waqf-e-Jadeed - Ansar Report - ${selectedYear}`,
            { headerLabels: { no: 'No', name: 'Name', fatherName: 'Father Name', halqa: 'Halqa', promised: 'Promised', paid: 'Paid', balance: 'Balance' } }
        );
        message.success('Ansar Report PDF exported');
    };

    const handleExportAnsarSummaryPDF = async () => {
        const totalCount = ansarReport.rows.length;
        const { promised, paid, balance } = ansarReport.totals;

        const halqaMap: Record<string, { count: number; promised: number; paid: number }> = {};
        ansarReport.rows.forEach(r => {
            if (!halqaMap[r.halqa]) halqaMap[r.halqa] = { count: 0, promised: 0, paid: 0 };
            halqaMap[r.halqa].count++;
            halqaMap[r.halqa].promised += r.promised;
            halqaMap[r.halqa].paid += r.paid;
        });

        const rows: Array<Record<string, unknown>> = [
            { item: 'Total Ansar Members', count: totalCount, promised, paid, balance, progress: promised > 0 ? `${Math.round((paid / promised) * 100)}%` : '0%' },
            ...Object.entries(halqaMap).map(([name, d]) => ({
                item: name,
                count: d.count,
                promised: d.promised,
                paid: d.paid,
                balance: d.promised - d.paid,
                progress: d.promised > 0 ? `${Math.round((d.paid / d.promised) * 100)}%` : '0%'
            }))
        ];

        await exportToPDF(
            rows,
            ['item', 'count', 'promised', 'paid', 'balance', 'progress'],
            `ansar_summary_${selectedYear}`,
            `Waqf-e-Jadeed - Ansar Summary - ${selectedYear}`,
            { headerLabels: { item: '', count: 'Members', promised: 'Promised', paid: 'Paid', balance: 'Balance', progress: 'Progress' } }
        );
        message.success('Ansar Summary PDF exported');
    };

    const handleExportSummaryPDF = async () => {
        const rows: Array<Record<string, unknown>> = summaryReport.rows.map(r => ({
            section: r.section,
            name: r.name,
            members: r.count,
            promised: r.promised,
            paid: r.paid,
            balance: r.promised - r.paid,
            progress: `${r.percent}%`
        }));
        await exportToPDF(
            rows,
            ['section', 'name', 'members', 'promised', 'paid', 'balance', 'progress'],
            `summary_report_${selectedYear}`,
            `Waqf-e-Jadeed - Summary Report - ${selectedYear}`
        );
        message.success('Summary PDF exported');
    };

    const handleExportDefaultersPDF = async () => {
        const rows = defaulters.map(r => ({
            name: r.name,
            halqa: r.halqa,
            tanzeem: getTanzeemDisplayName(r.tanzeem),
            promised: r.promised,
            paid: r.paid,
            balance: r.balance
        }));
        await exportToPDF(
            rows,
            ['name', 'halqa', 'tanzeem', 'promised', 'paid', 'balance'],
            `defaulters_list_${selectedYear}`,
            `Waqf-e-Jadeed - Defaulters List - ${selectedYear}`
        );
        message.success('Defaulters PDF exported');
    };

    const handleExportComparisonPDF = async () => {
        const rows = comparisonStats.map(r => ({
            halqa: r.name,
            [`paid_${selectedYear - 1}`]: r.prevPaid,
            [`paid_${selectedYear}`]: r.currentPaid,
            diff: r.diff,
            growth: `${r.percentChange.toFixed(1)}%`
        }));
        await exportToPDF(
            rows,
            ['halqa', `paid_${selectedYear - 1}`, `paid_${selectedYear}`, 'diff', 'growth'],
            `year_comparison_${selectedYear}`,
            `Waqf-e-Jadeed - Year Comparison - ${selectedYear}`
        );
        message.success('Comparison PDF exported');
    };

    const handleExportTransactionsPDF = async () => {
        const rows = transactionLogs.map(r => ({
            date: r.Date,
            member: r.Member,
            book: r['Book #'],
            receipt: r['Receipt #'],
            amount: r.Amount
        }));
        await exportToPDF(
            rows,
            ['date', 'member', 'book', 'receipt', 'amount'],
            `transaction_log_${selectedYear}`,
            `Waqf-e-Jadeed - Transaction Log - ${selectedYear}`
        );
        message.success('Transactions PDF exported');
    };

    const handleExportReceiptBookPDF = async () => {
        if (!selectedBook) return;
        const rows = bookDetails.map(r => ({
            receipt: r.receiptNo,
            status: r.status,
            name: r.name,
            amount: r.amount,
            date: r.date
        }));
        await exportToPDF(
            rows,
            ['receipt', 'status', 'name', 'amount', 'date'],
            `receipt_book_${selectedBook}_${selectedYear}`,
            `Waqf-e-Jadeed - Receipt Book ${selectedBook} - ${selectedYear}`
        );
        message.success('Receipt Book PDF exported');
    };

    // --- Columns Definitions ---

    const receiptBookColumns = [
        { title: 'Receipt #', dataIndex: 'receiptNo', key: 'receiptNo', width: 100 },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'Paid' ? 'success' : 'warning'}>{status}</Tag>
            )
        },
        {
            title: 'Member Name',
            dataIndex: 'name',
            key: 'name',
            render: (name: string, record: any) => (
                <Space>
                    {name}
                    {record?.isMultiple && <Tag color="blue">Multiple</Tag>}
                </Space>
            )
        },
        { title: 'Amount', dataIndex: 'amount', key: 'amount', render: (val: number) => val > 0 ? `Rs. ${val.toLocaleString()}` : '-', align: 'right' as const },
        { title: 'Date', dataIndex: 'date', key: 'date' }
    ];


    const summaryColumns = [
        { title: 'Name', dataIndex: 'name', key: 'name', width: 200 },
        { title: 'Members', dataIndex: 'count', key: 'count', align: 'center' as const },
        { title: 'Promised', dataIndex: 'promised', key: 'promised', render: (val: number) => `Rs. ${val.toLocaleString()}`, align: 'right' as const },
        { title: 'Paid', dataIndex: 'paid', key: 'paid', render: (val: number) => `Rs. ${val.toLocaleString()}`, align: 'right' as const },
        {
            title: 'Progress',
            key: 'percent',
            render: (_: any, r: any) => (
                <Space direction="vertical" style={{ width: '100%' }}>
                    <Progress percent={r.percent} size="small" strokeColor={r.percent >= 100 ? '#52c41a' : '#1890ff'} />
                    <Text type="secondary" style={{ fontSize: 11 }}>{r.percent}% completed</Text>
                </Space>
            ),
            width: 200
        }
    ];

    const ansarColumns = [
        { title: 'No', dataIndex: 'no', key: 'no', width: 70 },
        { title: 'Name', dataIndex: 'name', key: 'name', sorter: (a: any, b: any) => (a.name || '').localeCompare(b.name || '') },
        { title: 'Father Name', dataIndex: 'fatherName', key: 'fatherName' },
        { title: 'Halqa', dataIndex: 'halqa', key: 'halqa' },
        { title: 'Promised', dataIndex: 'promised', key: 'promised', render: (val: number) => `Rs. ${val.toLocaleString()}`, align: 'right' as const, sorter: (a: any, b: any) => a.promised - b.promised },
        { title: 'Paid', dataIndex: 'paid', key: 'paid', render: (val: number) => <Text strong style={{ color: '#52c41a' }}>Rs. {val.toLocaleString()}</Text>, align: 'right' as const, sorter: (a: any, b: any) => a.paid - b.paid },
        {
            title: 'Balance',
            dataIndex: 'balance',
            key: 'balance',
            render: (val: number) => <Tag color={val <= 0 ? 'success' : 'error'}>Rs. {val.toLocaleString()}</Tag>,
            align: 'right' as const,
            sorter: (a: any, b: any) => a.balance - b.balance
        }
    ];

    const summaryReportColumns = [
        { title: 'Section', dataIndex: 'section', key: 'section', width: 110, render: (val: string) => <Tag color={val === 'Overall' ? 'blue' : val === 'Tanzeem' ? 'purple' : 'cyan'}>{val}</Tag> },
        { title: 'Name', dataIndex: 'name', key: 'name' },
        { title: 'Members', dataIndex: 'count', key: 'count', align: 'center' as const },
        { title: 'Promised', dataIndex: 'promised', key: 'promised', render: (val: number) => `Rs. ${val.toLocaleString()}`, align: 'right' as const },
        { title: 'Paid', dataIndex: 'paid', key: 'paid', render: (val: number) => `Rs. ${val.toLocaleString()}`, align: 'right' as const },
        {
            title: 'Progress',
            dataIndex: 'percent',
            key: 'percent',
            render: (val: number) => <Progress percent={val} size="small" strokeColor={val >= 100 ? '#52c41a' : '#1890ff'} />,
            width: 160
        }
    ];

    const defaulterColumns = [
        { title: 'Member Name', dataIndex: 'name', key: 'name' },
        { title: 'Halqa', dataIndex: 'halqa', key: 'halqa' },
        { title: 'Tanzeem', dataIndex: 'tanzeem', key: 'tanzeem', render: (t: any) => t === 'special' ? <Tag>Special</Tag> : <Tag color="blue">{getTanzeemDisplayName(t)}</Tag> },
        { title: 'Balance Due', dataIndex: 'balance', key: 'balance', render: (val: number) => <Text strong type="danger">Rs. {val.toLocaleString()}</Text>, align: 'right' as const, sorter: (a: any, b: any) => a.balance - b.balance }
    ];

    const transactionColumns = [
        { title: 'Date', dataIndex: 'Date', key: 'Date' },
        { title: 'Member', dataIndex: 'Member', key: 'Member' },
        { title: 'Book #', dataIndex: 'Book #', key: 'Book #', width: 100 },
        { title: 'Receipt #', dataIndex: 'Receipt #', key: 'Receipt #', width: 100 },
        { title: 'Amount', dataIndex: 'Amount', key: 'Amount', render: (val: number) => <Text strong style={{ color: '#52c41a' }}>Rs. {val.toLocaleString()}</Text>, align: 'right' as const }
    ];

    const comparisonColumns = [
        { title: 'Halqa', dataIndex: 'name', key: 'name' },
        { title: `${selectedYear - 1} Paid`, dataIndex: 'prevPaid', key: 'prevPaid', render: (val: number) => `Rs. ${val.toLocaleString()}`, align: 'right' as const },
        { title: `${selectedYear} Paid`, dataIndex: 'currentPaid', key: 'currentPaid', render: (val: number) => <Text strong>Rs. {val.toLocaleString()}</Text>, align: 'right' as const },
        {
            title: 'Difference',
            dataIndex: 'diff',
            key: 'diff',
            render: (val: number) => (
                <Text strong style={{ color: val >= 0 ? '#52c41a' : '#cf1322' }}>
                    {val >= 0 ? '+' : ''}{val.toLocaleString()}
                </Text>
            ),
            align: 'right' as const
        },
        {
            title: '% Growth',
            dataIndex: 'percentChange',
            key: 'percentChange',
            render: (val: number) => (
                <Tag color={val >= 0 ? 'success' : 'error'}>
                    {val >= 0 ? '+' : ''}{val.toFixed(1)}%
                </Tag>
            ),
            align: 'center' as const
        }
    ];

    const fitranaData = useMemo(() => {
        const familyRows = families
            .filter(f => !f.isMoved)
            .map((family, index) => {
                const override = fitranaOverrides[family.id];
                const fitrana = override?.fitrana ?? family.fitrana ?? 0;
                const eidFund = override?.eidFund ?? family.eidFund ?? 0;
                const sadqa = override?.sadqa ?? family.sadqa ?? 0;
                return {
                    key: family.id,
                    no: index + 1,
                    familyName: family.familyName,
                    fitrana,
                    eidFund,
                    sadqa
                };
            });

        const extraRows = fitranaExtraRows.map((row, idx) => ({
            key: row.id,
            no: '',
            familyName: row.familyName || `Extra ${idx + 1}`,
            fitrana: row.fitrana || 0,
            eidFund: row.eidFund || 0,
            sadqa: row.sadqa || 0
        }));

        const rows = [...familyRows, ...extraRows];

        const totals = rows.reduce(
            (acc, row) => {
                acc.fitrana += row.fitrana;
                acc.eidFund += row.eidFund;
                acc.sadqa += row.sadqa;
                return acc;
            },
            { fitrana: 0, eidFund: 0, sadqa: 0 }
        );

        return { rows, totals };
    }, [families, fitranaOverrides, fitranaExtraRows]);

    const handleFitranaFieldChange = async (familyId: string, field: 'fitrana' | 'eidFund' | 'sadqa', value: number | null) => {
        const amount = value ?? 0;

        setFitranaOverrides(prev => {
            const existing = prev[familyId] || {};
            const family = families.find(f => f.id === familyId);
            return {
                ...prev,
                [familyId]: {
                    fitrana: field === 'fitrana' ? amount : existing.fitrana ?? family?.fitrana ?? 0,
                    eidFund: field === 'eidFund' ? amount : existing.eidFund ?? family?.eidFund ?? 0,
                    sadqa: field === 'sadqa' ? amount : existing.sadqa ?? family?.sadqa ?? 0
                }
            };
        });

        try {
            await ApiService.updateFamily(familyId, {
                [field]: amount,
                updatedAt: new Date().toISOString()
            });
            message.success('Saved');
        } catch (error) {
            console.error('Failed to update family fitrana data', error);
            message.error('Failed to save');
        }
    };

    const handleExportFitranaPDF = async () => {
        try {
            let rows = [...fitranaData.rows];

            if (fitranaSort.field && fitranaSort.order) {
                const field = fitranaSort.field;
                const order = fitranaSort.order;
                rows.sort((a: any, b: any) => {
                    const av = a[field];
                    const bv = b[field];

                    let cmp: number;
                    if (typeof av === 'string' && typeof bv === 'string') {
                        cmp = av.localeCompare(bv, undefined, { numeric: true });
                    } else {
                        cmp = (av || 0) - (bv || 0);
                    }
                    return order === 'ascend' ? cmp : -cmp;
                });
            }

            rows = rows.map(r => ({
                no: r.no,
                familyName: r.familyName,
                fitrana: r.fitrana || 0,
                eidFund: r.eidFund || 0,
                sadqa: r.sadqa || 0
            }));

            if (rows.length > 0) {
                rows.push({
                    no: '',
                    familyName: 'Total',
                    fitrana: fitranaData.totals.fitrana,
                    eidFund: fitranaData.totals.eidFund,
                    sadqa: fitranaData.totals.sadqa
                } as any);
            }

            await exportToPDF(
                rows,
                ['no', 'familyName', 'fitrana', 'eidFund', 'sadqa'],
                `fitrana_family_${selectedYear}`,
                `Fitrana / Eid Fund / Sadqa - ${selectedYear}`,
                { fontSize: 8 }
            );
            message.success('Fitrana PDF exported');
        } catch (error) {
            console.error('Failed to export fitrana PDF', error);
            message.error('Failed to export PDF');
        }
    };

    const handleExtraFieldChange = (
        id: string,
        field: 'familyName' | 'fitrana' | 'eidFund' | 'sadqa',
        value: string | number | null
    ) => {
        setFitranaExtraRows(prev =>
            prev.map(row =>
                row.id === id
                    ? {
                          ...row,
                          [field]:
                              field === 'familyName'
                                  ? String(value ?? '')
                                  : Number(value) || 0
                      }
                    : row
            )
        );

        const updateData: Partial<FitranaExtra> =
            field === 'familyName'
                ? { familyName: String(value ?? '') }
                : { [field]: Number(value) || 0 } as any;

        ApiService.updateFitranaExtra(id, updateData).catch(error => {
            console.error('Failed to update Fitrana extra row', error);
            message.error('Failed to save extra row');
        });
    };

    const addExtraRow = async () => {
        try {
            const extra = await ApiService.createFitranaExtra({ year: selectedYear });
            setFitranaExtraRows(prev => [...prev, extra]);
            message.success('Extra row added');
        } catch (error) {
            console.error('Failed to add Fitrana extra row', error);
            message.error('Failed to add extra row');
        }
    };

    const fitranaColumns = [
        { title: 'No', dataIndex: 'no', key: 'no', width: 70 },
        {
            title: 'Family Name',
            dataIndex: 'familyName',
            key: 'familyName',
            sorter: (a: any, b: any) => (a.familyName || '').localeCompare(b.familyName || ''),
            render: (text: string, record: any) => {
                const isExtra = typeof record.key === 'string' && record.key.startsWith('extra-');
                if (!isExtra) return text;
                return (
                    <Input
                        value={text || ''}
                        onChange={e => handleExtraFieldChange(record.key, 'familyName', e.target.value)}
                    />
                );
            }
        },
        {
            title: 'Fitrana',
            dataIndex: 'fitrana',
            key: 'fitrana',
            align: 'right' as const,
            sorter: (a: any, b: any) => (a.fitrana || 0) - (b.fitrana || 0),
            render: (val: number, record: any) => (
                <InputNumber
                    min={0}
                    value={val || undefined}
                    onChange={v => {
                        const isExtra = typeof record.key === 'string' && record.key.startsWith('extra-');
                        if (isExtra) {
                            handleExtraFieldChange(record.key, 'fitrana', v ?? 0);
                        } else {
                            handleFitranaFieldChange(record.key, 'fitrana', v);
                        }
                    }}
                    style={{ width: '100%' }}
                />
            )
        },
        {
            title: 'Eid Fund',
            dataIndex: 'eidFund',
            key: 'eidFund',
            align: 'right' as const,
            sorter: (a: any, b: any) => (a.eidFund || 0) - (b.eidFund || 0),
            render: (val: number, record: any) => (
                <InputNumber
                    min={0}
                    value={val || undefined}
                    onChange={v => {
                        const isExtra = typeof record.key === 'string' && record.key.startsWith('extra-');
                        if (isExtra) {
                            handleExtraFieldChange(record.key, 'eidFund', v ?? 0);
                        } else {
                            handleFitranaFieldChange(record.key, 'eidFund', v);
                        }
                    }}
                    style={{ width: '100%' }}
                />
            )
        },
        {
            title: 'Sadqa',
            dataIndex: 'sadqa',
            key: 'sadqa',
            align: 'right' as const,
            sorter: (a: any, b: any) => (a.sadqa || 0) - (b.sadqa || 0),
            render: (val: number, record: any) => (
                <InputNumber
                    min={0}
                    value={val || undefined}
                    onChange={v => {
                        const isExtra = typeof record.key === 'string' && record.key.startsWith('extra-');
                        if (isExtra) {
                            handleExtraFieldChange(record.key, 'sadqa', v ?? 0);
                        } else {
                            handleFitranaFieldChange(record.key, 'sadqa', v);
                        }
                    }}
                    style={{ width: '100%' }}
                />
            )
        }
    ];

    return (
        <Card className="waqf-reports-container">
            <Tabs
                activeKey={activeReport}
                onChange={setActiveReport}
                type="line"
                items={[
                    {
                        key: 'receipt_books',
                        label: <span><BookOutlined /> Receipt Books</span>,
                        children: (
                            <div>
                                <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                                    <Space size="large">
                                        <Title level={5} style={{ margin: 0 }}>Receipt Book Status (1-100)</Title>
                                        <Select
                                            placeholder="Select Book #"
                                            style={{ width: 150 }}
                                            value={selectedBook}
                                            onChange={setSelectedBook}
                                            options={uniqueBooks.map(b => ({ label: `Book ${b}`, value: b }))}
                                        />
                                    </Space>
                                    <Space>
                                        <Button
                                            icon={<DownloadOutlined />}
                                            disabled={!selectedBook}
                                            onClick={() => exportReport(bookDetails, `receipt_book_${selectedBook}`)}
                                        >
                                            Export CSV
                                        </Button>
                                        <Button
                                            icon={<FilePdfOutlined />}
                                            disabled={!selectedBook}
                                            onClick={handleExportReceiptBookPDF}
                                        >
                                            Export PDF
                                        </Button>
                                    </Space>
                                </Row>
                                <Row gutter={16} style={{ marginBottom: 16 }}>
                                    <Col xs={24} sm={12}>
                                        <Card size="small">
                                            <Statistic
                                                title="Total Amount Collected"
                                                value={bookStats.totalAmount}
                                                precision={0}
                                                prefix="Rs."
                                                valueStyle={{ color: '#3f8600' }}
                                            />
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={12}>
                                        <Card size="small">
                                            <Statistic
                                                title="Receipts Used"
                                                value={bookStats.count}
                                                suffix="/ 100"
                                            />
                                        </Card>
                                    </Col>
                                </Row>
                                <Table
                                    dataSource={bookDetails}
                                    columns={receiptBookColumns}
                                    pagination={false}
                                    rowKey="receiptNo"
                                    scroll={{ y: 500, x: 600 }}
                                />
                            </div>
                        )
                    },
                    {
                        key: 'halqa',
                        label: <span><PieChartOutlined /> Halqa Performance</span>,
                        children: (
                            <div>
                                <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                                    <Title level={5} style={{ margin: 0 }}>Halqa Collection Summary</Title>
                                    <Space>
                                        <Button icon={<DownloadOutlined />} onClick={() => exportReport(halqaStats, 'halqa_report')}>Export CSV</Button>
                                        <Button icon={<FilePdfOutlined />} onClick={handleExportHalqaPDF}>Export PDF</Button>
                                    </Space>
                                </Row>
                                <Table
                                    dataSource={halqaStats}
                                    columns={summaryColumns}
                                    pagination={false}
                                    rowKey="name"
                                    scroll={{ x: 600 }}
                                />
                            </div>
                        )
                    },
                    {
                        key: 'tanzeem',
                        label: <span><FilterOutlined /> Tanzeem Wise</span>,
                        children: (
                            <div>
                                <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                                    <Title level={5} style={{ margin: 0 }}>Tanzeem Wise Breakdown</Title>
                                    <Space>
                                        <Button icon={<DownloadOutlined />} onClick={() => exportReport(tanzeemStats, 'tanzeem_report')}>Export CSV</Button>
                                        <Button icon={<FilePdfOutlined />} onClick={handleExportTanzeemSummaryPDF}>Export PDF</Button>
                                    </Space>
                                </Row>
                                <Table
                                    dataSource={tanzeemStats}
                                    columns={summaryColumns}
                                    pagination={false}
                                    rowKey="name"
                                    scroll={{ x: 600 }}
                                />
                            </div>
                        )
                    },
                    {
                        key: 'ansar',
                        label: <span><TeamOutlined /> Ansar Report</span>,
                        children: (
                            <div>
                                <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                                    <Title level={5} style={{ margin: 0 }}>Ansar Waqf-e-Jadeed Report</Title>
                                    <Space>
                                        <Button icon={<DownloadOutlined />} onClick={() => exportReport(ansarReport.rows, 'ansar_report')}>Export CSV</Button>
                                        <Button icon={<FilePdfOutlined />} onClick={handleExportAnsarPDF}>Export PDF</Button>
                                        <Button icon={<FilePdfOutlined />} type="primary" onClick={handleExportAnsarSummaryPDF}>Export Summary PDF</Button>
                                    </Space>
                                </Row>
                                <Row gutter={16} style={{ marginBottom: 16 }}>
                                    <Col xs={12} sm={6}>
                                        <Card size="small">
                                            <Statistic title="Total Ansar" value={ansarReport.rows.length} />
                                        </Card>
                                    </Col>
                                    <Col xs={12} sm={6}>
                                        <Card size="small">
                                            <Statistic title="Promised" value={ansarReport.totals.promised} prefix="Rs." valueStyle={{ color: '#1890ff' }} />
                                        </Card>
                                    </Col>
                                    <Col xs={12} sm={6}>
                                        <Card size="small">
                                            <Statistic title="Paid" value={ansarReport.totals.paid} prefix="Rs." valueStyle={{ color: '#3f8600' }} />
                                        </Card>
                                    </Col>
                                    <Col xs={12} sm={6}>
                                        <Card size="small">
                                            <Statistic title="Balance" value={ansarReport.totals.balance} prefix="Rs." valueStyle={{ color: '#cf1322' }} />
                                        </Card>
                                    </Col>
                                </Row>
                                <Table
                                    dataSource={ansarReport.rows}
                                    columns={ansarColumns}
                                    pagination={{ pageSize: 15 }}
                                    rowKey="key"
                                    scroll={{ x: 700 }}
                                    summary={() => (
                                        <Table.Summary.Row>
                                            <Table.Summary.Cell index={0} colSpan={4}>
                                                <Text strong>Total</Text>
                                            </Table.Summary.Cell>
                                            <Table.Summary.Cell index={4} align="right">
                                                <Text strong>Rs. {ansarReport.totals.promised.toLocaleString()}</Text>
                                            </Table.Summary.Cell>
                                            <Table.Summary.Cell index={5} align="right">
                                                <Text strong style={{ color: '#52c41a' }}>Rs. {ansarReport.totals.paid.toLocaleString()}</Text>
                                            </Table.Summary.Cell>
                                            <Table.Summary.Cell index={6} align="right">
                                                <Text strong type="danger">Rs. {ansarReport.totals.balance.toLocaleString()}</Text>
                                            </Table.Summary.Cell>
                                        </Table.Summary.Row>
                                    )}
                                />
                            </div>
                        )
                    },
                    {
                        key: 'summary',
                        label: <span><BarChartOutlined /> Summary</span>,
                        children: (
                            <div>
                                <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                                    <Title level={5} style={{ margin: 0 }}>Collection Summary (No Member Detail)</Title>
                                    <Space>
                                        <Button icon={<DownloadOutlined />} onClick={() => exportReport(summaryReport.rows, 'summary_report')}>Export CSV</Button>
                                        <Button icon={<FilePdfOutlined />} onClick={handleExportSummaryPDF}>Export PDF</Button>
                                    </Space>
                                </Row>
                                <Row gutter={16} style={{ marginBottom: 16 }}>
                                    <Col xs={12} sm={6}>
                                        <Card size="small">
                                            <Statistic title="Participants" value={summaryReport.participants} />
                                        </Card>
                                    </Col>
                                    <Col xs={12} sm={6}>
                                        <Card size="small">
                                            <Statistic title="Total Promised" value={summaryReport.totalPromised} prefix="Rs." valueStyle={{ color: '#1890ff' }} />
                                        </Card>
                                    </Col>
                                    <Col xs={12} sm={6}>
                                        <Card size="small">
                                            <Statistic title="Total Paid" value={summaryReport.totalPaid} prefix="Rs." valueStyle={{ color: '#3f8600' }} />
                                        </Card>
                                    </Col>
                                    <Col xs={12} sm={6}>
                                        <Card size="small">
                                            <Statistic title="Balance" value={summaryReport.balance} prefix="Rs." valueStyle={{ color: '#cf1322' }} />
                                        </Card>
                                    </Col>
                                </Row>
                                <Table
                                    dataSource={summaryReport.rows}
                                    columns={summaryReportColumns}
                                    pagination={false}
                                    rowKey="key"
                                    scroll={{ x: 700 }}
                                />
                            </div>
                        )
                    },
                    {
                        key: 'defaulters',
                        label: <span><UserOutlined /> Defaulters List</span>,
                        children: (
                            <div>
                                <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                                    <Title level={5} style={{ margin: 0 }}>Pending Collections (Defaulters)</Title>
                                    <Space>
                                        <Button icon={<DownloadOutlined />} onClick={() => exportReport(defaulters, 'defaulters_list')}>Export CSV</Button>
                                        <Button icon={<FilePdfOutlined />} onClick={handleExportDefaultersPDF}>Export PDF</Button>
                                    </Space>
                                </Row>
                                <Table
                                    dataSource={defaulters}
                                    columns={defaulterColumns}
                                    pagination={{ pageSize: 15 }}
                                    scroll={{ x: 600 }}
                                />
                            </div>
                        )
                    },
                    {
                        key: 'transactions',
                        label: <span><HistoryOutlined /> Transaction Log</span>,
                        children: (
                            <div>
                                <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                                    <Title level={5} style={{ margin: 0 }}>Recent Payments Log</Title>
                                    <Space>
                                        <Button icon={<DownloadOutlined />} onClick={() => exportReport(transactionLogs, 'transaction_log')}>Export CSV</Button>
                                        <Button icon={<FilePdfOutlined />} onClick={handleExportTransactionsPDF}>Export PDF</Button>
                                    </Space>
                                </Row>
                                <Table
                                    dataSource={transactionLogs}
                                    columns={transactionColumns}
                                    pagination={{ pageSize: 15 }}
                                    scroll={{ x: 600 }}
                                />
                            </div>
                        )
                    },
                    {
                        key: 'comparison',
                        label: <span><LineChartOutlined /> Year Comparison</span>,
                        children: (
                            <div>
                                <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                                    <Title level={5} style={{ margin: 0 }}>Year over Year {selectedYear - 1} vs {selectedYear}</Title>
                                    <Space>
                                        <Button icon={<DownloadOutlined />} onClick={() => exportReport(comparisonStats, 'year_comparison')}>Export CSV</Button>
                                        <Button icon={<FilePdfOutlined />} onClick={handleExportComparisonPDF}>Export PDF</Button>
                                    </Space>
                                </Row>
                                <Table
                                    dataSource={comparisonStats}
                                    columns={comparisonColumns}
                                    pagination={false}
                                    rowKey="name"
                                    scroll={{ x: 600 }}
                                />
                            </div>
                        )
                    },
                    {
                        key: 'fitrana',
                        label: <span><DollarOutlined /> Fitrana</span>,
                        children: (
                            <div>
                                <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                                    <Title level={5} style={{ margin: 0 }}>Fitrana / Eid Fund / Sadqa (Family Wise)</Title>
                                    <Space>
                                        <Button onClick={resetFitranaSort}>Reset Sort</Button>
                                        <Button onClick={addExtraRow}>Add Extra Row</Button>
                                        <Button
                                            icon={<DownloadOutlined />}
                                            onClick={handleExportFitranaPDF}
                                            disabled={fitranaData.rows.length === 0}
                                        >
                                            Export PDF
                                        </Button>
                                    </Space>
                                </Row>
                                <Row gutter={16} style={{ marginBottom: 16 }}>
                                    <Col xs={24} sm={8}>
                                        <Card size="small">
                                            <Statistic
                                                title="Total Fitrana"
                                                value={fitranaData.totals.fitrana}
                                                precision={0}
                                            />
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={8}>
                                        <Card size="small">
                                            <Statistic
                                                title="Total Eid Fund"
                                                value={fitranaData.totals.eidFund}
                                                precision={0}
                                            />
                                        </Card>
                                    </Col>
                                    <Col xs={24} sm={8}>
                                        <Card size="small">
                                            <Statistic
                                                title="Total Sadqa"
                                                value={fitranaData.totals.sadqa}
                                                precision={0}
                                            />
                                        </Card>
                                    </Col>
                                </Row>
                                <Table
                                    key={fitranaTableKey}
                                    dataSource={fitranaData.rows}
                                    columns={fitranaColumns}
                                    pagination={false}
                                    rowKey="key"
                                    onChange={(_, __, sorter: any) => {
                                        if (!sorter || Array.isArray(sorter)) {
                                            setFitranaSort({ field: null, order: null });
                                            return;
                                        }
                                        const field = sorter.field as any;
                                        const order = sorter.order as any;
                                        if (
                                            (field === 'fitrana' ||
                                                field === 'eidFund' ||
                                                field === 'sadqa' ||
                                                field === 'no' ||
                                                field === 'familyName') &&
                                            (order === 'ascend' || order === 'descend')
                                        ) {
                                            setFitranaSort({ field, order });
                                        } else {
                                            setFitranaSort({ field: null, order: null });
                                        }
                                    }}
                                    rowClassName={(record: any) =>
                                        record.fitrana > 0 || record.eidFund > 0 || record.sadqa > 0
                                            ? 'fitrana-paid-row'
                                            : ''
                                    }
                                    summary={() => (
                                        <Table.Summary.Row>
                                            <Table.Summary.Cell index={0} colSpan={2}>
                                                <Text strong>Total</Text>
                                            </Table.Summary.Cell>
                                            <Table.Summary.Cell index={2} align="right">
                                                <Text strong>{fitranaData.totals.fitrana.toLocaleString()}</Text>
                                            </Table.Summary.Cell>
                                            <Table.Summary.Cell index={3} align="right">
                                                <Text strong>{fitranaData.totals.eidFund.toLocaleString()}</Text>
                                            </Table.Summary.Cell>
                                            <Table.Summary.Cell index={4} align="right">
                                                <Text strong>{fitranaData.totals.sadqa.toLocaleString()}</Text>
                                            </Table.Summary.Cell>
                                        </Table.Summary.Row>
                                    )}
                                    scroll={{ x: 600 }}
                                />
                            </div>
                        )
                    }
                    ,{
                        key: 'lajna_quarterly',
                        label: <span>Lajna Quarterly (وقف جدید سہ ماہی)</span>,
                        children: (
                            <div>
                                <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                                    <Title level={5} style={{ margin: 0 }}>Lajna Waqf Jadeed — Quarterly Form</Title>
                                    <Button icon={<FilePdfOutlined />} type="primary" onClick={handleExportLajnaQuarterlyPDF}>
                                        Export PDF
                                    </Button>
                                </Row>

                                {/* Preview */}
                                <Card
                                    size="small"
                                    style={{ marginBottom: 16, direction: 'rtl', fontFamily: "'Noto Nastaliq Urdu', 'Noto Naskh Arabic', Arial", lineHeight: '2.2' }}
                                    title={<span style={{ direction: 'rtl', fontFamily: "'Noto Nastaliq Urdu', Arial" }}>وقف جدید (سہ ماہی) — {selectedYear}</span>}
                                >
                                    <Row gutter={[16, 12]}>
                                        <Col xs={24} sm={12}>
                                            <Text>تجنید لجنہ اماءاللہ</Text>
                                            <Tag color="blue" style={{ marginRight: 8, fontSize: 14 }}>{lajnaQuarterlyStats.tajneedLajna}</Tag>
                                        </Col>
                                        <Col xs={24} sm={12}>
                                            <Text>وقف جدید میں شامل ممبرات</Text>
                                            <Tag color="green" style={{ marginRight: 8, fontSize: 14 }}>{lajnaQuarterlyStats.wjMembersLajna}</Tag>
                                            <Text> بچگان </Text><Tag>{lajnaQuarterlyStats.bachgan}</Tag>
                                            <Text> ناصرات </Text><Tag>{lajnaQuarterlyStats.nasirat}</Tag>
                                        </Col>
                                        <Col xs={24} sm={12}>
                                            <Text>مرحومین کی طرف سے چندہ</Text>
                                            <Tag style={{ marginRight: 8, fontSize: 14 }}>{lajnaQuarterlyStats.deceasedPayers}</Tag>
                                        </Col>
                                        <Col xs={24} sm={12}>
                                            <Text>صف اول </Text><Tag color="gold" style={{ fontSize: 14 }}>{lajnaQuarterlyStats.safEAwal}</Tag>
                                            <Text> صف دوم </Text><Tag color="orange" style={{ fontSize: 14 }}>{lajnaQuarterlyStats.safEDoem}</Tag>
                                        </Col>
                                        <Col xs={24} sm={12}>
                                            <Text>مجاہدات (1000 روپے+)</Text>
                                            <Tag color="purple" style={{ marginRight: 8, fontSize: 14 }}>{lajnaQuarterlyStats.mujahidat}</Tag>
                                        </Col>
                                        <Col xs={24} sm={12}>
                                            <Text>وعدہ </Text><Tag color="cyan">{`Rs. ${lajnaQuarterlyStats.totalPromise.toLocaleString()}`}</Tag>
                                            <Text> وصولی </Text><Tag color="green">{`Rs. ${lajnaQuarterlyStats.totalPaid.toLocaleString()}`}</Tag>
                                            <Tag color={lajnaQuarterlyStats.percent >= 100 ? 'green' : 'volcano'}>{lajnaQuarterlyStats.percent.toFixed(1)}%</Tag>
                                        </Col>
                                    </Row>
                                </Card>

                                {/* User-input fields */}
                                <Card size="small" title="Additional Details (for PDF)">
                                    <Row gutter={[16, 16]}>
                                        <Col xs={12} sm={6}>
                                            <div style={{ marginBottom: 4 }}>Events Held (ہفتہ/یوم/عشرہ)</div>
                                            <InputNumber
                                                min={0}
                                                value={lajnaEvents}
                                                onChange={v => setLajnaEvents(v || 0)}
                                                style={{ width: '100%' }}
                                            />
                                        </Col>
                                        <Col xs={12} sm={6}>
                                            <div style={{ marginBottom: 4 }}>Non-payers Converted (نادہند کو ہند)</div>
                                            <InputNumber
                                                min={0}
                                                value={lajnaConverted}
                                                onChange={v => setLajnaConverted(v || 0)}
                                                style={{ width: '100%' }}
                                            />
                                        </Col>
                                        <Col xs={12} sm={6}>
                                            <div style={{ marginBottom: 4 }}>Visits Count (تعداد دورہ جات)</div>
                                            <InputNumber
                                                min={0}
                                                value={lajnaVisits}
                                                onChange={v => setLajnaVisits(v || 0)}
                                                style={{ width: '100%' }}
                                            />
                                        </Col>
                                        <Col xs={24} sm={12}>
                                            <div style={{ marginBottom: 4 }}>Other Efforts (دیگر مساعی)</div>
                                            <Input
                                                value={lajnaOtherEfforts}
                                                onChange={e => setLajnaOtherEfforts(e.target.value)}
                                                placeholder="e.g. held monthly meeting, distributed pamphlets..."
                                            />
                                        </Col>
                                    </Row>
                                </Card>
                            </div>
                        )
                    }
                ]}
            />
        </Card>
    );
};

export default WaqfReports;
