import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Tag,
  Avatar,
  Row,
  Col,
  Statistic,
  Descriptions,
  message,
  Spin,
  Popconfirm,
  Modal,
  Select,
  Form,
} from 'antd';
import {
  ArrowLeftOutlined,
  UserOutlined,
  DownloadOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { getAllMembers, getAllFamilies, updateFamily } from '../services/firebase'; // Changed import
import { getTanzeemDisplayName, formatDate } from '../utils/helpers';
import type { Family, Member } from '../types';
const { Title, Text } = Typography;
const { Option } = Select;

const FamilyDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [family, setFamily] = useState<Family | null>(null);
  const [familyMembers, setFamilyMembers] = useState<Member[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [form] = Form.useForm();

  const loadFamilyData = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    try {
      const [familiesData, allMembersData] = await Promise.all([
        getAllFamilies(),
        getAllMembers()
      ]);

      const familyData = familiesData.find(f => f.id === id);

      if (familyData) {
        setFamily(familyData);
        setAllMembers(allMembersData);
        // Get family members
        const members = allMembersData.filter((member: Member) =>
          familyData.memberIds.includes(member.id)
        );
        setFamilyMembers(members);
      } else {
        message.error('Family not found');
        navigate('/families');
      }
    } catch (error) {
      message.error('Failed to load family data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadFamilyData();
  }, [loadFamilyData]);

  const handleExportPDF = () => {
    // TODO: Implement PDF export functionality
    message.info('PDF export functionality will be implemented');
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!family) return;

    // Check if trying to remove family head
    if (memberId === family.headId) {
      message.error('Cannot remove family head. Please change family head first.');
      return;
    }

    try {
      // Update family by removing member ID
      const updatedMemberIds = family.memberIds.filter((id: string) => id !== memberId);
      const updatedFamily = {
        ...family,
        memberIds: updatedMemberIds,
        totalMembers: updatedMemberIds.length,
        updatedAt: new Date().toISOString(),
      };

      await updateFamily(family.id, updatedFamily);
      message.success('Member removed from family successfully');

      // Reload family data
      loadFamilyData();
    } catch (error) {
      message.error('Failed to remove member from family');
      console.error(error);
    }
  };

  const handleAddMember = () => {
    setAddMemberModalVisible(true);
    form.resetFields();
  };

  const handleAddMemberSubmit = async () => {
    if (!family) return;

    try {
      const values = await form.validateFields();
      const selectedMemberIds: string[] = values.memberIds;

      if (selectedMemberIds.length === 0) {
        message.error('Please select at least one member to add');
        return;
      }

      // Check for duplicates
      const duplicates = selectedMemberIds.filter(id => family.memberIds.includes(id));
      if (duplicates.length > 0) {
        message.error('Some selected members are already in this family');
        return;
      }

      // Update family with new members
      const updatedMemberIds = [...family.memberIds, ...selectedMemberIds];
      const updatedFamily = {
        ...family,
        memberIds: updatedMemberIds,
        totalMembers: updatedMemberIds.length,
        updatedAt: new Date().toISOString(),
      };

      await updateFamily(family.id, updatedFamily);
      message.success(`${selectedMemberIds.length} member(s) added to family successfully`);

      setAddMemberModalVisible(false);
      // Reload family data
      loadFamilyData();
    } catch (error) {
      message.error('Failed to add members to family');
      console.error(error);
    }
  };

  // Get available members (not in current family)
  const getAvailableMembers = () => {
    return allMembers.filter(member => !family?.memberIds.includes(member.id));
  };

  const getFamilyHead = () => {
    return familyMembers.find(member => member.id === family?.headId);
  };

  const getTanzeemStats = () => {
    const stats: Record<string, number> = {};
    familyMembers.forEach(member => {
      const displayName = getTanzeemDisplayName(member.tanzeem);
      stats[displayName] = (stats[displayName] || 0) + 1;
    });
    return stats;
  };

  const columns = [
    {
      title: 'Photo',
      key: 'photo',
      render: (record: Member) => (
        <Avatar
          size="small"
          src={record.profilePhoto || undefined}
          icon={<UserOutlined />}
        />
      ),
      width: 60,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Member) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {name}
            {record.id === family?.headId && (
              <Tag color="gold" style={{ marginLeft: 8 }}>Head</Tag>
            )}
          </div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Father: {record.fatherName}
          </Text>
        </div>
      ),
    },
    {
      title: 'Age & Gender',
      key: 'demographics',
      render: (record: Member) => (
        <div>
          <div>{record.age} years</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.gender === 'male' ? 'Male' : 'Female'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Tanzeem',
      key: 'tanzeem',
      render: (record: Member) => (
        <div>
          <Tag color="blue">{getTanzeemDisplayName(record.tanzeem)}</Tag>
          {record.hasNewTanzeemTransition && (
            <Tag color="green">NEW</Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Contact',
      dataIndex: 'phone',
      key: 'contact',
      render: (phone: string, record: Member) => (
        <div>
          <div>{phone}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.cnic}
          </Text>
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: Member) => (
        <Space>
          {record.id !== family?.headId && (
            <Popconfirm
              title="Remove member from family?"
              description="This will only remove the member from this family, not delete the member."
              onConfirm={() => handleRemoveMember(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Button
                type="primary"
                danger
                size="small"
                icon={<DeleteOutlined />}
                title="Remove from Family"
              >
                Remove
              </Button>
            </Popconfirm>
          )}
          {record.id === family?.headId && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Family Head
            </Text>
          )}
        </Space>
      ),
      width: 120,
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!family) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Title level={3}>Family not found</Title>
        <Button type="primary" onClick={() => navigate('/families')}>
          Back to Families
        </Button>
      </div>
    );
  }

  const familyHead = getFamilyHead();
  const tanzeemStats = getTanzeemStats();

  return (
    <div>
      {/* Header Section */}
      <div style={{ marginBottom: 24 }}>
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/families')}
          >
            Back
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            {family.familyName}
          </Title>
        </Space>
        <Text type="secondary">
          Family Details & Member Management
        </Text>
      </div>

      {/* Family Information */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card title="Family Information">
            <Descriptions column={2}>
              <Descriptions.Item label="Family Name">
                {family.familyName}
              </Descriptions.Item>
              <Descriptions.Item label="Family Head">
                {familyHead ? familyHead.name : 'Not Found'}
              </Descriptions.Item>
              <Descriptions.Item label="Total Members">
                {family.totalMembers}
              </Descriptions.Item>
              <Descriptions.Item label="Halqa">
                {family.halqa || 'Not Assigned'}
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {formatDate(family.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="Updated">
                {formatDate(family.updatedAt)}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Family Statistics">
            <Space direction="vertical" style={{ width: '100%' }}>
              {Object.entries(tanzeemStats).map(([tanzeem, count]) => (
                <div key={tanzeem} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>{tanzeem}:</Text>
                  <Tag color="blue">{count}</Tag>
                </div>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Quick Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Members"
              value={familyMembers.length}
              prefix={<UserOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Male Members"
              value={familyMembers.filter(m => m.gender === 'male').length}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Female Members"
              value={familyMembers.filter(m => m.gender === 'female').length}
              valueStyle={{ color: '#f759ab' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Family Members Table */}
      <Card
        title="Family Members"
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddMember}
            >
              Add Member
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExportPDF}
            >
              Export PDF
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={familyMembers}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      </Card>

      {/* Add Member Modal */}
      <Modal
        title="Add Members to Family"
        open={addMemberModalVisible}
        onOk={handleAddMemberSubmit}
        onCancel={() => setAddMemberModalVisible(false)}
        width={600}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="memberIds"
            label="Select Members to Add"
            rules={[
              { required: true, message: 'Please select at least one member' }
            ]}
          >
            <Select
              mode="multiple"
              placeholder="Select members to add to this family"
              style={{ width: '100%' }}
              optionFilterProp="children"
              filterOption={(input, option) => {
                const children = option?.label || option?.children;
                return typeof children === 'string'
                  ? children.toLowerCase().includes(input.toLowerCase())
                  : false;
              }}
            >
              {getAvailableMembers().map(member => (
                <Option key={member.id} value={member.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar
                      size="small"
                      src={member.profilePhoto || undefined}
                      icon={<UserOutlined />}
                    />
                    <div>
                      <div style={{ fontWeight: 500 }}>{member.name}</div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {member.age} yrs • {getTanzeemDisplayName(member.tanzeem)} • {member.phone}
                      </Text>
                    </div>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          {getAvailableMembers().length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
              <Text type="secondary">
                All members are already in this family or no members available.
              </Text>
            </div>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default FamilyDetails;
