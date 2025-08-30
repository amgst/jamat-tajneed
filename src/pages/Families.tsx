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
  List,
  Row,
  Col
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
  SearchOutlined
} from '@ant-design/icons';
import { 
  getFamily, // Added to get existing family data
  getAllFamilies, 
  getAllMembers, 
  addFamily, 
  updateFamily, 
  deleteFamily 
} from '../services/firebase';
import type { Family, Member } from '../types';
import { getTanzeemDisplayName, formatDate } from '../utils/helpers';

const { Option } = Select;
const { Text, Title } = Typography;

interface FamilyForm {
  familyName: string;
  familyNumber?: number;
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
  const [searchText, setSearchText] = useState('');
  const [sortField, setSortField] = useState<string>('familyName');
  const [sortOrder, setSortOrder] = useState<'ascend' | 'descend'>('ascend');
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

  const getFilteredAndSortedFamilies = (): Family[] => {
    let filtered = families;
    
    // Apply search filter
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = families.filter(family => {
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
          aValue = a.familyNumber;
          bValue = b.familyNumber;
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

             if (editingFamily) {
         // FIX: Fetch the existing family data first to preserve the memberIds array
         const existingFamily = await getFamily(editingFamily.id);
         if (existingFamily) {
           const updatedFamily = {
             ...existingFamily, // Retain all existing fields
             familyName: formData.familyName,
             familyNumber: formData.familyNumber || undefined,
             headId: formData.headId,
             halqa: formData.halqa || '',
             updatedAt: new Date().toISOString(),
           };
           await updateFamily(editingFamily.id, updatedFamily);
           message.success('Family updated successfully');
         } else {
           message.error('Failed to find existing family data.');
           return;
         }
       } else {
         // Original logic for adding a new family
         const familyData = {
           familyName: formData.familyName,
           familyNumber: formData.familyNumber || undefined,
           headId: formData.headId,
           memberIds: [], // Will be updated when members are assigned
           totalMembers: 0,
           halqa: formData.halqa || '',
           createdAt: new Date().toISOString(),
           updatedAt: new Date().toISOString(),
         };
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
      title: 'S.No',
      key: 'serial',
      width: 80,
      render: (_: any, __: any, index: number) => index + 1,
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
      dataIndex: 'familyName',
      key: 'familyName',
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

                 <Table
           columns={columns}
           dataSource={getFilteredAndSortedFamilies()}
           rowKey="id"
           loading={loading}
          pagination={{
            defaultPageSize: 10,
            pageSizeOptions: [10, 20, 50, 100],
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} items`,
            responsive: true,
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
