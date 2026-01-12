import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  Tabs,
  Statistic,
  Tag,
  Avatar,
  Space,
  Typography,
  Button,
  Modal,
  message,
  Form,
  Input,
  Select,
  DatePicker,
  Checkbox,
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { Pie } from '@ant-design/charts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ApiService } from '../services/apiService';
import type { Member, Tanzeem } from '../types';
import { getTanzeemDisplayName, formatDate, exportToCSV } from '../utils/helpers';

import dayjs from 'dayjs';

const { TabPane } = Tabs;
const { Title, Text } = Typography;

const TanzeemView: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const data = await ApiService.getAllMembers();
      setMembers(data);
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMembersByTanzeem = (tanzeem: Tanzeem): Member[] => {
    return members.filter(member => member.tanzeem === tanzeem);
  };

  const getTanzeemStats = () => {
    const stats = members.reduce((acc, member) => {
      acc[member.tanzeem] = (acc[member.tanzeem] || 0) + 1;
      return acc;
    }, {} as Record<Tanzeem, number>);

    return Object.entries(stats).map(([tanzeem, count]) => ({
      type: getTanzeemDisplayName(tanzeem as Tanzeem),
      value: count,
    }));
  };

  const handleExportTanzeem = (tanzeem: Tanzeem) => {
    const tanzeemMembers = getMembersByTanzeem(tanzeem);
    const exportData = tanzeemMembers.map(member => ({
      Name: member.name,
      'Father Name': member.fatherName,
      Age: member.age,
      Phone: member.phone,
      CNIC: member.cnic,
      Address: member.address,
      Halqa: member.halqa || '',
      'Created At': formatDate(member.createdAt),
    }));

    exportToCSV(exportData, `${getTanzeemDisplayName(tanzeem).toLowerCase()}_members.csv`);
  };

  const handleExportTanzeemPDF = (tanzeem: Tanzeem) => {
    const tanzeemMembers = getMembersByTanzeem(tanzeem);

    // Create new PDF document
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(18);
    doc.text(`${getTanzeemDisplayName(tanzeem)} Members List`, 14, 20);

    // Add generation date
    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

    // Prepare table data
    const tableData = tanzeemMembers.map((member, index) => [
      index + 1,
      member.name,
      member.fatherName || '',
      member.age.toString(),
      member.phone || '',
      member.halqa || '',
      formatDate(member.createdAt)
    ]);

    // Add table
    autoTable(doc, {
      head: [['S.No', 'Name', 'Father Name', 'Age', 'Phone', 'Halqa', 'Joined']],
      body: tableData,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [24, 144, 255] },
      alternateRowStyles: { fillColor: [240, 240, 240] },
      didDrawCell: (_data) => {
        // This helps with character encoding
        doc.setTextColor(0, 0, 0);
      }
    });

    // Save the PDF
    doc.save(`${getTanzeemDisplayName(tanzeem).toLowerCase()}_members.pdf`);
  };

  const handleEdit = (member: Member) => {
    setEditingMember(member);
    form.setFieldsValue({
      name: member.name,
      fatherName: member.fatherName,
      gender: member.gender,
      dateOfBirth: member.dateOfBirth ? dayjs(member.dateOfBirth) : null,
      cnic: member.cnic,
      phone: member.phone,
      address: member.address,
      halqa: member.halqa,
      isDeceased: member.isDeceased,
      dateOfDeath: member.dateOfDeath ? dayjs(member.dateOfDeath) : null,
      isMoved: member.isMoved,
      movedTo: member.movedTo,
    });
    setModalVisible(true);
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    setEditingMember(null);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingMember) {
        const updatedMember = {
          ...editingMember,
          ...values,
          dateOfBirth: values.dateOfBirth ? values.dateOfBirth.format('YYYY-MM-DD') : undefined,
          dateOfDeath: values.dateOfDeath ? values.dateOfDeath.format('YYYY-MM-DD') : undefined,
        };
        await ApiService.updateMember(updatedMember.id, updatedMember);
        message.success('Member updated successfully');
        setModalVisible(false);
        setEditingMember(null);
        loadMembers(); // Refresh the data
      }
    } catch (error) {
      message.error('Failed to update member');
      console.error(error);
    }
  };

  const createTanzeemTable = (tanzeem: Tanzeem) => {
    const tanzeemMembers = getMembersByTanzeem(tanzeem);

    const columns = [
      {
        title: 'S.No',
        key: 'serial',
        width: 80,
        render: (_: any, __: any, index: number) => index + 1,
      },
      {
        title: 'Photo',
        key: 'photo',
        render: () => (
          <Avatar size="small" icon={<UserOutlined />} />
        ),
        width: 60,
      },
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        sorter: (a: Member, b: Member) => a.name.localeCompare(b.name),
      },
      {
        title: 'Father Name',
        dataIndex: 'fatherName',
        key: 'fatherName',
      },
      {
        title: 'Age',
        dataIndex: 'age',
        key: 'age',
        sorter: (a: Member, b: Member) => a.age - b.age,
        width: 70,
      },
      {
        title: 'Phone',
        dataIndex: 'phone',
        key: 'phone',
      },
      {
        title: 'Halqa',
        dataIndex: 'halqa',
        key: 'halqa',
        render: (halqa: string) => halqa || '-',
      },
      {
        title: 'Joined',
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (createdAt: string) => formatDate(createdAt),
        sorter: (a: Member, b: Member) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      },
      {
        title: 'Actions',
        key: 'actions',
        render: (__: any, record: Member) => (
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              Edit
            </Button>
          </Space>
        ),
        width: 100,
      },
    ];

    return (
      <Table
        columns={columns}
        dataSource={tanzeemMembers}
        rowKey="id"
        loading={loading}
        pagination={{
          defaultPageSize: 10,
          pageSizeOptions: [10, 20, 50, 100],
          showSizeChanger: true,
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} of ${total} members`,
          responsive: true,
        }}
      />
    );
  };

  const tanzeemList: Tanzeem[] = [
    'saf-e-awal',
    'atfal',
    'khuddam',
    'ansar',
    'nasirat',
    'lajna'
  ];

  const pieData = getTanzeemStats();

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>
        Tanzeem Management
      </Title>

      {/* Summary Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {tanzeemList.map(tanzeem => {
          const count = getMembersByTanzeem(tanzeem).length;
          const color = {
            'saf-e-awal': '#1890ff',
            'atfal': '#52c41a',
            'khuddam': '#faad14',
            'ansar': '#722ed1',
            'nasirat': '#f759ab',
            'lajna': '#13c2c2',
            'saf-e-awal-girls': '#999999', // Added for completeness
          }[tanzeem];

          return (
            <Col xs={24} sm={12} md={8} lg={4} key={tanzeem}>
              <Card>
                <Statistic
                  title={getTanzeemDisplayName(tanzeem)}
                  value={count}
                  prefix={<TeamOutlined style={{ color }} />}
                  valueStyle={{ color }}
                />
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* Distribution Chart */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card title="Tanzeem Distribution">
            <Pie
              data={pieData}
              angleField="value"
              colorField="type"
              radius={0.8}
              label={{
                type: 'outer',
                content: '{name} ({value})',
              }}
              height={400}
            />
          </Card>
        </Col>
      </Row>

      {/* Tanzeem Details Tabs */}
      <Card>
        <Tabs defaultActiveKey="saf-e-awal" type="card">
          {tanzeemList.map(tanzeem => {
            const count = getMembersByTanzeem(tanzeem).length;
            return (
              <TabPane
                tab={
                  <Space>
                    <span>{getTanzeemDisplayName(tanzeem)}</span>
                    <Tag color="blue">{count}</Tag>
                  </Space>
                }
                key={tanzeem}
              >
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Title level={4} style={{ margin: 0 }}>
                      {getTanzeemDisplayName(tanzeem)} Members
                    </Title>
                    <Text type="secondary">
                      Total: {count} members
                    </Text>
                  </div>
                  <div>
                    <Button
                      type="primary"
                      icon={<DownloadOutlined />}
                      onClick={() => handleExportTanzeem(tanzeem)}
                      disabled={count === 0}
                      style={{ marginRight: 8 }}
                    >
                      Export CSV
                    </Button>
                    <Button
                      type="primary"
                      icon={<FilePdfOutlined />}
                      onClick={() => handleExportTanzeemPDF(tanzeem)}
                      disabled={count === 0}
                    >
                      Export PDF
                    </Button>
                  </div>
                </div>
                {createTanzeemTable(tanzeem)}
              </TabPane>
            );
          })}
        </Tabs>
      </Card>
      {/* Edit Member Modal */}
      <Modal
        title={`Edit Member: ${editingMember?.name}`}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
        >
          <Form.Item
            name="name"
            label="Full Name"
            rules={[{ required: true, message: 'Please enter full name' }]}
          >
            <Input placeholder="Enter full name" />
          </Form.Item>

          <Form.Item
            name="fatherName"
            label="Father Name (Optional)"
          >
            <Input placeholder="Enter father name" />
          </Form.Item>

          <Form.Item
            name="gender"
            label="Gender"
            rules={[{ required: true, message: 'Please select gender' }]}
          >
            <Select placeholder="Select gender">
              <Select.Option value="male">Male</Select.Option>
              <Select.Option value="female">Female</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="dateOfBirth"
            label="Date of Birth"
            rules={[{ required: true, message: 'Please select date of birth' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              placeholder="Select date of birth"
              disabledDate={(current) => current && current > dayjs().endOf('day')}
            />
          </Form.Item>

          <Form.Item
            name="cnic"
            label="CNIC (Optional)"
          >
            <Input placeholder="Enter CNIC (without dashes)" maxLength={15} />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Phone (Optional)"
          >
            <Input placeholder="Enter phone number" />
          </Form.Item>

          <Form.Item
            name="address"
            label="Address"
            rules={[{ required: true, message: 'Please enter address' }]}
          >
            <Input.TextArea rows={3} placeholder="Enter complete address" />
          </Form.Item>

          <Form.Item
            name="halqa"
            label="Halqa (Optional)"
          >
            <Input placeholder="Enter halqa" />
          </Form.Item>

          <Form.Item
            name="isDeceased"
            valuePropName="checked"
          >
            <Checkbox>Deceased</Checkbox>
          </Form.Item>

          <Form.Item
            name="dateOfDeath"
            label="Date of Death"
            dependencies={['isDeceased']}
            rules={[{
              validator(_, value) {
                const isDeceased = form.getFieldValue('isDeceased');
                if (isDeceased && !value) {
                  return Promise.reject(new Error('Please select date of death'));
                }
                return Promise.resolve();
              },
            }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              placeholder="Select date of death"
              disabledDate={(current) => current && current > dayjs().endOf('day')}
            />
          </Form.Item>

          <Form.Item
            name="isMoved"
            valuePropName="checked"
          >
            <Checkbox>Moved</Checkbox>
          </Form.Item>

          <Form.Item
            name="movedTo"
            label="Moved To"
            dependencies={['isMoved']}
            rules={[{
              validator(_, value) {
                const isMoved = form.getFieldValue('isMoved');
                if (isMoved && !value) {
                  return Promise.reject(new Error('Please enter where member moved to'));
                }
                return Promise.resolve();
              },
            }]}
          >
            <Input
              placeholder="Enter new location"
              disabled={!form.getFieldValue('isMoved')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TanzeemView;