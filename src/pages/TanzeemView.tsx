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
  message
} from 'antd';
import {
  UserOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  EditOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ApiService } from '../services/apiService';
import MemberForm from '../components/MemberForm';
import type { Member, Tanzeem } from '../types';
import { getTanzeemDisplayName, formatDate, exportToCSV, calculateAge, determineTanzeem } from '../utils/helpers';


const { TabPane } = Tabs;
const { Title, Text } = Typography;

const TanzeemView: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);

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
    return members.filter(member => member.tanzeem === tanzeem && !member.isBList);
  };


  const handleExportTanzeem = (tanzeem: Tanzeem) => {
    const tanzeemMembers = getMembersByTanzeem(tanzeem);
    const exportData = tanzeemMembers.map(member => ({
      Name: member.name,
      'Father Name': member.fatherName,
      Age: member.age,
      Phone: member.phone,
      Address: member.address,
      Halqa: member.halqa || '',
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
      member.halqa || ''
    ]);

    // Add table
    autoTable(doc, {
      head: [['S.No', 'Name', 'Father Name', 'Age', 'Phone', 'Halqa']],
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
    setModalVisible(true);
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    setEditingMember(null);
  };

  const handleModalOk = async (values: any) => {
    try {
      if (editingMember) {
        const age = calculateAge(values.dateOfBirth.format('YYYY-MM-DD'));
        const tanzeem = determineTanzeem(age, values.gender);

        const updatedMember = {
          ...editingMember,
          ...values,
          age,
          tanzeem,
          dateOfBirth: values.dateOfBirth.format('YYYY-MM-DD'),
          dateOfDeath: values.dateOfDeath ? values.dateOfDeath.format('YYYY-MM-DD') : undefined,
          updatedAt: new Date().toISOString(),
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
          <TabPane
            tab={
              <Space>
                <span>B List</span>
                <Tag color="orange">{members.filter(m => m.isBList).length}</Tag>
              </Space>
            }
            key="b-list"
          >
            <div style={{ marginBottom: 16 }}>
              <Title level={4}>B List Members</Title>
              <Text type="secondary">Members marked for B List tracking</Text>
            </div>
            <Table
              columns={[
                {
                  title: 'S.No',
                  key: 'serial',
                  width: 80,
                  render: (_: any, __: any, index: number) => index + 1,
                },
                {
                  title: 'Name',
                  dataIndex: 'name',
                  key: 'name',
                },
                {
                  title: 'Father Name',
                  dataIndex: 'fatherName',
                  key: 'fatherName',
                },
                {
                  title: 'Tanzeem',
                  dataIndex: 'tanzeem',
                  key: 'tanzeem',
                  render: (t: Tanzeem) => getTanzeemDisplayName(t),
                },
                {
                  title: 'Moved To',
                  dataIndex: 'movedTo',
                  key: 'movedTo',
                },
                {
                  title: 'Actions',
                  key: 'actions',
                  render: (__: any, record: Member) => (
                    <Button
                      type="primary"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleEdit(record)}
                    >
                      Edit
                    </Button>
                  ),
                }
              ]}
              dataSource={members.filter(m => m.isBList)}
              rowKey="id"
              loading={loading}
            />
          </TabPane>
        </Tabs>
      </Card>
      <Modal
        title={`Edit Member: ${editingMember?.name}`}
        open={modalVisible}
        onCancel={handleModalCancel}
        footer={null}
        width={700}
        destroyOnHidden
      >
        <MemberForm
          initialValues={editingMember || undefined}
          onFinish={handleModalOk}
          isSaving={false} // Use a separate isSaving state if needed
          showCancel
          onCancel={handleModalCancel}
          existingMembers={members}
        />
      </Modal>
    </div>
  );
};

export default TanzeemView;
