import React, { useMemo, useState, useEffect } from 'react';
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
  Tabs,
  Row,
  Col,
  Statistic,
  message,
  Modal
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
  getTanzeemUrduName,
  exportToCSV
} from '../../utils/helpers';
import { generateAvatarFromName } from '../../utils/imageUtils';
import jsPDF from 'jspdf';
import dayjs from 'dayjs';
import html2canvas from 'html2canvas';

import MemberForm from '../../components/MemberForm';

const { Text, Title } = Typography;

const Mossi: React.FC = () => {
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [pageSize, setPageSize] = useState(10);
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

  const tablePagination = useMemo(
    () => ({
      pageSize,
      showSizeChanger: true,
      pageSizeOptions: [10, 20, 50, 100],
      onShowSizeChange: (_current: number, size: number) => setPageSize(size),
      showTotal: (total: number, range: [number, number]) => `${range[0]}-${range[1]} of ${total} records`,
    }),
    [pageSize]
  );

  const getExportData = () => {
    return filteredMembers.map(m => ({
      'Wasiyyat No': m.wasitNo,
      'Name': m.name,
      'Father/Husband Name': getGuardianName(m),
      'Tanzeem': getTanzeemDisplayName(m.tanzeem),
      'Age': m.age
    }));
  };

  const handleExportCSV = () => {
    exportToCSV(getExportData(), 'mossi-members');
  };

  const applyPdfDomBaseStyles = (el: HTMLDivElement) => {
    el.setAttribute('dir', 'rtl');
    el.style.position = 'fixed';
    el.style.left = '-10000px';
    el.style.top = '0';
    el.style.width = '794px'; // ~A4 at 96dpi
    el.style.background = '#fff';
    el.style.color = '#111';
    el.style.fontFamily =
      "Noto Nastaliq Urdu, Noto Naskh Arabic, Amiri, 'Segoe UI', Arial, sans-serif";
  };

  const handleExportPDF = async () => {
    const headerDiv = document.createElement('div');
    applyPdfDomBaseStyles(headerDiv);
    headerDiv.style.padding = '18px 20px 10px';

    const titleEl = document.createElement('div');
    titleEl.textContent = 'رپورٹ موصی ممبران';
    titleEl.style.fontSize = '20px';
    titleEl.style.fontWeight = '800';
    titleEl.style.textAlign = 'right';
    titleEl.style.marginBottom = '6px';
    headerDiv.appendChild(titleEl);

    const metaEl = document.createElement('div');
    metaEl.textContent = `کل ممبران: ${filteredMembers.length} • تاریخ: ${dayjs().format('DD-MM-YYYY')}`;
    metaEl.style.fontSize = '12px';
    metaEl.style.opacity = '0.8';
    metaEl.style.textAlign = 'right';
    metaEl.style.paddingBottom = '6px';
    headerDiv.appendChild(metaEl);

    const bodyDiv = document.createElement('div');
    applyPdfDomBaseStyles(bodyDiv);
    bodyDiv.style.padding = '0 20px 18px';

    const columns = [
      // In RTL, the FIRST column renders on the RIGHT.
      { key: 'no', label: 'نمبر شمار', align: 'center', numeric: true, width: '12%' },
      { key: 'wasitNo', label: 'وصیت نمبر', align: 'center', numeric: true, width: '18%' },
      { key: 'name', label: 'نام', align: 'right', numeric: false, width: '26%' },
      { key: 'fatherName', label: 'والد / شوہر کا نام', align: 'right', numeric: false, width: '26%' },
      { key: 'age', label: 'عمر', align: 'center', numeric: true, width: '12%' },
    ] as const;

    const makeTable = (rows: Array<Record<string, string | number>>) => {
      const table = document.createElement('table');
      table.style.width = '100%';
      table.style.borderCollapse = 'collapse';
      table.style.tableLayout = 'fixed';
      table.style.fontSize = '12px';

      const thead = document.createElement('thead');
      const trh = document.createElement('tr');
      columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col.label;
        th.style.width = col.width;
        th.style.border = '1px solid #e5e7eb';
        th.style.background = '#16a085';
        th.style.color = '#fff';
        th.style.padding = '8px 6px';
        th.style.textAlign = col.align as any;
        th.style.fontWeight = '800';
        th.style.wordBreak = 'break-word';
        trh.appendChild(th);
      });
      thead.appendChild(trh);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      rows.forEach((row, idx) => {
        const tr = document.createElement('tr');
        if (idx % 2 === 1) tr.style.background = '#fafafa';
        columns.forEach(col => {
          const td = document.createElement('td');
          const value = row[col.key];
          td.textContent = value === null || value === undefined ? '' : String(value);
          td.style.border = '1px solid #e5e7eb';
          td.style.padding = '7px 6px';
          td.style.verticalAlign = 'top';
          td.style.textAlign = col.align as any;
          td.style.wordBreak = 'break-word';
          if (col.numeric) {
            td.style.direction = 'ltr';
            td.style.unicodeBidi = 'embed';
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      return table;
    };

    groupedByTanzeem.forEach(group => {
      const groupMembers = [...group.members].sort((a, b) => (b.age ?? 0) - (a.age ?? 0));
      if (groupMembers.length === 0) return;

      const sectionTitle = document.createElement('div');
      const urduTanzeemName =
        group.key === 'other'
          ? 'دیگر'
          : group.key === 'unknown'
            ? 'نامعلوم'
            : getTanzeemUrduName(group.key);
      sectionTitle.textContent = `${urduTanzeemName} (${groupMembers.length})`;
      sectionTitle.style.fontSize = '16px';
      sectionTitle.style.fontWeight = '800';
      sectionTitle.style.color = '#16a085';
      sectionTitle.style.textAlign = 'right';
      sectionTitle.style.margin = '14px 0 8px';
      bodyDiv.appendChild(sectionTitle);

      const rows = groupMembers.map((m, index) => ({
        no: index + 1,
        wasitNo: m.wasitNo || '',
        name: m.name || '',
        fatherName: group.key === 'lajna' ? (m.husbandName || m.fatherName || '') : (m.fatherName || ''),
        age: m.age ?? ''
      }));
      bodyDiv.appendChild(makeTable(rows));
    });

    document.body.appendChild(headerDiv);
    document.body.appendChild(bodyDiv);

    try {
      const scale = Math.max(2, window.devicePixelRatio || 1);

      const headerCanvas = await html2canvas(headerDiv, {
        scale,
        backgroundColor: '#ffffff'
      });
      const bodyCanvas = await html2canvas(bodyDiv, {
        scale,
        backgroundColor: '#ffffff'
      });

      const headerImg = headerCanvas.toDataURL('image/png');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const margin = 10;
      const usableWidth = pageWidth - margin * 2;

      const headerHeightMm = (headerCanvas.height * usableWidth) / headerCanvas.width;
      const bodyHeightMm = (bodyCanvas.height * usableWidth) / bodyCanvas.width;

      const gapMm = 2;
      const contentTopMm = margin + headerHeightMm + gapMm;
      const contentHeightPerPageMm = pageHeight - contentTopMm - margin;

      const mmPerBodyPx = bodyHeightMm / bodyCanvas.height;
      const sliceHeightPx = Math.max(1, Math.floor(contentHeightPerPageMm / mmPerBodyPx));

      let pageIndex = 0;
      for (let startPx = 0; startPx < bodyCanvas.height; startPx += sliceHeightPx) {
        const thisSlicePx = Math.min(sliceHeightPx, bodyCanvas.height - startPx);
        const thisSliceMm = thisSlicePx * mmPerBodyPx;

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = bodyCanvas.width;
        sliceCanvas.height = thisSlicePx;
        const ctx = sliceCanvas.getContext('2d');
        if (!ctx) break;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(
          bodyCanvas,
          0,
          startPx,
          bodyCanvas.width,
          thisSlicePx,
          0,
          0,
          bodyCanvas.width,
          thisSlicePx
        );

        const sliceImg = sliceCanvas.toDataURL('image/png');

        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(headerImg, 'PNG', margin, margin, usableWidth, headerHeightMm);
        pdf.addImage(sliceImg, 'PNG', margin, contentTopMm, usableWidth, thisSliceMm);

        pageIndex += 1;
      }

      pdf.save(`mossi-members-${dayjs().format('DD-MM-YYYY')}.pdf`);
    } finally {
      document.body.removeChild(headerDiv);
      document.body.removeChild(bodyDiv);
    }
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
            <Avatar 
              src={record.profilePhoto} 
              icon={<UserOutlined />}
              style={{ backgroundColor: record.profilePhoto ? 'transparent' : '#1890ff' }}
            >
              {!record.profilePhoto && generateAvatarFromName(record.name)}
            </Avatar>
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
            <Button type="link" onClick={() => navigate(`/members/${record.id}`)}>
              Details
            </Button>
          </Space>
        ),
      },
    ];
  }, [navigate]);

  const columnsGroup = useMemo(() => {
    return columnsAll.filter(col => (col as any).key !== 'tanzeem');
  }, [columnsAll]);

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>Mossi Members</Title>
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
          items={[
            ...groupedByTanzeem.map(group => ({
              key: group.key,
              label: `${group.label} (${group.members.length})`,
              children: (
                <Table
                  columns={columnsGroup as any}
                  dataSource={group.members}
                  rowKey="id"
                  loading={loading}
                  pagination={tablePagination as any}
                />
              )
            })),
            {
              key: 'all',
              label: `All (${filteredMembers.length})`,
              children: (
                <Table
                  columns={columnsAll as any}
                  dataSource={filteredMembers}
                  rowKey="id"
                  loading={loading}
                  pagination={tablePagination as any}
                />
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
