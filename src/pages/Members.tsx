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
} from '@ant-design/icons';
import MemberForm from '../components/MemberForm';
import { ApiService } from '../services/apiService';
import type { Member, Tanzeem, Family } from '../types';
import {
  calculateAge,
  determineTanzeem,
  getTanzeemDisplayName,
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
  const [isSaving, setIsSaving] = useState(false);
  const [wasitDrafts, setWasitDrafts] = useState<Record<string, string>>({});
  const [savingWasitIds, setSavingWasitIds] = useState<Record<string, boolean>>({});
  const [savingMaritalIds, setSavingMaritalIds] = useState<Record<string, boolean>>({});
  const [fatherDrafts, setFatherDrafts] = useState<Record<string, string>>({});
  const [husbandDrafts, setHusbandDrafts] = useState<Record<string, string>>({});
  const [savingFatherIds, setSavingFatherIds] = useState<Record<string, boolean>>({});
  const [savingHusbandIds, setSavingHusbandIds] = useState<Record<string, boolean>>({});
  const [pageSize, setPageSize] = useState(10);

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
      setWasitDrafts(
        Object.fromEntries(membersData.map(member => [member.id, member.wasitNo || '']))
      );
      setFatherDrafts(
        Object.fromEntries(membersData.map(member => [member.id, member.fatherName || '']))
      );
      setHusbandDrafts(
        Object.fromEntries(membersData.map(member => [member.id, member.husbandName || '']))
      );
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
        dateOfBirth: formData.dateOfBirth.format('YYYY-MM-DD'),
        age,
        phone: formData.phone && String(formData.phone).trim() ? String(formData.phone).trim() : '',
        address: formData.address,
        tanzeem,
        halqa: '',
        profilePhoto: formData.profilePhoto || generateAvatarFromName(formData.name),
        hasNewTanzeemTransition: false,
        isDeceased: formData.isDeceased || false,
        isMoved: formData.isMoved || false,
        movedTo: formData.movedTo || '',
        isBList: formData.isBList || false,

        // New fields
        isBaitByBirth: formData.isBaitByBirth,
        baitYear: formData.isBaitByBirth ? undefined : formData.baitYear,
        wasitNo: formData.wasitNo || '',
        education: formData.education || '',
        bloodGroup: formData.bloodGroup || '',
        waqfeNauNumber: formData.waqfeNauNumber || '',
        maritalStatus: formData.maritalStatus || (formData.isMarried ? 'married' : 'unmarried'),
        isMarried: formData.maritalStatus ? formData.maritalStatus === 'married' : !!formData.isMarried,

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
      'Marital Status': member.maritalStatus || ((member as any).isMarried ? 'married' : 'unmarried'),
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

  const getFilteredAndSortedMembers = (): Member[] => {
    let filtered = members;

    if (activeTab === 'deceased') {
      filtered = filtered.filter(m => m.isDeceased && !m.isBList);
    } else if (activeTab === 'moved') {
      filtered = filtered.filter(m => m.isMoved && !m.isBList);
    } else if (activeTab === 'b-list') {
      filtered = filtered.filter(m => m.isBList);
    } else {
      filtered = filtered.filter(m => !m.isDeceased && !m.isMoved && !m.isBList);
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
          (m.address || '').toLowerCase().includes(searchLower) ||
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

  const persistWasitNo = async (memberId: string, nextWasitNo: string) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    const normalizedWasitNo = nextWasitNo.trim();
    const currentWasitNo = (member.wasitNo || '').trim();

    if (normalizedWasitNo === currentWasitNo) {
      setSavingWasitIds(prev => ({ ...prev, [memberId]: false }));
      return;
    }

    setSavingWasitIds(prev => ({ ...prev, [memberId]: true }));
    try {
      await ApiService.updateMember(memberId, { wasitNo: normalizedWasitNo });
      setMembers(prev => prev.map(item => (
        item.id === memberId
          ? { ...item, wasitNo: normalizedWasitNo, updatedAt: new Date().toISOString() }
          : item
      )));
      setWasitDrafts(prev => ({ ...prev, [memberId]: normalizedWasitNo }));
    } catch (error) {
      setWasitDrafts(prev => ({ ...prev, [memberId]: member.wasitNo || '' }));
      message.error(`Failed to save Wasit No for ${member.name}`);
      console.error(error);
    } finally {
      setSavingWasitIds(prev => ({ ...prev, [memberId]: false }));
    }
  };

  const handleWasitChange = (memberId: string, value: string) => {
    setWasitDrafts(prev => ({ ...prev, [memberId]: value }));
  };

  const handleWasitBlur = (memberId: string) => {
    const member = members.find(item => item.id === memberId);
    if (member) {
      void persistWasitNo(memberId, wasitDrafts[memberId] ?? member.wasitNo ?? '');
    }
  };

  const persistFatherName = async (memberId: string, nextFatherName: string) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    const normalizedFatherName = nextFatherName.trim();
    const currentFatherName = (member.fatherName || '').trim();

    if (normalizedFatherName === currentFatherName) {
      setSavingFatherIds(prev => ({ ...prev, [memberId]: false }));
      return;
    }

    setSavingFatherIds(prev => ({ ...prev, [memberId]: true }));
    try {
      await ApiService.updateMember(memberId, { fatherName: normalizedFatherName });
      setMembers(prev => prev.map(item => (
        item.id === memberId
          ? { ...item, fatherName: normalizedFatherName, updatedAt: new Date().toISOString() }
          : item
      )));
      setFatherDrafts(prev => ({ ...prev, [memberId]: normalizedFatherName }));
    } catch (error) {
      setFatherDrafts(prev => ({ ...prev, [memberId]: member.fatherName || '' }));
      message.error(`Failed to save father name for ${member.name}`);
      console.error(error);
    } finally {
      setSavingFatherIds(prev => ({ ...prev, [memberId]: false }));
    }
  };

  const handleFatherChange = (memberId: string, value: string) => {
    setFatherDrafts(prev => ({ ...prev, [memberId]: value }));
  };

  const handleFatherBlur = (memberId: string) => {
    const member = members.find(item => item.id === memberId);
    if (member) {
      void persistFatherName(memberId, fatherDrafts[memberId] ?? member.fatherName ?? '');
    }
  };

  const persistHusbandName = async (memberId: string, nextHusbandName: string) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    const normalizedHusbandName = nextHusbandName.trim();
    const currentHusbandName = (member.husbandName || '').trim();

    if (normalizedHusbandName === currentHusbandName) {
      setSavingHusbandIds(prev => ({ ...prev, [memberId]: false }));
      return;
    }

    setSavingHusbandIds(prev => ({ ...prev, [memberId]: true }));
    try {
      await ApiService.updateMember(memberId, { husbandName: normalizedHusbandName });
      setMembers(prev => prev.map(item => (
        item.id === memberId
          ? { ...item, husbandName: normalizedHusbandName, updatedAt: new Date().toISOString() }
          : item
      )));
      setHusbandDrafts(prev => ({ ...prev, [memberId]: normalizedHusbandName }));
    } catch (error) {
      setHusbandDrafts(prev => ({ ...prev, [memberId]: member.husbandName || '' }));
      message.error(`Failed to save husband name for ${member.name}`);
      console.error(error);
    } finally {
      setSavingHusbandIds(prev => ({ ...prev, [memberId]: false }));
    }
  };

  const handleHusbandChange = (memberId: string, value: string) => {
    setHusbandDrafts(prev => ({ ...prev, [memberId]: value }));
  };

  const handleHusbandBlur = (memberId: string) => {
    const member = members.find(item => item.id === memberId);
    if (member) {
      void persistHusbandName(memberId, husbandDrafts[memberId] ?? member.husbandName ?? '');
    }
  };

  const persistMaritalStatus = async (
    memberId: string,
    maritalStatus: 'married' | 'unmarried' | 'divorced' | 'widower' | 'widow'
  ) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    const currentStatus = member.maritalStatus || ((member as any).isMarried ? 'married' : 'unmarried');
    if (maritalStatus === currentStatus) {
      return;
    }

    setSavingMaritalIds(prev => ({ ...prev, [memberId]: true }));
    try {
      await ApiService.updateMember(memberId, {
        maritalStatus,
        isMarried: maritalStatus === 'married',
      });
      setMembers(prev => prev.map(item => (
        item.id === memberId
          ? {
              ...item,
              maritalStatus,
              isMarried: maritalStatus === 'married',
              updatedAt: new Date().toISOString()
            }
          : item
      )));
    } catch (error) {
      message.error(`Failed to save marital status for ${member.name}`);
      console.error(error);
    } finally {
      setSavingMaritalIds(prev => ({ ...prev, [memberId]: false }));
    }
  };

  const getComputedMaritalStatus = (record: Member) =>
    (record.maritalStatus
      ? record.maritalStatus
      : ((record as any).isMarried ? 'married' : 'unmarried')) as
      | 'married'
      | 'unmarried'
      | 'divorced'
      | 'widower'
      | 'widow';

  const tablePagination = React.useMemo(
    () => ({
      pageSize,
      showSizeChanger: true,
      pageSizeOptions: [10, 20, 50, 100],
      onShowSizeChange: (_current: number, size: number) => setPageSize(size),
      showTotal: (total: number, range: [number, number]) => `${range[0]}-${range[1]} of ${total} records`,
    }),
    [pageSize]
  );

  const columns = [
    {
      title: 'S.No',
      key: 'serial',
      width: 80,
      render: (_: any, __: any, index: number) => index + 1,
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
              onClick={() => handleEditMember(record)}
            >
              {name}
              {record.isDeceased && (
                <Tag color="red" style={{ fontSize: '10px', padding: '0 4px' }}>Deceased</Tag>
              )}
            </div>
            <div style={{ fontSize: '11px', marginTop: '2px' }}>
              <Button 
                type="link" 
                size="small" 
                style={{ padding: 0, height: 'auto', fontSize: '11px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  const slug = name
                    .toLowerCase()
                    .replace(/[^a-z0-9\s-]/g, '')
                    .trim()
                    .replace(/\s+/g, '-');
                  const slugId = `${slug}-${record.id}`;
                  navigate(`/members/${slugId}`);
                }}
              >
                View Full Details
              </Button>
            </div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {(record.fatherName || record.husbandName)
                ? `${record.fatherName ? `Father: ${record.fatherName}` : ''}${record.fatherName && record.husbandName ? ' • ' : ''}${record.husbandName ? `Husband: ${record.husbandName}` : ''}`
                : '-'}
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
      title: 'Father Name',
      key: 'fatherName',
      width: 180,
      render: (record: Member) => (
        <Input
          value={fatherDrafts[record.id] ?? record.fatherName ?? ''}
          placeholder="Enter father name"
          allowClear
          size="small"
          onChange={(event) => handleFatherChange(record.id, event.target.value)}
          onBlur={() => handleFatherBlur(record.id)}
          status={savingFatherIds[record.id] ? 'warning' : undefined}
        />
      ),
    },
    {
      title: 'Husband Name',
      key: 'husbandName',
      width: 180,
      render: (record: Member) => (
        <Input
          value={husbandDrafts[record.id] ?? record.husbandName ?? ''}
          placeholder="Enter husband name"
          allowClear
          size="small"
          onChange={(event) => handleHusbandChange(record.id, event.target.value)}
          onBlur={() => handleHusbandBlur(record.id)}
          status={savingHusbandIds[record.id] ? 'warning' : undefined}
        />
      ),
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
      title: 'Marital Status',
      key: 'maritalStatus',
      filters: [
        { text: 'Unmarried', value: 'unmarried' },
        { text: 'Married', value: 'married' },
        { text: 'Divorced', value: 'divorced' },
        { text: 'Widower', value: 'widower' },
        { text: 'Widow', value: 'widow' }
      ],
      onFilter: (value: any, record: Member) => getComputedMaritalStatus(record) === value,
      render: (record: Member) => {
        const status = getComputedMaritalStatus(record);
        const map: Record<string, { text: string; color: string }> = {
          married: { text: 'شادی شدہ', color: 'green' },
          unmarried: { text: 'غیر شادی شدہ', color: 'default' },
          divorced: { text: 'طلاق یافتہ', color: 'orange' },
          widower: { text: 'رنڈوا', color: 'blue' },
          widow: { text: 'بیوہ', color: 'purple' }
        };
        const meta = map[status] || map.unmarried;
        return (
          <Space direction="vertical" size={4}>
            <Tag color={meta.color}>{meta.text}</Tag>
            <Select
              size="small"
              style={{ width: 140 }}
              value={status}
              loading={savingMaritalIds[record.id]}
              onChange={(value) => void persistMaritalStatus(record.id, value)}
              options={[
                { value: 'unmarried', label: 'Unmarried' },
                { value: 'married', label: 'Married' },
                { value: 'divorced', label: 'Divorced' },
                { value: 'widower', label: 'Widower' },
                { value: 'widow', label: 'Widow' }
              ]}
            />
          </Space>
        );
      }
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
      title: 'Wasit No',
      key: 'wasitNo',
      width: 160,
      render: (record: Member) => (
        <Input
          value={wasitDrafts[record.id] ?? record.wasitNo ?? ''}
          placeholder="Enter Wasit No"
          allowClear
          size="small"
          onChange={(event) => handleWasitChange(record.id, event.target.value)}
          onBlur={() => handleWasitBlur(record.id)}
          status={savingWasitIds[record.id] ? 'warning' : undefined}
        />
      ),
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
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
    const activeCount = members.filter(m => !m.isDeceased && !m.isMoved && !m.isBList).length;
    const deceasedCount = members.filter(m => m.isDeceased && !m.isBList).length;
    const movedCount = members.filter(m => m.isMoved && !m.isBList).length;
    const bListCount = members.filter(m => m.isBList).length;
    return { activeCount, deceasedCount, movedCount, bListCount };
  };

  const { activeCount, deceasedCount, movedCount, bListCount } = getTabCounts();

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
                    pagination={tablePagination as any}
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
                  pagination={tablePagination as any}
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
                  pagination={tablePagination as any}
                  scroll={{ x: 1000 }}
                />
              )
            },
            {
              key: 'b-list',
              label: `B List (${bListCount})`,
              children: (
                <Table
                  columns={columns}
                  dataSource={getFilteredAndSortedMembers()}
                  rowKey="id"
                  loading={loading}
                  pagination={tablePagination as any}
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
        destroyOnHidden
        footer={null}
      >
        <MemberForm
          initialValues={editingMember || undefined}
          onFinish={handleModalOk}
          isSaving={isSaving}
          familyHalqa={editingMember ? families.find(f => f.memberIds.includes(editingMember.id))?.halqa : undefined}
          showCancel
          onCancel={() => setModalVisible(false)}
          existingMembers={members}
        />
      </Modal>
    </div>
  );
};

export default Members;
