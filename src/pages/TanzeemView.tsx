import useMemberNavigation from '../hooks/useMemberNavigation';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Input, Space, Tabs } from 'antd';
import { DownloadOutlined, FilePdfOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';

import type { TableProps } from 'antd';
import { ApiService } from '../services/apiService';
import type { Member, Tanzeem } from '../types';
import { exportToCSV, exportToPDF, getTanzeemDisplayName } from '../utils/helpers';
import MembershipRecords from '../components/MembershipRecords';
import './TanzeemView.css';

const tanzeems: Tanzeem[] = ['saf-e-awal', 'saf-e-awal-girls', 'atfal', 'nasirat', 'khuddam', 'ansar', 'lajna'];
const groups = [...tanzeems.map(value => ({ value, label: getTanzeemDisplayName(value) })), { value: 'b-list', label: 'B List' }, { value: 'moved', label: 'Moved' }, { value: 'deceased', label: 'Deceased' }, { value: 'unassigned', label: 'Unassigned' }];
const category = (member: Member) => member.isDeceased ? 'deceased' : member.isMoved ? 'moved' : member.isBList ? 'b-list' : tanzeems.includes(member.tanzeem) ? member.tanzeem : 'unassigned';

export default function TanzeemView() {

  const openMember = useMemberNavigation();
  const [members, setMembers] = useState<Member[]>(ApiService.getDirectorySnapshot().members);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activeGroup, setActiveGroup] = useState('saf-e-awal');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const load = async () => {
    setLoading(true); setError(false);
    try { setMembers(await ApiService.getAllMembers()); }
    catch { setError(true); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const filtered = useMemo(() => {
    const words = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return members.filter(member => category(member) === activeGroup && words.every(word => [member.name, member.fatherName, member.husbandName, member.phone, member.tajneedCode].filter(Boolean).join(' ').toLocaleLowerCase().includes(word))).sort((a, b) => a.name.localeCompare(b.name));
  }, [members, activeGroup, search]);
  const label = groups.find(group => group.value === activeGroup)?.label || 'Members';
  const exportRows = () => filtered.map(member => ({ name: member.name, guardian: member.husbandName || member.fatherName || '', age: member.age, tanzeem: getTanzeemDisplayName(member.tanzeem), phone: member.phone || '', halqa: member.halqa?.trim().toLowerCase() === 'unknown' ? '' : member.halqa || '' }));
  const exportPDF = async () => {
    setExporting(true);
    try { await exportToPDF(exportRows(), ['name', 'guardian', 'age', 'tanzeem', 'phone', 'halqa'], `${activeGroup}_members`, `${label} Members`, { renderMode: 'canvas' }); }
    catch { setError(true); }
    finally { setExporting(false); }
  };
  const columns: TableProps<Member>['columns'] = [
    { title: 'Member', key: 'name', render: (member: Member) => <button className="tanzeem-member-name" onClick={() => openMember(member.id)}>{member.name}</button>, sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: 'Father / Husband', key: 'guardian', render: (member: Member) => member.husbandName || member.fatherName || '' },
    { title: 'Age', dataIndex: 'age', width: 70, sorter: (a, b) => a.age - b.age },
    { title: 'Phone', dataIndex: 'phone' },
    { title: 'Tanzeem', dataIndex: 'tanzeem', render: getTanzeemDisplayName },
  ];
  return <div className="membership-page tanzeem-page">
    <header className="membership-header"><div><span className="section-eyebrow">YOUR COMMUNITY DIRECTORY</span><h1>Tanzeem Management</h1><p>{members.filter(member => tanzeems.includes(category(member) as Tanzeem)).length} active members · {members.length} total records</p></div><Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button></header>
    <div className="tanzeem-summary-grid">{groups.map(group => <button className={group.value === activeGroup ? 'selected' : ''} key={group.value} onClick={() => setActiveGroup(group.value)}><span>{group.label}</span><strong>{members.filter(member => category(member) === group.value).length}</strong></button>)}</div>
    <Card>
      {error && <Alert type="error" message="Unable to complete the request. Please try again." closable onClose={() => setError(false)} style={{ marginBottom: 16 }} />}
      <div className="tanzeem-record-toolbar"><Input prefix={<SearchOutlined />} placeholder="Search name, phone or Tajneed code" aria-label="Search tanzeem members" value={search} onChange={event => setSearch(event.target.value)} allowClear /><Space wrap><Button icon={<DownloadOutlined />} disabled={!filtered.length} onClick={() => exportToCSV(exportRows(), `${activeGroup}_members`)}>Export CSV</Button><Button icon={<FilePdfOutlined />} disabled={!filtered.length} loading={exporting} onClick={exportPDF}>Export PDF</Button></Space></div>
      <Tabs activeKey={activeGroup} onChange={setActiveGroup} items={groups.map(group => ({ key: group.value, label: group.label }))} />
      <MembershipRecords key={activeGroup} members={filtered} columns={columns} loading={loading} kind="tanzeem" />
    </Card>
  </div>;
}
