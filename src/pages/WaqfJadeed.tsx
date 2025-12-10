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
    Collapse
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
import type { Member, WaqfJadeedRecord, Family, Payment } from '../types';

const { Text, Title } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

const WaqfJadeed: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [members, setMembers] = useState<Member[]>([]);
    const [families, setFamilies] = useState<Family[]>([]);
    const [records, setRecords] = useState<WaqfJadeedRecord[]>([]);
    const [selectedYear, setSelectedYear] = useState<number>(dayjs().year());
    const [searchTerm, setSearchTerm] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('families');

    // Drawer & Edit State
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [isEditingPromise, setIsEditingPromise] = useState(false);

    const [form] = Form.useForm();
    const [paymentForm] = Form.useForm(); // New form for adding payments

    useEffect(() => {
        loadData();
    }, [selectedYear]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [membersData, familiesData, recordsData] = await Promise.all([
                ApiService.getAllMembers(),
                ApiService.getAllFamilies(),
                ApiService.getWaqfJadeedRecords(selectedYear)
            ]);
            setMembers(membersData);
            setFamilies(familiesData);
            setRecords(recordsData);
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
                // notes: values.notes 
            };

            const savedRecord = await ApiService.saveWaqfJadeedRecord(payload);
            updateLocalRecord(savedRecord);

            message.success('Promise updated');
            setIsEditingPromise(false);
        } catch (error) {
            message.error('Failed to save promise');
        }
    };

    const handleAddPayment = async () => {
        try {
            const values = await paymentForm.validateFields();
            if (!editingMember) return;

            const payload = {
                memberId: editingMember.id,
                year: selectedYear,
                amount: values.amount,
                date: values.date.toISOString(),
                notes: values.notes
            };

            const updatedRecord = await ApiService.addWaqfJadeedPayment(payload);
            updateLocalRecord(updatedRecord);

            paymentForm.resetFields();
            message.success('Payment added');
        } catch (error) {
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

    // Merge Data
    const getMemberData = (memberId: string) => {
        const member = members.find(m => m.id === memberId);
        if (!member) return null;
        const record = records.find(r => r.memberId === member.id);
        return {
            member,
            record,
            promise: record?.promiseAmount || 0,
            paid: record?.paidAmount || 0
        };
    };

    const filteredMemberData = useMemo(() => {
        let data = members.map(member => {
            const record = records.find(r => r.memberId === member.id);
            return {
                member,
                record,
                promise: record?.promiseAmount || 0,
                paid: record?.paidAmount || 0
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
        return data;
    }, [families, searchTerm]);


    // Stats
    const stats = useMemo(() => {
        const totalPromise = records.reduce((sum, r) => sum + (r.promiseAmount || 0), 0);
        const totalPaid = records.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
        const percent = totalPromise > 0 ? (totalPaid / totalPromise) * 100 : 0;
        return { totalPromise, totalPaid, percent };
    }, [records]);

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
            ) : (
                <div className="family-list">
                    {loading ? <p>Loading...</p> : (
                        <Collapse defaultActiveKey={[]} ghost>
                            {filteredFamilyData.map(family => {
                                const familyMembersCtx = family.memberIds.map(mid => getMemberData(mid)).filter(Boolean);
                                const familyTotalPromise = familyMembersCtx.reduce((sum, m) => sum + (m?.promise || 0), 0);
                                const familyTotalPaid = familyMembersCtx.reduce((sum, m) => sum + (m?.paid || 0), 0);
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
                                                        Head: {getMemberData(family.headId)?.member.name || 'Unknown'} • {familyMembersCtx.length} Members
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
                                    </Panel>
                                );
                            })}
                        </Collapse>
                    )}
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
                        <Col span={12}>
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
                        <Col span={12}>
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
        </div>
    );
};

export default WaqfJadeed;
