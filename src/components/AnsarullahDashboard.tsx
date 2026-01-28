import React, { useMemo } from 'react';
import {
    Card,
    Row,
    Col,
    Statistic,
    Table,
    Typography,
    Progress,
    Space
} from 'antd';
import {
    DollarOutlined,
    UserOutlined,
    PieChartOutlined,
    CheckCircleOutlined
} from '@ant-design/icons';
import type { Member, AnsarullahRecord, Payment } from '../types';

const { Text } = Typography;

interface AnsarullahDashboardProps {
    members: Member[];
    records: AnsarullahRecord[];
    selectedYear: number;
}

const AnsarullahDashboard: React.FC<AnsarullahDashboardProps> = ({
    members,
    records,
    selectedYear
}) => {
    // --- Calculations ---

    const stats = useMemo(() => {
        const totalPromised = records.reduce((sum, r) => sum + (r.promiseAmount || 0), 0);
        const totalPaid = records.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
        const balance = totalPromised - totalPaid;
        const participationCount = records.filter(r => (r.paidAmount || 0) > 0).length;
        const participationRate = members.length > 0 ? (participationCount / members.length) * 100 : 0;
        const collectionRate = totalPromised > 0 ? (totalPaid / totalPromised) * 100 : 0;

        return {
            totalPromised,
            totalPaid,
            balance,
            participationCount,
            participationRate,
            collectionRate,
            totalAnsar: members.length
        };
    }, [members, records]);

    const halqaStats = useMemo(() => {
        const statsMap: Record<string, { promised: number; paid: number; count: number; membersCount: number }> = {};

        // Initialize with all halqas from members
        members.forEach(m => {
            const h = m.halqa || 'Unknown';
            if (!statsMap[h]) statsMap[h] = { promised: 0, paid: 0, count: 0, membersCount: 0 };
            statsMap[h].membersCount++;
        });

        records.forEach(r => {
            const member = members.find(m => m.id === r.memberId);
            const h = member?.halqa || 'Unknown';
            if (!statsMap[h]) statsMap[h] = { promised: 0, paid: 0, count: 0, membersCount: 0 };
            statsMap[h].promised += (r.promiseAmount || 0);
            statsMap[h].paid += (r.paidAmount || 0);
            statsMap[h].count++;
        });

        return Object.entries(statsMap).map(([name, data]) => ({
            key: name,
            name,
            ...data,
            percent: data.promised > 0 ? Math.round((data.paid / data.promised) * 100) : 0,
            participation: data.membersCount > 0 ? Math.round((data.count / data.membersCount) * 100) : 0
        })).sort((a, b) => b.paid - a.paid);
    }, [members, records]);

    const recentPayments = useMemo(() => {
        const allPayments: (Payment & { memberName: string })[] = [];
        records.forEach(r => {
            const member = members.find(m => m.id === r.memberId);
            if (r.payments) {
                r.payments.forEach(p => {
                    allPayments.push({ ...p, memberName: member?.name || 'Unknown' });
                });
            }
        });
        return allPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10);
    }, [members, records]);

    const halqaColumns = [
        { title: 'Halqa', dataIndex: 'name', key: 'name' },
        { title: 'Ansar', dataIndex: 'membersCount', key: 'membersCount', align: 'center' as const },
        {
            title: 'Promised',
            dataIndex: 'promised',
            key: 'promised',
            render: (val: number) => `Rs. ${val.toLocaleString()}`,
            align: 'right' as const
        },
        {
            title: 'Paid',
            dataIndex: 'paid',
            key: 'paid',
            render: (val: number) => <Text strong style={{ color: '#52c41a' }}>Rs. {val.toLocaleString()}</Text>,
            align: 'right' as const
        },
        {
            title: 'Collection %',
            key: 'percent',
            render: (_: any, r: any) => (
                <Progress percent={r.percent} size="small" strokeColor={r.percent >= 100 ? '#52c41a' : '#1890ff'} />
            ),
            width: 150
        }
    ];

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false} className="stat-card">
                        <Statistic
                            title="Total Promised"
                            value={stats.totalPromised}
                            prefix={<DollarOutlined />}
                            precision={0}
                            valueStyle={{ color: '#1890ff' }}
                        />
                        <Text type="secondary" style={{ fontSize: '12px' }}>Budget for {selectedYear}</Text>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false} className="stat-card">
                        <Statistic
                            title="Total Collected"
                            value={stats.totalPaid}
                            prefix={<CheckCircleOutlined />}
                            precision={0}
                            valueStyle={{ color: '#52c41a' }}
                        />
                        <Progress percent={Math.round(stats.collectionRate)} size="small" status="active" strokeColor="#52c41a" />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false} className="stat-card">
                        <Statistic
                            title="Balance Due"
                            value={stats.balance}
                            prefix={<DollarOutlined />}
                            precision={0}
                            valueStyle={{ color: '#f5222d' }}
                        />
                        <Text type="secondary" style={{ fontSize: '12px' }}>Outstanding amount</Text>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false} className="stat-card">
                        <Statistic
                            title="Participation"
                            value={stats.participationRate}
                            prefix={<UserOutlined />}
                            suffix="%"
                            precision={1}
                        />
                        <Text type="secondary" style={{ fontSize: '12px' }}>{stats.participationCount} / {stats.totalAnsar} Ansar paid</Text>
                    </Card>
                </Col>
            </Row>

            <Row gutter={[16, 16]}>
                <Col xs={24} lg={16}>
                    <Card title={<span><PieChartOutlined /> Halqa Wise Performance</span>}>
                        <Table
                            dataSource={halqaStats}
                            columns={halqaColumns}
                            pagination={false}
                            size="middle"
                        />
                    </Card>
                </Col>
                <Col xs={24} lg={8}>
                    <Card title="Recent Payments">
                        {recentPayments.length > 0 ? (
                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                {recentPayments.map(p => (
                                    <div key={p.id} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #f0f0f0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Text strong>{p.memberName}</Text>
                                            <Text type="success" strong>Rs. {p.amount.toLocaleString()}</Text>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                            <Text type="secondary">{new Date(p.date).toLocaleDateString()}</Text>
                                            <Text type="secondary">Rcpt: {p.receiptNo}</Text>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <Text type="secondary">No recent payments found</Text>
                        )}
                    </Card>
                </Col>
            </Row>
        </Space>
    );
};

export default AnsarullahDashboard;
