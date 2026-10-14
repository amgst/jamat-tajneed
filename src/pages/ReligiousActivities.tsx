import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Input, Pagination, Segmented, Select, Space, Spin, Table, Tag } from 'antd';
import type { TableProps } from 'antd';
import { DownloadOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { LayoutGrid, List } from 'lucide-react';
import { ApiService } from '../services/apiService';
import type { Member, Family } from '../types';
import { exportToCSV, formatDate, getTanzeemDisplayName } from '../utils/helpers';
import ReligiousActivitiesModal from '../components/ReligiousActivitiesModal';
import './Families.css';
import './ReligiousActivities.css';

const hasRecordedData = (member: Member) => {
  const activities = member.religiousActivities;
  return !!activities && (!!activities.lastUpdated || Object.entries(activities).some(([key, value]) => key !== 'lastUpdated' && (value === true || typeof value === 'number' && value > 0 || key === 'notes' && typeof value === 'string' && !!value.trim())));
};
const hasMTA = (member: Member) => !!(member.religiousActivities?.mtaDish || member.religiousActivities?.mtaCable || member.religiousActivities?.mtaInternet);
const updatedDate = (member: Member) => member.religiousActivities?.lastUpdated ? formatDate(member.religiousActivities.lastUpdated) : '';

export default function ReligiousActivitiesPage() {
  const [members, setMembers] = useState<Member[]>(ApiService.getDirectorySnapshot().members);
  const [families, setFamilies] = useState<Family[]>(ApiService.getDirectorySnapshot().families);
  const [mode, setMode] = useState('families');
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [tanzeem, setTanzeem] = useState('all');
  const [activityFilter, setActivityFilter] = useState('all');
  const [view, setView] = useState<'cards' | 'list'>('cards');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(12);
  const [editing, setEditing] = useState<Member | null>(null);
  const load = async () => {
    setLoading(true); setError(false);
    try { const [people, households] = await Promise.all([ApiService.getAllMembers(), ApiService.getAllFamilies()]); setMembers(people); setFamilies(households); }
    catch { setError(true); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => { setPage(1); }, [search, tanzeem, activityFilter, mode, selectedFamily]);
  const filtered = useMemo(() => {
    const words = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const household = families.find(family => family.id === selectedFamily);
    return members.filter(member => (!household || household.memberIds.includes(member.id) || household.headId === member.id || member.familyId === household.id) && (tanzeem === 'all' || member.tanzeem === tanzeem)
      && (activityFilter === 'all' || activityFilter === 'recorded' && hasRecordedData(member) || activityFilter === 'missing' && !hasRecordedData(member) || activityFilter === 'prayers' && member.religiousActivities?.fiveDailyPrayers === 5 || activityFilter === 'mta' && hasMTA(member))
      && words.every(word => [member.name, member.fatherName, member.husbandName, member.halqa, member.tajneedCode, ...families.filter(family => family.memberIds.includes(member.id) || family.headId === member.id || family.id === member.familyId).map(family => family.familyName)].filter(Boolean).join(' ').toLocaleLowerCase().includes(word)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [members, families, selectedFamily, search, tanzeem, activityFilter]);
  const familyRecords = families.map(family => {
    const people = filtered.filter(member => family.memberIds.includes(member.id) || family.headId === member.id || member.familyId === family.id);
    return { family, people, recorded: people.filter(hasRecordedData).length, head: members.find(member => member.id === family.headId)?.name };
  }).filter(record => record.people.length).sort((a, b) => (a.family.familyNumber ?? Infinity) - (b.family.familyNumber ?? Infinity) || a.family.familyName.localeCompare(b.family.familyName));
  const browsingFamilies = mode === 'families' && !selectedFamily;
  const recorded = members.filter(hasRecordedData).length;
  const summaries = [
    { label: 'Total members', value: members.length, filter: 'all' },
    { label: 'With activity records', value: recorded, filter: 'recorded' },
    { label: 'Not yet recorded', value: members.length - recorded, filter: 'missing' },
    { label: 'Five daily prayers', value: members.filter(member => member.religiousActivities?.fiveDailyPrayers === 5).length, filter: 'prayers' },
    { label: 'MTA users', value: members.filter(hasMTA).length, filter: 'mta' },
  ];
  const exportData = () => exportToCSV(filtered.map(member => ({
    Name: member.name, Guardian: member.husbandName || member.fatherName || '', Age: member.age, Tanzeem: getTanzeemDisplayName(member.tanzeem),
    Recorded: hasRecordedData(member) ? 'Yes' : 'No',
    'Daily prayers': hasRecordedData(member) ? member.religiousActivities?.fiveDailyPrayers ?? 0 : '',
    'Congregational prayers': hasRecordedData(member) ? member.religiousActivities?.congregationalPrayers ?? 0 : '',
    'Daily recitation': hasRecordedData(member) ? member.religiousActivities?.dailyRecitation ? 'Yes' : 'No' : '',
    'Weekly Tahajjud': hasRecordedData(member) ? member.religiousActivities?.weeklyTahajjud ? 'Yes' : 'No' : '',
    'MTA Dish': hasRecordedData(member) ? member.religiousActivities?.mtaDish ? 'Yes' : 'No' : '',
    'MTA Cable': hasRecordedData(member) ? member.religiousActivities?.mtaCable ? 'Yes' : 'No' : '',
    'MTA Internet': hasRecordedData(member) ? member.religiousActivities?.mtaInternet ? 'Yes' : 'No' : '',
    Internet: hasRecordedData(member) ? member.religiousActivities?.internetAccess ? 'Yes' : 'No' : '', Updated: updatedDate(member),
  })), 'religious_activities');
  const columns: TableProps<Member>['columns'] = [
    { title: 'Member', key: 'member', render: (member: Member) => <button className="activity-member-name" onClick={() => setEditing(member)} dir="auto">{member.name}</button> },
    { title: 'Age', dataIndex: 'age', width: 70 },
    { title: 'Tanzeem', dataIndex: 'tanzeem', render: getTanzeemDisplayName },
    { title: 'Daily prayers', key: 'prayers', render: (member: Member) => hasRecordedData(member) ? `${member.religiousActivities?.fiveDailyPrayers ?? 0}/5` : 'Not recorded' },
    { title: 'MTA', key: 'mta', render: (member: Member) => hasRecordedData(member) ? hasMTA(member) ? 'Yes' : 'No' : 'Not recorded' },
    { title: 'Internet', key: 'internet', render: (member: Member) => hasRecordedData(member) ? member.religiousActivities?.internetAccess ? 'Yes' : 'No' : 'Not recorded' },
    { title: 'Updated', key: 'updated', render: updatedDate },
  ];
  const pagination = { current: page, pageSize: size, total: filtered.length, hideOnSinglePage: true, responsive: true, showSizeChanger: true, pageSizeOptions: [12, 24, 48, 100], onChange: (next: number, nextSize: number) => { setPage(size !== nextSize ? 1 : next); setSize(nextSize); } };
  return <div className="families-page activities-page">
    <header className="families-header"><span className="section-eyebrow">COMMUNITY ACTIVITIES</span><h1>مذہبی سرگرمیاں</h1><p>Religious activities · Select a member to review or update their record.</p></header>
    <div className="activities-summary">{summaries.map(summary => <button key={summary.filter} className={activityFilter === summary.filter ? 'selected' : ''} onClick={() => { setTanzeem('all'); setActivityFilter(summary.filter); }}><span>{summary.label}</span><strong>{summary.value}</strong></button>)}</div>
    <Card className="families-panel" title={browsingFamilies ? `${familyRecords.length} families` : selectedFamily ? families.find(family => family.id === selectedFamily)?.familyName : `${filtered.length} members`} extra={<Space wrap><Button icon={<ReloadOutlined />} loading={loading} onClick={load}>Refresh</Button><Button icon={<DownloadOutlined />} onClick={exportData} disabled={!filtered.length}>Export CSV</Button></Space>}>
      <div className="activities-mode-toolbar">{selectedFamily ? <Button onClick={() => setSelectedFamily(null)}>Back to families</Button> : <Segmented value={mode} onChange={value => setMode(String(value))} options={[{ value: 'families', label: 'Families' }, { value: 'members', label: 'Members' }]} />}</div>
      {error && <Alert type="error" message="Unable to load records. Please try again." action={<Button onClick={load}>Retry</Button>} style={{ marginBottom: 16 }} />}
      <div className="activities-controls"><Input aria-label="Search religious activity records" prefix={<SearchOutlined />} placeholder="Search family or member" value={search} onChange={event => setSearch(event.target.value)} allowClear /><Select aria-label="Filter tanzeem" value={tanzeem} onChange={setTanzeem} options={[{ value: 'all', label: 'All tanzeems' }, ...Array.from(new Set(members.map(member => member.tanzeem))).filter(Boolean).map(value => ({ value, label: getTanzeemDisplayName(value) }))]} /><Select aria-label="Filter activities" value={activityFilter} onChange={setActivityFilter} options={summaries.map(summary => ({ value: summary.filter, label: summary.filter === 'all' ? 'All activity records' : summary.label }))} /></div>
      <div className="families-view-toolbar"><span className="families-view-label">Choose your view</span><Segmented value={view} onChange={value => setView(value as 'cards' | 'list')} options={[{ value: 'cards', label: <span className="families-view-option"><LayoutGrid size={16} />Cards</span> }, { value: 'list', label: <span className="families-view-option"><List size={16} />List</span> }]} /></div>
      <Spin spinning={loading}>
        {browsingFamilies ? <>
          {!familyRecords.length && !loading ? <Empty description="No matching families" /> : view === 'list' ? <Table className="families-list" size="small" rowKey={record => record.family.id} dataSource={familyRecords} pagination={{ ...pagination, total: familyRecords.length, hideOnSinglePage: true }} onRow={record => ({ onClick: () => setSelectedFamily(record.family.id), style: { cursor: 'pointer' } })} columns={[{ title: 'Family', key: 'name', render: (_, record) => <button className="activity-member-name" onClick={() => setSelectedFamily(record.family.id)}>{record.family.familyName}</button> }, { title: 'Head', dataIndex: 'head' }, { title: 'Members', key: 'members', render: (_, record) => record.people.length }, { title: 'Recorded', dataIndex: 'recorded' }]} /> : <div className="family-search-grid families-card-grid">{familyRecords.slice((page - 1) * size, page * size).map(record => <button className="family-search-card" key={record.family.id} onClick={() => setSelectedFamily(record.family.id)}>
            <span className="family-number">{record.family.familyNumber != null ? `Family #${record.family.familyNumber}` : 'Family record'}</span><strong className="family-card-name" dir="auto">{record.family.familyName}</strong>{record.head && <span className="family-card-head">Head: {record.head}</span>}
            <div className="family-card-bottom"><span className="family-card-members">{record.people.length} members</span><span className="family-status">{record.recorded} recorded</span></div><span className="family-card-preview">{record.people.length - record.recorded} not yet recorded</span>
          </button>)}</div>}
          {view === 'cards' && familyRecords.length > size && <Pagination className="families-pagination" {...pagination} total={familyRecords.length} />}
        </> : <>
        {!filtered.length && !loading ? <Empty description="No matching members" /> : view === 'list' ? <Table className="families-list" size="small" columns={columns} dataSource={filtered} rowKey="id" pagination={pagination} scroll={{ x: 800 }} /> : <>
          <div className="activities-card-grid">{filtered.slice((page - 1) * size, page * size).map(member => <button className="activities-member-card" key={member.id} onClick={() => setEditing(member)}>
            <div className="activities-member-heading"><strong dir="auto">{member.name}</strong><small>{member.age} yrs</small></div>
            {(member.husbandName || member.fatherName) && <span className="activities-guardian">{member.husbandName ? `Husband: ${member.husbandName}` : `Father: ${member.fatherName}`}</span>}
            <div className="activities-member-meta"><Tag>{getTanzeemDisplayName(member.tanzeem)}</Tag><span>{hasRecordedData(member) ? 'Recorded' : 'Not yet recorded'}</span></div>
            {hasRecordedData(member) ? <div className="activities-mini-stats"><div><span>Daily prayers</span><strong>{member.religiousActivities?.fiveDailyPrayers ?? 0}/5</strong></div><div><span>MTA</span><strong>{hasMTA(member) ? 'Yes' : 'No'}</strong></div><div><span>Internet</span><strong>{member.religiousActivities?.internetAccess ? 'Yes' : 'No'}</strong></div></div> : <p className="activities-empty-note">Select to add an activity record.</p>}
            {updatedDate(member) && <small className="activities-updated">Updated {updatedDate(member)}</small>}
          </button>)}</div>
          {filtered.length > size && <Pagination className="families-pagination" {...pagination} />}
        </>}
        </>}
      </Spin>
    </Card>
    <ReligiousActivitiesModal visible={!!editing} member={editing} onClose={() => setEditing(null)} onSuccess={load} />
  </div>;
}
