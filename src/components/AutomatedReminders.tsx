import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Table, 
  Space, 
  Tag, 
  Statistic, 
  Row, 
  Col,
  App,
  Modal,
  Form,
  Input,
  Select,
  DatePicker
} from 'antd';
import { SendOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ApiService } from '../services/apiService';
import type { PaymentReminder } from '../types';

const { Option } = Select;

const AutomatedReminders: React.FC = () => {
  const { message } = App.useApp();
  const [reminders, setReminders] = useState<PaymentReminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadReminders();
  }, []);

  const loadReminders = async () => {
    setLoading(true);
    try {
      const data = await ApiService.getPaymentReminders();
      setReminders(data);
    } catch (error) {
      message.error('Failed to load reminders');
    } finally {
      setLoading(false);
    }
  };

  const handleSendReminder = async (reminderId: string) => {
    try {
      // In a real implementation, this would send an actual email/SMS
      // For now, we'll just update the status
      await ApiService.updatePaymentReminder(reminderId, { 
        status: 'sent',
        sentAt: new Date().toISOString()
      });
      
      message.success('Reminder sent successfully');
      loadReminders();
    } catch (error) {
      message.error('Failed to send reminder');
    }
  };

  const handleCreateReminder = async (values: any) => {
    try {
      const reminderData = {
        ...values,
        dueDate: values.dueDate.toISOString(),
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      await ApiService.createPaymentReminder(reminderData);
      message.success('Reminder created successfully');
      setModalVisible(false);
      form.resetFields();
      loadReminders();
    } catch (error) {
      message.error('Failed to create reminder');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'green';
      case 'pending': return 'orange';
      case 'failed': return 'red';
      default: return 'default';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'upcoming': return 'blue';
      case 'overdue': return 'red';
      default: return 'default';
    }
  };

  const columns = [
    {
      title: 'Member',
      dataIndex: 'memberName',
      key: 'memberName'
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={getTypeColor(type)}>
          {type === 'upcoming' ? 'Upcoming' : 'Overdue'}
        </Tag>
      )
    },
    {
      title: 'Program',
      dataIndex: 'programType',
      key: 'programType'
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (date: string) => dayjs(date).format('DD/MM/YYYY')
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => `Rs. ${amount.toLocaleString()}`
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Tag>
      )
    },
    {
      title: 'Sent At',
      dataIndex: 'sentAt',
      key: 'sentAt',
      render: (date: string) => date ? dayjs(date).format('DD/MM/YYYY HH:mm') : 'Not sent'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: PaymentReminder) => (
        <Space>
          {record.status === 'pending' && (
            <Button 
              icon={<SendOutlined />} 
              onClick={() => handleSendReminder(record.id)}
            >
              Send
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <Card 
      title="Automated Reminders" 
      extra={
        <Button 
          type="primary" 
          icon={<ClockCircleOutlined />}
          onClick={() => setModalVisible(true)}
        >
          Create Reminder
        </Button>
      }
    >
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Reminders"
              value={reminders.length}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Pending"
              value={reminders.filter(r => r.status === 'pending').length}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Sent"
              value={reminders.filter(r => r.status === 'sent').length}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Overdue"
              value={reminders.filter(r => r.type === 'overdue').length}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Table
        loading={loading}
        dataSource={reminders}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="Create Reminder"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateReminder}
        >
          <Form.Item
            name="memberName"
            label="Member Name"
            rules={[{ required: true, message: 'Please enter member name' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="memberId"
            label="Member ID"
            rules={[{ required: true, message: 'Please enter member ID' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="type"
            label="Reminder Type"
            rules={[{ required: true, message: 'Please select reminder type' }]}
          >
            <Select>
              <Option value="upcoming">Upcoming Payment</Option>
              <Option value="overdue">Overdue Payment</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="programType"
            label="Program Type"
            rules={[{ required: true, message: 'Please select program type' }]}
          >
            <Select>
              <Option value="Waqf-e-Jadeed">Waqf-e-Jadeed</Option>
              <Option value="Tahreq Jadeed">Tahreq Jadeed</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="amount"
            label="Amount (Rs.)"
            rules={[{ required: true, message: 'Please enter amount' }]}
          >
            <Input type="number" />
          </Form.Item>

          <Form.Item
            name="dueDate"
            label="Due Date"
            rules={[{ required: true, message: 'Please select due date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Create Reminder
              </Button>
              <Button onClick={() => {
                setModalVisible(false);
                form.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default AutomatedReminders;