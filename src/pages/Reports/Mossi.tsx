import useMemberNavigation from '../../hooks/useMemberNavigation';
import React, { useMemo, useState, useEffect } from 'react';

import {
  Card,

  Space,
  Input,
  Button,
  Tag,
  Typography,

  Tabs,
  Row,
  Col,
  Statistic,
  message,
  Modal
} from 'antd';
import {
  SearchOutlined,

  DownloadOutlined,

} from '@ant-design/icons';
import { ApiService } from '../../services/apiService';
import type { Member } from '../../types';
import {
  getTanzeemDisplayName,


} from '../../utils/helpers';
import MembershipRecords from '../../components/MembershipRecords';
import { exportMembershipPDF } from '../../utils/membershipPdf';
import dayjs from 'dayjs';

import MemberForm from '../../components/MemberForm';

const { Text, Title } = Typography;

const Mossi: React.FC = () => {

  const openMember = useMemberNavigation();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadMembers();
  }, []);

  const normalizeTanzeemForReport = (tanzeem: string | undefined): string => {
    if (!tanzeem) return 'unknown';
    if (['atfal', 'nasirat', 'saf-e-awal', 'saf-e-awal-girls'].includes(tanzeem)) return 'dafar-atfal';
    return tanzeem;
  };

  const getGuardianName = (m: Member) => {
    const normalized = normalizeTanzeemForReport(m.tanzeem);
    if (normalized === 'lajna') return m.husbandName || m.fatherName || '';
    return m.fatherName || m.husbandName || '';
  };

  const getGuardianPrefix = (m: Member) => {
    const normalized = normalizeTanzeemForReport(m.tanzeem);
    if (normalized === 'lajna' && m.husbandName) return 'w/o';
    if (m.fatherName) return 's/o';
    if (m.husbandName) return 'w/o';
    return '';
  };

  const loadMembers = async () => {
    setLoading(true);
    try {
      const allMembers = await ApiService.getAllMembers();
      const mossiMembers = allMembers.filter(m => m.wasitNo && m.wasitNo.trim() !== '');
      setMembers(mossiMembers);
    } catch (error) {
      message.error('Failed to load members');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = useMemo(() => {
    return members.filter(member => {
      if (!searchText) return true;
      const searchLower = searchText.toLowerCase();
      return (
        member.name.toLowerCase().includes(searchLower) ||
        member.wasitNo?.toLowerCase().includes(searchLower) ||
        member.fatherName?.toLowerCase().includes(searchLower) ||
        member.husbandName?.toLowerCase().includes(searchLower) ||
        member.phone?.toLowerCase().includes(searchLower)
      );
    });
  }, [members, searchText]);

  const groupedByTanzeem = useMemo(() => {
    const groups: Record<string, Member[]> = {
      ansar: [],
      khuddam: [],
      lajna: [],
      'dafar-atfal': [],
      other: [],
      unknown: []
    };

    filteredMembers.forEach(m => {
      const key = normalizeTanzeemForReport(m.tanzeem);
      if (key in groups) groups[key].push(m);
      else groups.other.push(m);
    });

    Object.values(groups).forEach(list => {
      list.sort((a, b) => (a.age ?? 0) - (b.age ?? 0));
    });

    const order = ['ansar', 'khuddam', 'lajna', 'dafar-atfal', 'other', 'unknown'];
    return order
      .filter(k => (groups[k]?.length ?? 0) > 0)
      .map(k => ({
        key: k,
        label: k === 'other' ? 'Other' : k === 'unknown' ? 'Unknown' : getTanzeemDisplayName(k),
        members: groups[k]
      }));
  }, [filteredMembers]);


  const handleExportPDF = async () => {
    if (exporting) return;
    setExporting(true);
    try { await exportMembershipPDF('Mossi Members', 'mossi-members', groupedByTanzeem.map(group => ({ title: group.label, rows: group.members.map((member, index) => [String(index + 1), member.wasitNo || '', member.name, getGuardianName(member), String(member.age)]) })), ['S.No', 'Musi number', 'Name', 'Father / Husband', 'Age']); }
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

  const columnsAll = useMemo(() => {
    return [
      {
        title: 'Wasiyyat No',
        dataIndex: 'wasitNo',
        key: 'wasitNo',
        width: 120,
        render: (text: string) => <Tag color="green">{text}</Tag>,
        sorter: (a: Member, b: Member) => (a.wasitNo || '').localeCompare(b.wasitNo || ''),
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
          { text: 'Ansar', value: 'ansar' },
          { text: 'Khuddam', value: 'khuddam' },
          { text: 'Atfal', value: 'atfal' },
          { text: 'Lajna', value: 'lajna' },
          { text: 'Nasirat', value: 'nasirat' },
          { text: 'Saf-e-Awal', value: 'saf-e-awal' },
          { text: 'Saf-e-Awal (Girls)', value: 'saf-e-awal-girls' },
        ],
        onFilter: (value: any, record: Member) => record.tanzeem === value,
      },
      {
        title: 'Age',
        dataIndex: 'age',
        key: 'age',
        width: 80,
        sorter: (a: Member, b: Member) => (a.age ?? 0) - (b.age ?? 0),
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
  }, [openMember]);

  const columnsGroup = useMemo(() => {
    return columnsAll.filter(col => (col as any).key !== 'tanzeem');
  }, [columnsAll]);

  return (
    <div className="membership-page">
      <div className="membership-header">
        <div>
          <Title level={2} style={{ margin: 0 }}>Mossi Members</Title>
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
            placeholder="Search by name, Wasiyyat No, father/husband name, or phone"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
        </div>

        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          {groupedByTanzeem.map(group => (
            <Col key={group.key} xs={12} sm={8} md={6} lg={4} xl={4}>
              <Card size="small">
                <Statistic title={group.label} value={group.members.length} />
              </Card>
            </Col>
          ))}
        </Row>

        <Tabs
          defaultActiveKey="all"
          items={[
            ...groupedByTanzeem.map(group => ({
              key: group.key,
              label: `${group.label} (${group.members.length})`,
              children: (
                <MembershipRecords kind="mossi" columns={columnsGroup as any} members={group.members} loading={loading} />
              )
            })),
            {
              key: 'all',
              label: `All (${filteredMembers.length})`,
              children: (
                <MembershipRecords kind="mossi" columns={columnsAll as any} members={filteredMembers} loading={loading} />
              )
            }
          ]}
        />
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

export default Mossi;
