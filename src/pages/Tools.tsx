import React from 'react';
import { Card, Typography, Row, Col, Button } from 'antd';
import { CalculatorOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph } = Typography;

const Tools: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div style={{ padding: '24px' }}>
            <Title level={2}>Tools</Title>
            <Paragraph>
                Helpful utilities for daily tasks.
            </Paragraph>

            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Card
                        hoverable
                        title="Zakat Calculator"
                        extra={<CalculatorOutlined />}
                        actions={[
                            <Button type="link" onClick={() => navigate('/tools/zakat-calculator')}>
                                Open
                            </Button>
                        ]}
                    >
                        <Paragraph ellipsis={{ rows: 2 }}>
                            Calculate your Zakat obligations easily based on your assets.
                        </Paragraph>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default Tools;
