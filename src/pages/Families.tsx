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
  App,
  Segmented,
  Pagination,
  Empty,
  Spin
} from 'antd';
import { House, MapPin, Users, ArrowRight, LayoutGrid, List as ListIcon } from 'lucide-react';
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
import { matchesNameSearch } from '../utils/nameSearch';
import './PeopleHome.css';
import './Families.css';

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
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  useEffect(() => { setCurrentPage(1); }, [searchText, sortField, sortOrder, activeTab, families.length]);

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

    return members.filter(member => family.memberIds.includes(member.id) || member.id === family.headId || member.familyId === family.id);
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
    let filtered = [...families];

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
      filtered = filtered.filter(family => {
        const people = getMembersByFamily(family.id);
        const names = [family.familyName, getMemberName(family.headId),
          ...people.flatMap(member => [member.name, member.fatherName, member.husbandName])]
          .filter((value): value is string => !!value);
        const text = [...names, family.familyNumber, family.halqa,
          ...people.flatMap(member => [member.phone, member.cnic, member.tajneedCode])].filter(value => value != null).join(' ');
        return matchesNameSearch(text, names, searchText);
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
      width: 55,
      render: (_: any, __: any, index: number) => (currentPage - 1) * pageSize + index + 1,
    },
    {
      title: 'Family #',
      dataIndex: 'familyNumber',
      key: 'familyNumber',
      width: 80,
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
      title: 'Members',
      key: 'totalMembers',
      width: 85,
      align: 'center' as const,
      render: (record: Family) => getMembersByFamily(record.id).length,
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
      render: (record: Family) => (
        <Space size={4}>
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
              title="Move family"
              aria-label={`Move ${record.familyName}`}
              onClick={() => {
                setMovingFamily(record);
                setMoveModalVisible(true);
              }}
            />
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
      width: 210,
    },
  ];

  const visibleFamilies = getFilteredAndSortedFamilies();
  const pagination = {
    current: currentPage,
    pageSize,
    total: visibleFamilies.length,
    pageSizeOptions: [10, 20, 50, 100],
    showSizeChanger: true,
    responsive: true,
    showTotal: (total: number, range: [number, number]) => `${range[0]}–${range[1]} of ${total} families`,
    onChange: (page: number, size: number) => { setCurrentPage(size !== pageSize ? 1 : page); setPageSize(size); },
  };

  return (
    <div className="families-page">
      <header className="families-header families-page-heading"><div className="families-title-line"><h1>Families</h1><span className="families-total">{families.length}</span></div><Button type="primary" icon={<PlusOutlined />} onClick={handleAddFamily}>Add Family</Button></header>
      <Card
        className="families-panel"
      >
        {/* Search and Sort Controls */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={24} md={8}>
            <Input
              placeholder="Search English or Urdu name, family number or phone"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={12} sm={12} md={8}>
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
          <Col xs={12} sm={12} md={8}>
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
              label: `Active (${families.filter(f => !f.isMoved && !f.isBList).length})`,
            },
            {
              key: 'b-list',
              label: `B List (${families.filter(f => !!f.isBList && !f.isMoved).length})`,
            },
            {
              key: 'moved',
              label: `Moved (${families.filter(f => f.isMoved).length})`,
            }
          ]}
        />

        <div className="families-view-toolbar"><span className="families-view-label">Choose your view</span><Segmented
          aria-label="Family display view"
          value={viewMode}
          onChange={value => setViewMode(value as 'cards' | 'list')}
          options={[{ value: 'cards', label: <span className="families-view-option"><LayoutGrid size={16} />Cards</span> }, { value: 'list', label: <span className="families-view-option"><ListIcon size={16} />List</span> }]}
        /></div>
        {viewMode === 'cards' ? <Spin spinning={loading}>
          {!loading && visibleFamilies.length === 0 ? <Empty description="No families found. Try another search or tab." /> : <div className="family-search-grid families-card-grid">
            {visibleFamilies.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(family => {
              const people = getMembersByFamily(family.id);
              return <article className="families-card" key={family.id}>
                <button className="family-search-card" onClick={() => navigate(`/families/${encodeURIComponent(family.id)}`)}>
                  <div className="family-card-top"><span className="family-house"><House size={21} /></span><span className="family-number">{family.familyNumber != null ? `Family #${family.familyNumber}` : 'Family record'}</span><ArrowRight size={18} /></div>
                  <strong className="family-card-name" dir="auto">{family.familyName}</strong>
                  <span className="family-card-head">Head: <span dir="auto">{getMemberName(family.headId)}</span></span>
                  <span className="family-card-location"><MapPin size={14} /><span dir="auto">{family.halqa || 'Location not recorded'}</span></span>
                  <div className="family-card-bottom"><span className="family-card-members"><Users size={15} />{people.length} {people.length === 1 ? 'member' : 'members'}</span><span className={`family-status ${family.isMoved || family.isBList ? 'muted' : ''}`}>{family.isMoved ? 'Moved' : family.isBList ? 'B List' : 'Active'}</span></div>
                  <span className="family-card-preview" dir="auto">{people.slice(0, 3).map(member => member.name).join(' · ')}{people.length > 3 ? ` · +${people.length - 3} more` : ''}</span>
                </button>
              </article>;
            })}
          </div>}
          {visibleFamilies.length > 0 && <Pagination className="families-pagination" {...pagination} />}
        </Spin> : <Table
          className="families-list"
          size="small"
          columns={columns}
          dataSource={visibleFamilies}
          scroll={{ x: 800 }}
          rowKey="id"
          loading={loading}
          pagination={pagination}
        />}
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
