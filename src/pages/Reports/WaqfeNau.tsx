import useMemberNavigation from '../../hooks/useMemberNavigation';
import React, { useState, useEffect } from 'react';

import {
  Card,

  Space,
  Input,
  Button,
  Tag,
  Typography,

  Modal,
  message
} from 'antd';
import {
  SearchOutlined,

  DownloadOutlined,

} from '@ant-design/icons';
import { ApiService } from '../../services/apiService';
import type { Member, Family } from '../../types';
import {
  getTanzeemDisplayName
} from '../../utils/helpers';
import MembershipRecords from '../../components/MembershipRecords';
import { exportMembershipPDF } from '../../utils/membershipPdf';
import dayjs from 'dayjs';

import MemberForm from '../../components/MemberForm';

const { Text, Title } = Typography;

const WaqfeNau: React.FC = () => {

  const openMember = useMemberNavigation();
  const [members, setMembers] = useState<Member[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadMembers();
  }, []);

  const getGuardianName = (m: Member) => {
    if (m.tanzeem === 'lajna') return m.husbandName || m.fatherName || '';
    return m.fatherName || m.husbandName || '';
  };

  const getGuardianPrefix = (m: Member) => {
    if (m.tanzeem === 'lajna' && m.husbandName) return 'w/o';
    if (m.fatherName) return 's/o';
    if (m.husbandName) return 'w/o';
    return '';
  };

  const loadMembers = async () => {
    setLoading(true);
    try {
      const [allMembers, allFamilies] = await Promise.all([
        ApiService.getAllMembers(),
        ApiService.getAllFamilies()
      ]);
      // Filter for Waqf-e-Nau members (those who have a waqfeNauNumber)
      const wnMembers = allMembers.filter(m => m.waqfeNauNumber && m.waqfeNauNumber.trim() !== '');
      setMembers(wnMembers);
      setFamilies(allFamilies);
    } catch (error) {
      message.error('Failed to load members');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter(member => {
    if (!searchText) return true;
    const searchLower = searchText.toLowerCase();
    return (
      member.name.toLowerCase().includes(searchLower) ||
      member.waqfeNauNumber?.toLowerCase().includes(searchLower) ||
      member.fatherName?.toLowerCase().includes(searchLower) ||
      member.husbandName?.toLowerCase().includes(searchLower)
    );
  });

  const familyNameById = React.useMemo(() => {
    const map: Record<string, string> = {};
    families.forEach(f => {
      map[f.id] = f.familyName || '';
    });
    return map;
  }, [families]);

  const sortedMembers = React.useMemo(() => {
    const arr = [...filteredMembers];
    arr.sort((a, b) => {
      const aFamilyId = a.familyId || '';
      const bFamilyId = b.familyId || '';
      const fa = familyNameById[aFamilyId] || '';
      const fb = familyNameById[bFamilyId] || '';
      if (fa !== fb) return fa.localeCompare(fb);
      const ageA = a.age ?? 0;
      const ageB = b.age ?? 0;
      if (ageA !== ageB) return ageB - ageA; // older to younger within family
      return a.name.localeCompare(b.name);
    });
    return arr;
  }, [filteredMembers, familyNameById]);


  const handleExportPDF = async () => {
    if (exporting) return;
    setExporting(true);
    try { await exportMembershipPDF('Waqf-e-Nau Members', 'waqf-e-nau-members', [
      { title: 'Below 15 years', members: sortedMembers.filter(member => member.age < 15) },
      { title: '15-21 years', members: sortedMembers.filter(member => member.age >= 15 && member.age <= 21) },
      { title: 'Above 21 years', members: sortedMembers.filter(member => member.age > 21) }
    ].map(group => ({ title: group.title, rows: group.members.map((member, index) => [String(index + 1), member.waqfeNauNumber || '', member.name, getGuardianName(member), String(member.age), getTanzeemDisplayName(member.tanzeem)]) })), ['S.No', 'Waqf-e-Nau number', 'Name', 'Father / Husband', 'Age', 'Tanzeem']); }
    catch { message.error('Unable to export PDF. Please try again.'); }
    finally { setExporting(false); }
  };
  const handleEdit = (record: Member) => {
    setEditingMember(record);
    setModalVisible(true);
  };

  const handleModalOk = async (values: any) => {
    try {
      setIsSaving(true);
      if (editingMember) {
        const age = dayjs().diff(dayjs(values.dateOfBirth), 'year');
        const updatedMember = {
          ...editingMember,
          ...values,
          age,
          dateOfBirth: values.dateOfBirth.format('YYYY-MM-DD'),
          dateOfDeath: values.dateOfDeath ? values.dateOfDeath.format('YYYY-MM-DD') : undefined,
          updatedAt: new Date().toISOString(),
        };
        await ApiService.updateMember(editingMember.id, updatedMember);
        message.success('Member updated successfully');
        setModalVisible(false);
        setEditingMember(null);
        loadMembers();
      }
    } catch (error) {
      message.error('Failed to update member');
    } finally {
      setIsSaving(false);
    }
  };

  const columns = [
    {
      title: 'S.No',
      key: 'index',
      width: 70,
      render: (_: any, __: Member, index: number) => index + 1,
    },
    {
      title: 'Family',
      key: 'family',
      width: 180,
      render: (_: any, record: Member) => familyNameById[record.familyId || ''] || '-',
      sorter: (a: Member, b: Member) =>
        (familyNameById[a.familyId || ''] || '').localeCompare(familyNameById[b.familyId || ''] || ''),
    },
    {
      title: 'Waqf-e-Nau No',
      dataIndex: 'waqfeNauNumber',
      key: 'waqfeNauNumber',
      width: 120,
      render: (text: string) => <Tag color="blue">{text}</Tag>,
      sorter: (a: Member, b: Member) => (a.waqfeNauNumber || '').localeCompare(b.waqfeNauNumber || ''),
    },
    {
      title: 'Name',
      key: 'name',
      render: (_: any, record: Member) => (
        <Space>

          <Space direction="vertical" size={0}>
            <Text 
              strong 
              style={{ color: '#1890ff', cursor: 'pointer' }}
              onClick={() => handleEdit(record)}
            >
              {record.name}
            </Text>
            {getGuardianName(record) && (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {getGuardianPrefix(record)} {getGuardianName(record)}
              </Text>
            )}
          </Space>
        </Space>
      ),
      sorter: (a: Member, b: Member) => a.name.localeCompare(b.name),
    },
    {
      title: 'Tanzeem',
      dataIndex: 'tanzeem',
      key: 'tanzeem',
      width: 120,
      render: (tanzeem: any) => <Tag>{getTanzeemDisplayName(tanzeem)}</Tag>,
      filters: [
        { text: 'Ansarullah', value: 'ansarullah' },
        { text: 'Khuddam', value: 'khuddam' },
        { text: 'Atfal', value: 'atfal' },
        { text: 'Lajna', value: 'lajna' },
        { text: 'Nasirat', value: 'nasirat' },
      ],
      onFilter: (value: any, record: Member) => record.tanzeem === value,
    },
    {
      title: 'Age',
      dataIndex: 'age',
      key: 'age',
      width: 80,
      sorter: (a: Member, b: Member) => a.age - b.age,
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: Member) => (
        <Space size="middle">
          <Button type="link" onClick={() => handleEdit(record)}>
            Edit
          </Button>
          <Button type="link" onClick={() => openMember(record.id)}>
            Details
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="membership-page">
      <div className="membership-header">
        <div>
          <Title level={2} style={{ margin: 0 }}>Waqf-e-Nau Members</Title>
          <Text type="secondary">Total: {filteredMembers.length}</Text>
        </div>
        <Space>

          <Button 
            icon={<DownloadOutlined />} 
            onClick={handleExportPDF} loading={exporting}
          >
            Export PDF
          </Button>

        </Space>
      </div>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search by name, Waqf-e-Nau No, or father/husband name"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
        </div>

        <div className="membership-tanzeem-summary">{Array.from(new Set(filteredMembers.map(member => member.tanzeem))).map(tanzeem => <div key={tanzeem}><span>{getTanzeemDisplayName(tanzeem)}</span><strong>{filteredMembers.filter(member => member.tanzeem === tanzeem).length}</strong></div>)}</div>
        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginTop: 0 }}>
            Below 15 Years <Text type="secondary">({sortedMembers.filter(m => m.age < 15).length})</Text>
          </Title>
          <MembershipRecords hideCount kind="waqfe-nau" columns={columns} members={sortedMembers.filter(m => m.age < 15)} loading={loading} />
        </div>

        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginTop: 0 }}>
            15–21 Years <Text type="secondary">({sortedMembers.filter(m => m.age >= 15 && m.age <= 21).length})</Text>
          </Title>
          <MembershipRecords hideCount kind="waqfe-nau" columns={columns} members={sortedMembers.filter(m => m.age >= 15 && m.age <= 21)} loading={loading} />
        </div>

        <div>
          <Title level={4} style={{ marginTop: 0 }}>
            Above 21 Years <Text type="secondary">({sortedMembers.filter(m => m.age > 21).length})</Text>
          </Title>
          <MembershipRecords hideCount kind="waqfe-nau" columns={columns} members={sortedMembers.filter(m => m.age > 21)} loading={loading} />
        </div>
      </Card>

      <Modal
        title="Edit Member"
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
          showCancel
          onCancel={() => setModalVisible(false)}
          existingMembers={members}
        />
      </Modal>
    </div>
  );
};

export default WaqfeNau;
