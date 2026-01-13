import React, { useMemo, useState } from 'react';
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
    Space
} from 'antd';
import {
    FilterOutlined,
    DownloadOutlined,
    HistoryOutlined,
    UserOutlined,
    LineChartOutlined,
    PieChartOutlined
} from '@ant-design/icons';
import { Member, WaqfJadeedRecord, WaqfJadeedSpecialRecord, Tanzeem, Payment } from '../types';
import { getTanzeemDisplayName, getTanzeemUrduName } from '../utils/helpers';
import { exportToCSV } from '../utils/helpers';
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
}

const WaqfReports: React.FC<WaqfReportsProps> = ({
    members,
    records,
    specialRecords,
    allPayments,
    prevRecords,
    prevSpecialRecords,
    selectedYear
}) => {
    const [activeReport, setActiveReport] = useState('halqa');

    // --- Data Calculations ---

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
            const display = getTanzeemDisplayName(r.member.tanzeem);
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
                ...p,
                name,
                key: p.id
            };
        }).sort((a, b) => dayjs(b.date).unix() - dayjs(a.date).unix());
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

    // --- Export Functions ---

    const exportReport = (data: any[], filename: string) => {
        exportToCSV(data, `${filename}_${selectedYear}.csv`);
    };

    // --- Columns Definitions ---

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
        { title: 'Date', dataIndex: 'date', key: 'date', render: (d: string) => dayjs(d).format('DD MMM YYYY') },
        { title: 'Member', dataIndex: 'name', key: 'name' },
        { title: 'Receipt #', dataIndex: 'receiptNo', key: 'receiptNo', render: (val: any, r: any) => r.bookNo ? `${r.bookNo}-${val}` : val || 'N/A' },
        { title: 'Amount', dataIndex: 'amount', key: 'amount', render: (val: number) => <Text strong style={{ color: '#52c41a' }}>Rs. {val.toLocaleString()}</Text>, align: 'right' as const }
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

    return (
        <Card className="waqf-reports-container">
            <Tabs
                activeKey={activeReport}
                onChange={setActiveReport}
                type="line"
                items={[
                    {
                        key: 'halqa',
                        label: <span><PieChartOutlined /> Halqa Performance</span>,
                        children: (
                            <div>
                                <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                                    <Title level={5} style={{ margin: 0 }}>Halqa Collection Summary</Title>
                                    <Button icon={<DownloadOutlined />} onClick={() => exportReport(halqaStats, 'halqa_report')}>Export CSV</Button>
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
                                    <Button icon={<DownloadOutlined />} onClick={() => exportReport(tanzeemStats, 'tanzeem_report')}>Export CSV</Button>
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
                                    <Button icon={<DownloadOutlined />} onClick={() => exportReport(defaulters, 'defaulters_list')}>Export CSV</Button>
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
                                    <Button icon={<DownloadOutlined />} onClick={() => exportReport(transactionLogs, 'transaction_log')}>Export CSV</Button>
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
                                    <Button icon={<DownloadOutlined />} onClick={() => exportReport(comparisonStats, 'year_comparison')}>Export CSV</Button>
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
                    }
                ]}
            />
        </Card>
    );
};

export default WaqfReports;
