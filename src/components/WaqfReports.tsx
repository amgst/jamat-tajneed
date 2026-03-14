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
    FilePdfOutlined
} from '@ant-design/icons';
import type { Member, WaqfJadeedRecord, WaqfJadeedSpecialRecord, Payment, Family, FitranaExtra } from '../types';
import { getTanzeemDisplayName, exportToCSV, exportToPDF } from '../utils/helpers';
import { ApiService } from '../services/apiService';
import dayjs from 'dayjs';

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
                ]}
            />
        </Card>
    );
};

export default WaqfReports;
