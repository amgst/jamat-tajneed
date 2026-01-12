import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Avatar,
  Typography,
  Row,
  Col,
  Statistic
} from 'antd';
import {
  UserOutlined,
  DownloadOutlined,
  HeartOutlined,
  FilePdfOutlined
} from '@ant-design/icons';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ApiService } from '../services/apiService';
import type { Member, Family } from '../types';
import { getTanzeemDisplayName, formatDate, exportToCSV } from '../utils/helpers';

const { Title, Text } = Typography;

const Graveyard: React.FC = () => {
  const [deceasedMembers, setDeceasedMembers] = useState<Member[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDeceasedMembers();
  }, []);

  const loadDeceasedMembers = async () => {
    setLoading(true);
    try {
      const [members, familiesData] = await Promise.all([
        ApiService.getAllMembers(),
        ApiService.getAllFamilies()
      ]);

      // Filter only deceased members
      const deceased = members.filter(member => member.isDeceased);
      setDeceasedMembers(deceased);
      setFamilies(familiesData);
    } catch (error) {
      console.error('Error loading deceased members:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFamilyName = (memberId: string) => {
    const family = families.find(f => f.memberIds.includes(memberId));
    return family ? family.familyName : 'No Family';
  };

  const handleExportCSV = () => {
    const exportData = deceasedMembers.map(member => ({
      Name: member.name,
      'Father/Husband Name': member.husbandName ? `Husband: ${member.husbandName}` : member.fatherName,
      Gender: member.gender,
      Age: member.age,
      'Date of Birth': formatDate(member.dateOfBirth),
      'Date of Death': member.dateOfDeath ? formatDate(member.dateOfDeath) : '',
      'Years Passed': member.dateOfDeath ? Math.floor((new Date().getTime() - new Date(member.dateOfDeath).getTime()) / (1000 * 60 * 60 * 24 * 365)) : '',
      Tanzeem: getTanzeemDisplayName(member.tanzeem),
      Family: getFamilyName(member.id),
      Address: member.address,
    }));

    exportToCSV(exportData, 'graveyard_members.csv');
  };

  const handleExportPDF = () => {
    // Create new PDF document
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(18);
    doc.text('Graveyard Members List', 14, 20);

    // Add generation date
    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

    // Prepare table data
    const tableData = deceasedMembers.map((member, index) => [
      index + 1,
      member.name,
      member.husbandName ? `Husband: ${member.husbandName}` : member.fatherName || '',
      member.gender,
      member.age.toString(),
      formatDate(member.dateOfBirth),
      member.dateOfDeath ? formatDate(member.dateOfDeath) : '',
      member.dateOfDeath ? Math.floor((new Date().getTime() - new Date(member.dateOfDeath).getTime()) / (1000 * 60 * 60 * 24 * 365)).toString() : '',
      getTanzeemDisplayName(member.tanzeem),
      getFamilyName(member.id)
    ]);

    // Add table
    autoTable(doc, {
      head: [['S.No', 'Name', 'Father/Husband', 'Gender', 'Age', 'DOB', 'DOD', 'Years Passed', 'Tanzeem', 'Family']],
      body: tableData,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [24, 144, 255] },
      alternateRowStyles: { fillColor: [240, 240, 240] },
      didDrawCell: (_data) => {
        // This helps with character encoding
        doc.setTextColor(0, 0, 0);
      }
    });

    // Save the PDF
    doc.save('graveyard_members.pdf');
  };

  const columns = [
    {
      title: 'S.No',
      key: 'serial',
      width: 60,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Photo',
      key: 'photo',
      render: () => (
        <Avatar size="small" icon={<UserOutlined />} />
      ),
      width: 60,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: Member, b: Member) => a.name.localeCompare(b.name),
    },
    {
      title: 'Father/Husband',
      key: 'fatherHusband',
      render: (record: Member) => (
        <div>
          {record.husbandName ? `Husband: ${record.husbandName}` : record.fatherName}
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
      title: 'Date of Birth',
      dataIndex: 'dateOfBirth',
      key: 'dateOfBirth',
      render: (dateOfBirth: string) => formatDate(dateOfBirth),
      sorter: (a: Member, b: Member) =>
        new Date(a.dateOfBirth).getTime() - new Date(b.dateOfBirth).getTime(),
    },
    {
      title: 'Date of Death',
      dataIndex: 'dateOfDeath',
      key: 'dateOfDeath',
      render: (dateOfDeath: string) => dateOfDeath ? formatDate(dateOfDeath) : '-',
      sorter: (a: Member, b: Member) => {
        if (!a.dateOfDeath) return 1;
        if (!b.dateOfDeath) return -1;
        return new Date(a.dateOfDeath).getTime() - new Date(b.dateOfDeath).getTime();
      },
    },
    {
      title: 'Years Passed',
      key: 'yearsPassed',
      render: (record: Member) => {
        if (!record.dateOfDeath) return '-';
        const years = Math.floor((new Date().getTime() - new Date(record.dateOfDeath).getTime()) / (1000 * 60 * 60 * 24 * 365));
        return years;
      },
      sorter: (a: Member, b: Member) => {
        if (!a.dateOfDeath) return 1;
        if (!b.dateOfDeath) return -1;
        const yearsA = Math.floor((new Date().getTime() - new Date(a.dateOfDeath).getTime()) / (1000 * 60 * 60 * 24 * 365));
        const yearsB = Math.floor((new Date().getTime() - new Date(b.dateOfDeath).getTime()) / (1000 * 60 * 60 * 24 * 365));
        return yearsA - yearsB;
      },
    },
    {
      title: 'Tanzeem',
      dataIndex: 'tanzeem',
      key: 'tanzeem',
      render: (tanzeem: any) => (
        <Tag color="green">{getTanzeemDisplayName(tanzeem)}</Tag>
      ),
    },
    {
      title: 'Family',
      key: 'family',
      render: (record: Member) => getFamilyName(record.id),
    },
  ];

  // Statistics
  const totalDeceased = deceasedMembers.length;
  const maleDeceased = deceasedMembers.filter(m => m.gender === 'male').length;
  const femaleDeceased = deceasedMembers.filter(m => m.gender === 'female').length;

  // Group by tanzeem for statistics
  const tanzeemStats = deceasedMembers.reduce((acc, member) => {
    acc[member.tanzeem] = (acc[member.tanzeem] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>
        <HeartOutlined style={{ marginRight: 12, color: '#ff4d4f' }} />
        Graveyard Records
      </Title>

      {/* Summary Statistics */}
      < Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Deceased"
              value={totalDeceased}
              prefix={<HeartOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Male Deceased"
              value={maleDeceased}
              prefix={<UserOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Female Deceased"
              value={femaleDeceased}
              prefix={<UserOutlined style={{ color: '#eb2f96' }} />}
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
      </Row >

      {/* Tanzeem Distribution */}
      < Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {
          Object.entries(tanzeemStats).map(([tanzeem, count]) => (
            <Col xs={12} sm={8} md={4} key={tanzeem}>
              <Card size="small">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
                    {getTanzeemDisplayName(tanzeem as any)}
                  </div>
                  <div style={{ fontSize: '20px', color: '#1890ff', marginTop: 8 }}>
                    {count}
                  </div>
                </div>
              </Card>
            </Col>
          ))
        }
      </Row >

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Deceased Members
            </Title>
            <Text type="secondary">
              Total: {totalDeceased} members
            </Text>
          </div>
          <div>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExportCSV}
              disabled={totalDeceased === 0}
              style={{ marginRight: 8 }}
            >
              Export CSV
            </Button>
            <Button
              type="primary"
              icon={<FilePdfOutlined />}
              onClick={handleExportPDF}
              disabled={totalDeceased === 0}
            >
              Export PDF
            </Button>
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={deceasedMembers}
          rowKey="id"
          loading={loading}
          pagination={{
            defaultPageSize: 10,
            pageSizeOptions: [10, 20, 50, 100],
            showSizeChanger: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} deceased members`,
            responsive: true,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div >
  );
};

export default Graveyard;