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
  Popconfirm,
  Tag,
  Avatar,
  Typography,
  Descriptions,
  List,
  Row,
  Col,
  Tabs,
  Checkbox,
  App
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  TeamOutlined,
  UserOutlined,
  ProfileOutlined,
  ReloadOutlined,
  SearchOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { ApiService } from '../services/apiService';
import type { Family, Member } from '../types';
import { getTanzeemDisplayName, formatDate } from '../utils/helpers';
import { sanitizeFamilyData } from '../utils/validation';

const { Option } = Select;
const { Text, Title } = Typography;

interface FamilyForm {
  familyName: string;
  familyNumber?: number;
  headId: string;
  halqa?: string;
  isBList?: boolean;
}

const Families: React.FC = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [families, setFamilies] = useState<Family[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [editingFamily, setEditingFamily] = useState<Family | null>(null);
  const [viewingFamily, setViewingFamily] = useState<Family | null>(null);
  const [familyMembers, setFamilyMembers] = useState<Member[]>([]);
  const [searchText, setSearchText] = useState('');
  const [sortField, setSortField] = useState<string>('familyNumber');
  const [sortOrder, setSortOrder] = useState<'ascend' | 'descend'>('ascend');
  const [activeTab, setActiveTab] = useState<string>('active');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Move Family State
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [movingFamily, setMovingFamily] = useState<Family | null>(null);
  const [moveForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [familiesData, membersData] = await Promise.all([
        ApiService.getAllFamilies(),
        ApiService.getAllMembers()
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

  const getFilteredAndSortedFamilies = (): Family[] => {
    let filtered = families;

    // Filter by Active/Moved/B-List Tab
    if (activeTab === 'active') {
      filtered = filtered.filter(f => !f.isMoved && !f.isBList);
    } else if (activeTab === 'moved') {
      filtered = filtered.filter(f => !!f.isMoved);
    } else if (activeTab === 'b-list') {
      filtered = filtered.filter(f => !!f.isBList && !f.isMoved);
    }

    // Apply search filter
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(family => {
        const familyName = family.familyName.toLowerCase();
        const headName = getMemberName(family.headId).toLowerCase();
        const halqa = (family.halqa || '').toLowerCase();
        const familyNumber = family.familyNumber?.toString() || '';

        return familyName.includes(searchLower) ||
          headName.includes(searchLower) ||
          halqa.includes(searchLower) ||
          familyNumber.includes(searchLower);
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortField) {
        case 'familyNumber':
          // Handle families without numbers - put them at the end
          if (!a.familyNumber && !b.familyNumber) return 0; // Both have no number
          if (!a.familyNumber) return 1; // a has no number, put it after b
          if (!b.familyNumber) return -1; // b has no number, put it after a
          // Convert to numbers for proper numeric sorting
          aValue = Number(a.familyNumber);
          bValue = Number(b.familyNumber);
          break;
        case 'familyName':
          aValue = a.familyName;
          bValue = b.familyName;
          break;
        case 'headName':
          aValue = getMemberName(a.headId);
          bValue = getMemberName(b.headId);
          break;
        case 'totalMembers':
          aValue = getMembersByFamily(a.id).length;
          bValue = getMembersByFamily(b.id).length;
          break;
        case 'halqa':
          aValue = a.halqa || '';
          bValue = b.halqa || '';
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        default:
          aValue = a.familyName;
          bValue = b.familyName;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'ascend'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return sortOrder === 'ascend'
          ? aValue - bValue
          : bValue - aValue;
      }
    });

    return filtered;
  };

  const handleAddFamily = () => {
    setEditingFamily(null);
    form.resetFields();
    form.setFieldsValue({ isBList: false });
    setModalVisible(true);
  };

  const handleEditFamily = (family: Family) => {
    setEditingFamily(family);
    form.setFieldsValue({
      ...family,
      isBList: family.isBList || false
    });
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
      await ApiService.deleteFamily(id);
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
      const rawData: FamilyForm = {
        ...values,
        familyNumber: values.familyNumber ? Number(values.familyNumber) : undefined,
      };

      if (editingFamily) {
        const existingFamily = await ApiService.getFamily(editingFamily.id);
        if (existingFamily) {
          const updatedFamily = sanitizeFamilyData({
            ...existingFamily,
            ...rawData,
          });
          await ApiService.updateFamily(editingFamily.id, updatedFamily);

          // Sync isBList status to members if it changed
          if (updatedFamily.isBList !== existingFamily.isBList) {
            const familyMembersList = members.filter(m => existingFamily.memberIds.includes(m.id));
            await Promise.all(familyMembersList.map(m =>
              ApiService.updateMember(m.id, {
                isBList: updatedFamily.isBList,
                updatedAt: new Date().toISOString()
              })
            ));
            message.info(`B List status synced to ${familyMembersList.length} family members`);
          }

          message.success('Family updated successfully');
        } else {
          message.error('Failed to find existing family data.');
          return;
        }
      } else {
        const familyData = sanitizeFamilyData({
          ...rawData,
          memberIds: [],
          totalMembers: 0,
          createdAt: new Date().toISOString(),
        });
        await ApiService.createFamily(familyData);
        message.success('Family added successfully');
      }

      setModalVisible(false);
      loadData();
    } catch (error) {
      message.error('Failed to save family');
      console.error(error);
    }
  };

  const handleMoveFamily = async (values: { destination: string }) => {
    if (!movingFamily) return;
    setSubmitting(true);
    try {
      // 1. Update Family record
      await ApiService.updateFamily(movingFamily.id, {
        isMoved: true,
        movedTo: values.destination,
        updatedAt: new Date().toISOString()
      });

      // 2. Update all members in this family
      const familyMembersList = members.filter(m => movingFamily.memberIds.includes(m.id));
      await Promise.all(familyMembersList.map(m =>
        ApiService.updateMember(m.id, {
          isMoved: true,
          movedTo: values.destination,
          isBList: true, // Auto add to B List when moved
          updatedAt: new Date().toISOString()
        })
      ));

      message.success(`Family and ${familyMembersList.length} members moved to ${values.destination}`);
      setMoveModalVisible(false);
      moveForm.resetFields();
      loadData();
    } catch (error) {
      console.error('Error moving family:', error);
      message.error('Failed to move family');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestoreFamily = async (family: Family) => {
    try {
      setLoading(true);
      // 1. Restore Family
      await ApiService.updateFamily(family.id, {
        isMoved: false,
        movedTo: '',
        updatedAt: new Date().toISOString()
      });

      // 2. Restore all members
      const familyMembersList = members.filter(m => family.memberIds.includes(m.id));
      await Promise.all(familyMembersList.map(m =>
        ApiService.updateMember(m.id, {
          isMoved: false,
          movedTo: '',
          isBList: false, // Also remove from B List when restored
          updatedAt: new Date().toISOString()
        })
      ));

      message.success('Family and members restored to active list');
      loadData();
    } catch (error) {
      console.error('Error restoring family:', error);
      message.error('Failed to restore family');
    } finally {
      setLoading(false);
    }
  };


  const columns = [
    {
      title: 'S.No',
      key: 'serial',
      width: 80,
      render: (_: any, __: any, index: number) => (currentPage - 1) * pageSize + index + 1,
    },
    {
      title: 'Family #',
      dataIndex: 'familyNumber',
      key: 'familyNumber',
      width: 100,
      render: (familyNumber: number) => (
        <Tag color={familyNumber ? 'blue' : 'default'}>
          {familyNumber || 'Not Set'}
        </Tag>
      ),
    },
    {
      title: 'Family Name',
      key: 'familyName',
      render: (record: Family) => (
        <Space>
          <Avatar size="small" icon={<TeamOutlined />} />
          <Text strong>{record.familyName}</Text>
          {record.isBList && <Tag color="blue" icon={<CheckCircleOutlined />}>B List</Tag>}
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
          {!record.isMoved ? (
            <Button
              type="default"
              size="small"
              icon={<ReloadOutlined style={{ color: '#fa8c16' }} />}
              onClick={() => {
                setMovingFamily(record);
                setMoveModalVisible(true);
              }}
            >
              Move
            </Button>
          ) : (
            <Popconfirm
              title="Restore this family as active?"
              onConfirm={() => handleRestoreFamily(record)}
              okText="Yes"
              cancelText="No"
            >
              <Button type="default" size="small" style={{ color: '#52c41a' }}>
                Restore
              </Button>
            </Popconfirm>
          )}
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
      width: 250,
    },
  ];

  return (
    <div>
      <Card
        title={`Families (${getFilteredAndSortedFamilies().length} of ${families.length})`}
        extra={
          <Space>
            <Button
              type="default"
              icon={<ReloadOutlined />}
              onClick={loadData}
              loading={loading}
            >
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddFamily}
            >
              Add Family
            </Button>
          </Space>
        }
      >
        {/* Search and Sort Controls */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Search by family name, number, head, or halqa..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder="Sort by..."
              value={sortField}
              onChange={setSortField}
              style={{ width: '100%' }}
            >
              <Option value="familyNumber">Family Number</Option>
              <Option value="familyName">Family Name</Option>
              <Option value="headName">Head of Family</Option>
              <Option value="totalMembers">Total Members</Option>
              <Option value="halqa">Halqa</Option>
              <Option value="createdAt">Created Date</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder="Sort order..."
              value={sortOrder}
              onChange={setSortOrder}
              style={{ width: '100%' }}
            >
              <Option value="ascend">Ascending</Option>
              <Option value="descend">Descending</Option>
            </Select>
          </Col>
        </Row>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          style={{ marginBottom: 16 }}
          items={[
            {
              key: 'active',
              label: `Active Families (${families.filter(f => !f.isMoved && !f.isBList).length})`,
            },
            {
              key: 'b-list',
              label: `B List Families (${families.filter(f => !!f.isBList && !f.isMoved).length})`,
            },
            {
              key: 'moved',
              label: `Moved Families (${families.filter(f => f.isMoved).length})`,
            }
          ]}
        />

        <Table
          columns={columns}
          dataSource={getFilteredAndSortedFamilies()}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            pageSizeOptions: [10, 20, 50, 100],
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} items`,
            responsive: true,
            onChange: (page, pageSize) => {
              setCurrentPage(page);
              setPageSize(pageSize || 10);
            },
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
          requiredMark={true}
          initialValues={{ isBList: false }}
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
            name="familyNumber"
            label="Family Number (Optional)"
          >
            <Input
              type="number"
              placeholder="Enter family number"
              min={1}
            />
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

          <Form.Item
            name="isBList"
            valuePropName="checked"
          >
            <Checkbox>B List (Special Tracking)</Checkbox>
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
              <Descriptions.Item label="Family Number">
                {viewingFamily.familyNumber || 'Not assigned'}
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
              <Descriptions.Item label="Status">
                {viewingFamily.isBList && <Tag color="blue">B List</Tag>}
                {viewingFamily.isMoved ? <Tag color="orange">Moved</Tag> : <Tag color="green">Active</Tag>}
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
      {/* Move Family Modal */}
      <Modal
        title={`Move Family: ${movingFamily?.familyName}`}
        open={moveModalVisible}
        onCancel={() => {
          setMoveModalVisible(false);
          moveForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={moveForm}
          layout="vertical"
          onFinish={handleMoveFamily}
        >
          <Form.Item
            name="destination"
            label="Destination (Moved to...)"
            rules={[{ required: true, message: 'Please enter destination' }]}
            help="This will mark the family and all its active members as moved."
          >
            <Input placeholder="e.g. Rabwah, UK, Germany" autoFocus />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setMoveModalVisible(false)}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                Move Family
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Families;
