import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Alert, Avatar, Button, Empty, Select, Spin } from 'antd';
import { Search, ArrowRight, Users, House, X, MapPin, RefreshCw } from 'lucide-react';
import { ApiService } from '../services/apiService';
import type { Member } from '../types';
import { getTanzeemDisplayName } from '../utils/helpers';
import './PeopleHome.css';

export default function PeopleHome() {
  const navigate = useNavigate();
  const directory = useLocation().pathname === '/people';
  const [members, setMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [limit, setLimit] = useState(30);
  const load = async () => {
    setLoading(true); setError(false);
    try { setMembers(await ApiService.getAllMembers()); }
    catch { setError(true); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => { setLimit(30); }, [query, group, status]);
  const results = useMemo(() => {
    const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return members.filter(member => {
      const text = [member.name, member.fatherName, member.husbandName, member.phone,
        member.cnic, member.tajneedCode, member.address, member.halqa].filter(Boolean).join(' ').toLocaleLowerCase();
      return words.every(word => text.includes(word)) && (group === 'all' || member.tanzeem === group)
        && (status === 'all' || (status === 'deceased' ? member.isDeceased : status === 'moved' ? member.isMoved : !member.isDeceased && !member.isMoved));
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [members, query, group, status]);
  const showResults = directory || !!query.trim() || group !== 'all' || status !== 'all';
  return <div className="people-app">
    <section className={`people-hero ${showResults ? 'compact' : ''}`}>
      <span className="community-label"><span /> JAMAAT AHMADIYYA · MURIDKE</span>
      <div className="people-wordmark">Taj<span>need</span><i /></div>
      <h1>{directory ? 'Everyone, in one place.' : 'Find your people.'}</h1>
      <p>One directory. Every person. A more connected Jamaat.</p>
      <form className="people-search" onSubmit={event => { event.preventDefault(); document.getElementById('people-results')?.scrollIntoView({ behavior: 'smooth' }); }}>
        <Search size={22} aria-hidden="true" />
        <input aria-label="Search person records" placeholder="Search name, phone, CNIC or Tajneed code" value={query} onChange={event => setQuery(event.target.value)} />
        {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={18} /></button>}
        <button type="submit" className="search-submit" aria-label="Search"><ArrowRight size={20} /></button>
      </form>
      <span className="search-hint">Search in English or Urdu · Find a record in seconds</span>
    </section>
    {error ? <Alert type="error" showIcon message="Unable to load person records" description="Check your connection and try again." action={<Button onClick={load}>Retry</Button>} /> : loading ? <div className="people-loading"><Spin /><p>Loading your directory…</p></div> : <>
      {!showResults && <>
        <div className="people-shortcuts">
          <button onClick={() => navigate('/people')}><span className="shortcut-icon"><Users size={24} /></span><strong>All people</strong><span>Browse the directory</span><ArrowRight size={18} /></button>
          <button onClick={() => navigate('/families')}><span className="shortcut-icon mint"><House size={24} /></span><strong>Families</strong><span>Explore family records</span><ArrowRight size={18} /></button>
        </div>
        <div className="directory-note"><div><span className="section-eyebrow">YOUR COMMUNITY DIRECTORY</span><h2>Every record matters.</h2><p>Personal details, contact information and family connections — together in one place.</p></div><div className="people-count"><strong>{members.length.toLocaleString()}</strong><span>person records</span></div></div>
      </>}
      {showResults && <section id="people-results" className="people-results">
        <div className="results-heading"><div><span className="section-eyebrow">PERSON DIRECTORY</span><h2>{results.length.toLocaleString()} {results.length === 1 ? 'person' : 'people'}{query.trim() ? ' found' : ''}</h2></div><Button type="text" aria-label="Refresh directory" icon={<RefreshCw size={17} />} onClick={load} /></div>
        <div className="people-filters"><Select aria-label="Filter by Tanzeem" value={group} onChange={setGroup} options={[{ value: 'all', label: 'All Tanzeems' }, ...Array.from(new Set(members.map(m => m.tanzeem))).map(value => ({ value, label: getTanzeemDisplayName(value) }))]} /><Select aria-label="Filter by record status" value={status} onChange={setStatus} options={[{ value: 'all', label: 'All records' }, { value: 'active', label: 'Active' }, { value: 'moved', label: 'Moved' }, { value: 'deceased', label: 'Deceased' }]} /></div>
        {results.length === 0 ? <Empty description="No people found. Try a different name or clear the filters." /> : <div className="people-list">{results.slice(0, limit).map(member => <button className="person-card" key={member.id} onClick={() => navigate(`/members/person-${encodeURIComponent(member.id)}`)}>
          <Avatar size={48} src={member.profilePhoto} style={{ background: '#e9edf9', color: '#425fa9', flexShrink: 0 }}>{member.name.slice(0, 1)}</Avatar>
          <div className="person-copy"><strong>{member.name}</strong><span>{member.fatherName ? `Father: ${member.fatherName}` : member.husbandName ? `Husband: ${member.husbandName}` : getTanzeemDisplayName(member.tanzeem)}</span><small><MapPin size={12} />{member.halqa || member.address || 'Location not recorded'}</small></div>
          <div className="person-meta"><span>{member.isDeceased ? 'Deceased' : member.isMoved ? 'Moved' : getTanzeemDisplayName(member.tanzeem)}</span><ArrowRight size={17} /></div>
        </button>)}</div>}
        {results.length > limit && <Button className="load-more" onClick={() => setLimit(value => value + 30)}>Show more people</Button>}
      </section>}
    </>}
    <footer className="people-footer">Tajneed · Bringing our community together</footer>
  </div>;
}
