import useMemberNavigation from '../hooks/useMemberNavigation';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, Empty, Select, Spin, Card, Input, Segmented, Table, Pagination } from 'antd';
import { Search, ArrowRight, Users, House, X, MapPin, RefreshCw, LayoutGrid, List } from 'lucide-react';
import { ApiService } from '../services/apiService';
import type { Family, Member, Tanzeem } from '../types';
import { getTanzeemDisplayName } from '../utils/helpers';
import './PeopleHome.css';
import './Families.css';

const tanzeems: Tanzeem[] = ['ansar', 'khuddam', 'lajna', 'atfal', 'nasirat', 'saf-e-awal', 'saf-e-awal-girls'];
const memberships = [{ value: 'mossi', label: 'Mossi' }, { value: 'waqfe-nau', label: 'Waqf-e-Nau' }];
const recordLists = [{ value: 'active', label: 'Active in tanzeems' }, { value: 'b-list', label: 'B List' }, { value: 'moved', label: 'Moved' }, { value: 'deceased', label: 'Deceased' }, { value: 'unassigned', label: 'No tanzeem assigned' }];
const recordCategory = (member: Member) => member.isDeceased ? 'deceased' : member.isMoved ? 'moved' : member.isBList ? 'b-list' : !tanzeems.includes(member.tanzeem) ? 'unassigned' : 'active';
const recordedLocation = (...values: (string | undefined)[]) => values.map(value => value?.trim()).find(value => value && !['unknown', 'not recorded', 'location not recorded', 'n/a', '-'].includes(value.toLowerCase()));
const matchesMembership = (member: Member, membership: string) => membership === 'mossi' ? !!member.wasitNo?.trim() : membership === 'waqfe-nau' ? !!member.waqfeNauNumber?.trim() : true;

export default function PeopleHome() {
  const navigate = useNavigate();
  const openMember = useMemberNavigation();
  const directory = useLocation().pathname === '/people';
  const [members, setMembers] = useState<Member[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('ascend');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const group = params.get('tanzeem') || 'all';
  const status = params.get('status') || 'all';
  const membership = params.get('membership') || 'all';
  const setMembership = (value: string) => setParams(previous => { const next = new URLSearchParams(previous); next.set('membership', value); return next; });
  const setGroup = (value: string) => setParams(previous => { const next = new URLSearchParams(previous); next.set('tanzeem', value); return next; });
  const setStatus = (value: string) => setParams(previous => { const next = new URLSearchParams(previous); next.set('status', value); return next; });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [limit, setLimit] = useState(30);
  const load = async () => {
    setLoading(true); setError(false);
    try {
      const [people, households] = await Promise.all([ApiService.getAllMembers(), ApiService.getAllFamilies()]);
      setMembers(people); setFamilies(households);
    }
    catch { setError(true); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => { setLimit(30); }, [query, group, status, membership]);
  useEffect(() => { setPage(1); }, [memberQuery, group, status, membership, sortField, sortOrder]);
  const familyRecords = useMemo(() => {
    const byId = new Map(members.map(member => [member.id, member]));
    const byFamily = new Map<string, Member[]>();
    members.forEach(member => {
      if (member.familyId) byFamily.set(member.familyId, [...(byFamily.get(member.familyId) || []), member]);
    });
    return families.map(family => {
      const ids = new Set([family.headId, ...family.memberIds, ...(byFamily.get(family.id) || []).map(member => member.id)]);
      const people = Array.from(ids).map(id => byId.get(id)).filter((member): member is Member => !!member);
      const head = byId.get(family.headId);
      const text = [family.familyName, family.familyNumber, family.halqa, ...people.flatMap(member =>
        [member.name, member.fatherName, member.husbandName, member.phone, member.cnic, member.tajneedCode, member.address, member.halqa])]
        .filter(value => value !== undefined && value !== null).join(' ').toLocaleLowerCase();
      return { family, people, head, text };
    });
  }, [families, members]);
  const familyResults = useMemo(() => {
    const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return familyRecords.filter(record => words.every(word => record.text.includes(word)))
      .sort((a, b) => a.family.familyName.localeCompare(b.family.familyName));
  }, [familyRecords, query]);
  const searchingFamilies = !!query.trim();
  const results = useMemo(() => {
    const words = (directory ? memberQuery : query).trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return members.filter(member => {
      const text = [member.name, member.fatherName, member.husbandName, member.phone,
        member.cnic, member.tajneedCode, member.address, member.halqa, member.wasitNo, member.waqfeNauNumber].filter(Boolean).join(' ').toLocaleLowerCase();
      return words.every(word => text.includes(word)) && (group === 'all' || member.tanzeem === group)
        && matchesMembership(member, membership)
        && (status === 'all' || recordCategory(member) === status);
    }).sort((a, b) => (sortField === 'age' ? a.age - b.age : a.name.localeCompare(b.name)) * (sortOrder === 'descend' ? -1 : 1));
  }, [members, query, memberQuery, directory, group, status, membership, sortField, sortOrder]);
  const showResults = directory || !!query.trim() || group !== 'all' || status !== 'all' || membership !== 'all';
  if (directory) return <div className="families-page members-directory">
    <header className="families-header"><div><span className="section-eyebrow">YOUR COMMUNITY DIRECTORY</span><h1>Members</h1></div></header>
    <Card className="families-panel" title={`${results.length} of ${members.length} members`} extra={<Button icon={<RefreshCw size={15} />} onClick={load} loading={loading}>Refresh</Button>}>
      <div className="members-directory-controls">
        <Input aria-label="Search members" prefix={<Search size={16} />} placeholder="Search name, phone or membership number" allowClear value={memberQuery} onChange={event => setMemberQuery(event.target.value)} />
        <Select aria-label="Sort members" value={sortField} onChange={setSortField} options={[{ value: 'name', label: 'Member name' }, { value: 'age', label: 'Age' }]} />
        <Select aria-label="Sort order" value={sortOrder} onChange={setSortOrder} options={[{ value: 'ascend', label: 'Ascending' }, { value: 'descend', label: 'Descending' }]} />
      </div>
      <div className="members-directory-controls">
        <Select aria-label="Filter by membership" value={membership} onChange={setMembership} options={[{ value: 'all', label: 'All memberships' }, ...memberships]} />
        <Select aria-label="Filter by Tanzeem" value={group} onChange={setGroup} options={[{ value: 'all', label: 'All Tanzeems' }, ...tanzeems.map(value => ({ value, label: getTanzeemDisplayName(value) }))]} />
        <Select aria-label="Filter by record status" value={status} onChange={setStatus} options={[{ value: 'all', label: 'All records' }, ...recordLists]} />
      </div>
      <div className="families-view-toolbar"><span className="families-view-label">Choose your view</span><Segmented value={viewMode} onChange={value => setViewMode(value as 'cards' | 'list')} options={[{ value: 'cards', label: <span className="families-view-option"><LayoutGrid size={16} />Cards</span> }, { value: 'list', label: <span className="families-view-option"><List size={16} />List</span> }]} /></div>
      {error ? <Alert type="error" message="Unable to load members. Please try again." action={<Button onClick={load}>Retry</Button>} /> : <Spin spinning={loading}>
        {!loading && !results.length ? <Empty description="No members found. Try another search or filter." /> : viewMode === 'cards' ? <div className="family-search-grid families-card-grid">{results.slice((page - 1) * pageSize, page * pageSize).map(member => <button className="family-search-card member-directory-card" key={member.id} onClick={() => openMember(member.id)}>
          <div className="person-name-line"><strong className="family-card-name" dir="auto">{member.name}</strong>{Number.isFinite(member.age) && <span className="person-age">{member.age} yrs</span>}<ArrowRight size={17} /></div>
          {(member.fatherName || member.husbandName) && <span className="family-card-head">{member.fatherName ? `Father: ${member.fatherName}` : `Husband: ${member.husbandName}`}</span>}
          {membership === 'mossi' && <span className="family-card-head">Musi number: {member.wasitNo}</span>}
          {recordedLocation(member.halqa, member.address) && <span className="family-card-location"><MapPin size={14} />{recordedLocation(member.halqa, member.address)}</span>}
          <div className="family-card-bottom"><span className="family-card-members">{getTanzeemDisplayName(member.tanzeem)}</span><span className={`family-status ${recordCategory(member) !== 'active' ? 'muted' : ''}`}>{recordLists.find(item => item.value === recordCategory(member))?.label.replace('Active in tanzeems', 'Active')}</span></div>
        </button>)}</div> : <Table className="families-list" size="small" rowKey="id" dataSource={results.slice((page - 1) * pageSize, page * pageSize)} pagination={false} scroll={{ x: 650 }} onRow={member => ({ onClick: () => openMember(member.id), style: { cursor: 'pointer' } })} columns={[
          { title: 'Member', key: 'name', render: (member: Member) => <button className="member-directory-name" onClick={event => { event.stopPropagation(); openMember(member.id); }}>{member.name}</button> },
          { title: 'Age', dataIndex: 'age', key: 'age', width: 70 },
          { title: 'Tanzeem', dataIndex: 'tanzeem', key: 'tanzeem', render: getTanzeemDisplayName },
          ...(membership === 'mossi' ? [{ title: 'Musi number', dataIndex: 'wasitNo', key: 'wasitNo' }] : []),
          { title: 'Phone', dataIndex: 'phone', key: 'phone' },
          { title: 'Status', key: 'status', render: (member: Member) => recordLists.find(item => item.value === recordCategory(member))?.label.replace('Active in tanzeems', 'Active') },
        ]} />}
        {results.length > 0 && <Pagination className="families-pagination" current={page} pageSize={pageSize} total={results.length} responsive showSizeChanger pageSizeOptions={[10, 20, 50, 100]} showTotal={(total, range) => `${range[0]}–${range[1]} of ${total} members`} onChange={(nextPage, size) => { setPage(size !== pageSize ? 1 : nextPage); setPageSize(size); }} />}
      </Spin>}
    </Card>
  </div>;
  return <div className={`people-app ${directory || showResults ? 'directory-layout' : ''}`}>
    <section className={`people-hero ${showResults ? 'compact' : ''}`}>
      <div className="people-wordmark">Taj<span>need</span><i /></div>
      <span className="people-logo-location">Muridke</span>
      {!directory && <p>Family records and community connections, in one place.</p>}
      <form className="people-search" onSubmit={event => { event.preventDefault(); document.getElementById('people-results')?.scrollIntoView({ behavior: 'smooth' }); }}>
        <Search size={22} aria-hidden="true" />
        <input aria-label="Search families" placeholder="Search family, name or phone" value={query} onChange={event => setQuery(event.target.value)} />
        {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={18} /></button>}
        <button type="submit" className="search-submit" aria-label="Search"><ArrowRight size={20} /></button>
      </form>
      <span className="search-hint">Search in English or Urdu · Results show families only</span>
    </section>
    {error ? <Alert type="error" showIcon message="Unable to load the directory" description="Check your connection and try again." action={<Button onClick={load}>Retry</Button>} /> : loading ? <div className="people-loading"><Spin /><p>Loading your directory…</p></div> : <>
      {!showResults && <>
        <div className="people-shortcuts">
          <button onClick={() => navigate('/people')}><span className="shortcut-icon"><Users size={24} /></span><strong>All people</strong><span>Browse the directory</span><ArrowRight size={18} /></button>
          <button onClick={() => navigate('/families')}><span className="shortcut-icon mint"><House size={24} /></span><strong>Families</strong><span>Explore family records</span><ArrowRight size={18} /></button>
        </div>
        <section className="home-tanzeems" aria-label="Tanzeem member counts">
          <div className="tanzeem-heading"><span className="section-eyebrow">EXPLORE BY TANZEEM</span><span>{members.filter(member => recordCategory(member) === 'active').length.toLocaleString()} active members</span></div>
          <div className="tanzeem-grid">{tanzeems.map(tanzeem => {
            const count = members.filter(member => member.tanzeem === tanzeem && recordCategory(member) === 'active').length;
            return <button key={tanzeem} onClick={() => navigate(`/people?tanzeem=${tanzeem}&status=active`)} aria-label={`View ${count} active ${getTanzeemDisplayName(tanzeem)} members`}><span>{getTanzeemDisplayName(tanzeem)}</span><strong>{count.toLocaleString()}</strong><ArrowRight size={14} /></button>;
          })}</div>
        </section>
        <section className="home-tanzeems" aria-label="Mossi and Waqf-e-Nau counts">
          <div className="tanzeem-heading"><span className="section-eyebrow">MOSSI & WAQF-E-NAU</span><span>All recorded members</span></div>
          <div className="tanzeem-grid membership-grid">{memberships.map(item => {
            const count = members.filter(member => matchesMembership(member, item.value)).length;
            return <button key={item.value} onClick={() => navigate(`/people?membership=${item.value}`)} aria-label={`View ${count} ${item.label} members`}><span>{item.label}</span><strong>{count.toLocaleString()}</strong><ArrowRight size={14} /></button>;
          })}</div>
        </section>
        <section className="home-tanzeems record-breakdown" aria-label="All record breakdown">
          <div className="tanzeem-heading"><span className="section-eyebrow">ALL RECORDS EXPLAINED</span><span>{members.length.toLocaleString()} total records</span></div>
          <div className="tanzeem-grid">{recordLists.map(item => {
            const count = members.filter(member => recordCategory(member) === item.value).length;
            return <button key={item.value} onClick={() => navigate(`/people?status=${item.value}`)} aria-label={`View ${count} ${item.label} records`}><span>{item.label}</span><strong>{count.toLocaleString()}</strong><ArrowRight size={14} /></button>;
          })}</div>
          <p className="record-breakdown-note">Tanzeem totals include active members only. These groups add up to all {members.length.toLocaleString()} records. Each person is counted once: deceased, then moved, then B List, then unassigned or active.</p>
          <p className="record-breakdown-note">Mossi and Waqf-e-Nau are memberships within these records, so their counts are not added to the total.</p>
        </section>
      </>}
      {showResults && searchingFamilies && <section id="people-results" className="people-results">
        <div className="results-heading"><div><span className="section-eyebrow">FAMILY SEARCH</span><h2>{familyResults.length.toLocaleString()} {familyResults.length === 1 ? 'family' : 'families'} found</h2></div><Button type="text" aria-label="Refresh families" icon={<RefreshCw size={17} />} onClick={load} /></div>
        {familyResults.length === 0 ? <Empty description="No families found. Try a family name, member name, number or phone." /> : <div className="family-search-grid">{familyResults.slice(0, limit).map(({ family, people, head }) => <button className="family-search-card" key={family.id} onClick={() => navigate(`/families/${encodeURIComponent(family.id)}`)}>
          <div className="family-card-top"><span className="family-house"><House size={21} /></span><span className="family-number">{family.familyNumber != null ? `Family #${family.familyNumber}` : 'Family record'}</span><ArrowRight size={18} /></div>
          <strong className="family-card-name">{family.familyName}</strong>
          <span className="family-card-head">Head: {head?.name || 'Not recorded'}</span>
          {recordedLocation(family.halqa, head?.halqa, head?.address) && <span className="family-card-location"><MapPin size={14} />{recordedLocation(family.halqa, head?.halqa, head?.address)}</span>}
          <div className="family-card-bottom"><span className="family-card-members"><Users size={15} />{people.length} {people.length === 1 ? 'member' : 'members'}</span><span className={`family-status ${family.isMoved || family.isBList ? 'muted' : ''}`}>{family.isMoved ? 'Moved' : family.isBList ? 'B List' : 'Active'}</span></div>
          <span className="family-card-preview">{people.slice(0, 3).map(member => member.name).join(' · ')}{people.length > 3 ? ` · +${people.length - 3} more` : ''}</span>
        </button>)}</div>}
        {familyResults.length > limit && <Button className="load-more" onClick={() => setLimit(value => value + 30)}>Show more families</Button>}
      </section>}
      {showResults && !searchingFamilies && <section id="people-results" className="people-results">
        <div className="results-heading"><div><span className="section-eyebrow">{[group === 'all' ? '' : getTanzeemDisplayName(group), memberships.find(item => item.value === membership)?.label].filter(Boolean).join(' · ').toUpperCase() || 'PERSON DIRECTORY'}</span><h2>{results.length.toLocaleString()} {results.length === 1 ? 'person' : 'people'}</h2></div><Button type="text" aria-label="Refresh directory" icon={<RefreshCw size={17} />} onClick={load} /></div>
        <div className="people-filters"><Select aria-label="Filter by membership" value={membership} onChange={setMembership} options={[{ value: 'all', label: 'All memberships' }, ...memberships]} /><Select aria-label="Filter by Tanzeem" value={group} onChange={setGroup} options={[{ value: 'all', label: 'All Tanzeems' }, ...Array.from(new Set(members.map(m => m.tanzeem))).map(value => ({ value, label: getTanzeemDisplayName(value) }))]} /><Select aria-label="Filter by record status" value={status} onChange={setStatus} options={[{ value: 'all', label: 'All records' }, ...recordLists]} /></div>
        {results.length === 0 ? <Empty description="No people found. Try a different name or clear the filters." /> : <div className="people-list">{results.slice(0, limit).map(member => <button className="person-card" key={member.id} onClick={() => openMember(member.id)}>
          <div className="person-copy"><div className="person-name-line"><strong>{member.name}</strong>{Number.isFinite(member.age) && <span className="person-age">{member.age} yrs</span>}</div><span>{member.fatherName ? `Father: ${member.fatherName}` : member.husbandName ? `Husband: ${member.husbandName}` : getTanzeemDisplayName(member.tanzeem)}</span>{membership === 'mossi' && <span>Musi number: {member.wasitNo}</span>}{recordedLocation(member.halqa, member.address) && <small><MapPin size={12} />{recordedLocation(member.halqa, member.address)}</small>}</div>
          <div className="person-meta"><span>{member.isDeceased ? 'Deceased' : member.isMoved ? 'Moved' : getTanzeemDisplayName(member.tanzeem)}</span><ArrowRight size={17} /></div>
        </button>)}</div>}
        {results.length > limit && <Button className="load-more" onClick={() => setLimit(value => value + 30)}>Show more people</Button>}
      </section>}
    </>}
    <footer className="people-footer">Tajneed · Bringing our community together</footer>
  </div>;
}
