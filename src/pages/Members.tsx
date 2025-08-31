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
  DatePicker,
  Upload,
  message,
  Popconfirm,
  Tag,
  Avatar,
  Typography,
  Row,
  Col,
  Tabs,
  Checkbox
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
  UserOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { getAllMembers, getAllFamilies, addMember, updateMember, deleteMember } from '../services/firebase';
import type { Member, Tanzeem, Family } from '../types';
import {
  calculateAge,
  determineTanzeem,
  getTanzeemDisplayName,
  formatCNIC,
  validateCNIC,
  validatePhone,
  formatDate,
  exportToCSV
} from '../utils/helpers';
import { processImageFile, generateAvatarFromName } from '../utils/imageUtils';

const { Option } = Select;
const { Text } = Typography;

interface MemberForm {
  name: string;
  fatherName: string;
  husbandName?: string;
  gender: 'male' | 'female';
  cnic?: string;
  dateOfBirth: dayjs.Dayjs;
  phone?: string;
  address: string;

  isDeceased?: boolean;
  dateOfDeath?: dayjs.Dayjs;
}

const Members: React.FC = () => {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string>('');
  const [imageUploading, setImageUploading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('active');
  const [religiousModalVisible, setReligiousModalVisible] = useState(false);
  const [selectedMemberForReligious, setSelectedMemberForReligious] = useState<Member | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const [membersData, familiesData] = await Promise.all([
        getAllMembers(),
        getAllFamilies()
      ]);
      setMembers(membersData);
      setFamilies(familiesData);
    } catch (error) {
      message.error('Failed to load data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = () => {
    setEditingMember(null);
    setUploadedImage('');
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditMember = (member: Member) => {
    setEditingMember(member);
    setUploadedImage(member.profilePhoto || '');
    form.setFieldsValue({
      ...member,
      dateOfBirth: dayjs(member.dateOfBirth),
      dateOfDeath: member.dateOfDeath ? dayjs(member.dateOfDeath) : undefined,
    });
    setModalVisible(true);
  };

  const handleDeleteMember = async (id: string) => {
    try {
      await deleteMember(id);
      message.success('Member deleted successfully');
      loadMembers();
    } catch (error) {
      message.error('Failed to delete member');
      console.error(error);
    }
  };

  const getFamilyName = (familyId: string): string => {
    const family = families.find(f => f.id === familyId);
    return family ? family.familyName : 'Unknown Family';
  };

  const getFamilyMembers = (familyId: string): Member[] => {
    const family = families.find(f => f.id === familyId);
    if (!family) return [];
    return members.filter(member => family.memberIds.includes(member.id));
  };

  const getFilteredAndSortedMembers = (): Member[] => {
    let filtered = members;
    
    // Filter by deceased status based on active tab
    filtered = filtered.filter(member => {
      if (activeTab === 'deceased') {
        return member.isDeceased === true;
      } else {
        return !member.isDeceased;
      }
    });
    
    // Apply family filter
    if (selectedFamilyId) {
      const familyMembers = getFamilyMembers(selectedFamilyId);
      filtered = filtered.filter(member => familyMembers.some(fm => fm.id === member.id));
    }
    
    // Apply search filter
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(member => {
        const name = member.name.toLowerCase();
        const fatherName = (member.fatherName || '').toLowerCase();
        const phone = (member.phone || '').toLowerCase();
        const address = (member.address || '').toLowerCase();
        const halqa = (member.halqa || '').toLowerCase();
        
        return name.includes(searchLower) || 
               fatherName.includes(searchLower) || 
               phone.includes(searchLower) ||
               address.includes(searchLower) ||
               halqa.includes(searchLower);
      });
    }
    
    // Sort by family number, then by family role
    filtered.sort((a, b) => {
      const familyA = families.find(f => f.memberIds.includes(a.id));
      const familyB = families.find(f => f.memberIds.includes(b.id));
      
      // First sort by family number
      const familyNumA = familyA?.familyNumber || 999999; // Put members without family number at end
      const familyNumB = familyB?.familyNumber || 999999;
      
      if (familyNumA !== familyNumB) {
        return familyNumA - familyNumB;
      }
      
      // Within same family, sort by role
      if (familyA && a.id === familyA.headId) return -1;
      if (familyB && b.id === familyB.headId) return 1;
      
      // Then by gender (wife after head)
      if (a.gender === 'female' && b.gender === 'male') return -1;
      if (a.gender === 'male' && b.gender === 'female') return 1;
      
      // Finally by age (older first)
      return b.age - a.age;
    });
    
    return filtered;
  };

  const handleImageUpload = async (file: File): Promise<boolean> => {
    setImageUploading(true);
    try {
      const result = await processImageFile(file);
      if (result.success && result.data) {
        setUploadedImage(result.data);
        message.success('Image uploaded successfully');
        return false; // Prevent default upload behavior
      } else {
        message.error(result.error || 'Failed to upload image');
        return false;
      }
    } catch {
      message.error('Failed to process image');
      return false;
    } finally {
      setImageUploading(false);
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      const formData: MemberForm = values;

      const age = calculateAge(formData.dateOfBirth.format('YYYY-MM-DD'));
      const tanzeem = determineTanzeem(age, formData.gender);

      const memberData: any = {
        name: formData.name,
        fatherName: formData.fatherName || '',
        husbandName: formData.husbandName || '',
        gender: formData.gender,
        cnic: formData.cnic ? formatCNIC(formData.cnic) : '',
        dateOfBirth: formData.dateOfBirth.format('YYYY-MM-DD'),
        age,
        phone: formData.phone || '',
        address: formData.address,
        tanzeem,
        halqa: '',
        profilePhoto: uploadedImage || generateAvatarFromName(formData.name),
        hasNewTanzeemTransition: false,
        isDeceased: formData.isDeceased || false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Only add dateOfDeath if it has a value (Firebase doesn't accept undefined)
      if (formData.dateOfDeath) {
        memberData.dateOfDeath = formData.dateOfDeath.format('YYYY-MM-DD');
      }

      if (editingMember) {
        await updateMember(editingMember.id, memberData);
        message.success('Member updated successfully');
      } else {
        await addMember(memberData);
        message.success('Member added successfully');
      }

      setModalVisible(false);
      loadMembers();
    } catch (error) {
      message.error('Failed to save member');
      console.error(error);
    }
  };

  const handleExport = () => {
    const exportData = members.map(member => ({
      Name: member.name,
      'Father Name': member.fatherName,
      Gender: member.gender,
      CNIC: member.cnic || '',
      'Date of Birth': member.dateOfBirth,
      Age: member.age,
      Phone: member.phone,
      Address: member.address,
      Tanzeem: getTanzeemDisplayName(member.tanzeem),
      Halqa: member.halqa || '',
      'Created At': formatDate(member.createdAt),
    }));

    exportToCSV(exportData, 'members.csv');
    message.success('Data exported successfully');
  };

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
      title: 'Family',
      key: 'family',
      render: (record: Member) => {
        const family = families.find(f => f.memberIds.includes(record.id));
        if (!family) return <Tag color="default">No Family</Tag>;
        
        const isHead = family.headId === record.id;
        const isWife = record.gender === 'female' && family.headId !== record.id;
        
        return (
          <div>
            <div 
              style={{ fontWeight: 500, color: '#1890ff', cursor: 'pointer' }}
              onClick={() => navigate(`/families/${family.id}`)}
            >
              {family.familyName}
            </div>
            {isHead && (
              <Tag color="red" size="small">
                Head
              </Tag>
            )}
          </div>
        );
      },
      width: 120,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: Member, b: Member) => a.name.localeCompare(b.name),
      render: (name: string, record: Member) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.husbandName ? `Husband: ${record.husbandName}` : record.fatherName}
          </Text>
        </div>
      ),
    },
    {
      title: 'Gender',
      dataIndex: 'gender',
      key: 'gender',
      render: (gender: string) => (
        <Tag color={gender === 'male' ? 'blue' : 'pink'}>
          {gender.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Age',
      dataIndex: 'age',
      key: 'age',
      sorter: (a: Member, b: Member) => a.age - b.age,
      width: 70,
    },
    {
      title: 'Tanzeem',
      dataIndex: 'tanzeem',
      key: 'tanzeem',
      sorter: (a: Member, b: Member) => {
        const tanzeemOrder = ['saf-e-awal', 'saf-e-awal-girls', 'atfal', 'nasirat', 'khuddam', 'lajna', 'ansar'];
        return tanzeemOrder.indexOf(a.tanzeem) - tanzeemOrder.indexOf(b.tanzeem);
      },
      render: (tanzeem: Tanzeem) => (
        <Tag color="green">{getTanzeemDisplayName(tanzeem)}</Tag>
      ),
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: 'Halqa',
      key: 'halqa',
      sorter: (a: Member, b: Member) => {
        const familyA = families.find(f => f.memberIds.includes(a.id));
        const familyB = families.find(f => f.memberIds.includes(b.id));
        const halqaA = familyA?.halqa || '';
        const halqaB = familyB?.halqa || '';
        return halqaA.localeCompare(halqaB);
      },
      render: (record: Member) => {
        const family = families.find(f => f.memberIds.includes(record.id));
        return family?.halqa || '-';
      },
    },
    {
      title: 'Religious Data',
      key: 'religious',
      render: (record: Member) => {
        const hasData = record.religiousActivities;
        return (
          <Button
            type={hasData ? 'primary' : 'default'}
            size="small"
            onClick={() => {
              setSelectedMemberForReligious(record);
              setReligiousModalVisible(true);
            }}
            style={{ 
              backgroundColor: hasData ? '#52c41a' : undefined,
              borderColor: hasData ? '#52c41a' : undefined
            }}
          >
            View
          </Button>
        );
      },
      width: 100,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: Member) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditMember(record)}
          />
          <Popconfirm
            title="Are you sure you want to delete this member?"
            onConfirm={() => handleDeleteMember(record.id)}
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
      width: 120,
    },
  ];

  const getTabCounts = () => {
    const activeCount = members.filter(m => !m.isDeceased).length;
    const deceasedCount = members.filter(m => m.isDeceased).length;
    return { activeCount, deceasedCount };
  };

  const { activeCount, deceasedCount } = getTabCounts();

  return (
    <div>
      <Card
        title="Members Management"
        extra={
          <Space>
            <Button
              type="default"
              icon={<DownloadOutlined />}
              onClick={handleExport}
            >
              Export CSV
            </Button>
            <Button
              type="default"
              icon={<ReloadOutlined />}
              onClick={loadMembers}
              loading={loading}
            >
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddMember}
            >
              Add Member
            </Button>
          </Space>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'active',
              label: `Active Members (${activeCount})`,
              children: (
                <div>
        {/* Search and Filter Controls */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Search by name, father, phone, address, or halqa..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder="Filter by family..."
              value={selectedFamilyId}
              onChange={setSelectedFamilyId}
              allowClear
              style={{ width: '100%' }}
            >
              {families.map(family => (
                <Option key={family.id} value={family.id}>
                  <Space>
                    <TeamOutlined />
                    {family.familyName}
                    <Tag size="small" color="blue">
                      {getFamilyMembers(family.id).length} members
                    </Tag>
                  </Space>
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Button
              type="default"
              onClick={() => {
                setSearchText('');
                setSelectedFamilyId('');
              }}
              style={{ width: '100%' }}
            >
              Clear Filters
            </Button>
          </Col>
        </Row>

                  <Table
                    columns={columns}
                    dataSource={getFilteredAndSortedMembers()}
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
                    scroll={{ x: 1000 }}
                  />
                </div>
              ),
            },
            {
              key: 'deceased',
              label: `Deceased Members (${deceasedCount})`,
              children: (
                <div>
                  {/* Search and Filter Controls for Deceased */}
                  <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col xs={24} sm={12} md={8}>
                      <Input
                        placeholder="Search deceased members..."
                        prefix={<SearchOutlined />}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        allowClear
                        style={{ width: '100%' }}
                      />
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                      <Select
                        placeholder="Filter by family..."
                        value={selectedFamilyId}
                        onChange={setSelectedFamilyId}
                        allowClear
                        style={{ width: '100%' }}
                      >
                        {families.map(family => (
                          <Option key={family.id} value={family.id}>
                            <Space>
                              <TeamOutlined />
                              {family.familyName}
                            </Space>
                          </Option>
                        ))}
                      </Select>
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                      <Button
                        type="default"
                        onClick={() => {
                          setSearchText('');
                          setSelectedFamilyId('');
                        }}
                        style={{ width: '100%' }}
                      >
                        Clear Filters
                      </Button>
                    </Col>
                  </Row>

                  <Table
                    columns={[...columns.slice(0, -1), {
                      title: 'Date of Death',
                      dataIndex: 'dateOfDeath',
                      key: 'dateOfDeath',
                      render: (dateOfDeath: string) => dateOfDeath ? formatDate(dateOfDeath) : '-',
                    }, columns[columns.length - 1]]}
                    dataSource={getFilteredAndSortedMembers()}
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
                    scroll={{ x: 1000 }}
                  />
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editingMember ? 'Edit Member' : 'Add New Member'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={600}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="name"
                label="Full Name"
                rules={[
                  { required: true, message: 'Please enter full name' },
                  { min: 2, message: 'Name must be at least 2 characters' }
                ]}
              >
                <Input placeholder="Enter full name" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="fatherName"
                label="Father Name (Optional)"
              >
                <Input placeholder="Enter father name" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="husbandName"
                label="Husband Name (Optional)"
              >
                <Input placeholder="Enter husband name" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <div style={{ marginTop: 30 }}>
                <Space direction="vertical">
                  <Checkbox
                    onChange={(e) => {
                      if (e.target.checked) {
                        // Find the family head name
                        const memberFamily = families.find(f => f.memberIds.includes(editingMember?.id || ''));
                        if (memberFamily) {
                          const headMember = members.find(m => m.id === memberFamily.headId);
                          if (headMember) {
                            form.setFieldsValue({ fatherName: headMember.name });
                          }
                        }
                      }
                    }}
                  >
                    Set Head as Father
                  </Checkbox>
                </Space>
              </div>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="gender"
                label="Gender"
                rules={[
                  { required: true, message: 'Please select gender' }
                ]}
              >
                <Select placeholder="Select gender">
                  <Option value="male">Male</Option>
                  <Option value="female">Female</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="dateOfBirth"
                label="Date of Birth"
                rules={[
                  { required: true, message: 'Please select date of birth' }
                ]}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  placeholder="Select date of birth"
                  disabledDate={(current) => current && current > dayjs().endOf('day')}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="cnic"
                label="CNIC (Optional)"
                rules={[
                  {
                    validator: (_, value) => {
                      if (!value || validateCNIC(value)) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Please enter a valid CNIC (13 digits)'));
                    }
                  }
                ]}
              >
                <Input
                  placeholder="Enter CNIC (without dashes)"
                  maxLength={15}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="phone"
                label="Phone (Optional)"
              >
                <Input placeholder="Enter phone number" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                label="Halqa"
              >
                <Input 
                  disabled 
                  value={(() => {
                    if (editingMember) {
                      const family = families.find(f => f.memberIds.includes(editingMember.id));
                      return family?.halqa || 'Not assigned to family';
                    }
                    return 'Will be set by family assignment';
                  })()} 
                  placeholder="Halqa is managed at family level" 
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="profilePhoto"
                label="Profile Photo (Optional)"
              >
                <Upload
                  listType="picture-card"
                  maxCount={1}
                  beforeUpload={handleImageUpload}
                  fileList={uploadedImage ? [{
                    uid: '-1',
                    name: 'profile.jpg',
                    status: 'done',
                    url: uploadedImage,
                  }] : []}
                  onRemove={() => {
                    setUploadedImage('');
                    return true;
                  }}
                  disabled={imageUploading}
                >
                  {!uploadedImage && (
                    <div>
                      <UploadOutlined />
                      <div style={{ marginTop: 8 }}>
                        {imageUploading ? 'Uploading...' : 'Upload'}
                      </div>
                    </div>
                  )}
                </Upload>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="isDeceased"
                valuePropName="checked"
              >
                <Checkbox>Deceased</Checkbox>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="dateOfDeath"
                label="Date of Death"
                dependencies={['isDeceased']}
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (getFieldValue('isDeceased') && !value) {
                        return Promise.reject(new Error('Please select date of death'));
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  placeholder="Select date of death"
                  disabled={!Form.useWatch('isDeceased', form)}
                  disabledDate={(current) => current && current > dayjs().endOf('day')}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row>
            <Col xs={24}>
              <Form.Item
                name="address"
                label="Address"
                rules={[
                  { required: true, message: 'Please enter address' }
                ]}
              >
                <Input.TextArea
                  rows={3}
                  placeholder="Enter complete address"
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Religious Data Modal */}
      <Modal
        title={`Religious Activities: ${selectedMemberForReligious?.name}`}
        open={religiousModalVisible}
        onCancel={() => setReligiousModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setReligiousModalVisible(false)}>
            Close
          </Button>
        ]}
        width={700}
      >
        {selectedMemberForReligious && (
          <div>
            {selectedMemberForReligious.religiousActivities ? (
              <div>
                <Row gutter={[16, 16]}>
                  <Col span={24}>
                    <h4>Daily Tasks</h4>
                    <Space wrap>
                      <Tag color={selectedMemberForReligious.religiousActivities.weeklyVoluntaryFast ? 'green' : 'red'}>
                        نفلی روزہ: {selectedMemberForReligious.religiousActivities.weeklyVoluntaryFast ? 'Yes' : 'No'}
                      </Tag>
                      <Tag color={selectedMemberForReligious.religiousActivities.twoNaflDaily ? 'green' : 'red'}>
                        دو نوافل: {selectedMemberForReligious.religiousActivities.twoNaflDaily ? 'Yes' : 'No'}
                      </Tag>
                      <Tag color={selectedMemberForReligious.religiousActivities.dailyRecitation ? 'green' : 'red'}>
                        تلاوت: {selectedMemberForReligious.religiousActivities.dailyRecitation ? 'Yes' : 'No'}
                      </Tag>
                      <Tag color={selectedMemberForReligious.religiousActivities.dailyThreePrayers ? 'green' : 'red'}>
                        روزانہ 3 دعائیں: {selectedMemberForReligious.religiousActivities.dailyThreePrayers ? 'Yes' : 'No'}
                      </Tag>
                    </Space>
                  </Col>
                </Row>
                
                <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                  <Col span={24}>
                    <h4>Weekly Tasks</h4>
                    <Space wrap>
                      <Tag color={selectedMemberForReligious.religiousActivities.weeklyTahajjud ? 'green' : 'red'}>
                        تہجد: {selectedMemberForReligious.religiousActivities.weeklyTahajjud ? 'Yes' : 'No'}
                      </Tag>
                      <Tag color={selectedMemberForReligious.religiousActivities.sermonListening ? 'green' : 'red'}>
                        خطبہ حضور انور: {selectedMemberForReligious.religiousActivities.sermonListening ? 'Yes' : 'No'}
                      </Tag>
                      <Tag color={selectedMemberForReligious.religiousActivities.prayerLetterWriting ? 'green' : 'red'}>
                        دعائیہ خط: {selectedMemberForReligious.religiousActivities.prayerLetterWriting ? 'Yes' : 'No'}
                      </Tag>
                    </Space>
                  </Col>
                </Row>
                
                <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                  <Col span={24}>
                    <h4>Others Info</h4>
                    <Space wrap>
                      <Tag color={selectedMemberForReligious.religiousActivities.prayerWithTranslation ? 'green' : 'red'}>
                        نماز با ترجمہ: {selectedMemberForReligious.religiousActivities.prayerWithTranslation ? 'Yes' : 'No'}
                      </Tag>
                      <Tag color={selectedMemberForReligious.religiousActivities.quranRecitation ? 'green' : 'red'}>
                        قرآن ناظرہ: {selectedMemberForReligious.religiousActivities.quranRecitation ? 'Yes' : 'No'}
                      </Tag>
                      <Tag color={selectedMemberForReligious.religiousActivities.willWritten ? 'green' : 'red'}>
                        وصیت: {selectedMemberForReligious.religiousActivities.willWritten ? 'Yes' : 'No'}
                      </Tag>
                    </Space>
                  </Col>
                </Row>
                
                <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                  <Col span={24}>
                    <h4>MTA ba zaria Dish, internet</h4>
                    <Space wrap>
                      <Tag color={selectedMemberForReligious.religiousActivities.mtaDish ? 'green' : 'red'}>
                        MTA ڈش: {selectedMemberForReligious.religiousActivities.mtaDish ? 'Yes' : 'No'}
                      </Tag>
                      <Tag color={selectedMemberForReligious.religiousActivities.mtaCable ? 'green' : 'red'}>
                        MTA کیبل: {selectedMemberForReligious.religiousActivities.mtaCable ? 'Yes' : 'No'}
                      </Tag>
                      <Tag color={selectedMemberForReligious.religiousActivities.internetAccess ? 'green' : 'red'}>
                        انٹرنیٹ: {selectedMemberForReligious.religiousActivities.internetAccess ? 'Yes' : 'No'}
                      </Tag>
                    </Space>
                  </Col>
                </Row>
                
                <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                  <Col span={24}>
                    <h4>Prayer Information</h4>
                    <Space wrap>
                      <Tag color="blue">
                        پنجگانہ نماز: {selectedMemberForReligious.religiousActivities.fiveDailyPrayers}/5
                      </Tag>
                      <Tag color="blue">
                        با جماعت نمازیں: {selectedMemberForReligious.religiousActivities.congregationalPrayers}/5
                      </Tag>
                      <Tag color={selectedMemberForReligious.religiousActivities.fridayPrayer ? 'green' : 'red'}>
                        نماز جمعہ: {selectedMemberForReligious.religiousActivities.fridayPrayer ? 'Yes' : 'No'}
                      </Tag>
                    </Space>
                  </Col>
                </Row>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Text type="secondary">No religious activities data available for this member.</Text>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Members;
