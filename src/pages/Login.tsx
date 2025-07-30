import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Space } from 'antd';
import { LockOutlined } from '@ant-design/icons'; // Only LockOutlined is needed now
import { useAuth } from '../contexts/useAuth';

const { Title, Text } = Typography;

interface LoginForm {
  pin: string; // Changed from email to pin
}

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();

  const onFinish = async (values: LoginForm) => {
    setLoading(true);
    setError(null);
    
    try {
      await login(values.pin); // Pass pin instead of email/password
      // Auth context will handle the redirect
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Card 
        style={{ 
          width: 400, 
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          borderRadius: '8px'
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <Title level={2} style={{ marginBottom: 8 }}>Tajneed Admin Dashboard</Title>
            <Text type="secondary">Jamaat Ahmadiyya Muridke</Text>
            <br />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Family & Membership Management System
            </Text>
          </div>

          {error && (
            <Alert
              message="Login Error"
              description={error}
              type="error"
              showIcon
            />
          )}

          <Alert
            message="Development Mode - Demo PIN"
            description={
              <div>
                <strong>PIN:</strong> 1234
              </div>
            }
            type="info"
            showIcon
            style={{ textAlign: 'left' }}
          />

          <Form
            name="login"
            onFinish={onFinish}
            layout="vertical"
            size="large"
          >
            <Form.Item
              name="pin" // Changed name to pin
              label="4-Digit PIN" // Changed label
              rules={[
                { required: true, message: 'Please input your PIN!' },
                { pattern: /^\d{4}$/, message: 'PIN must be exactly 4 digits!' }, // Regex for 4 digits
              ]}
            >
              <Input.Password // Using Input.Password for PIN entry
                prefix={<LockOutlined />} 
                placeholder="1234" 
                maxLength={4} // Limit to 4 characters
              />
            </Form.Item>

            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading}
                block
                style={{ height: '40px' }}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </Button>
            </Form.Item>
          </Form>

          <div style={{ marginTop: 16 }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Last updated: 7/28/2025, 3:55:08 PM • 52 total users
            </Text>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default Login;
