import React, { useState } from 'react';
import { Form, InputNumber, Card, Typography, Button, Divider, Alert, Row, Col } from 'antd';
import { CalculatorOutlined, DollarOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const ZakatCalculator: React.FC = () => {
    const [zakatVisible, setZakatVisible] = useState(false);
    const [zakatAmount, setZakatAmount] = useState<number>(0);
    const [totalAssets, setTotalAssets] = useState<number>(0);

    const [form] = Form.useForm();

    const onFinish = (values: any) => {
        // Calculate total assets
        const cash = values.cash || 0;
        const gold = values.gold || 0;
        const silver = values.silver || 0;
        const business = values.business || 0;
        const other = values.other || 0;
        const debts = values.debts || 0;

        const total = (cash + gold + silver + business + other) - debts;
        setTotalAssets(total);

        // Calculate Zakat (2.5% of total)
        // Assuming Nisab is met for simplicity, or user knows to check. 
        // Usually one would check against gold/silver nisab rates.
        // For this simple calculator, we just apply 2.5% if positive.
        if (total > 0) {
            setZakatAmount(total * 0.025);
        } else {
            setZakatAmount(0);
        }
        setZakatVisible(true);
    };

    const onReset = () => {
        form.resetFields();
        setZakatVisible(false);
        setZakatAmount(0);
        setTotalAssets(0);
    };

    return (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px' }}>
            <Card>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <Title level={2}>
                        <CalculatorOutlined /> Zakat Calculator
                    </Title>
                    <Paragraph>
                        Calculate your Zakat easily. Enter the value of your assets below.
                    </Paragraph>
                </div>

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={onFinish}
                    initialValues={{
                        cash: 0,
                        gold: 0,
                        silver: 0,
                        business: 0,
                        other: 0,
                        debts: 0
                    }}
                >
                    <Row gutter={16}>
                        <Col xs={24} md={12}>
                            <Form.Item
                                name="cash"
                                label="Cash on Hand & Bank Accounts"
                                tooltip="Include cash at home, savings, current accounts, etc."
                            >
                                <InputNumber<number>
                                    style={{ width: '100%' }}
                                    formatter={(value) => `Rs ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    parser={(value) => value ? parseFloat(value.replace(/\Rs\s?|(,*)/g, '')) : 0}
                                    addonAfter={<DollarOutlined />}
                                    min={0}
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                name="gold"
                                label="Value of Gold"
                                tooltip="Current market value of full ownership gold."
                            >
                                <InputNumber<number>
                                    style={{ width: '100%' }}
                                    formatter={(value) => `Rs ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    parser={(value) => value ? parseFloat(value.replace(/\Rs\s?|(,*)/g, '')) : 0}
                                    addonAfter={<DollarOutlined />}
                                    min={0}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col xs={24} md={12}>
                            <Form.Item
                                name="silver"
                                label="Value of Silver"
                                tooltip="Current market value of full ownership silver."
                            >
                                <InputNumber<number>
                                    style={{ width: '100%' }}
                                    formatter={(value) => `Rs ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    parser={(value) => value ? parseFloat(value.replace(/\Rs\s?|(,*)/g, '')) : 0}
                                    addonAfter={<DollarOutlined />}
                                    min={0}
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                name="business"
                                label="Business Assets (Inventory/Stock)"
                                tooltip="Current value of goods for sale."
                            >
                                <InputNumber<number>
                                    style={{ width: '100%' }}
                                    formatter={(value) => `Rs ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    parser={(value) => value ? parseFloat(value.replace(/\Rs\s?|(,*)/g, '')) : 0}
                                    addonAfter={<DollarOutlined />}
                                    min={0}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col xs={24} md={12}>
                            <Form.Item
                                name="other"
                                label="Other Assets"
                                tooltip="Other zakatable assets (shares, investments, etc.)"
                            >
                                <InputNumber<number>
                                    style={{ width: '100%' }}
                                    formatter={(value) => `Rs ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    parser={(value) => value ? parseFloat(value.replace(/\Rs\s?|(,*)/g, '')) : 0}
                                    addonAfter={<DollarOutlined />}
                                    min={0}
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item
                                name="debts"
                                label="Liabilities / Debts"
                                tooltip="Debts due immediately"
                            >
                                <InputNumber<number>
                                    style={{ width: '100%' }}
                                    formatter={(value) => `Rs ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    parser={(value) => value ? parseFloat(value.replace(/\Rs\s?|(,*)/g, '')) : 0}
                                    addonAfter={<DollarOutlined />}
                                    min={0}
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Divider />

                    <Form.Item>
                        <Button type="primary" htmlType="submit" block size="large">
                            Calculate Zakat
                        </Button>
                        <Button htmlType="button" onClick={onReset} block style={{ marginTop: 8 }}>
                            Reset
                        </Button>
                    </Form.Item>
                </Form>

                {zakatVisible && (
                    <div style={{ marginTop: 24 }}>
                        <Alert
                            message={<Title level={4}>Zakat Calculation Result</Title>}
                            description={
                                <div>
                                    <Row gutter={16} style={{ marginTop: 12 }}>
                                        <Col span={12}>
                                            <Text type="secondary">Total Net Assets:</Text>
                                        </Col>
                                        <Col span={12} style={{ textAlign: 'right' }}>
                                            <Text strong>Rs {totalAssets.toLocaleString()}</Text>
                                        </Col>
                                    </Row>
                                    <Divider style={{ margin: '12px 0' }} />
                                    <Row gutter={16}>
                                        <Col span={12}>
                                            <Text style={{ fontSize: 16 }}>Zakat Payable (2.5%):</Text>
                                        </Col>
                                        <Col span={12} style={{ textAlign: 'right' }}>
                                            <Text strong style={{ fontSize: 20, color: '#52c41a' }}>
                                                Rs {zakatAmount.toLocaleString()}
                                            </Text>
                                        </Col>
                                    </Row>
                                </div>
                            }
                            type="success"
                            showIcon
                        />
                    </div>
                )}
            </Card>
        </div>
    );
};

export default ZakatCalculator;
