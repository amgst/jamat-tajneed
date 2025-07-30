import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Tag,
  Avatar,
  Typography,
  Descriptions,
  List
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  TeamOutlined,
  UserOutlined,
  ProfileOutlined
} from '@ant-design/icons';
import { getAllFamilies, getAllMembers, addFamily, updateFamily, deleteFamily } from '../services/firebase'; // Changed import
import type { Family, Member } from '../types';
import { getTanzeemDisplayName, formatDate } from '../utils/helpers';

const { Option } = Select;
const { Text, Title } = Typography;

interface FamilyForm {
  familyName: string;
  headId: string;
  halqa?: string;
}

const Families: React.FC = () => {
  const navigate = useNavigate();
  const [families, setFamilies] = useState<Family[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [editingFamily, setEditingFamily] = useState<Family | null>(null);
  const [viewingFamily, setViewingFamily] = useState<Family | null>(null);
  const [familyMembers, setFamilyMembers] = useState<Member[]>([]);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [familiesData, membersData] = await Promise.all([
        getAllFamilies(),
        getAllMembers()
      ]);
      setFamilies(familiesData);
      setMembers(membersData);
    } catch (error) {
      message.error('Failed to load data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getMembersByFamily = (familyId: string): Member[] => {
    const family = families.find(f => f.id === familyId);
    if (!family) return [];

    return members.filter(member => family.memberIds.includes(member.id));
  };

  const getMemberName = (memberId: string): string => {
    const member = members.find(m => m.id === memberId);
    return member ? member.name : 'Unknown';
  };

  const getHeadMembers = (): Member[] => {
    return members.filter(member =>
      member.gender === 'male' &&
      (member.tanzeem === 'khuddam' || member.tanzeem === 'ansar')
    );
  };

  const handleAddFamily = () => {
    setEditingFamily(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditFamily = (family: Family) => {
    setEditingFamily(family);
    form.setFieldsValue(family);
    setModalVisible(true);
  };

  const handleViewFamily = (family: Family) => {
    setViewingFamily(family);
    const membersList = getMembersByFamily(family.id);
    setFamilyMembers(membersList);
    setViewModalVisible(true);
  };

  const handleDeleteFamily = async (id: string) => {
    try {
      await deleteFamily(id);
      message.success('Family deleted successfully');
      loadData();
    } catch (error) {
      message.error('Failed to delete family');
      console.error(error);
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      const formData: FamilyForm = values;

      const familyData = {
        familyName: formData.familyName,
        headId: formData.headId,
        memberIds: [], // Will be updated when members are assigned
        totalMembers: 0,
        halqa: formData.halqa || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (editingFamily) {
        await updateFamily(editingFamily.id, familyData);
        message.success('Family updated successfully');
      } else {
        await addFamily(familyData);
        message.success('Family added successfully');
      }

      setModalVisible(false);
      loadData();
    } catch (error) {
      message.error('Failed to save family');
      console.error(error);
    }
  };

  const columns = [
    {
      title: 'Family Name',
      dataIndex: 'familyName',
      key: 'familyName',
      sorter: (a: Family, b: Family) => a.familyName.localeCompare(b.familyName),
      render: (familyName: string) => (
        <Space>
          <Avatar size="small" icon={<TeamOutlined />} />
          <Text strong>{familyName}</Text>
        </Space>
      ),
    },
    {
      title: 'Head of Family',
      dataIndex: 'headId',
      key: 'headId',
      render: (headId: string) => getMemberName(headId),
    },
    {
      title: 'Total Members',
      key: 'totalMembers',
      render: (record: Family) => {
        const memberCount = getMembersByFamily(record.id).length;
        return (
          <Tag color="blue">
            {memberCount} Member{memberCount !== 1 ? 's' : ''}
          </Tag>
        );
      },
      sorter: (a: Family, b: Family) =>
        getMembersByFamily(a.id).length - getMembersByFamily(b.id).length,
    },
    {
      title: 'Halqa',
      dataIndex: 'halqa',
      key: 'halqa',
      render: (halqa: string) => halqa || '-',
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (createdAt: string) => formatDate(createdAt),
      sorter: (a: Family, b: Family) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: Family) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<ProfileOutlined />}
            onClick={() => navigate(`/families/${record.id}`)}
          >
            Details
          </Button>
          <Button
            type="default"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewFamily(record)}
          />
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditFamily(record)}
          />
          <Popconfirm
            title="Are you sure you want to delete this family?"
            onConfirm={() => handleDeleteFamily(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button
              type="primary"
              danger
              size="small"
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      ),
      width: 180,
    },
  ];

  return (
    <div>
      <Card
        title={`Families (${families.length})`}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddFamily}
          >
            Add Family
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={families}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} items`,
          }}
        />
      </Card>

      {/* Add/Edit Family Modal */}
      <Modal
        title={editingFamily ? 'Edit Family' : 'Add New Family'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={500}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
        >
          <Form.Item
            name="familyName"
            label="Family Name"
            rules={[
              { required: true, message: 'Please enter family name' },
              { min: 2, message: 'Family name must be at least 2 characters' }
            ]}
          >
            <Input placeholder="Enter family name" />
          </Form.Item>

          <Form.Item
            name="headId"
            label="Head of Family"
            rules={[
              { required: true, message: 'Please select head of family' }
            ]}
          >
            <Select
              placeholder="Select head of family"
              showSearch
              optionFilterProp="children"
            >
              {getHeadMembers().map(member => (
                <Option key={member.id} value={member.id}>
                  {member.name} - {getTanzeemDisplayName(member.tanzeem)}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="halqa"
            label="Halqa (Optional)"
          >
            <Input placeholder="Enter halqa name" />
          </Form.Item>
        </Form>
      </Modal>

      {/* View Family Modal */}
      <Modal
        title={`Family Details: ${viewingFamily?.familyName}`}
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setViewModalVisible(false)}>
            Close
          </Button>
        ]}
        width={700}
      >
        {viewingFamily && (
          <div>
            <Descriptions bordered column={2} style={{ marginBottom: 24 }}>
              <Descriptions.Item label="Family Name">
                {viewingFamily.familyName}
              </Descriptions.Item>
              <Descriptions.Item label="Head of Family">
                {getMemberName(viewingFamily.headId)}
              </Descriptions.Item>
              <Descriptions.Item label="Total Members">
                {familyMembers.length}
              </Descriptions.Item>
              <Descriptions.Item label="Halqa">
                {viewingFamily.halqa || 'Not specified'}
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {formatDate(viewingFamily.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="Last Updated">
                {formatDate(viewingFamily.updatedAt)}
              </Descriptions.Item>
            </Descriptions>

            <Title level={4}>Family Members</Title>
            <List
              dataSource={familyMembers}
              renderItem={(member) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={<UserOutlined />} />}
                    title={
                      <Space>
                        {member.name}
                        <Tag color={member.gender === 'male' ? 'blue' : 'pink'}>
                          {member.gender.toUpperCase()}
                        </Tag>
                        <Tag color="green">
                          {getTanzeemDisplayName(member.tanzeem)}
                        </Tag>
                      </Space>
                    }
                    description={
                      <div>
                        <Text type="secondary">Age: {member.age} • Phone: {member.phone}</Text>
                        <br />
                        <Text type="secondary">Father: {member.fatherName}</Text>
                      </div>
                    }
                  />
                </List.Item>
              )}
              locale={{ emptyText: 'No members assigned to this family yet' }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Families;
