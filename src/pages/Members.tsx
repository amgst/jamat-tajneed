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
import ReligiousActivitiesModal from '../components/ReligiousActivitiesModal';
import dayjs from 'dayjs';
import { ApiService } from '../services/apiService';
import type { Member, Tanzeem, Family } from '../types';
import {
  calculateAge,
  determineTanzeem,
  getTanzeemDisplayName,
  formatCNIC,
  validateCNIC,
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
  graveNumber?: string;

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

  // Add CSS for deceased member rows
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .deceased-member {
        background-color: #fff0f0 !important;
      }
      .deceased-member:hover {
        background-color: #ffe0e0 !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const mapMemberToFormValues = (member: Member) => ({
    ...member,
    dateOfBirth: dayjs(member.dateOfBirth),
    dateOfDeath: member.dateOfDeath ? dayjs(member.dateOfDeath) : undefined,
  });

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const [membersData, familiesData] = await Promise.all([
        ApiService.getAllMembers(),
        ApiService.getAllFamilies()
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
    setModalVisible(true);
  };

  useEffect(() => {
    if (modalVisible) {
      if (editingMember) {
        form.setFieldsValue({
          ...editingMember,
          dateOfBirth: dayjs(editingMember.dateOfBirth),
          dateOfDeath: editingMember.dateOfDeath ? dayjs(editingMember.dateOfDeath) : undefined,
        });
      } else {
        form.resetFields();
      }
    }
  }, [modalVisible, editingMember, form]);

  const handleDeleteMember = async (id: string) => {
    try {
      await ApiService.deleteMember(id);
      message.success('Member deleted successfully');
      loadMembers();
    } catch (error) {
      message.error('Failed to delete member');
      console.error(error);
    }
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
        graveNumber: formData.graveNumber || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Only add dateOfDeath if it has a value (Firebase doesn't accept undefined)
      if (formData.dateOfDeath) {
        memberData.dateOfDeath = formData.dateOfDeath.format('YYYY-MM-DD');
      }

      if (editingMember) {
        await ApiService.updateMember(editingMember.id, memberData);
        message.success('Member updated successfully');
      } else {
        await ApiService.createMember(memberData);
        message.success('Member added successfully');
      }

      setModalVisible(false);
      loadMembers();
    } catch (error: any) {
      if (error.errorFields) {
        console.log('Validation errors:', error.errorFields);
        message.error('Please fix form validation errors');
      } else {
        message.error('Failed to save member');
        console.error(error);
      }
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

  const handleFirebaseExport = () => {
    const firebaseData: {
      members: Record<string, any>;
      families: Record<string, any>;
    } = {
      members: {},
      families: {}
    };

    members.forEach(member => {
      (firebaseData.members as Record<string, any>)[member.id] = {
        ...member,
        id: undefined // Remove id from data
      };
      delete firebaseData.members[member.id].id;
    });

    families.forEach(family => {
      firebaseData.families[family.id] = {
        ...family,
        id: undefined // Remove id from data
      };
      delete firebaseData.families[family.id].id;
    });

    const blob = new Blob([JSON.stringify(firebaseData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'firebase-export.json';
    a.click();
    URL.revokeObjectURL(url);
    message.success('Firebase data exported successfully');
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

        return (
          <div>
            <div
              style={{ fontWeight: 500, color: '#1890ff', cursor: 'pointer' }}
              onClick={() => navigate(`/families/${family.id}`)}
            >
              {family.familyName}
            </div>
            {isHead && (
              <Tag color="red">
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
      render: (name: string, record: Member) => {
        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-');
        const slugId = `${slug}-${record.id}`;
        return (
          <div>
            <div
              style={{ fontWeight: 500, color: '#1890ff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
              onClick={() => navigate(`/members/${slugId}`)}
            >
              {name}
              {record.isDeceased && (
                <Tag color="red" style={{ fontSize: '10px', padding: '0 4px' }}>
                  Deceased
                </Tag>
              )}
            </div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.husbandName ? `Husband: ${record.husbandName}` : record.fatherName}
            </Text>
          </div>
        );
      },
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
            icon={<EditOutlined />}
            onClick={() => {
              setSelectedMemberForReligious(record);
              setReligiousModalVisible(true);
            }}
            style={{
              backgroundColor: hasData ? '#52c41a' : undefined,
              borderColor: hasData ? '#52c41a' : undefined
            }}
          >
            Edit
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
              icon={<DownloadOutlined />}
              onClick={handleFirebaseExport}
            >
              Export Firebase Data
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
                              <Tag color="blue">
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
                    rowClassName={(record: Member) => record.isDeceased ? 'deceased-member' : ''}
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
        destroyOnClose
        afterOpenChange={(open) => {
          if (open && editingMember) {
            form.setFieldsValue(mapMemberToFormValues(editingMember));
          }
        }}
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          preserve={false}
          initialValues={editingMember ? mapMemberToFormValues(editingMember) : undefined}
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

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="graveNumber"
                label="Grave Number"
                rules={[
                  { max: 50, message: 'Grave number cannot be longer than 50 characters' }
                ]}
              >
                <Input placeholder="Enter grave number" />
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

      {/* Religious Activities Modal */}
      <ReligiousActivitiesModal
        visible={religiousModalVisible}
        member={selectedMemberForReligious}
        onClose={() => setReligiousModalVisible(false)}
        onSuccess={() => {
          loadMembers(); // Refresh the members list
        }}
      />
    </div>
  );
};

export default Members;
