import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    App,
    Button,
    Card,
    Col,
    Empty,
    Form,
    Input,
    InputNumber,
    Modal,
    Popconfirm,
    Progress,
    Row,
    Segmented,
    Select,
    Space,
    Table,
    Tag,
    Tooltip,
    Typography
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
    CheckCircleOutlined,
    ClockCircleOutlined,
    DeleteOutlined,
    DollarOutlined,
    DownloadOutlined,
    EditOutlined,
    ExclamationCircleOutlined,
    MinusCircleOutlined,
    ReloadOutlined,
    SearchOutlined,
    TeamOutlined,
    UserOutlined,
    WalletOutlined
} from '@ant-design/icons';
import { ApiService } from '../services/apiService';
import type {
    Family,
    Member,
    Payment,
    ReceiptBook,
    WaqfJadeedMarkazPayment,
    WaqfJadeedRecord,
    WaqfJadeedSpecialRecord
} from '../types';
import { getTanzeemDisplayName, exportToPDF } from '../utils/helpers';

const { Text, Title } = Typography;

// ---------- Row model ----------

type PayerStatus = 'paid' | 'partial' | 'unpaid' | 'no-promise';

interface PayerRow {
    key: string;
    kind: 'member' | 'special';
    name: string;
    subtitle: string;
    memberId?: string;
    specialId?: string;
    familyId: string;
    familyName: string;
    halqa: string;
    tanzeem: string;
    isDeceased: boolean;
    promiseBase: number;
    nagarpar: number;
    promise: number;
    paid: number;
    balance: number;
    percent: number;
    status: PayerStatus;
    payments: Payment[];
}

const STATUS_META: Record<PayerStatus, { label: string; color: string; icon: React.ReactNode }> = {
    'paid': { label: 'Paid', color: 'success', icon: <CheckCircleOutlined /> },
    'partial': { label: 'Partial', color: 'processing', icon: <ClockCircleOutlined /> },
    'unpaid': { label: 'Unpaid', color: 'warning', icon: <ExclamationCircleOutlined /> },
    'no-promise': { label: 'No Promise', color: 'default', icon: <MinusCircleOutlined /> }
};

const formatRs = (val: number) => `Rs. ${Math.round(val).toLocaleString()}`;

const currencyInputProps = {
    style: { width: '100%' },
    min: 0,
    formatter: (value: number | string | undefined) =>
        `${value ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, ','),
    parser: (value: string | undefined) => Number((value || '0').replace(/,/g, ''))
};

const WaqfJadeedPro: React.FC = () => {
    const { message } = App.useApp();

    const currentYear = new Date().getFullYear();
    const yearOptions = useMemo(() => {
        const years: number[] = [];
        for (let y = currentYear + 1; y >= 2023; y--) years.push(y);
        return years;
    }, [currentYear]);

    // ---------- State ----------
    const [loading, setLoading] = useState(false);
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [members, setMembers] = useState<Member[]>([]);
    const [families, setFamilies] = useState<Family[]>([]);
    const [records, setRecords] = useState<WaqfJadeedRecord[]>([]);
    const [specialRecords, setSpecialRecords] = useState<WaqfJadeedSpecialRecord[]>([]);
    const [markazPayments, setMarkazPayments] = useState<WaqfJadeedMarkazPayment[]>([]);
    const [books, setBooks] = useState<ReceiptBook[]>([]);
    const [reloadKey, setReloadKey] = useState(0);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | PayerStatus>('all');
    const [tanzeemFilter, setTanzeemFilter] = useState<string | undefined>(undefined);
    const [halqaFilter, setHalqaFilter] = useState<string | undefined>(undefined);
    const [viewMode, setViewMode] = useState<'members' | 'families'>('members');

    // Modals
    const [payRow, setPayRow] = useState<PayerRow | null>(null);
    const [promiseRow, setPromiseRow] = useState<PayerRow | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [payForm] = Form.useForm();
    const [promiseForm] = Form.useForm();

    // ---------- Data loading (with cancellation) ----------
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const [membersData, familiesData, recordsData, specialData, markazData, booksData] = await Promise.all([
                    ApiService.getAllMembers(),
                    ApiService.getAllFamilies(),
                    ApiService.getWaqfJadeedRecords(selectedYear),
                    ApiService.getWaqfJadeedSpecialRecords(selectedYear),
                    ApiService.getWaqfJadeedMarkazPayments(selectedYear),
                    ApiService.getReceiptBooks()
                ]);
                if (cancelled) return;

                setMembers(membersData);
                setFamilies(familiesData.filter(f => !f.isMoved && !f.isBList));
                setRecords((Array.isArray(recordsData) ? recordsData : []).filter(r => r.year === selectedYear));
                setSpecialRecords((Array.isArray(specialData) ? specialData : []).filter(r => r.year === selectedYear));
                setMarkazPayments((Array.isArray(markazData) ? markazData : []).map((p: WaqfJadeedMarkazPayment & { amount?: number }) => ({
                    ...p,
                    amountWJ: p.amountWJ ?? p.amount ?? 0,
                    amountAtfal: p.amountAtfal ?? 0,
                    amountNagarParkar: p.amountNagarParkar ?? 0
                })));
                const sortedBooks = (booksData as ReceiptBook[]).sort((a, b) => {
                    if (a.status === 'active' && b.status !== 'active') return -1;
                    if (a.status !== 'active' && b.status === 'active') return 1;
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                });
                setBooks(sortedBooks);
            } catch (error) {
                if (!cancelled) {
                    console.error('Failed to load Waqf-e-Jadeed data:', error);
                    message.error('Failed to load data');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedYear, reloadKey]);

    // Debounce search input
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchTerm.trim().toLowerCase()), 250);
        return () => clearTimeout(t);
    }, [searchTerm]);

    // ---------- Fast lookups ----------
    const recordByMember = useMemo(() => {
        const map = new Map<string, WaqfJadeedRecord>();
        records.forEach(r => map.set(r.memberId, r));
        return map;
    }, [records]);

    const familyById = useMemo(() => {
        const map = new Map<string, Family>();
        families.forEach(f => map.set(f.id, f));
        return map;
    }, [families]);

    // ---------- Unified rows (members + special) ----------
    const allRows = useMemo<PayerRow[]>(() => {
        const movedFamilyIds = new Set(families.filter(f => f.isMoved).map(f => f.id));
        const rows: PayerRow[] = [];

        members.forEach(m => {
            const record = recordByMember.get(m.id);
            const active = !m.isMoved && !m.isDeceased && !m.isBList && !movedFamilyIds.has(m.familyId || '');
            if (!active && !record) return;

            const promiseBase = record?.promiseAmount || 0;
            const nagarpar = record?.nagarparAmount || 0;
            const promise = promiseBase + nagarpar;
            const paid = record?.paidAmount || 0;
            const family = m.familyId ? familyById.get(m.familyId) : undefined;

            let status: PayerStatus = 'no-promise';
            if (promise > 0) {
                status = paid >= promise ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
            }

            rows.push({
                key: `m-${m.id}`,
                kind: 'member',
                name: m.name,
                subtitle: m.fatherName ? `S/O ${m.fatherName}` : (m.husbandName ? `W/O ${m.husbandName}` : ''),
                memberId: m.id,
                familyId: m.familyId || '',
                familyName: family?.familyName || '-',
                halqa: m.halqa || family?.halqa || '',
                tanzeem: m.tanzeem || 'unknown',
                isDeceased: !!m.isDeceased,
                promiseBase,
                nagarpar,
                promise,
                paid,
                balance: Math.max(0, promise - paid),
                percent: promise > 0 ? Math.min(100, Math.round((paid / promise) * 100)) : 0,
                status,
                payments: record?.payments || []
            });
        });

        specialRecords.forEach(r => {
            const promiseBase = r.promiseAmount || 0;
            const nagarpar = r.nagarparAmount || 0;
            const promise = promiseBase + nagarpar;
            const paid = r.paidAmount || 0;
            const family = r.familyId ? familyById.get(r.familyId) : undefined;

            let status: PayerStatus = 'no-promise';
            if (promise > 0) {
                status = paid >= promise ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
            }

            rows.push({
                key: `s-${r.id}`,
                kind: 'special',
                name: r.name,
                subtitle: r.isDeceased ? 'Deceased (Marhoom)' : 'Special Member',
                specialId: r.id,
                familyId: r.familyId || '',
                familyName: family?.familyName || '-',
                halqa: family?.halqa || '',
                tanzeem: r.isDeceased ? 'marhumeen' : 'special',
                isDeceased: !!r.isDeceased,
                promiseBase,
                nagarpar,
                promise,
                paid,
                balance: Math.max(0, promise - paid),
                percent: promise > 0 ? Math.min(100, Math.round((paid / promise) * 100)) : 0,
                status,
                payments: r.payments || []
            });
        });

        return rows;
    }, [members, specialRecords, recordByMember, familyById, families]);

    // ---------- Filtering ----------
    const filteredRows = useMemo(() => {
        let rows = allRows;
        if (debouncedSearch) {
            rows = rows.filter(r =>
                r.name.toLowerCase().includes(debouncedSearch) ||
                r.subtitle.toLowerCase().includes(debouncedSearch) ||
                r.familyName.toLowerCase().includes(debouncedSearch) ||
                r.halqa.toLowerCase().includes(debouncedSearch)
            );
        }
        if (statusFilter !== 'all') {
            rows = rows.filter(r => r.status === statusFilter);
        }
        if (tanzeemFilter) {
            rows = rows.filter(r => r.tanzeem === tanzeemFilter);
        }
        if (halqaFilter) {
            rows = rows.filter(r => r.halqa === halqaFilter);
        }
        return rows;
    }, [allRows, debouncedSearch, statusFilter, tanzeemFilter, halqaFilter]);

    // Counts per status (respecting search/tanzeem/halqa filters, not status filter)
    const statusCounts = useMemo(() => {
        let rows = allRows;
        if (debouncedSearch) {
            rows = rows.filter(r =>
                r.name.toLowerCase().includes(debouncedSearch) ||
                r.familyName.toLowerCase().includes(debouncedSearch) ||
                r.halqa.toLowerCase().includes(debouncedSearch)
            );
        }
        if (tanzeemFilter) rows = rows.filter(r => r.tanzeem === tanzeemFilter);
        if (halqaFilter) rows = rows.filter(r => r.halqa === halqaFilter);
        const counts: Record<'all' | PayerStatus, number> = { 'all': rows.length, 'paid': 0, 'partial': 0, 'unpaid': 0, 'no-promise': 0 };
        rows.forEach(r => { counts[r.status] += 1; });
        return counts;
    }, [allRows, debouncedSearch, tanzeemFilter, halqaFilter]);

    // ---------- KPIs ----------
    const kpis = useMemo(() => {
        const totalPromise = allRows.reduce((sum, r) => sum + r.promise, 0);
        const totalPaid = allRows.reduce((sum, r) => sum + r.paid, 0);
        const outstanding = Math.max(0, totalPromise - totalPaid);
        const percent = totalPromise > 0 ? (totalPaid / totalPromise) * 100 : 0;
        const withPromise = allRows.filter(r => r.promise > 0).length;
        const fullyPaid = allRows.filter(r => r.status === 'paid').length;
        const participation = allRows.length > 0 ? (withPromise / allRows.length) * 100 : 0;
        const markazPaid = markazPayments.reduce(
            (sum, p) => sum + (p.amountWJ || 0) + (p.amountAtfal || 0) + (p.amountNagarParkar || 0), 0
        );
        return {
            totalPromise,
            totalPaid,
            outstanding,
            percent,
            withPromise,
            fullyPaid,
            participation,
            markazPaid,
            netInHand: totalPaid - markazPaid
        };
    }, [allRows, markazPayments]);

    // ---------- Filter options ----------
    const tanzeemOptions = useMemo(() => {
        const set = new Set(allRows.map(r => r.tanzeem).filter(Boolean));
        return [...set].sort().map(t => ({
            value: t,
            label: t === 'special' ? 'Special Members' : getTanzeemDisplayName(t)
        }));
    }, [allRows]);

    const halqaOptions = useMemo(() => {
        const set = new Set(allRows.map(r => r.halqa).filter(Boolean));
        return [...set].sort().map(h => ({ value: h, label: h }));
    }, [allRows]);

    // ---------- Family grouping ----------
    const familyGroups = useMemo(() => {
        const groups = new Map<string, { family: Family; rows: PayerRow[] }>();
        filteredRows.forEach(row => {
            if (!row.familyId) return;
            const family = familyById.get(row.familyId);
            if (!family) return;
            if (!groups.has(family.id)) groups.set(family.id, { family, rows: [] });
            groups.get(family.id)!.rows.push(row);
        });
        return [...groups.values()]
            .map(g => {
                const promise = g.rows.reduce((sum, r) => sum + r.promise, 0);
                const paid = g.rows.reduce((sum, r) => sum + r.paid, 0);
                return {
                    key: g.family.id,
                    family: g.family,
                    rows: g.rows,
                    memberCount: g.rows.length,
                    promise,
                    paid,
                    balance: Math.max(0, promise - paid),
                    percent: promise > 0 ? Math.min(100, Math.round((paid / promise) * 100)) : 0
                };
            })
            .sort((a, b) => (a.family.familyNumber || 999999) - (b.family.familyNumber || 999999));
    }, [filteredRows, familyById]);

    // ---------- Local state updates after mutations ----------
    const applyUpdatedRecord = useCallback((updated: WaqfJadeedRecord) => {
        setRecords(prev => {
            const idx = prev.findIndex(r => r.memberId === updated.memberId);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = updated;
                return next;
            }
            return [...prev, updated];
        });
    }, []);

    const applyUpdatedSpecial = useCallback((updated: WaqfJadeedSpecialRecord) => {
        setSpecialRecords(prev => {
            const idx = prev.findIndex(r => r.id === updated.id);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = updated;
                return next;
            }
            return [...prev, updated];
        });
    }, []);

    // ---------- Actions ----------
    const openPayModal = (row: PayerRow) => {
        setPayRow(row);
        const activeBook = books.find(b => b.status === 'active');
        payForm.setFieldsValue({
            amount: row.balance > 0 ? row.balance : undefined,
            bookId: activeBook?.id,
            receiptNo: undefined,
            notes: ''
        });
    };

    const openPromiseModal = (row: PayerRow) => {
        setPromiseRow(row);
        promiseForm.setFieldsValue({
            promiseAmount: row.promiseBase || undefined,
            nagarparAmount: row.nagarpar || undefined
        });
    };

    const handleQuickPay = async () => {
        if (!payRow) return;
        let values;
        try {
            values = await payForm.validateFields();
        } catch {
            return; // validation errors are shown inline
        }
        setSubmitting(true);
        try {
            const book = books.find(b => b.id === values.bookId);
            const common = {
                amount: values.amount,
                date: new Date().toISOString(),
                notes: values.notes || undefined,
                bookId: values.bookId || undefined,
                bookNo: book?.bookNo,
                receiptNo: values.receiptNo || undefined
            };
            if (payRow.kind === 'member' && payRow.memberId) {
                const updated = await ApiService.addWaqfJadeedPayment({
                    memberId: payRow.memberId,
                    year: selectedYear,
                    ...common
                });
                if (updated) applyUpdatedRecord(updated);
            } else if (payRow.kind === 'special' && payRow.specialId) {
                const updated = await ApiService.addWaqfJadeedSpecialPayment({
                    specialId: payRow.specialId,
                    ...common
                });
                if (updated) applyUpdatedSpecial(updated);
            }
            message.success(`Payment of ${formatRs(values.amount)} recorded for ${payRow.name}`);
            setPayRow(null);
            payForm.resetFields();
        } catch (error) {
            console.error('Quick pay failed:', error);
            message.error('Failed to record payment');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSavePromise = async () => {
        if (!promiseRow) return;
        let values;
        try {
            values = await promiseForm.validateFields();
        } catch {
            return;
        }
        setSubmitting(true);
        try {
            if (promiseRow.kind === 'member' && promiseRow.memberId) {
                const updated = await ApiService.saveWaqfJadeedRecord({
                    memberId: promiseRow.memberId,
                    year: selectedYear,
                    promiseAmount: values.promiseAmount || 0,
                    nagarparAmount: values.nagarparAmount || 0
                });
                if (updated) applyUpdatedRecord(updated);
            } else if (promiseRow.kind === 'special' && promiseRow.specialId) {
                const existing = specialRecords.find(r => r.id === promiseRow.specialId);
                if (existing) {
                    const updated = await ApiService.saveWaqfJadeedSpecialRecord({
                        ...existing,
                        promiseAmount: values.promiseAmount || 0,
                        nagarparAmount: values.nagarparAmount || 0
                    });
                    if (updated) applyUpdatedSpecial({ ...updated, payments: existing.payments });
                }
            }
            message.success(`Promise updated for ${promiseRow.name}`);
            setPromiseRow(null);
            promiseForm.resetFields();
        } catch (error) {
            console.error('Save promise failed:', error);
            message.error('Failed to save promise');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeletePayment = async (row: PayerRow, paymentId: string) => {
        try {
            if (row.kind === 'member') {
                await ApiService.deleteWaqfJadeedPayment(paymentId);
                const refreshed = await ApiService.getWaqfJadeedRecords(selectedYear, row.memberId);
                if (refreshed && refreshed.length > 0) applyUpdatedRecord(refreshed[0]);
            } else if (row.specialId) {
                await ApiService.deleteWaqfJadeedSpecialPayment(paymentId);
                const refreshed = await ApiService.getWaqfJadeedSpecialRecordById(row.specialId);
                if (refreshed) applyUpdatedSpecial(refreshed);
            }
            message.success('Payment deleted');
        } catch (error) {
            console.error('Delete payment failed:', error);
            message.error('Failed to delete payment');
        }
    };

    const handleExportPDF = async () => {
        const rows = filteredRows.map((r, i) => ({
            no: i + 1,
            name: r.name,
            family: r.familyName,
            tanzeem: r.tanzeem === 'special' ? 'Special' : getTanzeemDisplayName(r.tanzeem),
            promise: r.promise,
            paid: r.paid,
            balance: r.balance,
            status: STATUS_META[r.status].label
        }));
        await exportToPDF(
            rows,
            ['no', 'name', 'family', 'tanzeem', 'promise', 'paid', 'balance', 'status'],
            `waqf_jadeed_pro_${selectedYear}`,
            `Waqf-e-Jadeed - Collection Report - ${selectedYear}`
        );
        message.success('PDF exported');
    };

    // ---------- Render helpers ----------
    const renderPaymentHistory = (row: PayerRow) => {
        if (!row.payments || row.payments.length === 0) {
            return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No payments recorded yet" />;
        }
        const sorted = [...row.payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return (
            <Table<Payment>
                dataSource={sorted}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                    {
                        title: 'Date',
                        dataIndex: 'date',
                        key: 'date',
                        render: (d: string) => new Date(d).toLocaleDateString()
                    },
                    {
                        title: 'Amount',
                        dataIndex: 'amount',
                        key: 'amount',
                        align: 'right' as const,
                        render: (v: number) => <Text strong>{formatRs(v || 0)}</Text>
                    },
                    {
                        title: 'Receipt',
                        key: 'receipt',
                        render: (_: unknown, p: Payment) =>
                            p.receiptNo ? <Tag>{p.bookNo ? `Book ${p.bookNo} / ` : ''}#{p.receiptNo}</Tag> : <Text type="secondary">-</Text>
                    },
                    {
                        title: 'Notes',
                        dataIndex: 'notes',
                        key: 'notes',
                        render: (n?: string) => n || <Text type="secondary">-</Text>
                    },
                    {
                        title: '',
                        key: 'actions',
                        width: 50,
                        render: (_: unknown, p: Payment) => (
                            <Popconfirm
                                title="Delete this payment?"
                                onConfirm={() => handleDeletePayment(row, p.id)}
                                okText="Delete"
                                okButtonProps={{ danger: true }}
                            >
                                <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                            </Popconfirm>
                        )
                    }
                ]}
            />
        );
    };

    const memberColumns: ColumnsType<PayerRow> = [
        {
            title: 'Name',
            key: 'name',
            fixed: 'left',
            sorter: (a, b) => a.name.localeCompare(b.name),
            render: (_, row) => (
                <div style={{ minWidth: 160 }}>
                    <Space size={6}>
                        <Text strong>{row.name}</Text>
                        {row.isDeceased && <Tag color="default" style={{ marginInlineEnd: 0 }}>Marhoom</Tag>}
                        {row.kind === 'special' && !row.isDeceased && <Tag color="purple" style={{ marginInlineEnd: 0 }}>Special</Tag>}
                    </Space>
                    {row.subtitle && (
                        <div><Text type="secondary" style={{ fontSize: 12 }}>{row.subtitle}</Text></div>
                    )}
                </div>
            )
        },
        {
            title: 'Family',
            dataIndex: 'familyName',
            key: 'family',
            responsive: ['md'],
            sorter: (a, b) => a.familyName.localeCompare(b.familyName),
            render: (v: string) => <Text type="secondary">{v}</Text>
        },
        {
            title: 'Tanzeem',
            dataIndex: 'tanzeem',
            key: 'tanzeem',
            responsive: ['lg'],
            render: (t: string) => (
                <Tag color="blue">{t === 'special' ? 'Special' : getTanzeemDisplayName(t)}</Tag>
            )
        },
        {
            title: 'Promise',
            dataIndex: 'promise',
            key: 'promise',
            align: 'right',
            sorter: (a, b) => a.promise - b.promise,
            render: (v: number, row) => (
                <Tooltip title={row.nagarpar > 0 ? `WJ: ${formatRs(row.promiseBase)} + Nagar Parkar: ${formatRs(row.nagarpar)}` : undefined}>
                    <Text>{formatRs(v)}</Text>
                </Tooltip>
            )
        },
        {
            title: 'Paid',
            dataIndex: 'paid',
            key: 'paid',
            align: 'right',
            sorter: (a, b) => a.paid - b.paid,
            render: (v: number) => <Text style={{ color: v > 0 ? '#389e0d' : undefined }}>{formatRs(v)}</Text>
        },
        {
            title: 'Balance',
            dataIndex: 'balance',
            key: 'balance',
            align: 'right',
            sorter: (a, b) => a.balance - b.balance,
            render: (v: number) => (
                <Text strong style={{ color: v > 0 ? '#cf1322' : '#389e0d' }}>{formatRs(v)}</Text>
            )
        },
        {
            title: 'Progress',
            key: 'progress',
            width: 140,
            responsive: ['sm'],
            sorter: (a, b) => a.percent - b.percent,
            render: (_, row) => (
                <Progress
                    percent={row.percent}
                    size="small"
                    strokeColor={row.status === 'paid' ? '#52c41a' : '#6d28d9'}
                />
            )
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            filters: Object.entries(STATUS_META).map(([value, meta]) => ({ value, text: meta.label })),
            onFilter: (value, row) => row.status === value,
            render: (s: PayerStatus) => (
                <Tag color={STATUS_META[s].color} icon={STATUS_META[s].icon}>{STATUS_META[s].label}</Tag>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            fixed: 'right',
            width: 110,
            render: (_, row) => (
                <Space size={4}>
                    <Tooltip title="Record payment">
                        <Button
                            type="primary"
                            size="small"
                            icon={<DollarOutlined />}
                            disabled={row.promise <= 0}
                            onClick={(e) => { e.stopPropagation(); openPayModal(row); }}
                        />
                    </Tooltip>
                    <Tooltip title="Set / edit promise">
                        <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={(e) => { e.stopPropagation(); openPromiseModal(row); }}
                        />
                    </Tooltip>
                </Space>
            )
        }
    ];

    const kpiTiles = [
        { label: 'Total Promise', value: formatRs(kpis.totalPromise), icon: <WalletOutlined />, color: '#6d28d9', bg: '#f5f0ff' },
        { label: 'Collected', value: formatRs(kpis.totalPaid), sub: `${kpis.percent.toFixed(1)}% of promise`, icon: <CheckCircleOutlined />, color: '#389e0d', bg: '#f6ffed' },
        { label: 'Outstanding', value: formatRs(kpis.outstanding), icon: <ExclamationCircleOutlined />, color: '#cf1322', bg: '#fff1f0' },
        { label: 'Participation', value: `${kpis.participation.toFixed(0)}%`, sub: `${kpis.withPromise} of ${allRows.length} promised`, icon: <TeamOutlined />, color: '#0958d9', bg: '#e6f4ff' },
        { label: 'Fully Paid', value: `${kpis.fullyPaid}`, sub: `of ${kpis.withPromise} promisers`, icon: <UserOutlined />, color: '#08979c', bg: '#e6fffb' },
        { label: 'Net in Hand', value: formatRs(kpis.netInHand), sub: `${formatRs(kpis.markazPaid)} sent to Markaz`, icon: <DollarOutlined />, color: '#d46b08', bg: '#fff7e6' }
    ];

    // ---------- Render ----------
    return (
        <div style={{ padding: '0 8px 80px', width: '100%', boxSizing: 'border-box' }}>
            {/* Hero header */}
            <div
                style={{
                    background: 'linear-gradient(135deg, #312e81 0%, #4c1d95 50%, #6d28d9 100%)',
                    borderRadius: 16,
                    padding: '20px 24px',
                    marginBottom: 16,
                    color: 'white'
                }}
            >
                <Row gutter={[12, 12]} align="middle" justify="space-between">
                    <Col xs={24} md={10}>
                        <Title level={3} style={{ color: 'white', margin: 0 }}>Waqf-e-Jadeed</Title>
                        <Text style={{ color: 'rgba(255,255,255,0.75)' }}>
                            Collection workspace &middot; {selectedYear}
                        </Text>
                    </Col>
                    <Col xs={24} md={14}>
                        <Row gutter={[8, 8]} justify="end" align="middle">
                            <Col>
                                <Select
                                    value={selectedYear}
                                    onChange={setSelectedYear}
                                    style={{ width: 100 }}
                                    options={yearOptions.map(y => ({ value: y, label: `${y}` }))}
                                />
                            </Col>
                            <Col>
                                <Button icon={<ReloadOutlined />} onClick={() => setReloadKey(k => k + 1)} loading={loading}>
                                    Refresh
                                </Button>
                            </Col>
                            <Col>
                                <Button icon={<DownloadOutlined />} onClick={handleExportPDF}>
                                    Export PDF
                                </Button>
                            </Col>
                        </Row>
                    </Col>
                </Row>
            </div>

            {/* KPI tiles */}
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                {kpiTiles.map(tile => (
                    <Col xs={12} sm={12} md={8} xl={4} key={tile.label}>
                        <Card styles={{ body: { padding: 14 } }} style={{ borderRadius: 12, height: '100%' }}>
                            <Space align="start" size={10}>
                                <div
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 10,
                                        background: tile.bg,
                                        color: tile.color,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 16,
                                        flexShrink: 0
                                    }}
                                >
                                    {tile.icon}
                                </div>
                                <div>
                                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{tile.label}</Text>
                                    <Text strong style={{ fontSize: 15 }}>{tile.value}</Text>
                                    {tile.sub && (
                                        <div><Text type="secondary" style={{ fontSize: 11 }}>{tile.sub}</Text></div>
                                    )}
                                </div>
                            </Space>
                        </Card>
                    </Col>
                ))}
            </Row>

            {/* Toolbar */}
            <Card style={{ borderRadius: 12, marginBottom: 16 }} styles={{ body: { padding: 12 } }}>
                <Row gutter={[8, 8]} align="middle">
                    <Col xs={24} md={8}>
                        <Input
                            prefix={<SearchOutlined />}
                            placeholder="Search name, family, halqa..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            allowClear
                        />
                    </Col>
                    <Col xs={12} md={4}>
                        <Select
                            placeholder="Tanzeem"
                            value={tanzeemFilter}
                            onChange={setTanzeemFilter}
                            options={tanzeemOptions}
                            allowClear
                            style={{ width: '100%' }}
                        />
                    </Col>
                    <Col xs={12} md={4}>
                        <Select
                            placeholder="Halqa"
                            value={halqaFilter}
                            onChange={setHalqaFilter}
                            options={halqaOptions}
                            allowClear
                            style={{ width: '100%' }}
                        />
                    </Col>
                    <Col xs={24} md={8} style={{ textAlign: 'right' }}>
                        <Segmented
                            value={viewMode}
                            onChange={(v) => setViewMode(v as 'members' | 'families')}
                            options={[
                                { value: 'members', label: 'Members', icon: <UserOutlined /> },
                                { value: 'families', label: 'Families', icon: <TeamOutlined /> }
                            ]}
                        />
                    </Col>
                    <Col span={24}>
                        <Segmented
                            block
                            value={statusFilter}
                            onChange={(v) => setStatusFilter(v as 'all' | PayerStatus)}
                            options={[
                                { value: 'all', label: `All (${statusCounts['all']})` },
                                { value: 'paid', label: `Paid (${statusCounts['paid']})` },
                                { value: 'partial', label: `Partial (${statusCounts['partial']})` },
                                { value: 'unpaid', label: `Unpaid (${statusCounts['unpaid']})` },
                                { value: 'no-promise', label: `No Promise (${statusCounts['no-promise']})` }
                            ]}
                        />
                    </Col>
                </Row>
            </Card>

            {/* Main content */}
            {viewMode === 'members' ? (
                <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 0 } }}>
                    <Table<PayerRow>
                        dataSource={filteredRows}
                        columns={memberColumns}
                        rowKey="key"
                        loading={loading}
                        size="middle"
                        scroll={{ x: 'max-content' }}
                        pagination={{
                            defaultPageSize: 25,
                            showSizeChanger: true,
                            pageSizeOptions: ['25', '50', '100'],
                            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`
                        }}
                        expandable={{
                            expandedRowRender: renderPaymentHistory
                        }}
                    />
                </Card>
            ) : (
                <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 0 } }}>
                    <Table
                        dataSource={familyGroups}
                        rowKey="key"
                        loading={loading}
                        size="middle"
                        scroll={{ x: 'max-content' }}
                        pagination={{
                            defaultPageSize: 25,
                            showSizeChanger: true,
                            pageSizeOptions: ['25', '50', '100'],
                            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} families`
                        }}
                        columns={[
                            {
                                title: '#',
                                key: 'familyNumber',
                                width: 60,
                                render: (_: unknown, g: typeof familyGroups[number]) => g.family.familyNumber || '-'
                            },
                            {
                                title: 'Family',
                                key: 'familyName',
                                sorter: (a: typeof familyGroups[number], b: typeof familyGroups[number]) =>
                                    a.family.familyName.localeCompare(b.family.familyName),
                                render: (_: unknown, g: typeof familyGroups[number]) => (
                                    <div>
                                        <Text strong>{g.family.familyName}</Text>
                                        <div>
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                {g.memberCount} payers{g.family.halqa ? ` · ${g.family.halqa}` : ''}
                                            </Text>
                                        </div>
                                    </div>
                                )
                            },
                            {
                                title: 'Promise',
                                dataIndex: 'promise',
                                key: 'promise',
                                align: 'right' as const,
                                sorter: (a: typeof familyGroups[number], b: typeof familyGroups[number]) => a.promise - b.promise,
                                render: (v: number) => formatRs(v)
                            },
                            {
                                title: 'Paid',
                                dataIndex: 'paid',
                                key: 'paid',
                                align: 'right' as const,
                                sorter: (a: typeof familyGroups[number], b: typeof familyGroups[number]) => a.paid - b.paid,
                                render: (v: number) => <Text style={{ color: v > 0 ? '#389e0d' : undefined }}>{formatRs(v)}</Text>
                            },
                            {
                                title: 'Balance',
                                dataIndex: 'balance',
                                key: 'balance',
                                align: 'right' as const,
                                sorter: (a: typeof familyGroups[number], b: typeof familyGroups[number]) => a.balance - b.balance,
                                render: (v: number) => (
                                    <Text strong style={{ color: v > 0 ? '#cf1322' : '#389e0d' }}>{formatRs(v)}</Text>
                                )
                            },
                            {
                                title: 'Progress',
                                key: 'progress',
                                width: 160,
                                sorter: (a: typeof familyGroups[number], b: typeof familyGroups[number]) => a.percent - b.percent,
                                render: (_: unknown, g: typeof familyGroups[number]) => (
                                    <Progress percent={g.percent} size="small" strokeColor={g.percent >= 100 ? '#52c41a' : '#6d28d9'} />
                                )
                            }
                        ]}
                        expandable={{
                            expandedRowRender: (g: typeof familyGroups[number]) => (
                                <Table<PayerRow>
                                    dataSource={g.rows}
                                    columns={memberColumns.filter(c => c.key !== 'family')}
                                    rowKey="key"
                                    size="small"
                                    pagination={false}
                                    scroll={{ x: 'max-content' }}
                                    expandable={{ expandedRowRender: renderPaymentHistory }}
                                />
                            )
                        }}
                    />
                </Card>
            )}

            {/* Quick Pay modal */}
            <Modal
                title={payRow ? `Record Payment — ${payRow.name}` : 'Record Payment'}
                open={!!payRow}
                onCancel={() => { setPayRow(null); payForm.resetFields(); }}
                onOk={handleQuickPay}
                okText="Save Payment"
                confirmLoading={submitting}
                destroyOnClose
            >
                {payRow && (
                    <div style={{ marginBottom: 12 }}>
                        <Space size={16} wrap>
                            <Text type="secondary">Promise: <Text strong>{formatRs(payRow.promise)}</Text></Text>
                            <Text type="secondary">Paid: <Text strong style={{ color: '#389e0d' }}>{formatRs(payRow.paid)}</Text></Text>
                            <Text type="secondary">Balance: <Text strong style={{ color: payRow.balance > 0 ? '#cf1322' : '#389e0d' }}>{formatRs(payRow.balance)}</Text></Text>
                        </Space>
                    </div>
                )}
                <Form form={payForm} layout="vertical">
                    <Form.Item
                        name="amount"
                        label="Amount"
                        rules={[{ required: true, message: 'Enter the payment amount' }]}
                    >
                        <InputNumber {...currencyInputProps} placeholder="0" autoFocus />
                    </Form.Item>
                    <Row gutter={12}>
                        <Col span={14}>
                            <Form.Item name="bookId" label="Receipt Book">
                                <Select
                                    placeholder="Select book"
                                    allowClear
                                    options={books.map(b => ({
                                        value: b.id,
                                        label: `Book ${b.bookNo}${b.status === 'active' ? ' (active)' : ''}`
                                    }))}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={10}>
                            <Form.Item name="receiptNo" label="Receipt #">
                                <InputNumber style={{ width: '100%' }} min={1} placeholder="e.g. 45" />
                            </Form.Item>
                        </Col>
                    </Row>
                    <Form.Item name="notes" label="Notes (optional)">
                        <Input.TextArea rows={2} />
                    </Form.Item>
                </Form>
            </Modal>

            {/* Promise modal */}
            <Modal
                title={promiseRow ? `Set Promise — ${promiseRow.name}` : 'Set Promise'}
                open={!!promiseRow}
                onCancel={() => { setPromiseRow(null); promiseForm.resetFields(); }}
                onOk={handleSavePromise}
                okText="Save Promise"
                confirmLoading={submitting}
                destroyOnClose
            >
                <Form form={promiseForm} layout="vertical">
                    <Form.Item name="promiseAmount" label="Waqf-e-Jadeed Promise">
                        <InputNumber {...currencyInputProps} placeholder="0" autoFocus />
                    </Form.Item>
                    <Form.Item name="nagarparAmount" label="Nagar Parkar">
                        <InputNumber {...currencyInputProps} placeholder="0" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default WaqfJadeedPro;
