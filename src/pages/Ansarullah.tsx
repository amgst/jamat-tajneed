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
    Tabs
} from 'antd';
import {
    UserOutlined,
    SearchOutlined,
    DollarOutlined,
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    SaveOutlined
} from '@ant-design/icons';
import { ApiService } from '../services/apiService';
import type { Member, AnsarullahRecord, Payment, ReceiptBook } from '../types';
import MemberForm from '../components/MemberForm';
import { formatCNIC } from '../utils/helpers';
import { validateMemberData, sanitizeMemberData } from '../utils/validation';
import dayjs from 'dayjs';
import AnsarullahDashboard from '../components/AnsarullahDashboard';

const { Text, Title } = Typography;

const Ansarullah: React.FC = () => {
    const { message } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [ansarMembers, setAnsarMembers] = useState<Member[]>([]);
    const [records, setRecords] = useState<AnsarullahRecord[]>([]);
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
            const [membersData, recordsData] = await Promise.all([
                ApiService.getAllMembers(),
                ApiService.getAnsarullahRecords(selectedYear)
            ]);

            // Filter only Ansar members
            setAnsarMembers(membersData.filter(m => m.tanzeem === 'ansar' && !m.isDeceased && !m.isMoved));
            setRecords(recordsData);
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

    const handleDeletePayment = async (paymentId: string) => {
        try {
            const res = await ApiService.deleteAnsarullahPayment(paymentId);
            if (res.success) {
                const refreshed = await ApiService.getAnsarullahRecords(selectedYear, editingMember?.id);
                if (refreshed && refreshed.length > 0) {
                    updateLocalRecord(refreshed[0]);
                }
                message.success('Payment deleted');
            }
        } catch (error) {
            message.error('Failed to delete payment');
        }
    };

    const handlePersonalDetailsSave = async (values: any) => {
        if (!editingMember) return;
        try {
            setSubmitting(true);
            const formData = values;
            const memberDataRaw: any = {
                ...editingMember,
                ...formData,
                cnic: formData.cnic ? formatCNIC(formData.cnic) : '',
                dateOfBirth: formData.dateOfBirth.format('YYYY-MM-DD'),
                updatedAt: new Date().toISOString(),
            };

            const validation = validateMemberData(memberDataRaw);
            if (!validation.valid) {
                message.error(`Validation failed: ${validation.errors.join(', ')}`);
                return;
            }

            const memberData = sanitizeMemberData(memberDataRaw);
            await ApiService.updateMember(editingMember.id, memberData);

            const refreshedMembers = await ApiService.getAllMembers();
            setAnsarMembers(refreshedMembers.filter(m => m.tanzeem === 'ansar' && !m.isMoved && !m.isDeceased));
            setEditingMember({ ...editingMember, ...memberData });
            message.success('Member details updated');
        } catch (error) {
            message.error('Failed to update member');
        } finally {
            setSubmitting(false);
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
                    }
                ]}
            />

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
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                                <div style={{ flex: 1 }}>
                                    <Text type="secondary">Chanda Majlis</Text>
                                    <Title level={5} style={{ margin: 0 }}>Rs. {currentRecord?.chandaMajlis?.toLocaleString() || 0}</Title>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <Text type="secondary">Salana Ijtema</Text>
                                    <Title level={5} style={{ margin: 0 }}>Rs. {currentRecord?.chandaSalanaIjtema?.toLocaleString() || 0}</Title>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <Text type="secondary">Asyat</Text>
                                    <Title level={5} style={{ margin: 0 }}>Rs. {currentRecord?.chandaAsyat?.toLocaleString() || 0}</Title>
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
                                        (allValues.chandaAsyat || 0);
                                    form.setFieldsValue({ total });
                                }}
                            >
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
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

                        {/* Member Details */}
                        <Divider>Member Personal Details</Divider>
                        <MemberForm
                            initialValues={editingMember}
                            onFinish={handlePersonalDetailsSave}
                            isSaving={submitting}
                        />
                    </div>
                )}
            </Drawer>
        </div>
    );
};

export default Ansarullah;
