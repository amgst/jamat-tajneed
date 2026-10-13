import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Avatar, Button, Empty, Select, Spin } from 'antd';
import { Search, ArrowRight, Users, House, X, MapPin, RefreshCw } from 'lucide-react';
import { ApiService } from '../services/apiService';
import type { Family, Member, Tanzeem } from '../types';
import { getTanzeemDisplayName } from '../utils/helpers';
import './PeopleHome.css';

const tanzeems: Tanzeem[] = ['ansar', 'khuddam', 'lajna', 'atfal', 'nasirat', 'saf-e-awal', 'saf-e-awal-girls'];

export default function PeopleHome() {
  const navigate = useNavigate();
  const directory = useLocation().pathname === '/people';
  const [members, setMembers] = useState<Member[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const group = params.get('tanzeem') || 'all';
  const status = params.get('status') || 'all';
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
  useEffect(() => { setLimit(30); }, [query, group, status]);
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
    const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return members.filter(member => {
      const text = [member.name, member.fatherName, member.husbandName, member.phone,
        member.cnic, member.tajneedCode, member.address, member.halqa].filter(Boolean).join(' ').toLocaleLowerCase();
      return words.every(word => text.includes(word)) && (group === 'all' || member.tanzeem === group)
        && (status === 'all' || (status === 'deceased' ? member.isDeceased : status === 'moved' ? member.isMoved : !member.isDeceased && !member.isMoved && !member.isBList));
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [members, query, group, status]);
  const showResults = directory || !!query.trim() || group !== 'all' || status !== 'all';
  return <div className="people-app">
    <section className={`people-hero ${showResults ? 'compact' : ''}`}>
      <span className="community-label"><span /> JAMAAT AHMADIYYA · MURIDKE</span>
      <div className="people-wordmark">Taj<span>need</span><i /></div>
      <h1>{directory ? 'Everyone, in one place.' : 'Find your family.'}</h1>
      <p>Family records and community connections, in one place.</p>
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
          <div className="tanzeem-heading"><span className="section-eyebrow">EXPLORE BY TANZEEM</span><span>Active members</span></div>
          <div className="tanzeem-grid">{tanzeems.map(tanzeem => {
            const count = members.filter(member => member.tanzeem === tanzeem && !member.isDeceased && !member.isMoved && !member.isBList).length;
            return <button key={tanzeem} onClick={() => navigate(`/people?tanzeem=${tanzeem}&status=active`)} aria-label={`View ${count} active ${getTanzeemDisplayName(tanzeem)} members`}><span>{getTanzeemDisplayName(tanzeem)}</span><strong>{count.toLocaleString()}</strong><ArrowRight size={14} /></button>;
          })}</div>
        </section>
        <div className="directory-note"><div><span className="section-eyebrow">YOUR COMMUNITY DIRECTORY</span><h2>Every record matters.</h2><p>Personal details, contact information and family connections — together in one place.</p></div><div className="people-count"><strong>{members.length.toLocaleString()}</strong><span>person records</span></div></div>
      </>}
      {showResults && searchingFamilies && <section id="people-results" className="people-results">
        <div className="results-heading"><div><span className="section-eyebrow">FAMILY SEARCH</span><h2>{familyResults.length.toLocaleString()} {familyResults.length === 1 ? 'family' : 'families'} found</h2></div><Button type="text" aria-label="Refresh families" icon={<RefreshCw size={17} />} onClick={load} /></div>
        {familyResults.length === 0 ? <Empty description="No families found. Try a family name, member name, number or phone." /> : <div className="family-search-grid">{familyResults.slice(0, limit).map(({ family, people, head }) => <button className="family-search-card" key={family.id} onClick={() => navigate(`/families/${encodeURIComponent(family.id)}`)}>
          <div className="family-card-top"><span className="family-house"><House size={21} /></span><span className="family-number">{family.familyNumber != null ? `Family #${family.familyNumber}` : 'Family record'}</span><ArrowRight size={18} /></div>
          <strong className="family-card-name">{family.familyName}</strong>
          <span className="family-card-head">Head: {head?.name || 'Not recorded'}</span>
          <span className="family-card-location"><MapPin size={14} />{family.halqa || head?.halqa || head?.address || 'Location not recorded'}</span>
          <div className="family-card-bottom"><span className="family-card-members"><Users size={15} />{people.length} {people.length === 1 ? 'member' : 'members'}</span><span className={`family-status ${family.isMoved || family.isBList ? 'muted' : ''}`}>{family.isMoved ? 'Moved' : family.isBList ? 'B List' : 'Active'}</span></div>
          <span className="family-card-preview">{people.slice(0, 3).map(member => member.name).join(' · ')}{people.length > 3 ? ` · +${people.length - 3} more` : ''}</span>
        </button>)}</div>}
        {familyResults.length > limit && <Button className="load-more" onClick={() => setLimit(value => value + 30)}>Show more families</Button>}
      </section>}
      {showResults && !searchingFamilies && <section id="people-results" className="people-results">
        <div className="results-heading"><div><span className="section-eyebrow">{group === 'all' ? 'PERSON DIRECTORY' : getTanzeemDisplayName(group).toUpperCase()}</span><h2>{results.length.toLocaleString()} {results.length === 1 ? 'person' : 'people'}</h2></div><Button type="text" aria-label="Refresh directory" icon={<RefreshCw size={17} />} onClick={load} /></div>
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
