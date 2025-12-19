import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  InputNumber, 
  Select, 
  DatePicker, 
  Button, 
  List, 
  Tag, 
  Space, 
  Modal, 
  Alert,
  App
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ApiService } from '../services/apiService';
import type { PaymentPlan } from '../types';

const { Option } = Select;

interface PaymentPlanManagerProps {
  memberId: string;
  year: number;
  totalAmount: number;
  onUpdate: () => void;
}

const PaymentPlanManager: React.FC<PaymentPlanManagerProps> = ({ 
  memberId, 
  year, 
  totalAmount,
  onUpdate
}) => {
  const { message } = App.useApp();
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PaymentPlan | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadPaymentPlans();
  }, [memberId]);

  const loadPaymentPlans = async () => {
    setLoading(true);
    try {
      const data = await ApiService.getPaymentPlans(memberId);
      setPlans(data);
    } catch (error) {
      message.error('Failed to load payment plans');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async (values: any) => {
    try {
      const startDate = values.startDate.toISOString();
      const endDate = values.endDate.toISOString();
      
      // Calculate installments
      const totalInstallments = calculateInstallments(values.frequency, startDate, endDate);
      const installmentAmount = values.totalAmount / totalInstallments;
      
      const planData = {
        memberId,
        year,
        totalAmount: values.totalAmount,
        startDate,
        endDate,
        frequency: values.frequency,
        installmentAmount,
        totalInstallments,
        paidInstallments: 0,
        remainingAmount: values.totalAmount,
        isActive: true
      };

      await ApiService.createPaymentPlan(planData);
      message.success('Payment plan created successfully');
      setModalVisible(false);
      form.resetFields();
      loadPaymentPlans();
      onUpdate();
    } catch (error) {
      message.error('Failed to create payment plan');
    }
  };

  const handleUpdatePlan = async (values: any) => {
    if (!editingPlan) return;
    
    try {
      const startDate = values.startDate.toISOString();
      const endDate = values.endDate.toISOString();
      
      // Calculate installments
      const totalInstallments = calculateInstallments(values.frequency, startDate, endDate);
      const installmentAmount = values.totalAmount / totalInstallments;
      
      const planData = {
        totalAmount: values.totalAmount,
        startDate,
        endDate,
        frequency: values.frequency,
        installmentAmount,
        totalInstallments,
        remainingAmount: values.totalAmount - (editingPlan.paidInstallments * installmentAmount)
      };

      await ApiService.updatePaymentPlan(editingPlan.id, planData);
      message.success('Payment plan updated successfully');
      setModalVisible(false);
      setEditingPlan(null);
      form.resetFields();
      loadPaymentPlans();
      onUpdate();
    } catch (error) {
      message.error('Failed to update payment plan');
    }
  };

  const handleDeletePlan = async (planId: string) => {
    try {
      await ApiService.deletePaymentPlan(planId);
      message.success('Payment plan deleted successfully');
      loadPaymentPlans();
      onUpdate();
    } catch (error) {
      message.error('Failed to delete payment plan');
    }
  };

  const calculateInstallments = (frequency: string, startDate: string, endDate: string): number => {
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    const diffMonths = end.diff(start, 'month');
    
    switch (frequency) {
      case 'monthly':
        return diffMonths + 1;
      case 'quarterly':
        return Math.ceil((diffMonths + 1) / 3);
      case 'half-yearly':
        return Math.ceil((diffMonths + 1) / 6);
      case 'yearly':
        return Math.ceil((diffMonths + 1) / 12);
      default:
        return 1;
    }
  };

  const handleEditPlan = (plan: PaymentPlan) => {
    setEditingPlan(plan);
    setModalVisible(true);
    form.setFieldsValue({
      totalAmount: plan.totalAmount,
      startDate: dayjs(plan.startDate),
      endDate: dayjs(plan.endDate),
      frequency: plan.frequency
    });
  };

  const resetModal = () => {
    setModalVisible(false);
    setEditingPlan(null);
    form.resetFields();
  };

  const getFrequencyLabel = (frequency: string): string => {
    const labels: Record<string, string> = {
      'monthly': 'Monthly',
      'quarterly': 'Quarterly',
      'half-yearly': 'Half-Yearly',
      'yearly': 'Yearly'
    };
    return labels[frequency] || frequency;
  };

  return (
    <Card 
      title="Payment Plans" 
      extra={
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => setModalVisible(true)}
        >
          Create Plan
        </Button>
      }
    >
      {plans.length === 0 ? (
        <Alert 
          message="No payment plans created" 
          description="Create a payment plan to help members manage their contributions." 
          type="info" 
          showIcon 
        />
      ) : (
        <List
          loading={loading}
          dataSource={plans}
          renderItem={plan => (
            <List.Item
              actions={[
                <Button 
                  type="text" 
                  icon={<EditOutlined />} 
                  onClick={() => handleEditPlan(plan)}
                />,
                <Button 
                  type="text" 
                  icon={<DeleteOutlined />} 
                  danger 
                  onClick={() => handleDeletePlan(plan.id)}
                />
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <span>{getFrequencyLabel(plan.frequency)} Plan</span>
                    {plan.isActive && <Tag color="green">Active</Tag>}
                    {!plan.isActive && <Tag color="red">Inactive</Tag>}
                  </Space>
                }
                description={
                  <Space direction="vertical" size={0}>
                    <div>Total: Rs. {plan.totalAmount.toLocaleString()}</div>
                    <div>Installment: Rs. {plan.installmentAmount.toLocaleString()} × {plan.totalInstallments}</div>
                    <div>Duration: {dayjs(plan.startDate).format('MMM YYYY')} - {dayjs(plan.endDate).format('MMM YYYY')}</div>
                    <div>Paid: {plan.paidInstallments}/{plan.totalInstallments} installments</div>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}

      <Modal
        title={editingPlan ? "Edit Payment Plan" : "Create Payment Plan"}
        open={modalVisible}
        onCancel={resetModal}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={editingPlan ? handleUpdatePlan : handleCreatePlan}
        >
          <Form.Item
            name="totalAmount"
            label="Total Amount (Rs.)"
            rules={[{ required: true, message: 'Please enter total amount' }]}
          >
            <InputNumber 
              style={{ width: '100%' }} 
              min={0} 
              formatter={value => `Rs. ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value!.replace(/Rs.\s?|(,*)/g, '') as any}
            />
          </Form.Item>

          <Form.Item
            name="frequency"
            label="Payment Frequency"
            rules={[{ required: true, message: 'Please select frequency' }]}
          >
            <Select placeholder="Select frequency">
              <Option value="monthly">Monthly</Option>
              <Option value="quarterly">Quarterly</Option>
              <Option value="half-yearly">Half-Yearly</Option>
              <Option value="yearly">Yearly</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="startDate"
            label="Start Date"
            rules={[{ required: true, message: 'Please select start date' }]}
          >
            <DatePicker picker="month" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="endDate"
            label="End Date"
            rules={[{ required: true, message: 'Please select end date' }]}
          >
            <DatePicker picker="month" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingPlan ? "Update Plan" : "Create Plan"}
              </Button>
              <Button onClick={resetModal}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default PaymentPlanManager;