import React, { useState, useEffect, useMemo } from 'react';
import {
    Card,
    List,
    Avatar,
    Typography,
    Input,
    Select,
    Button,
    Drawer,
    Form,
    InputNumber,
    Space,
    Table,
    Tag,
    App,
    Divider,
    Popconfirm,
    Tabs,
    Row,
    Col,
    Statistic,
    Progress,
    Modal,
    DatePicker
} from 'antd';
import {
    UserOutlined,
    SearchOutlined,
    DollarOutlined,
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    SaveOutlined,
    DownloadOutlined
} from '@ant-design/icons';
import { ApiService } from '../services/apiService';
import type { Member, AnsarullahRecord, Payment, ReceiptBook, MarkazPayment } from '../types';
import dayjs from 'dayjs';
import AnsarullahDashboard from '../components/AnsarullahDashboard';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const { Text, Title } = Typography;

const Ansarullah: React.FC = () => {
    const { message } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [ansarMembers, setAnsarMembers] = useState<Member[]>([]);
    const [records, setRecords] = useState<AnsarullahRecord[]>([]);
    const [markazPayments, setMarkazPayments] = useState<MarkazPayment[]>([]);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [searchTerm, setSearchTerm] = useState('');
    const [books, setBooks] = useState<ReceiptBook[]>([]);

    // Drawer & Edit State
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [editingMember, setEditingMember] = useState<Member | null>(null);

    const [form] = Form.useForm();
    const [paymentForm] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);
    const [paymentEditingId, setPaymentEditingId] = useState<string | null>(null);

    const [markazForm] = Form.useForm();
    const [markazModalVisible, setMarkazModalVisible] = useState(false);

    useEffect(() => {
        loadData();
        loadBooks();
    }, [selectedYear]);

    const loadBooks = async () => {
        try {
            const data = await ApiService.getReceiptBooks();
            setBooks(data.filter(b => b.status === 'active'));
        } catch (error) {
            console.error('Failed to load books:', error);
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const [membersData, recordsData, markazData] = await Promise.all([
                ApiService.getAllMembers(),
                ApiService.getAnsarullahRecords(selectedYear),
                ApiService.getMarkazPayments(selectedYear)
            ]);

            // Filter only Ansar members
            setAnsarMembers(membersData.filter(m => m.tanzeem === 'ansar' && !m.isDeceased && !m.isMoved));
            setRecords(recordsData);
            setMarkazPayments(markazData);
        } catch (error) {
            console.error('Error loading data:', error);
            message.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const updateLocalRecord = (savedRecord: AnsarullahRecord) => {
        setRecords(prev => {
            const idx = prev.findIndex(r => r.memberId === savedRecord.memberId);
            if (idx >= 0) {
                const newRecords = [...prev];
                newRecords[idx] = savedRecord;
                return newRecords;
            } else {
                return [...prev, savedRecord];
            }
        });
    };

    const handleEditRecord = (member: Member) => {
        setEditingMember(member);
        const record = records.find(r => r.memberId === member.id);
        form.setFieldsValue({
            chandaMajlis: record?.chandaMajlis || 0,
            chandaSalanaIjtema: record?.chandaSalanaIjtema || 0,
            chandaAsyat: record?.chandaAsyat || 0,
            chandaTawseaImarat: record?.chandaTawseaImarat || 0,
        });
        setDrawerVisible(true);
    };

    const handleSavePromise = async () => {
        if (!editingMember) return;
        setSubmitting(true);
        try {
            const values = await form.validateFields();
            const payload = {
                memberId: editingMember.id,
                year: selectedYear,
                chandaMajlis: values.chandaMajlis || 0,
                chandaSalanaIjtema: values.chandaSalanaIjtema || 0,
                chandaAsyat: values.chandaAsyat || 0,
                chandaTawseaImarat: values.chandaTawseaImarat || 0,
            };

            const savedRecord = await ApiService.saveAnsarullahRecord(payload);
            if (savedRecord) {
                updateLocalRecord(savedRecord);
                message.success('Promise updated');
            }
        } catch (error) {
            message.error('Failed to save promise');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddPayment = async (values: any) => {
        if (!editingMember) return;
        setSubmitting(true);
        try {
            const paymentData = {
                id: paymentEditingId || undefined,
                memberId: editingMember.id,
                year: selectedYear,
                amount: values.amount,
                date: paymentEditingId
                    ? (records.find(r => r.memberId === editingMember.id)?.payments?.find(p => p.id === paymentEditingId)?.date || new Date().toISOString())
                    : new Date().toISOString(),
                notes: values.notes,
                bookId: values.bookId,
                bookNo: books.find(b => b.id === values.bookId)?.bookNo,
                receiptNo: values.receiptNo
            };

            let updatedRecord;
            if (paymentEditingId) {
                updatedRecord = await ApiService.updateAnsarullahPayment(paymentData as any);
                message.success('Payment updated');
            } else {
                updatedRecord = await ApiService.addAnsarullahPayment(paymentData as any);
                message.success('Payment added');
            }

            if (updatedRecord) updateLocalRecord(updatedRecord);
            paymentForm.resetFields();
            setPaymentEditingId(null);
        } catch (error) {
            message.error('Failed to process payment');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeletePayment = async (id: string) => {
        try {
            const result = await ApiService.deleteAnsarullahPayment(id);
            if (result.error) {
                message.error(result.error);
                return;
            }

            // Update local state
            // This part of the original instruction seems to be for Waqf-e-Jadeed, not Ansarullah.
            // For Ansarullah, we need to reload the record for the current member.
            if (editingMember) {
                const refreshed = await ApiService.getAnsarullahRecords(selectedYear, editingMember.id);
                if (refreshed && refreshed.length > 0) {
                    updateLocalRecord(refreshed[0]);
                }
            }
            message.success('Payment deleted');
        } catch (error) {
            message.error('Failed to delete payment');
        }
    };

    const handleSaveMarkazPayment = async (values: any) => {
        try {
            setSubmitting(true);
            const payload = {
                amount: values.amount,
                couponNo: values.couponNo,
                paymentDate: values.paymentDate.format('YYYY-MM-DD'),
                notes: values.notes,
                year: selectedYear
            };

            await ApiService.saveMarkazPayment(payload);
            message.success('Markaz payment recorded');
            setMarkazModalVisible(false);
            markazForm.resetFields();
            loadData(); // Reload to refresh list
        } catch (error) {
            message.error('Failed to save Markaz payment');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteMarkazPayment = async (id: string) => {
        try {
            await ApiService.deleteMarkazPayment(id);
            message.success('Payment deleted');
            loadData();
        } catch (error) {
            message.error('Failed to delete payment');
        }
    };

    const handleExportPDF = async () => {
        const input = document.getElementById('audit-report-content');
        if (!input) return;

        try {
            const canvas = await html2canvas(input, {
                scale: 2, // Higher scale for better quality
                useCORS: true,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            const imgX = (pdfWidth - imgWidth * ratio) / 2;
            const imgY = 10;

            // Log details for debugging if needed
            // console.log({ pdfWidth, pdfHeight, imgWidth, imgHeight, ratio });

            // Calculate height based on width to maintain aspect ratio
            const finalImgHeight = (imgHeight * pdfWidth) / imgWidth;

            // If image is too long, we might need multiple pages, but for now let's fit to width
            // For a single page report usually fitting to width is fine unless it's very long

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, finalImgHeight);
            pdf.save(`Ansarullah_Audit_Report_${selectedYear}.pdf`);
            message.success('PDF downloaded');
        } catch (error) {
            console.error('PDF Export Error:', error);
            message.error('Failed to export PDF');
        }
    };

    const filteredMembers = useMemo(() => {
        return ansarMembers.filter(m =>
            m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.fatherName?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [ansarMembers, searchTerm]);

    const columns = [
        {
            title: 'Member',
            key: 'member',
            render: (m: Member) => (
                <Space>
                    <Avatar src={m.profilePhoto} icon={<UserOutlined />} />
                    <div>
                        <Text strong>{m.name}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: '12px' }}>{m.fatherName}</Text>
                    </div>
                </Space>
            ),
        },
        {
            title: 'Promise (Owe)',
            key: 'promise',
            render: (m: Member) => {
                const record = records.find(r => r.memberId === m.id);
                return <Text strong>Rs. {record?.promiseAmount?.toLocaleString() || 0}</Text>;
            },
        },
        {
            title: 'Paid',
            key: 'paid',
            render: (m: Member) => {
                const record = records.find(r => r.memberId === m.id);
                return <Text type="success" strong>Rs. {record?.paidAmount?.toLocaleString() || 0}</Text>;
            },
        },
        {
            title: 'Balance',
            key: 'balance',
            render: (m: Member) => {
                const record = records.find(r => r.memberId === m.id);
                const balance = (record?.promiseAmount || 0) - (record?.paidAmount || 0);
                return <Tag color={balance <= 0 ? 'green' : 'red'}>Rs. {balance.toLocaleString()}</Tag>;
            },
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (m: Member) => (
                <Button
                    icon={<DollarOutlined />}
                    type="primary"
                    onClick={() => handleEditRecord(m)}
                >
                    Payments
                </Button>
            ),
        },
    ];

    const currentRecord = editingMember ? records.find(r => r.memberId === editingMember.id) : null;

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <Title level={2} style={{ margin: 0 }}>Ansarullah Financials</Title>
                    <Text type="secondary">Manage Chanda Ansarullah for members (40+ years)</Text>
                </div>
                <Space>
                    <Select
                        value={selectedYear}
                        onChange={setSelectedYear}
                        style={{ width: 120 }}
                    >
                        {[2024, 2025, 2026].map(y => <Select.Option key={y} value={y}>{y}</Select.Option>)}
                    </Select>
                    <Input
                        placeholder="Search Ansar..."
                        prefix={<SearchOutlined />}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ width: 250 }}
                    />
                </Space>
            </div>

            <Tabs
                defaultActiveKey="list"
                items={[
                    {
                        key: 'list',
                        label: 'Member List',
                        children: (
                            <Card>
                                <Table
                                    columns={columns}
                                    dataSource={filteredMembers}
                                    rowKey="id"
                                    loading={loading}
                                    pagination={{ pageSize: 10 }}
                                />
                            </Card>
                        )
                    },
                    {
                        key: 'dashboard',
                        label: 'Dashboard',
                        children: (
                            <AnsarullahDashboard
                                members={ansarMembers}
                                records={records}
                                selectedYear={selectedYear}
                            />
                        )
                    },
                    {
                        key: 'audit',
                        label: 'Audit Report',
                        children: (
                            <Card>
                                <div id="audit-report-content" style={{ padding: '24px', fontFamily: 'Jameel Noori Nastaleeq, Noto Nastalikh Urdu, Arial', background: '#fff' }}>
                                    {/* Header */}
                                    <div style={{ textAlign: 'center', marginBottom: '32px', borderBottom: '2px solid #1890ff', paddingBottom: '16px', position: 'relative' }}>
                                        <div style={{ position: 'absolute', left: 0, top: 0 }}>
                                            <Button icon={<DownloadOutlined />} onClick={handleExportPDF}>
                                                Export PDF
                                            </Button>
                                        </div>
                                        <Title level={2} style={{ margin: 0, direction: 'rtl' }}>آڈٹ رپورٹ</Title>
                                        <Title level={3} style={{ margin: '8px 0', direction: 'rtl' }}>انصار اللہ چندہ تفصیلات</Title>
                                        <Text type="secondary" style={{ fontSize: '16px', direction: 'rtl' }}>سال: {selectedYear}</Text>
                                    </div>

                                    {/* Summary Statistics */}
                                    <div style={{ marginBottom: '32px' }}>
                                        <Title level={4} style={{ direction: 'rtl', textAlign: 'right', color: '#1890ff' }}>خلاصہ</Title>
                                        <Row gutter={[16, 16]}>
                                            <Col span={6}>
                                                <Card size="small" style={{ background: '#e6f7ff', textAlign: 'center' }}>
                                                    <Statistic
                                                        title={<span style={{ direction: 'rtl' }}>کل انصار</span>}
                                                        value={ansarMembers.length}
                                                        prefix={<UserOutlined />}
                                                    />
                                                </Card>
                                            </Col>
                                            <Col span={6}>
                                                <Card size="small" style={{ background: '#f6ffed', textAlign: 'center' }}>
                                                    <Statistic
                                                        title={<span style={{ direction: 'rtl' }}>کل وعدہ</span>}
                                                        value={records.reduce((sum, r) => sum + (r.promiseAmount || 0), 0)}
                                                        prefix="Rs."
                                                        valueStyle={{ color: '#1890ff' }}
                                                    />
                                                </Card>
                                            </Col>
                                            <Col span={6}>
                                                <Card size="small" style={{ background: '#f6ffed', textAlign: 'center' }}>
                                                    <Statistic
                                                        title={<span style={{ direction: 'rtl' }}>کل ادائیگی</span>}
                                                        value={records.reduce((sum, r) => sum + (r.paidAmount || 0), 0)}
                                                        prefix="Rs."
                                                        valueStyle={{ color: '#52c41a' }}
                                                    />
                                                </Card>
                                            </Col>
                                            <Col span={6}>
                                                <Card size="small" style={{ background: '#fff1f0', textAlign: 'center' }}>
                                                    <Statistic
                                                        title={<span style={{ direction: 'rtl' }}>باقی رقم</span>}
                                                        value={records.reduce((sum, r) => sum + ((r.promiseAmount || 0) - (r.paidAmount || 0)), 0)}
                                                        prefix="Rs."
                                                        valueStyle={{ color: '#f5222d' }}
                                                    />
                                                </Card>
                                            </Col>
                                        </Row>
                                    </div>

                                    {/* Chanda Type Breakdown */}
                                    <div style={{ marginBottom: '32px' }}>
                                        <Title level={4} style={{ direction: 'rtl', textAlign: 'right', color: '#1890ff' }}>چندہ کی اقسام کی تفصیل</Title>
                                        <Table
                                            size="small"
                                            pagination={false}
                                            dataSource={[
                                                {
                                                    key: '1',
                                                    type: 'چندہ مجلس',
                                                    amount: records.reduce((sum, r) => sum + (r.chandaMajlis || 0), 0)
                                                },
                                                {
                                                    key: '2',
                                                    type: 'سالانہ اجتماع',
                                                    amount: records.reduce((sum, r) => sum + (r.chandaSalanaIjtema || 0), 0)
                                                },
                                                {
                                                    key: '3',
                                                    type: 'عاشیات',
                                                    amount: records.reduce((sum, r) => sum + (r.chandaAsyat || 0), 0)
                                                },
                                                {
                                                    key: '4',
                                                    type: 'توسیع عمارت',
                                                    amount: records.reduce((sum, r) => sum + (r.chandaTawseaImarat || 0), 0)
                                                },
                                                {
                                                    key: 'total',
                                                    type: 'کل',
                                                    amount: records.reduce((sum, r) => sum + (r.promiseAmount || 0), 0),
                                                    isTotal: true
                                                }
                                            ]}
                                            columns={[
                                                {
                                                    title: <span style={{ direction: 'rtl' }}>چندہ کی قسم</span>,
                                                    dataIndex: 'type',
                                                    key: 'type',
                                                    render: (text, record) => (
                                                        <Text strong={record.isTotal} style={{ direction: 'rtl', fontSize: record.isTotal ? '16px' : '14px' }}>
                                                            {text}
                                                        </Text>
                                                    )
                                                },
                                                {
                                                    title: <span style={{ direction: 'rtl' }}>رقم</span>,
                                                    dataIndex: 'amount',
                                                    key: 'amount',
                                                    align: 'right',
                                                    render: (val, record) => (
                                                        <Text strong={record.isTotal} style={{
                                                            color: record.isTotal ? '#1890ff' : 'inherit',
                                                            fontSize: record.isTotal ? '16px' : '14px'
                                                        }}>
                                                            Rs. {val.toLocaleString()}
                                                        </Text>
                                                    )
                                                }
                                            ]}
                                        />
                                    </div>

                                    {/* Halqa-wise Report */}
                                    <div style={{ marginBottom: '32px' }}>
                                        <Title level={4} style={{ direction: 'rtl', textAlign: 'right', color: '#1890ff' }}>حلقہ وار تفصیل</Title>
                                        <Table
                                            size="small"
                                            pagination={false}
                                            dataSource={(() => {
                                                const halqaMap: Record<string, { count: number; promised: number; paid: number }> = {};
                                                ansarMembers.forEach(m => {
                                                    const h = m.halqa || 'نامعلوم';
                                                    if (!halqaMap[h]) halqaMap[h] = { count: 0, promised: 0, paid: 0 };
                                                    halqaMap[h].count++;
                                                });
                                                records.forEach(r => {
                                                    const member = ansarMembers.find(m => m.id === r.memberId);
                                                    const h = member?.halqa || 'نامعلوم';
                                                    if (!halqaMap[h]) halqaMap[h] = { count: 0, promised: 0, paid: 0 };
                                                    halqaMap[h].promised += (r.promiseAmount || 0);
                                                    halqaMap[h].paid += (r.paidAmount || 0);
                                                });
                                                return Object.entries(halqaMap).map(([name, data]) => ({
                                                    key: name,
                                                    halqa: name,
                                                    ...data,
                                                    balance: data.promised - data.paid,
                                                    percentage: data.promised > 0 ? Math.round((data.paid / data.promised) * 100) : 0
                                                }));
                                            })()}
                                            columns={[
                                                {
                                                    title: <span style={{ direction: 'rtl' }}>حلقہ</span>,
                                                    dataIndex: 'halqa',
                                                    key: 'halqa',
                                                    render: (text) => <Text style={{ direction: 'rtl' }}>{text}</Text>
                                                },
                                                {
                                                    title: <span style={{ direction: 'rtl' }}>انصار</span>,
                                                    dataIndex: 'count',
                                                    key: 'count',
                                                    align: 'center'
                                                },
                                                {
                                                    title: <span style={{ direction: 'rtl' }}>وعدہ</span>,
                                                    dataIndex: 'promised',
                                                    key: 'promised',
                                                    align: 'right',
                                                    render: (val) => `Rs. ${val.toLocaleString()}`
                                                },
                                                {
                                                    title: <span style={{ direction: 'rtl' }}>ادائیگی</span>,
                                                    dataIndex: 'paid',
                                                    key: 'paid',
                                                    align: 'right',
                                                    render: (val) => <Text style={{ color: '#52c41a' }}>Rs. {val.toLocaleString()}</Text>
                                                },
                                                {
                                                    title: <span style={{ direction: 'rtl' }}>باقی</span>,
                                                    dataIndex: 'balance',
                                                    key: 'balance',
                                                    align: 'right',
                                                    render: (val) => <Text style={{ color: val > 0 ? '#f5222d' : '#52c41a' }}>Rs. {val.toLocaleString()}</Text>
                                                },
                                                {
                                                    title: <span style={{ direction: 'rtl' }}>فیصد</span>,
                                                    dataIndex: 'percentage',
                                                    key: 'percentage',
                                                    align: 'center',
                                                    render: (val) => <Progress percent={val} size="small" />
                                                }
                                            ]}
                                        />
                                    </div>

                                    {/* Markaz Payments Section */}
                                    <div style={{ marginBottom: '32px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                            <Button
                                                type="primary"
                                                icon={<PlusOutlined />}
                                                onClick={() => setMarkazModalVisible(true)}
                                            >
                                                Record Markaz Payment
                                            </Button>
                                            <Title level={4} style={{ direction: 'rtl', margin: 0, color: '#1890ff' }}>مرکز کو ادائیگی</Title>
                                        </div>
                                        <Table
                                            size="small"
                                            pagination={false}
                                            dataSource={markazPayments}
                                            rowKey="id"
                                            columns={[
                                                {
                                                    title: <span style={{ direction: 'rtl' }}>تاریخ</span>,
                                                    dataIndex: 'paymentDate',
                                                    key: 'paymentDate',
                                                    render: (val) => dayjs(val).format('DD MMM YYYY')
                                                },
                                                {
                                                    title: <span style={{ direction: 'rtl' }}>کوپن نمبر</span>,
                                                    dataIndex: 'couponNo',
                                                    key: 'couponNo',
                                                    align: 'center'
                                                },
                                                {
                                                    title: <span style={{ direction: 'rtl' }}>نوٹ</span>,
                                                    dataIndex: 'notes',
                                                    key: 'notes',
                                                    align: 'right',
                                                    render: (val) => <Text style={{ direction: 'rtl' }}>{val || '-'}</Text>
                                                },
                                                {
                                                    title: <span style={{ direction: 'rtl' }}>رقم</span>,
                                                    dataIndex: 'amount',
                                                    key: 'amount',
                                                    align: 'right',
                                                    render: (val) => <Text type="danger">Rs. {val.toLocaleString()}</Text>
                                                },
                                                {
                                                    title: '',
                                                    key: 'actions',
                                                    align: 'center',
                                                    render: (_, r) => (
                                                        <Popconfirm title="Delete this payment?" onConfirm={() => handleDeleteMarkazPayment(r.id)}>
                                                            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                                                        </Popconfirm>
                                                    )
                                                }
                                            ]}
                                            footer={() => (
                                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 16px', fontWeight: 'bold' }}>
                                                    <span>Total Paid to Markaz</span>
                                                    <span style={{ color: '#f5222d' }}>
                                                        Rs. {markazPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                                                    </span>
                                                </div>
                                            )}
                                        />
                                    </div>

                                    {/* Net Balance Section */}
                                    <div style={{ background: '#f0f2f5', padding: '24px', borderRadius: '8px', marginBottom: '32px' }}>
                                        <Row gutter={24} align="middle">
                                            <Col span={8} style={{ textAlign: 'center' }}>
                                                <Statistic
                                                    title="Total Collected (Local)"
                                                    value={records.reduce((sum, r) => sum + (r.paidAmount || 0), 0)}
                                                    prefix="Rs."
                                                    valueStyle={{ color: '#52c41a' }}
                                                />
                                            </Col>
                                            <Col span={8} style={{ textAlign: 'center' }}>
                                                <Statistic
                                                    title="Paid to Markaz"
                                                    value={markazPayments.reduce((sum, p) => sum + p.amount, 0)}
                                                    prefix="- Rs."
                                                    valueStyle={{ color: '#f5222d' }}
                                                />
                                            </Col>
                                            <Col span={8} style={{ textAlign: 'center', borderLeft: '1px solid #d9d9d9' }}>
                                                <Statistic
                                                    title="Net Balance in Hand"
                                                    value={
                                                        records.reduce((sum, r) => sum + (r.paidAmount || 0), 0) -
                                                        markazPayments.reduce((sum, p) => sum + p.amount, 0)
                                                    }
                                                    prefix="Rs."
                                                    valueStyle={{ color: '#1890ff', fontWeight: 'bold' }}
                                                />
                                            </Col>
                                        </Row>
                                    </div>

                                    {/* Footer */}
                                    <div style={{ marginTop: '48px', paddingTop: '16px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
                                        <Text type="secondary" style={{ direction: 'rtl' }}>
                                            تیار کردہ: {new Date().toLocaleDateString('ur-PK')}
                                        </Text>
                                    </div>
                                </div>
                            </Card>
                        )
                    }

                ]}
            />

            {/* Markaz Payment Modal */}
            <Modal
                title="Record Payment to Markaz"
                open={markazModalVisible}
                onCancel={() => setMarkazModalVisible(false)}
                footer={null}
            >
                <Form
                    form={markazForm}
                    layout="vertical"
                    onFinish={handleSaveMarkazPayment}
                    initialValues={{ paymentDate: dayjs() }}
                >
                    <Form.Item name="amount" label="Amount Sent" rules={[{ required: true, message: 'Please enter amount' }]}>
                        <InputNumber
                            style={{ width: '100%' }}
                            formatter={value => `Rs. ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={value => value!.replace(/Rs\.\s?|(,*)/g, '') as any}
                        />
                    </Form.Item>
                    <Form.Item name="couponNo" label="Coupon Number" rules={[{ required: true, message: 'Please enter coupon number' }]}>
                        <Input placeholder="Enter coupon number" />
                    </Form.Item>
                    <Form.Item name="paymentDate" label="Date Sent" rules={[{ required: true, message: 'Please select date' }]}>
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="notes" label="Notes (Optional)">
                        <Input.TextArea />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" loading={submitting} block>
                        Save Record
                    </Button>
                </Form>
            </Modal>

            <Drawer
                title={editingMember ? `Financials: ${editingMember.name}` : 'Details'}
                width={720}
                onClose={() => setDrawerVisible(false)}
                open={drawerVisible}
                destroyOnClose
            >
                {editingMember && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Summary Stats */}
                        <div style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                                <div>
                                    <Text type="secondary">Chanda Majlis</Text>
                                    <Title level={5} style={{ margin: 0 }}>Rs. {currentRecord?.chandaMajlis?.toLocaleString() || 0}</Title>
                                </div>
                                <div>
                                    <Text type="secondary">Salana Ijtema</Text>
                                    <Title level={5} style={{ margin: 0 }}>Rs. {currentRecord?.chandaSalanaIjtema?.toLocaleString() || 0}</Title>
                                </div>
                                <div>
                                    <Text type="secondary">Asyat</Text>
                                    <Title level={5} style={{ margin: 0 }}>Rs. {currentRecord?.chandaAsyat?.toLocaleString() || 0}</Title>
                                </div>
                                <div>
                                    <Text type="secondary">توسیع عمارت</Text>
                                    <Title level={5} style={{ margin: 0 }}>Rs. {currentRecord?.chandaTawseaImarat?.toLocaleString() || 0}</Title>
                                </div>
                            </div>
                            <Divider style={{ margin: '12px 0' }} />
                            <div style={{ display: 'flex', gap: '16px' }}>
                                <div style={{ flex: 1 }}>
                                    <Text type="secondary">Total Promised</Text>
                                    <Title level={4} style={{ margin: 0 }}>Rs. {currentRecord?.promiseAmount?.toLocaleString() || 0}</Title>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <Text type="secondary">Paid</Text>
                                    <Title level={4} style={{ margin: 0, color: '#52c41a' }}>Rs. {currentRecord?.paidAmount?.toLocaleString() || 0}</Title>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <Text type="secondary">Remaining</Text>
                                    <Title level={4} style={{ margin: 0, color: '#f5222d' }}>Rs. {((currentRecord?.promiseAmount || 0) - (currentRecord?.paidAmount || 0)).toLocaleString()}</Title>
                                </div>
                            </div>
                        </div>

                        {/* Promise Form */}
                        <Card size="small" title="Manage Promise (Budget)">
                            <Form
                                form={form}
                                layout="vertical"
                                onFinish={handleSavePromise}
                                onValuesChange={(_, allValues) => {
                                    // Auto-calculate total when any chanda value changes
                                    const total = (allValues.chandaMajlis || 0) +
                                        (allValues.chandaSalanaIjtema || 0) +
                                        (allValues.chandaAsyat || 0) +
                                        (allValues.chandaTawseaImarat || 0);
                                    form.setFieldsValue({ total });
                                }}
                            >
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '16px' }}>
                                    <Form.Item name="chandaMajlis" label="Chanda Majlis" rules={[{ required: true, message: 'Required' }]}>
                                        <InputNumber
                                            formatter={value => `Rs. ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                            parser={value => value!.replace(/Rs\.\s?|(,*)/g, '') as any}
                                            style={{ width: '100%' }}
                                            min={0}
                                        />
                                    </Form.Item>
                                    <Form.Item name="chandaSalanaIjtema" label="Salana Ijtema" rules={[{ required: true, message: 'Required' }]}>
                                        <InputNumber
                                            formatter={value => `Rs. ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                            parser={value => value!.replace(/Rs\.\s?|(,*)/g, '') as any}
                                            style={{ width: '100%' }}
                                            min={0}
                                        />
                                    </Form.Item>
                                    <Form.Item name="chandaAsyat" label="Asyat" rules={[{ required: true, message: 'Required' }]}>
                                        <InputNumber
                                            formatter={value => `Rs. ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                            parser={value => value!.replace(/Rs\.\s?|(,*)/g, '') as any}
                                            style={{ width: '100%' }}
                                            min={0}
                                        />
                                    </Form.Item>
                                    <Form.Item name="chandaTawseaImarat" label="توسیع عمارت" rules={[{ required: true, message: 'Required' }]}>
                                        <InputNumber
                                            formatter={value => `Rs. ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                            parser={value => value!.replace(/Rs\.\s?|(,*)/g, '') as any}
                                            style={{ width: '100%' }}
                                            min={0}
                                        />
                                    </Form.Item>
                                    <Form.Item name="total" label="Total">
                                        <InputNumber
                                            formatter={value => `Rs. ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                            style={{ width: '100%' }}
                                            disabled
                                            readOnly
                                        />
                                    </Form.Item>
                                </div>
                                <Button type="primary" htmlType="submit" loading={submitting} icon={<SaveOutlined />} block>
                                    Save Promise
                                </Button>
                            </Form>
                        </Card>

                        {/* Payment Section */}
                        <Card size="small" title="Record New Payment">
                            <Form form={paymentForm} layout="vertical" onFinish={handleAddPayment}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <Form.Item name="amount" label="Amount" rules={[{ required: true }]}>
                                        <InputNumber style={{ width: '100%' }} />
                                    </Form.Item>
                                    <Form.Item name="bookId" label="Receipt Book" rules={[{ required: true }]}>
                                        <Select placeholder="Select Book">
                                            {books.map(b => <Select.Option key={b.id} value={b.id}>{b.bookNo}</Select.Option>)}
                                        </Select>
                                    </Form.Item>
                                    <Form.Item name="receiptNo" label="Receipt #" rules={[{ required: true }]}>
                                        <InputNumber style={{ width: '100%' }} />
                                    </Form.Item>
                                    <Form.Item name="notes" label="Notes">
                                        <Input />
                                    </Form.Item>
                                </div>
                                <Button type="primary" htmlType="submit" loading={submitting} icon={<PlusOutlined />} block>
                                    {paymentEditingId ? 'Update Payment' : 'Add Payment'}
                                </Button>
                            </Form>
                        </Card>

                        {/* Payment List */}
                        <Card size="small" title="Payment History">
                            <List
                                dataSource={currentRecord?.payments || []}
                                renderItem={(p: Payment) => (
                                    <List.Item
                                        actions={[
                                            <Button type="text" icon={<EditOutlined />} onClick={() => {
                                                setPaymentEditingId(p.id);
                                                paymentForm.setFieldsValue({
                                                    amount: p.amount,
                                                    notes: p.notes,
                                                    bookId: p.bookId,
                                                    receiptNo: p.receiptNo
                                                });
                                            }} />,
                                            <Popconfirm title="Delete this payment?" onConfirm={() => handleDeletePayment(p.id)}>
                                                <Button type="text" danger icon={<DeleteOutlined />} />
                                            </Popconfirm>
                                        ]}
                                    >
                                        <List.Item.Meta
                                            title={<Text strong>Rs. {p.amount.toLocaleString()}</Text>}
                                            description={
                                                <Space split={<Divider type="vertical" />}>
                                                    <span>{dayjs(p.date).format('DD MMM YYYY')}</span>
                                                    <span>Book: {p.bookNo}</span>
                                                    <span>Receipt: {p.receiptNo}</span>
                                                </Space>
                                            }
                                        />
                                    </List.Item>
                                )}
                            />
                        </Card>
                    </div>
                )}
            </Drawer>
        </div>
    );
};

export default Ansarullah;
