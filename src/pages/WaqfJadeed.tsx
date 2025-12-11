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
    Progress,
    Space,
    Row,
    Col,
    Statistic,
    message,
    Tabs,
    Collapse,
    Modal,
    Radio,
    Checkbox
} from 'antd';
import {
    UserOutlined,
    SearchOutlined,
    DollarOutlined,
    CheckCircleOutlined,
    DeleteOutlined,
    PlusOutlined,
    EditOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { ApiService } from '../services/apiService';
import type { Member, WaqfJadeedRecord, Family, Payment, WaqfJadeedSpecialRecord } from '../types';

const { Text, Title } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

const WaqfJadeed: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [members, setMembers] = useState<Member[]>([]);
    const [families, setFamilies] = useState<Family[]>([]);
    const [records, setRecords] = useState<WaqfJadeedRecord[]>([]);
    const [specialRecords, setSpecialRecords] = useState<WaqfJadeedSpecialRecord[]>([]);
    const [selectedYear, setSelectedYear] = useState<number>(dayjs().year());
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('families');

    // Drawer & Edit State
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [isEditingPromise, setIsEditingPromise] = useState(false);

    const [form] = Form.useForm();
    const [paymentForm] = Form.useForm(); // New form for adding payments
    const [specialForm] = Form.useForm();

    // Special Member State
    const [specialModalVisible, setSpecialModalVisible] = useState(false);
    const [activeFamilyId, setActiveFamilyId] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, [selectedYear]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [membersData, familiesData, recordsData, specialData] = await Promise.all([
                ApiService.getAllMembers(),
                ApiService.getAllFamilies(),
                ApiService.getWaqfJadeedRecords(selectedYear),
                ApiService.getWaqfJadeedSpecialRecords(selectedYear)
            ]);
            setMembers(membersData);
            setFamilies(familiesData);
            setRecords(recordsData);
            setSpecialRecords(Array.isArray(specialData) ? specialData : []);
        } catch (error) {
            message.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (member: Member) => {
        setEditingMember(member);
        const record = records.find(r => r.memberId === member.id);
        form.setFieldsValue({
            promiseAmount: record?.promiseAmount || 0,
            nagarparAmount: record?.nagarparAmount || 0,
        });
        // If no promise exists, default to editing mode. If it exists, view mode.
        setIsEditingPromise(!record?.promiseAmount);
        setDrawerVisible(true);
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            if (!editingMember) return;


            // Only update promise (notes removed as per request)
            const payload = {
                memberId: editingMember.id,
                year: selectedYear,
                promiseAmount: values.promiseAmount,
                nagarparAmount: values.nagarparAmount,
                // notes: values.notes 
            };

            const savedRecord = await ApiService.saveWaqfJadeedRecord(payload);
            if (savedRecord) {
                updateLocalRecord(savedRecord);
            }

            message.success('Promise updated');
            setIsEditingPromise(false);
        } catch (error) {
            message.error('Failed to save promise');
        }
    };

    const handleAddPayment = async (values: any) => {
        try {
            if (!editingMember) return;

            const payload = {
                memberId: editingMember.id,
                year: selectedYear,
                amount: values.amount,
                date: dayjs().toISOString(), // Default to now since no date picker
                notes: values.notes
            };

            const updatedRecord = await ApiService.addWaqfJadeedPayment(payload);
            if (updatedRecord) {
                updateLocalRecord(updatedRecord);
            }

            paymentForm.resetFields();
            message.success('Payment added');
        } catch (error) {
            console.error('Add payment error:', error);
            message.error('Failed to add payment');
        }
    };

    const handleDeletePayment = async (paymentId: string) => {
        try {
            const res = await ApiService.deleteWaqfJadeedPayment(paymentId);
            if (res.success) {
                // We need to fetch the updated record or manually update state
                // Since delete response might just be success, let's re-fetch or manual splice
                // Best to refetch or return new total from API. My API returns { newTotal, waqfJadeedId }.
                // But simplified: let's reload the record for this member
                if (editingMember) {
                    const [updatedRecords] = await Promise.all([ApiService.getWaqfJadeedRecords(selectedYear, editingMember.id)]);
                    if (updatedRecords && updatedRecords.length > 0) {
                        updateLocalRecord(updatedRecords[0]);
                    }
                }
                message.success('Payment deleted');
            }
        } catch (error) {
            message.error('Failed to delete payment');
        }
    };

    const updateLocalRecord = (savedRecord: WaqfJadeedRecord) => {
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

    // Special Member Handlers
    const handleSaveSpecial = async () => {
        try {
            const values = await specialForm.validateFields();
            const payload = {
                id: values.id,
                familyId: activeFamilyId,
                year: selectedYear,
                name: values.name,
                gender: values.gender,
                isDeceased: values.isDeceased,
                promiseAmount: values.promiseAmount,
                nagarparAmount: values.nagarparAmount,
            };
            const saved = await ApiService.saveWaqfJadeedSpecialRecord(payload);

            setSpecialRecords(prev => {
                const idx = prev.findIndex(r => r.id === saved.id);
                if (idx >= 0) {
                    const newRecs = [...prev];
                    newRecs[idx] = { ...saved, isDeceased: !!saved.isDeceased } as WaqfJadeedSpecialRecord;
                    return newRecs;
                }
                return [...prev, { ...saved, isDeceased: !!saved.isDeceased } as WaqfJadeedSpecialRecord];
            });

            message.success('Special record saved');
            setSpecialModalVisible(false);
            specialForm.resetFields();
        } catch (error) {
            message.error('Failed to save');
        }
    };

    const handleDeleteSpecial = async (id: string) => {
        try {
            await ApiService.deleteWaqfJadeedSpecialRecord(id);
            setSpecialRecords(prev => prev.filter(r => r.id !== id));
            message.success('Record deleted');
        } catch (error) {
            message.error('Failed to delete');
        }
    };

    const openSpecialEdit = (record: WaqfJadeedSpecialRecord) => {
        setActiveFamilyId(record.familyId);
        specialForm.setFieldsValue({
            id: record.id,
            name: record.name,
            gender: record.gender,
            isDeceased: record.isDeceased,
            promiseAmount: record.promiseAmount,
            nagarparAmount: record.nagarparAmount,
        });
        setSpecialModalVisible(true);
    };

    // Merge Data
    const getMemberData = (memberId: string) => {
        const member = members.find(m => m.id === memberId);
        if (!member) return null;
        const record = records.find(r => r.memberId === member.id);
        return {
            member,
            record,
            promise: (record?.promiseAmount || 0) + (record?.nagarparAmount || 0),
            paid: record?.paidAmount || 0,
            originalPromise: record?.promiseAmount || 0,
            nagarpar: record?.nagarparAmount || 0
        };
    };

    const filteredMemberData = useMemo(() => {
        let data = members.map(member => {
            const record = records.find(r => r.memberId === member.id);
            return {
                member,
                record,
                promise: (record?.promiseAmount || 0) + (record?.nagarparAmount || 0),
                paid: record?.paidAmount || 0,
                originalPromise: record?.promiseAmount || 0,
                nagarpar: record?.nagarparAmount || 0
            };
        });

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            data = data.filter(item =>
                item.member.name.toLowerCase().includes(lower) ||
                (item.member.fatherName || '').toLowerCase().includes(lower) ||
                (item.member.halqa || '').toLowerCase().includes(lower)
            );
        }
        return data;
    }, [members, records, searchTerm]);

    const filteredFamilyData = useMemo(() => {
        let data = families;
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            data = data.filter(f =>
                f.familyName.toLowerCase().includes(lower) ||
                (f.halqa || '').toLowerCase().includes(lower)
            );
        }
        // numeric sort by familyNumber
        return data.sort((a, b) => {
            const numA = a.familyNumber || 999999;
            const numB = b.familyNumber || 999999;
            return numA - numB;
        });
    }, [families, searchTerm]);


    // Stats
    const stats = useMemo(() => {
        const specialPromise = Array.isArray(specialRecords) ? specialRecords.reduce((sum, r) => sum + (r.promiseAmount || 0) + (r.nagarparAmount || 0), 0) : 0;
        const specialPaid = Array.isArray(specialRecords) ? specialRecords.reduce((sum, r) => sum + (r.paidAmount || 0), 0) : 0;

        const totalPromise = records.reduce((sum, r) => sum + (r.promiseAmount || 0) + (r.nagarparAmount || 0), 0) + specialPromise;
        const totalPaid = records.reduce((sum, r) => sum + (r.paidAmount || 0), 0) + specialPaid;
        const percent = totalPromise > 0 ? (totalPaid / totalPromise) * 100 : 0;
        return { totalPromise, totalPaid, percent };
    }, [records, specialRecords]);

    // Tanzeem Stats Aggregation
    const tanzeemStats = useMemo(() => {
        const statsMap: Record<string, { promise: number; paid: number; count: number }> = {};

        members.forEach(member => {
            const tanzeem = member.tanzeem || 'Unknown';
            if (!statsMap[tanzeem]) {
                statsMap[tanzeem] = { promise: 0, paid: 0, count: 0 };
            }
            const record = records.find(r => r.memberId === member.id);
            if (record) {
                statsMap[tanzeem].promise += (record.promiseAmount || 0) + (record.nagarparAmount || 0);
                statsMap[tanzeem].paid += record.paidAmount || 0;
            }
            statsMap[tanzeem].count += 1;
        });

        return Object.entries(statsMap).map(([name, data]) => ({
            name,
            ...data,
            percent: data.promise > 0 ? (data.paid / data.promise) * 100 : 0
        })).sort((a, b) => b.promise - a.promise); // Sort by highest promise
    }, [members, records]);

    const renderMemberCard = (item: any) => (
        <Card
            hoverable
            onClick={() => handleEdit(item.member)}
            bodyStyle={{ padding: 12 }}
            style={{ marginBottom: 16 }}
        >
            <Space style={{ width: '100%', marginBottom: 12 }}>
                <Avatar size="large" icon={<UserOutlined />} src={item.member.profilePhoto} />
                <div style={{ overflow: 'hidden' }}>
                    <Text strong style={{ display: 'block' }} ellipsis>{item.member.name}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {item.member.halqa || 'No Halqa'} • {item.member.tanzeem}
                    </Text>
                </div>
            </Space>

            <div style={{ background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                <Row justify="space-between" style={{ marginBottom: 4 }}>
                    <Text type="secondary">Promise:</Text>
                    <Text strong>{item.promise.toLocaleString()}</Text>
                </Row>
                <Row justify="space-between">
                    <Text type="secondary">Paid:</Text>
                    <Text strong style={{ color: item.paid >= item.promise && item.promise > 0 ? 'green' : undefined }}>
                        {item.paid.toLocaleString()}
                    </Text>
                </Row>
                <Progress
                    percent={item.promise > 0 ? Math.min(100, Math.round((item.paid / item.promise) * 100)) : 0}
                    size="small"
                    showInfo={false}
                    strokeColor={item.paid >= item.promise ? '#52c41a' : '#1890ff'}
                />
            </div>
        </Card>
    );

    return (
        <div style={{ paddingBottom: 80 }}>
            {/* Search Header */}
            <Card style={{ marginBottom: 16, position: 'sticky', top: 0, zIndex: 10 }} bodyStyle={{ padding: 12 }}>
                <Row gutter={[8, 8]} align="middle">
                    <Col xs={24} sm={12}>
                        <Title level={4} style={{ margin: 0 }}>Waqf-e-Jadeed</Title>
                    </Col>
                    <Col xs={12} sm={6}>
                        <Select
                            value={selectedYear}
                            onChange={setSelectedYear}
                            style={{ width: '100%' }}
                        >
                            {[2023, 2024, 2025, 2026].map(y => (
                                <Option key={y} value={y}>{y}</Option>
                            ))}
                        </Select>
                    </Col>
                    <Col xs={24} sm={6}>
                        <Input
                            prefix={<SearchOutlined />}
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            allowClear
                        />
                    </Col>
                </Row>
                <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ marginTop: 12 }}>
                    <Tabs.TabPane tab="Members" key="members" />
                    <Tabs.TabPane tab="Family Wise" key="families" />
                    <Tabs.TabPane tab="Dashboard" key="dashboard" />
                </Tabs>
            </Card>

            {/* Stats Cards */}
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={12} sm={8}>
                    <Card bodyStyle={{ padding: 16 }}>
                        <Statistic
                            title="Total Promise"
                            value={stats.totalPromise}
                            prefix={<DollarOutlined />}
                            precision={0}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={8}>
                    <Card bodyStyle={{ padding: 16 }}>
                        <Statistic
                            title="Total Paid"
                            value={stats.totalPaid}
                            prefix={<CheckCircleOutlined />}
                            valueStyle={{ color: '#3f8600' }}
                            precision={0}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card bodyStyle={{ padding: 16 }}>
                        <Text type="secondary">Collection Progress</Text>
                        <Progress percent={Math.round(stats.percent)} status="active" />
                    </Card>
                </Col>
            </Row>

            {/* Content */}
            {activeTab === 'members' ? (
                <List
                    grid={{ gutter: 16, xs: 1, sm: 2, lg: 3 }}
                    dataSource={filteredMemberData}
                    loading={loading}
                    renderItem={(item) => (
                        <List.Item>
                            {renderMemberCard(item)}
                        </List.Item>
                    )}
                    pagination={{
                        pageSize: 12,
                        responsive: true,
                        showSizeChanger: false
                    }}
                />
            ) : activeTab === 'families' ? (
                <div className="family-list">
                    {loading ? <p>Loading...</p> : (
                        <Collapse defaultActiveKey={[]} ghost>
                            {filteredFamilyData.map(family => {
                                const familyMembersCtx = family.memberIds.map(mid => getMemberData(mid)).filter(Boolean);
                                const familySpecialRecords = specialRecords.filter(r => r.familyId === family.id);

                                const membersPromise = familyMembersCtx.reduce((sum, m) => sum + (m?.promise || 0), 0);
                                const specialPromise = familySpecialRecords.reduce((sum, r) => sum + (r.promiseAmount || 0) + (r.nagarparAmount || 0), 0);
                                const familyTotalPromise = membersPromise + specialPromise;

                                const membersPaid = familyMembersCtx.reduce((sum, m) => sum + (m?.paid || 0), 0);
                                const specialPaid = familySpecialRecords.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
                                const familyTotalPaid = membersPaid + specialPaid;

                                const familyPercent = familyTotalPromise > 0 ? Math.round((familyTotalPaid / familyTotalPromise) * 100) : 0;

                                return (
                                    <Panel
                                        key={family.id}
                                        header={
                                            <Row justify="space-between" align="middle" style={{ width: '100%' }}>
                                                <Col>
                                                    <Text strong>{family.familyName}</Text>
                                                    <br />
                                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                                        {family.familyNumber ? <span>#{family.familyNumber} • </span> : ''}
                                                        Head: {getMemberData(family.headId)?.member.name || 'Unknown'} • {familyMembersCtx.length + familySpecialRecords.length} Cards
                                                    </Text>
                                                </Col>
                                                <Col style={{ textAlign: 'right' }}>
                                                    <Text type="secondary" style={{ fontSize: 12 }}>Paid / Promise</Text>
                                                    <div style={{ fontWeight: 500 }}>
                                                        {familyTotalPaid.toLocaleString()} / {familyTotalPromise.toLocaleString()}
                                                    </div>
                                                    <Progress percent={familyPercent} steps={5} size="small" strokeColor="#52c41a" />
                                                </Col>
                                            </Row>
                                        }
                                    >
                                        <List
                                            grid={{ gutter: 16, xs: 1, sm: 2, lg: 3 }}
                                            dataSource={familyMembersCtx}
                                            renderItem={(item: any) => (
                                                <List.Item>
                                                    {renderMemberCard(item)}
                                                </List.Item>
                                            )}
                                        />

                                        {/* Special Members Section */}
                                        <div style={{ marginTop: 16, borderTop: '1px dashed #d9d9d9', paddingTop: 16 }}>
                                            <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
                                                <Text type="secondary"><strong style={{ color: '#1890ff' }}>Special / Deceased Pledges</strong></Text>
                                                <Button
                                                    size="small"
                                                    type="dashed"
                                                    icon={<PlusOutlined />}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveFamilyId(family.id);
                                                        specialForm.resetFields();
                                                        setSpecialModalVisible(true);
                                                    }}
                                                >
                                                    Add Special
                                                </Button>
                                            </Row>
                                            <List
                                                grid={{ gutter: 16, xs: 1, sm: 2, lg: 3 }}
                                                dataSource={familySpecialRecords}
                                                renderItem={(record) => (
                                                    <List.Item>
                                                        <Card
                                                            size="small"
                                                            hoverable
                                                            actions={[
                                                                <EditOutlined key="edit" onClick={() => openSpecialEdit(record)} />,
                                                                <DeleteOutlined key="delete" onClick={() => handleDeleteSpecial(record.id)} />
                                                            ]}
                                                        >
                                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                <Text strong>{record.name}</Text>
                                                                {record.isDeceased && <Text type="secondary" style={{ fontSize: 10 }}>(Deceased)</Text>}
                                                            </div>
                                                            <div style={{ marginTop: 8 }}>
                                                                <Row justify="space-between">
                                                                    <Text type="secondary">Promise:</Text>
                                                                    <Text>{((record.promiseAmount || 0) + (record.nagarparAmount || 0)).toLocaleString()}</Text>
                                                                </Row>
                                                                {/* Show breakdown if nagarpar exists */}
                                                                {(record.nagarparAmount || 0) > 0 && (
                                                                    <Text type="secondary" style={{ fontSize: 10 }}>
                                                                        (P: {record.promiseAmount}, N: {record.nagarparAmount})
                                                                    </Text>
                                                                )}
                                                            </div>
                                                        </Card>
                                                    </List.Item>
                                                )}
                                            />
                                        </div>
                                    </Panel>
                                );
                            })}
                        </Collapse>
                    )}
                </div>
            ) : (
                // Dashboard Tab (Tanzeem Wise)
                <div className="dashboard-view">
                    <List
                        grid={{ gutter: 16, xs: 1, sm: 2, md: 3 }}
                        dataSource={tanzeemStats}
                        renderItem={(item) => (
                            <List.Item>
                                <Card title={item.name} hoverable>
                                    <Statistic
                                        title="Paid / Promise"
                                        value={item.paid}
                                        suffix={`/ ${item.promise.toLocaleString()}`}
                                        precision={0}
                                        valueStyle={{ color: item.percent >= 100 ? '#3f8600' : '#1890ff', fontSize: '1.2rem' }}
                                    />
                                    <Progress
                                        percent={Math.round(item.percent)}
                                        status={item.percent >= 100 ? 'success' : 'active'}
                                        strokeColor={item.percent >= 100 ? '#52c41a' : '#1890ff'}
                                    />
                                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between' }}>
                                        <Text type="secondary">Members: {item.count}</Text>
                                        <Text type="secondary">{item.percent.toFixed(1)}%</Text>
                                    </div>
                                </Card>
                            </List.Item>
                        )}
                    />
                </div>
            )}

            {/* Edit Drawer */}
            <Drawer
                title={`Edit: ${editingMember?.name}`}
                placement="bottom"
                height="70vh" // Good for mobile reachability
                onClose={() => setDrawerVisible(false)}
                open={drawerVisible}
                extra={
                    <Button type="primary" onClick={handleSave}>
                        Save
                    </Button>
                }
            >
                <Form form={form} layout="vertical">
                    <Row gutter={16}>
                        <Col span={6}>
                            <Form.Item label="Promised Amount">
                                {isEditingPromise ? (
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <Form.Item name="promiseAmount" noStyle>
                                            <InputNumber
                                                style={{ width: '100%' }}
                                                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                                parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                                                size="large"
                                                autoFocus
                                            />
                                        </Form.Item>
                                        <Button
                                            type="primary"
                                            onClick={handleSave}
                                            icon={<CheckCircleOutlined />}
                                        />
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Title level={4} style={{ margin: 0 }}>
                                            {(records.find(r => r.memberId === editingMember?.id)?.promiseAmount || 0).toLocaleString()}
                                        </Title>
                                        <Button
                                            size="small"
                                            icon={<EditOutlined />}
                                            onClick={() => setIsEditingPromise(true)}
                                        />
                                    </div>
                                )}
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item label="Nagarpar Amount">
                                {isEditingPromise ? (
                                    <Form.Item name="nagarparAmount" noStyle>
                                        <InputNumber
                                            style={{ width: '100%' }}
                                            formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                            parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                                            size="large"
                                        />
                                    </Form.Item>
                                ) : (
                                    <Title level={4} style={{ margin: 0 }}>
                                        {(records.find(r => r.memberId === editingMember?.id)?.nagarparAmount || 0).toLocaleString()}
                                    </Title>
                                )}
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item label="Total Promised">
                                <Title level={4} style={{ margin: 0, marginTop: 4 }}>
                                    {((records.find(r => r.memberId === editingMember?.id)?.promiseAmount || 0) +
                                        (records.find(r => r.memberId === editingMember?.id)?.nagarparAmount || 0)).toLocaleString()}
                                </Title>
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item label="Total Paid">
                                <Title level={4} style={{ margin: 0, marginTop: 4 }}>
                                    {records.find(r => r.memberId === editingMember?.id)?.paidAmount?.toLocaleString() || 0}
                                </Title>
                            </Form.Item>
                        </Col>
                    </Row>
                    {/* Notes field removed as per request */}
                </Form>

                <div style={{ marginTop: 24, padding: '16px 0', borderTop: '1px solid #f0f0f0' }}>
                    <Title level={5}>Add Payment</Title>
                    <Form form={paymentForm} layout="inline" onFinish={handleAddPayment}>
                        <div style={{ display: 'flex', gap: 8, width: '100%', flexWrap: 'wrap' }}>
                            <Form.Item name="amount" rules={[{ required: true, message: 'Req' }]} style={{ flex: 1, minWidth: 100, margin: 0 }}>
                                <InputNumber placeholder="Amount" style={{ width: '100%' }} />
                            </Form.Item>
                            <Form.Item name="notes" style={{ flex: 2, minWidth: 150, margin: 0 }}>
                                <Input placeholder="Ref/Receipt #" />
                            </Form.Item>
                            <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>Add</Button>
                        </div>
                    </Form>
                </div>

                <div style={{ marginTop: 24 }}>
                    <Title level={5}>Payment History</Title>
                    <List
                        size="small"
                        dataSource={records.find(r => r.memberId === editingMember?.id)?.payments || []}
                        renderItem={(item: Payment) => (
                            <List.Item
                                actions={[
                                    <Button
                                        type="text"
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={() => handleDeletePayment(item.id)}
                                    />
                                ]}
                            >
                                <List.Item.Meta
                                    title={`Rs. ${item.amount.toLocaleString()}`}
                                    description={
                                        <Space>
                                            <Text type="secondary">{dayjs(item.date).format('DD MMM YYYY')}</Text>
                                            {item.notes && <Text type="secondary">• {item.notes}</Text>}
                                        </Space>
                                    }
                                />
                            </List.Item>
                        )}
                    />
                </div>

                <div style={{ marginTop: 20, textAlign: 'center' }}>
                    <Text type="secondary">Year: {selectedYear}</Text>
                </div>
            </Drawer>

            {/* Special Member Modal */}
            <Modal
                title="Add/Edit Special Pledge"
                open={specialModalVisible}
                onOk={handleSaveSpecial}
                onCancel={() => setSpecialModalVisible(false)}
                okText="Save"
            >
                <Form form={specialForm} layout="vertical">
                    <Form.Item name="id" hidden><Input /></Form.Item>

                    <Form.Item label="Quick Select">
                        <Radio.Group
                            buttonStyle="solid"
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val) specialForm.setFieldsValue({ name: val });
                            }}
                        >
                            <Radio.Button value="Hazrat Muhammad (pbuh)">Hazrat Muhammad (pbuh)</Radio.Button>
                            <Radio.Button value="Hazrat Messiah Maoud (as)">Hazrat Messiah Maoud (as)</Radio.Button>
                        </Radio.Group>
                    </Form.Item>

                    <Form.Item name="name" label="Name / Title" rules={[{ required: true, message: 'Please enter name' }]}>
                        <Input placeholder="Enter Name" />
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="gender" label="Gender" initialValue="male">
                                <Radio.Group>
                                    <Radio value="male">Male</Radio>
                                    <Radio value="female">Female</Radio>
                                </Radio.Group>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="isDeceased" valuePropName="checked">
                                <Checkbox>Is Deceased?</Checkbox>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="promiseAmount" label="Promised Amount" initialValue={0}>
                                <InputNumber
                                    style={{ width: '100%' }}
                                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="nagarparAmount" label="Nagarpar Amount" initialValue={0}>
                                <InputNumber
                                    style={{ width: '100%' }}
                                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Modal>
        </div>
    );
};

export default WaqfJadeed;
