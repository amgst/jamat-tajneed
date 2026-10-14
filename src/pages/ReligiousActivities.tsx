import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Input, Pagination, Segmented, Select, Space, Spin, Table, Tag } from 'antd';
import type { TableProps } from 'antd';
import { DownloadOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { LayoutGrid, List } from 'lucide-react';
import { ApiService } from '../services/apiService';
import type { Member } from '../types';
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
    try { setMembers(await ApiService.getAllMembers()); }
    catch { setError(true); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => { setPage(1); }, [search, tanzeem, activityFilter]);
  const filtered = useMemo(() => {
    const words = search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return members.filter(member => (tanzeem === 'all' || member.tanzeem === tanzeem)
      && (activityFilter === 'all' || activityFilter === 'recorded' && hasRecordedData(member) || activityFilter === 'missing' && !hasRecordedData(member) || activityFilter === 'prayers' && member.religiousActivities?.fiveDailyPrayers === 5 || activityFilter === 'mta' && hasMTA(member))
      && words.every(word => [member.name, member.fatherName, member.husbandName, member.halqa, member.tajneedCode].filter(Boolean).join(' ').toLocaleLowerCase().includes(word)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [members, search, tanzeem, activityFilter]);
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
  const pagination = { current: page, pageSize: size, total: filtered.length, responsive: true, showSizeChanger: true, pageSizeOptions: [12, 24, 48, 100], onChange: (next: number, nextSize: number) => { setPage(size !== nextSize ? 1 : next); setSize(nextSize); } };
  return <div className="families-page activities-page">
    <header className="families-header"><span className="section-eyebrow">COMMUNITY ACTIVITIES</span><h1>مذہبی سرگرمیاں</h1><p>Religious activities · Select a member to review or update their record.</p></header>
    <div className="activities-summary">{summaries.map(summary => <button key={summary.filter} className={activityFilter === summary.filter ? 'selected' : ''} onClick={() => { setTanzeem('all'); setActivityFilter(summary.filter); }}><span>{summary.label}</span><strong>{summary.value}</strong></button>)}</div>
    <Card className="families-panel" title={`${filtered.length} of ${members.length} members`} extra={<Space wrap><Button icon={<ReloadOutlined />} loading={loading} onClick={load}>Refresh</Button><Button icon={<DownloadOutlined />} onClick={exportData} disabled={!filtered.length}>Export CSV</Button></Space>}>
      {error && <Alert type="error" message="Unable to load records. Please try again." action={<Button onClick={load}>Retry</Button>} style={{ marginBottom: 16 }} />}
      <div className="activities-controls"><Input aria-label="Search religious activity records" prefix={<SearchOutlined />} placeholder="Search member, guardian or Tajneed code" value={search} onChange={event => setSearch(event.target.value)} allowClear /><Select aria-label="Filter tanzeem" value={tanzeem} onChange={setTanzeem} options={[{ value: 'all', label: 'All tanzeems' }, ...Array.from(new Set(members.map(member => member.tanzeem))).filter(Boolean).map(value => ({ value, label: getTanzeemDisplayName(value) }))]} /><Select aria-label="Filter activities" value={activityFilter} onChange={setActivityFilter} options={summaries.map(summary => ({ value: summary.filter, label: summary.filter === 'all' ? 'All activity records' : summary.label }))} /></div>
      <div className="families-view-toolbar"><span className="families-view-label">Choose your view</span><Segmented value={view} onChange={value => setView(value as 'cards' | 'list')} options={[{ value: 'cards', label: <span className="families-view-option"><LayoutGrid size={16} />Cards</span> }, { value: 'list', label: <span className="families-view-option"><List size={16} />List</span> }]} /></div>
      <Spin spinning={loading}>
        {!filtered.length && !loading ? <Empty description="No matching members" /> : view === 'list' ? <Table className="families-list" size="small" columns={columns} dataSource={filtered} rowKey="id" pagination={pagination} scroll={{ x: 800 }} /> : <>
          <div className="activities-card-grid">{filtered.slice((page - 1) * size, page * size).map(member => <button className="activities-member-card" key={member.id} onClick={() => setEditing(member)}>
            <div className="activities-member-heading"><strong dir="auto">{member.name}</strong><small>{member.age} yrs</small></div>
            {(member.husbandName || member.fatherName) && <span className="activities-guardian">{member.husbandName ? `Husband: ${member.husbandName}` : `Father: ${member.fatherName}`}</span>}
            <div className="activities-member-meta"><Tag>{getTanzeemDisplayName(member.tanzeem)}</Tag><span>{hasRecordedData(member) ? 'Recorded' : 'Not yet recorded'}</span></div>
            {hasRecordedData(member) ? <div className="activities-mini-stats"><div><span>Daily prayers</span><strong>{member.religiousActivities?.fiveDailyPrayers ?? 0}/5</strong></div><div><span>MTA</span><strong>{hasMTA(member) ? 'Yes' : 'No'}</strong></div><div><span>Internet</span><strong>{member.religiousActivities?.internetAccess ? 'Yes' : 'No'}</strong></div></div> : <p className="activities-empty-note">Select to add an activity record.</p>}
            {updatedDate(member) && <small className="activities-updated">Updated {updatedDate(member)}</small>}
          </button>)}</div>
          {filtered.length > 0 && <Pagination className="families-pagination" {...pagination} />}
        </>}
      </Spin>
    </Card>
    <ReligiousActivitiesModal visible={!!editing} member={editing} onClose={() => setEditing(null)} onSuccess={load} />
  </div>;
}
