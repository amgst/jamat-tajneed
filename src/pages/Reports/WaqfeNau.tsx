import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Space,
  Input,
  Button,
  Tag,
  Typography,
  Avatar,
  message
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  UserOutlined
} from '@ant-design/icons';
import { ApiService } from '../../services/apiService';
import type { Member, Family } from '../../types';
import {
  getTanzeemDisplayName,
  exportToCSV
} from '../../utils/helpers';
import { generateAvatarFromName } from '../../utils/imageUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const { Text, Title } = Typography;

const WaqfeNau: React.FC = () => {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    loadMembers();
  }, []);

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
      member.fatherName?.toLowerCase().includes(searchLower)
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

  const getExportData = () => {
    return sortedMembers.map(m => ({
      'Waqf-e-Nau No': m.waqfeNauNumber,
      'Name': m.name,
      'Father Name': m.fatherName || '',
      'Family': familyNameById[m.familyId || ''] || '',
      'Tanzeem': getTanzeemDisplayName(m.tanzeem),
      'Age': m.age,
      'Phone': m.phone || '',
      'Address': m.address || ''
    }));
  };

  const handleExportCSV = () => {
    exportToCSV(getExportData(), 'waqf-e-nau-members');
  };

  const handleExportPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = 16;

    try {
      const response = await fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/amiri/Amiri-Regular.ttf');
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        const base64Font = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        doc.addFileToVFS('Amiri-Regular.ttf', base64Font);
        doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
        doc.setFont('Amiri');
      }
    } catch (e) {
      // Fallback to default font if remote fetch fails
    }

    doc.setFontSize(16);
    doc.text('Waqf-e-Nau Members', 14, currentY);
    currentY += 6;
    doc.setFontSize(10);
    doc.text(`Total: ${sortedMembers.length}`, 14, currentY);
    currentY += 6;

    const headers = ['S.No', 'Tajneed No', 'Name', 'Father Name', 'Age', 'Tanzeem'];

    const renderSection = (title: string, data: Member[]) => {
      doc.setFontSize(12);
      doc.text(title + ` (${data.length})`, 14, currentY);
      currentY += 4;

      const body = data.map((m, idx) => [
        String(idx + 1),
        m.tajneedCode || m.waqfeNauNumber || '',
        m.name,
        m.fatherName || '',
        String(m.age ?? ''),
        getTanzeemDisplayName(m.tanzeem)
      ]);

      autoTable(doc, {
        head: [headers],
        body,
        startY: currentY + 2,
        styles: { fontSize: 8, font: 'Amiri' },
        headStyles: { fillColor: [22, 160, 133] },
        margin: { left: 14, right: 14 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 8;
      if (currentY > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        currentY = 16;
      }
    };

    const below15 = sortedMembers.filter(m => m.age < 15);
    const fifteenToTwentyOne = sortedMembers.filter(m => m.age >= 15 && m.age <= 21);
    const above21 = sortedMembers.filter(m => m.age > 21);

    renderSection('Below 15 Years', below15);
    renderSection('15–21 Years', fifteenToTwentyOne);
    renderSection('Above 21 Years', above21);

    doc.save('waqf-e-nau-members.pdf');
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
          <Avatar 
            src={record.profilePhoto} 
            icon={<UserOutlined />}
            style={{ backgroundColor: record.profilePhoto ? 'transparent' : '#1890ff' }}
          >
            {!record.profilePhoto && generateAvatarFromName(record.name)}
          </Avatar>
          <Space direction="vertical" size={0}>
            <Text strong>{record.name}</Text>
            {record.fatherName && <Text type="secondary" style={{ fontSize: '12px' }}>s/o {record.fatherName}</Text>}
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
          <Button type="link" onClick={() => navigate(`/members/${record.id}`)}>
            View Details
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>Waqf-e-Nau Members</Title>
          <Text type="secondary">Total: {filteredMembers.length}</Text>
        </div>
        <Space>
          <Button 
            icon={<DownloadOutlined />} 
            onClick={handleExportCSV}
          >
            Export CSV
          </Button>
          <Button 
            icon={<DownloadOutlined />} 
            onClick={handleExportPDF}
          >
            Export PDF
          </Button>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={loadMembers}  
            loading={loading}
          >
            Refresh
          </Button>
        </Space>
      </div>

      <Card>
        <div style={{ marginBottom: 16 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search by name, Waqf-e-Nau No, or father's name"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginTop: 0 }}>
            Below 15 Years <Text type="secondary">({sortedMembers.filter(m => m.age < 15).length})</Text>
          </Title>
          <Table
            columns={columns}
            dataSource={sortedMembers.filter(m => m.age < 15)}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginTop: 0 }}>
            15–21 Years <Text type="secondary">({sortedMembers.filter(m => m.age >= 15 && m.age <= 21).length})</Text>
          </Title>
          <Table
            columns={columns}
            dataSource={sortedMembers.filter(m => m.age >= 15 && m.age <= 21)}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </div>

        <div>
          <Title level={4} style={{ marginTop: 0 }}>
            Above 21 Years <Text type="secondary">({sortedMembers.filter(m => m.age > 21).length})</Text>
          </Title>
          <Table
            columns={columns}
            dataSource={sortedMembers.filter(m => m.age > 21)}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </div>
      </Card>
    </div>
  );
};

export default WaqfeNau;
