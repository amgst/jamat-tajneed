import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Input,
  Select,
  message,
  Popconfirm,
  Tag,
  Avatar,
  Typography,
  Row,
  Col,
  Tabs
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  DownloadOutlined,
  TeamOutlined,
  UserOutlined
} from '@ant-design/icons';
import ReligiousActivitiesModal from '../components/ReligiousActivitiesModal';
import MemberForm from '../components/MemberForm';
import { ApiService } from '../services/apiService';
import type { Member, Tanzeem, Family } from '../types';
import {
  calculateAge,
  determineTanzeem,
  getTanzeemDisplayName,
  formatCNIC,
  formatDate,
  exportToCSV
} from '../utils/helpers';
import { generateAvatarFromName } from '../utils/imageUtils';
import { validateMemberData, sanitizeMemberData } from '../utils/validation';

const { Option } = Select;
const { Text } = Typography;

const Members: React.FC = () => {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [searchText, setSearchText] = useState('');
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('active');
  const [religiousModalVisible, setReligiousModalVisible] = useState(false);
  const [selectedMemberForReligious, setSelectedMemberForReligious] = useState<Member | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
    setModalVisible(true);
  };

  const handleEditMember = (member: Member) => {
    setEditingMember(member);
    setModalVisible(true);
  };

  const handleModalOk = async (values: any) => {
    try {
      setIsSaving(true);
      const formData = values;

      const age = calculateAge(formData.dateOfBirth.format('YYYY-MM-DD'));
      const tanzeem = determineTanzeem(age, formData.gender);

      // Prepare member data
      const memberDataRaw: any = {
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
        profilePhoto: formData.profilePhoto || generateAvatarFromName(formData.name),
        hasNewTanzeemTransition: false,
        isDeceased: formData.isDeceased || false,
        isMoved: formData.isMoved || false,
        movedTo: formData.movedTo || '',

        // New fields
        isBaitByBirth: formData.isBaitByBirth,
        baitYear: formData.isBaitByBirth ? undefined : formData.baitYear,
        wasitNo: formData.wasitNo || '',
        education: formData.education || '',
        bloodGroup: formData.bloodGroup || '',
        waqfeNauNumber: formData.waqfeNauNumber || '',

        updatedAt: new Date().toISOString(),
      };

      // Only set createdAt for new members
      if (!editingMember) {
        memberDataRaw.createdAt = new Date().toISOString();
      } else {
        memberDataRaw.createdAt = editingMember.createdAt;
      }

      // Only add dateOfDeath if it has a value
      if (formData.dateOfDeath) {
        memberDataRaw.dateOfDeath = formData.dateOfDeath.format('YYYY-MM-DD');
      }

      // Validate and sanitize input
      const validation = validateMemberData(memberDataRaw);
      if (!validation.valid) {
        message.error(`Validation failed: ${validation.errors.join(', ')}`);
        return;
      }

      const memberData = sanitizeMemberData(memberDataRaw);

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
        const errors = error.errorFields.map((field: any) => field.errors).flat();
        message.error(`Please fix the following errors: ${errors.join(', ')}`);
      } else {
        message.error('Failed to save member');
        console.error(error);
      }
    } finally {
      setIsSaving(false);
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
      firebaseData.members[member.id] = {
        ...member,
        id: undefined
      };
      delete firebaseData.members[member.id].id;
    });

    families.forEach(family => {
      firebaseData.families[family.id] = {
        ...family,
        id: undefined
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

  const getFamilyMembers = (familyId: string): Member[] => {
    return members.filter(m => m.familyId === familyId);
  };

  const getFilteredAndSortedMembers = (): Member[] => {
    let filtered = members;

    if (activeTab === 'deceased') {
      filtered = filtered.filter(m => m.isDeceased);
    } else if (activeTab === 'moved') {
      filtered = filtered.filter(m => m.isMoved);
    } else {
      filtered = filtered.filter(m => !m.isDeceased && !m.isMoved);
    }

    if (selectedFamilyId) {
      filtered = filtered.filter(m => m.familyId === selectedFamilyId);
    }

    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(m => {
        const family = families.find(f => f.memberIds.includes(m.id));
        return (
          m.name.toLowerCase().includes(searchLower) ||
          (m.fatherName || '').toLowerCase().includes(searchLower) ||
          (m.phone || '').toLowerCase().includes(searchLower) ||
          m.address.toLowerCase().includes(searchLower) ||
          (family?.halqa || '').toLowerCase().includes(searchLower)
        );
      });
    }

    // Sort by family number, then by family role
    filtered.sort((a, b) => {
      const familyA = families.find(f => f.memberIds.includes(a.id));
      const familyB = families.find(f => f.memberIds.includes(b.id));

      const familyNumA = familyA?.familyNumber || 999999;
      const familyNumB = familyB?.familyNumber || 999999;

      if (familyNumA !== familyNumB) {
        return familyNumA - familyNumB;
      }

      if (familyA && a.id === familyA.headId) return -1;
      if (familyB && b.id === familyB.headId) return 1;

      if (a.gender === 'female' && b.gender === 'male') return -1;
      if (a.gender === 'male' && b.gender === 'female') return 1;

      return b.age - a.age;
    });

    return filtered;
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
              <Tag color="red">Head</Tag>
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
                <Tag color="red" style={{ fontSize: '10px', padding: '0 4px' }}>Deceased</Tag>
              )}
            </div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {record.husbandName ? `Husband: ${record.husbandName}` : record.fatherName}
            </Text>
            {record.isMoved && (
              <Tag color="orange" style={{ marginTop: 4, display: 'block' }}>
                Moved to {record.movedTo || 'unknown location'}
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: 'Gender',
      dataIndex: 'gender',
      key: 'gender',
      render: (gender: string) => (
        <Tag color={gender === 'male' ? 'blue' : 'pink'}>{gender.toUpperCase()}</Tag>
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
      render: (record: Member) => {
        const family = families.find(f => f.memberIds.includes(record.id));
        return family?.halqa || '-';
      },
    },
    {
      title: 'Status',
      key: 'status',
      render: (record: Member) => {
        if (record.isDeceased) return <Tag color="red">Deceased</Tag>;
        if (record.isMoved) return <Tag color="orange">Moved</Tag>;
        return <Tag color="green">Active</Tag>;
      },
      width: 100,
    },
    {
      title: 'Religious Data',
      key: 'religious',
      render: (record: Member) => {
        const hasData = !!record.religiousActivities;
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
            title="Are you sure?"
            onConfirm={() => {
              ApiService.deleteMember(record.id).then(() => {
                message.success('Deleted');
                loadMembers();
              });
            }}
          >
            <Button type="primary" danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
      width: 100,
    },
  ];

  const getTabCounts = () => {
    const activeCount = members.filter(m => !m.isDeceased && !m.isMoved).length;
    const deceasedCount = members.filter(m => m.isDeceased).length;
    const movedCount = members.filter(m => m.isMoved).length;
    return { activeCount, deceasedCount, movedCount };
  };

  const { activeCount, deceasedCount, movedCount } = getTabCounts();

  return (
    <div>
      <Card
        title="Members Management"
        extra={
          <Space>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>Export CSV</Button>
            <Button icon={<DownloadOutlined />} onClick={handleFirebaseExport}>Firebase</Button>
            <Button icon={<ReloadOutlined />} onClick={loadMembers} loading={loading}>Refresh</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddMember}>Add</Button>
          </Space>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'active',
              label: `Active (${activeCount})`,
              children: (
                <>
                  <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col xs={24} md={12}>
                      <Input
                        placeholder="Search..."
                        prefix={<SearchOutlined />}
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        allowClear
                      />
                    </Col>
                    <Col xs={24} md={12}>
                      <Select
                        placeholder="Filter by family"
                        value={selectedFamilyId}
                        onChange={setSelectedFamilyId}
                        allowClear
                        style={{ width: '100%' }}
                      >
                        {families.map(f => (
                          <Option key={f.id} value={f.id}>{f.familyName}</Option>
                        ))}
                      </Select>
                    </Col>
                  </Row>
                  <Table
                    columns={columns}
                    dataSource={getFilteredAndSortedMembers()}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 1000 }}
                  />
                </>
              )
            },
            {
              key: 'deceased',
              label: `Deceased (${deceasedCount})`,
              children: (
                <Table
                  columns={columns}
                  dataSource={getFilteredAndSortedMembers()}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 1000 }}
                  rowClassName={() => 'deceased-member'}
                />
              )
            },
            {
              key: 'moved',
              label: `Moved (${movedCount})`,
              children: (
                <Table
                  columns={columns}
                  dataSource={getFilteredAndSortedMembers()}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 1000 }}
                />
              )
            }
          ]}
        />
      </Card>

      <Modal
        title={editingMember ? 'Edit Member' : 'Add New Member'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingMember(null);
        }}
        width={700}
        destroyOnClose
        footer={null}
      >
        <MemberForm
          initialValues={editingMember || undefined}
          onFinish={handleModalOk}
          isSaving={isSaving}
          familyHalqa={editingMember ? families.find(f => f.memberIds.includes(editingMember.id))?.halqa : undefined}
          showCancel
          onCancel={() => setModalVisible(false)}
        />
      </Modal>

      <ReligiousActivitiesModal
        visible={religiousModalVisible}
        member={selectedMemberForReligious}
        onClose={() => setReligiousModalVisible(false)}
        onSuccess={loadMembers}
      />
    </div>
  );
};

export default Members;
