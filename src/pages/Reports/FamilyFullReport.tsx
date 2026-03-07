import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Space,
  Select,
  Button,
  Typography,
  Tag,
  Table,
  Row,
  Col,
  Statistic,
  Descriptions,
  message
} from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ApiService } from '../../services/apiService';
import type { AnsarullahRecord, Family, Member, TahreqJadeedRecord, WaqfJadeedRecord } from '../../types';
import { formatDate, getTanzeemDisplayName } from '../../utils/helpers';

const { Title, Text } = Typography;

interface MemberReportRow {
  id: string;
  name: string;
  relation: string;
  gender: string;
  age: number;
  tanzeem: string;
  phone: string;
  cnic: string;
  maritalStatus: string;
  profession: string;
  education: string;
  waqfPromise: number;
  waqfPaid: number;
  tahreqPromise: number;
  tahreqPaid: number;
  ansarPromise: number;
  ansarPaid: number;
}

const FamilyFullReport: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, index) => currentYear - index);

  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('');
  const [families, setFamilies] = useState<Family[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [waqfRecords, setWaqfRecords] = useState<WaqfJadeedRecord[]>([]);
  const [tahreqRecords, setTahreqRecords] = useState<TahreqJadeedRecord[]>([]);
  const [ansarRecords, setAnsarRecords] = useState<AnsarullahRecord[]>([]);

  const loadData = async (year: number) => {
    setLoading(true);
    try {
      const [allFamilies, allMembers, waqfData, tahreqData, ansarData] = await Promise.all([
        ApiService.getAllFamilies(),
        ApiService.getAllMembers(),
        ApiService.getWaqfJadeedRecords(year),
        ApiService.getTahreqJadeedRecords(year),
        ApiService.getAnsarullahRecords(year)
      ]);

      const sortedFamilies = [...allFamilies].sort((a, b) => {
        const numA = a.familyNumber ?? Number.MAX_SAFE_INTEGER;
        const numB = b.familyNumber ?? Number.MAX_SAFE_INTEGER;
        if (numA !== numB) return numA - numB;
        return a.familyName.localeCompare(b.familyName);
      });

      setFamilies(sortedFamilies);
      setMembers(allMembers);
      setWaqfRecords(waqfData);
      setTahreqRecords(tahreqData);
      setAnsarRecords(ansarData);

      if (!selectedFamilyId && sortedFamilies.length > 0) {
        setSelectedFamilyId(sortedFamilies[0].id);
      }
    } catch (error) {
      message.error('Failed to load family report data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedYear);
  }, [selectedYear]);

  const selectedFamily = useMemo(
    () => families.find(family => family.id === selectedFamilyId) || null,
    [families, selectedFamilyId]
  );

  const familyHead = useMemo(() => {
    if (!selectedFamily) return null;
    return members.find(member => member.id === selectedFamily.headId) || null;
  }, [members, selectedFamily]);

  const memberRows = useMemo<MemberReportRow[]>(() => {
    if (!selectedFamily) return [];

    const memberIdSet = new Set(selectedFamily.memberIds || []);
    if (selectedFamily.headId) memberIdSet.add(selectedFamily.headId);

    const membersInFamily = members
      .filter(member => memberIdSet.has(member.id) || member.familyId === selectedFamily.id)
      .sort((a, b) => {
        if (a.id === selectedFamily.headId) return -1;
        if (b.id === selectedFamily.headId) return 1;
        return (b.age || 0) - (a.age || 0);
      });

    const waqfByMember = new Map(waqfRecords.map(record => [record.memberId, record]));
    const tahreqByMember = new Map(tahreqRecords.map(record => [record.memberId, record]));
    const ansarByMember = new Map(ansarRecords.map(record => [record.memberId, record]));

    return membersInFamily.map(member => {
      const waqf = waqfByMember.get(member.id);
      const tahreq = tahreqByMember.get(member.id);
      const ansar = ansarByMember.get(member.id);

      return {
        id: member.id,
        name: member.name || '',
        relation: member.husbandName ? `h/o ${member.husbandName}` : member.fatherName ? `s/o ${member.fatherName}` : '-',
        gender: member.gender || '-',
        age: member.age || 0,
        tanzeem: getTanzeemDisplayName(member.tanzeem),
        phone: member.phone || '-',
        cnic: member.cnic || '-',
        maritalStatus: member.maritalStatus || '-',
        profession: member.profession || '-',
        education: member.education || '-',
        waqfPromise: waqf?.promiseAmount || 0,
        waqfPaid: waqf?.paidAmount || 0,
        tahreqPromise: tahreq?.promiseAmount || 0,
        tahreqPaid: tahreq?.paidAmount || 0,
        ansarPromise: ansar?.promiseAmount || 0,
        ansarPaid: ansar?.paidAmount || 0
      };
    });
  }, [ansarRecords, members, selectedFamily, tahreqRecords, waqfRecords]);

  const totals = useMemo(() => {
    return memberRows.reduce(
      (acc, row) => ({
        waqfPromise: acc.waqfPromise + row.waqfPromise,
        waqfPaid: acc.waqfPaid + row.waqfPaid,
        tahreqPromise: acc.tahreqPromise + row.tahreqPromise,
        tahreqPaid: acc.tahreqPaid + row.tahreqPaid,
        ansarPromise: acc.ansarPromise + row.ansarPromise,
        ansarPaid: acc.ansarPaid + row.ansarPaid
      }),
      {
        waqfPromise: 0,
        waqfPaid: 0,
        tahreqPromise: 0,
        tahreqPaid: 0,
        ansarPromise: 0,
        ansarPaid: 0
      }
    );
  }, [memberRows]);

  const formatAmount = (value: number) => `Rs ${value.toLocaleString()}`;

  const handleExportPDF = () => {
    if (!selectedFamily) {
      message.warning('Please select a family first');
      return;
    }

    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.getWidth();
    let currentY = 14;

    doc.setFontSize(16);
    doc.text('Family Full Report', 14, currentY);
    currentY += 6;
    doc.setFontSize(10);
    doc.text(`${selectedFamily.familyName} | Year ${selectedYear}`, 14, currentY);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 14, currentY, { align: 'right' });
    currentY += 8;

    const summaryRows = [
      ['Family Name', selectedFamily.familyName || '-'],
      ['Family Number', selectedFamily.familyNumber?.toString() || '-'],
      ['Halqa', selectedFamily.halqa || '-'],
      ['Head of Family', familyHead?.name || '-'],
      ['Head Phone', familyHead?.phone || '-'],
      ['Total Members', memberRows.length.toString()],
      ['Family Fitrana', formatAmount(selectedFamily.fitrana || 0)],
      ['Family Eid Fund', formatAmount(selectedFamily.eidFund || 0)],
      ['Family Sadqa', formatAmount(selectedFamily.sadqa || 0)],
      ['Last Updated', formatDate(selectedFamily.updatedAt)]
    ];

    autoTable(doc, {
      head: [['Field', 'Value']],
      body: summaryRows,
      startY: currentY,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [24, 144, 255] },
      margin: { left: 14, right: 14 }
    });

    const summaryEndY = (doc as any).lastAutoTable.finalY + 6;
    autoTable(doc, {
      head: [['Program', 'Promise', 'Paid', 'Balance']],
      body: [
        ['Waqf-e-Jadeed', formatAmount(totals.waqfPromise), formatAmount(totals.waqfPaid), formatAmount(totals.waqfPromise - totals.waqfPaid)],
        ['Tahreq Jadeed', formatAmount(totals.tahreqPromise), formatAmount(totals.tahreqPaid), formatAmount(totals.tahreqPromise - totals.tahreqPaid)],
        ['Ansarullah Chanda', formatAmount(totals.ansarPromise), formatAmount(totals.ansarPaid), formatAmount(totals.ansarPromise - totals.ansarPaid)]
      ],
      startY: summaryEndY,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [22, 160, 133] },
      margin: { left: 14, right: 14 }
    });

    const detailsStartY = (doc as any).lastAutoTable.finalY + 6;
    autoTable(doc, {
      head: [[
        'Name',
        'Relation',
        'Gender',
        'Age',
        'Tanzeem',
        'Phone',
        'CNIC',
        'Marital',
        'Profession',
        'Education',
        'Waqf P/P',
        'Tahreq P/P',
        'Ansar P/P'
      ]],
      body: memberRows.map(row => [
        row.name,
        row.relation,
        row.gender,
        row.age,
        row.tanzeem,
        row.phone,
        row.cnic,
        row.maritalStatus,
        row.profession,
        row.education,
        `${row.waqfPromise}/${row.waqfPaid}`,
        `${row.tahreqPromise}/${row.tahreqPaid}`,
        `${row.ansarPromise}/${row.ansarPaid}`
      ]),
      startY: detailsStartY,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [114, 46, 209] },
      margin: { left: 14, right: 14 }
    });

    doc.save(`${selectedFamily.familyName.replace(/\s+/g, '_')}_full_report_${selectedYear}.pdf`);
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', fixed: 'left' as const, width: 180 },
    { title: 'Relation', dataIndex: 'relation', key: 'relation', width: 160 },
    { title: 'Gender', dataIndex: 'gender', key: 'gender', width: 90 },
    { title: 'Age', dataIndex: 'age', key: 'age', width: 80 },
    {
      title: 'Tanzeem',
      dataIndex: 'tanzeem',
      key: 'tanzeem',
      width: 130,
      render: (value: string) => <Tag color="blue">{value}</Tag>
    },
    { title: 'Phone', dataIndex: 'phone', key: 'phone', width: 140 },
    { title: 'CNIC', dataIndex: 'cnic', key: 'cnic', width: 170 },
    { title: 'Marital', dataIndex: 'maritalStatus', key: 'maritalStatus', width: 120 },
    { title: 'Profession', dataIndex: 'profession', key: 'profession', width: 140 },
    { title: 'Education', dataIndex: 'education', key: 'education', width: 140 },
    {
      title: 'Waqf (P/P)',
      key: 'waqf',
      width: 120,
      render: (_: unknown, row: MemberReportRow) => `${row.waqfPromise}/${row.waqfPaid}`
    },
    {
      title: 'Tahreq (P/P)',
      key: 'tahreq',
      width: 120,
      render: (_: unknown, row: MemberReportRow) => `${row.tahreqPromise}/${row.tahreqPaid}`
    },
    {
      title: 'Ansar (P/P)',
      key: 'ansar',
      width: 120,
      render: (_: unknown, row: MemberReportRow) => `${row.ansarPromise}/${row.ansarPaid}`
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>Family Full Report</Title>
          <Text type="secondary">Family profile + chanda details + PDF export</Text>
        </div>
        <Space>
          <Select
            style={{ width: 140 }}
            value={selectedYear}
            options={years.map(year => ({ label: year, value: year }))}
            onChange={setSelectedYear}
          />
          <Select
            showSearch
            optionFilterProp="label"
            style={{ width: 320 }}
            value={selectedFamilyId || undefined}
            placeholder="Select family"
            options={families.map(family => ({
              value: family.id,
              label: `${family.familyNumber ? `#${family.familyNumber} - ` : ''}${family.familyName}`
            }))}
            onChange={setSelectedFamilyId}
          />
          <Button icon={<DownloadOutlined />} onClick={handleExportPDF} disabled={!selectedFamily}>
            Export PDF
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => loadData(selectedYear)} loading={loading}>
            Refresh
          </Button>
        </Space>
      </div>

      {selectedFamily && (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card>
            <Descriptions column={3}>
              <Descriptions.Item label="Family">{selectedFamily.familyName}</Descriptions.Item>
              <Descriptions.Item label="Family Number">{selectedFamily.familyNumber || '-'}</Descriptions.Item>
              <Descriptions.Item label="Halqa">{selectedFamily.halqa || '-'}</Descriptions.Item>
              <Descriptions.Item label="Head">{familyHead?.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="Head Phone">{familyHead?.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="Last Updated">{formatDate(selectedFamily.updatedAt)}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Card>
                <Statistic title="Waqf-e-Jadeed (Paid / Promise)" value={`${totals.waqfPaid.toLocaleString()} / ${totals.waqfPromise.toLocaleString()}`} />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card>
                <Statistic title="Tahreq Jadeed (Paid / Promise)" value={`${totals.tahreqPaid.toLocaleString()} / ${totals.tahreqPromise.toLocaleString()}`} />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card>
                <Statistic title="Ansarullah (Paid / Promise)" value={`${totals.ansarPaid.toLocaleString()} / ${totals.ansarPromise.toLocaleString()}`} />
              </Card>
            </Col>
          </Row>

          <Card title={`Members (${memberRows.length})`}>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={memberRows}
              loading={loading}
              pagination={{ pageSize: 12 }}
              scroll={{ x: 1800 }}
            />
          </Card>
        </Space>
      )}
    </div>
  );
};

export default FamilyFullReport;
