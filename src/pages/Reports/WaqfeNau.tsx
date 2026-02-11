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
import type { Member } from '../../types';
import {
  getTanzeemDisplayName,
  exportToCSV,
  exportToPDF
} from '../../utils/helpers';
import { generateAvatarFromName } from '../../utils/imageUtils';

const { Text, Title } = Typography;

const WaqfeNau: React.FC = () => {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const allMembers = await ApiService.getAllMembers();
      // Filter for Waqf-e-Nau members (those who have a waqfeNauNumber)
      const wnMembers = allMembers.filter(m => m.waqfeNauNumber && m.waqfeNauNumber.trim() !== '');
      setMembers(wnMembers);
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

  const getExportData = () => {
    return filteredMembers.map(m => ({
      'Waqf-e-Nau No': m.waqfeNauNumber,
      'Name': m.name,
      'Father Name': m.fatherName || '',
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
    const data = getExportData();
    const headers = ['Waqf-e-Nau No', 'Name', 'Father Name', 'Tanzeem', 'Age', 'Phone', 'Address'];
    await exportToPDF(data, headers, 'waqf-e-nau-members', 'Waqf-e-Nau Members Report');
  };

  const columns = [
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

        <Table
          columns={columns}
          dataSource={filteredMembers}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default WaqfeNau;
