import React from 'react';
import { Typography, Row, Col, Divider } from 'antd';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface ReceiptTemplateProps {
    data: {
        receiptNo: string;
        date: string;
        name: string;
        memberCode: string;
        amount: number;
        year: number;
        type: 'Waqf-e-Jadeed' | 'Waqf-e-Jadeed (Special)' | 'Tahreq Jadeed' | 'Tahreq Jadeed (Special)';
        bookNo?: string;
        receiptNoDisplay?: string | number; // differentiated from receiptNo (system ID)
        tanzeem?: string;
        gender?: 'male' | 'female';
    }
}

export const ReceiptTemplate = React.forwardRef<HTMLDivElement, ReceiptTemplateProps>(({ data }, ref) => {
    const getFormattedName = () => {
        if (!data.gender) return data.name;
        if (data.gender === 'female') return `محترمہ ${data.name} صاحبہ`;
        return `محترم ${data.name} صاحب`;
    };

    const getUrduType = () => {
        if (data.type.includes('Special')) return 'وقف جدید (خصوصی)';
        if (data.type.includes('Waqf-e-Jadeed')) return 'وقف جدید';
        return data.type;
    };

    return (
        <div ref={ref} className="receipt-container" style={{ padding: 40, background: 'white', color: 'black' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <Title level={3} style={{ marginBottom: 0 }}>Jamat Tajneed</Title>
                <Text type="secondary">Secure Member Management System</Text>
                <Divider style={{ margin: '12px 0' }} />
                <Title level={4} style={{ marginTop: 0 }}>OFFICIAL RECEIPT</Title>
            </div>

            {/* Details */}
            <Row gutter={[16, 16]} style={{ marginBottom: 40 }}>
                <Col span={12}>
                    <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>RECEIPT NO</Text>
                        <div style={{ fontWeight: 'bold' }}>
                            {data.bookNo ? `Book: ${data.bookNo} - Rcpt: ${data.receiptNoDisplay}` : `#${data.receiptNo}`}
                        </div>
                    </div>
                </Col>
                <Col span={12} style={{ textAlign: 'right' }}>
                    <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>DATE</Text>
                        <div style={{ fontWeight: 'bold' }}>{dayjs(data.date).format('DD MMM YYYY')}</div>
                    </div>
                </Col>
            </Row>

            <div style={{ background: '#f5f5f5', padding: 24, borderRadius: 8, marginBottom: 40 }}>
                <Row gutter={[16, 24]}>
                    <Col span={24}>
                        <Text type="secondary" style={{ fontSize: 12 }}>RECEIVED FROM</Text>
                        <div style={{ fontSize: 18, fontWeight: 500, fontFamily: 'Noto Nastaliq Urdu, Arial, sans-serif' }}>{getFormattedName()}</div>
                        <Text type="secondary">{data.memberCode ? `Member Code: ${data.memberCode}` : 'Special Pledge'}</Text>
                        {data.tanzeem && (
                            <div style={{ marginTop: 4 }}>
                                <Text strong style={{ fontSize: 16, fontFamily: 'Noto Nastaliq Urdu, Arial, sans-serif' }}>{data.tanzeem}</Text>
                            </div>
                        )}
                    </Col>
                    <Col span={24}>
                        <Text type="secondary" style={{ fontSize: 12 }}>PAYMENT FOR</Text>
                        <div style={{ fontSize: 20, fontFamily: 'Noto Nastaliq Urdu, Arial, sans-serif' }}>{getUrduType()}</div>
                        <div style={{ fontSize: 14, color: '#666' }}>{data.year}</div>
                    </Col>
                </Row>
            </div>

            {/* Amount */}
            <div style={{ textAlign: 'center', marginBottom: 60 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>AMOUNT PAID</Text>
                <div style={{ fontSize: 36, fontWeight: 'bold', color: '#1890ff' }}>
                    {data.amount.toLocaleString()}
                </div>
            </div>

            {/* Footer */}
            <Row style={{ marginTop: 80 }}>
                <Col span={12}>
                    <div style={{ borderTop: '1px solid #ddd', width: '80%', paddingTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Authorized Signature</Text>
                    </div>
                </Col>
                <Col span={12} style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-block', borderTop: '1px solid #ddd', width: '80%', paddingTop: 8, textAlign: 'left' }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Payer Signature</Text>
                    </div>
                </Col>
            </Row>

            <div style={{ textAlign: 'center', marginTop: 40 }}>
                <Text type="secondary" style={{ fontSize: 10 }}>Generated via Jamat Tajneed System • {dayjs().format('DD MMM YYYY HH:mm')}</Text>
            </div>

            {/* Print Styles */}
            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .receipt-container, .receipt-container * {
                        visibility: visible;
                    }
                    .receipt-container {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        margin: 0;
                        padding: 20px !important;
                    }
                }
            `}</style>
        </div>
    );
});