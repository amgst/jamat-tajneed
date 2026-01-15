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
    Space,
    Select
} from 'antd';
import {
    FilterOutlined,
    DownloadOutlined,
    HistoryOutlined,
    UserOutlined,
    LineChartOutlined,
    PieChartOutlined,
    BookOutlined
} from '@ant-design/icons';
import type { Member, WaqfJadeedRecord, WaqfJadeedSpecialRecord, Payment } from '../types';
import { getTanzeemDisplayName, exportToCSV } from '../utils/helpers';
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
    const [selectedBook, setSelectedBook] = useState<string | null>(null);

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
            // Group child tanzeems into Daftar Atfal
            if (['atfal', 'nasirat', 'saf-e-awal', 'saf-e-awal-girls'].includes(r.member.tanzeem || '')) {
                display = 'Daftar Atfal';
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
                const memberRecord = records.find(r => r.record?.id === payment.waqfJadeedId);
                if (memberRecord) {
                    memberName = memberRecord.member.name;
                } else {
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
    }, [selectedBook, allPayments, records, specialRecords]);

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
                                    <Button
                                        icon={<DownloadOutlined />}
                                        disabled={!selectedBook}
                                        onClick={() => exportReport(bookDetails, `receipt_book_${selectedBook}`)}
                                    >
                                        Export CSV
                                    </Button>
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
