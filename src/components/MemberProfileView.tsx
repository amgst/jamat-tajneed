import { useState } from 'react';
import { Avatar, Button, Popconfirm, Spin } from 'antd';
import { ArrowLeft, ArrowUpRight, Pencil, Phone, MapPin, UserRound, Users, Fingerprint, Heart, BookOpen, Wallet, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Member, Family, WaqfJadeedRecord, TahreqJadeedRecord } from '../types';
import { formatDate, getTanzeemDisplayName } from '../utils/helpers';
import './MemberProfileView.css';

type Props = { member: Member; family: Family | null; waqf: WaqfJadeedRecord | null; tahreq: TahreqJadeedRecord | null; financialError: boolean; onEdit: () => void; backTo?: string; backLabel?: string; onRemove?: () => Promise<void>; removing?: boolean; onReligiousEdit?: () => void; financialLoading?: boolean; onFinancialOpen?: () => void };
const Field = ({ label, value }: { label: string; value?: string | number | null }) => <div className="profile-field"><dt>{label}</dt><dd>{value === undefined || value === null || value === '' ? <span className="unrecorded">Not recorded</span> : value}</dd></div>;
const date = (value?: string) => value ? formatDate(value) : undefined;

export default function MemberProfileView({ member, family, waqf, tahreq, financialError, onEdit, backTo = '/people', backLabel = 'Back to people', onRemove, removing, onReligiousEdit, financialLoading, onFinancialOpen }: Props) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('about');
  const phone = member.phone?.replace(/[^+\d]/g, '');
  const sections = [
    { title: 'Personal details', icon: UserRound, fields: [['Full name', member.name], ['Father’s name', member.fatherName], ['Husband’s name', member.husbandName], ['Gender', member.gender === 'male' ? 'Male' : 'Female'], ['Date of birth', date(member.dateOfBirth)], ['Age on record', `${member.age} years`], ['Marital status', member.maritalStatus ? member.maritalStatus.charAt(0).toUpperCase() + member.maritalStatus.slice(1) : undefined], ['Blood group', member.bloodGroup]] },
    { title: 'Contact & location', icon: MapPin, fields: [['Phone number', member.phone], ['Address', member.address], ['Halqa', member.halqa || family?.halqa], ['Moved to', member.isMoved ? member.movedTo : undefined]] },
    { title: 'Membership', icon: Fingerprint, fields: [['Tajneed code', member.tajneedCode], ['CNIC', member.cnic], ['Tanzeem', getTanzeemDisplayName(member.tanzeem)], ['Year of Bai’at', member.isBaitByBirth ? 'By birth' : member.baitYear], ['Wasit number', member.wasitNo], ['Waqf-e-Nau number', member.waqfeNauNumber], ['Date of death', member.isDeceased ? date(member.dateOfDeath) : undefined]] },
    { title: 'Education & work', icon: BookOpen, fields: [['Education', member.education], ['Profession', member.profession], ['Talem', member.talem]] },
  ];
  return <div className="member-profile">
    <div className="profile-toolbar"><button onClick={() => navigate(backTo)}><ArrowLeft size={17} /> {backLabel}</button><span>PERSON PROFILE</span></div>
    <section className="profile-hero">
      <div className="profile-cover"><span>TAJNEED DIRECTORY</span><span className="cover-ring" /></div>
      <div className="profile-identity">
        <Avatar className="profile-avatar" src={member.profilePhoto}>{member.name.charAt(0)}</Avatar>
        <div className="profile-name"><div className="profile-badges"><span>{getTanzeemDisplayName(member.tanzeem)}</span><span className={member.isDeceased || member.isMoved ? 'status-muted' : 'status-active'}>{member.isDeceased ? 'Deceased' : member.isMoved ? 'Moved' : 'Active'}{member.isBList ? ' · B List' : ''}</span></div><h1>{member.name}</h1><p>{member.fatherName ? `Father: ${member.fatherName}` : member.husbandName ? `Husband: ${member.husbandName}` : 'Jamaat Ahmadiyya Muridke'}</p></div>
        <Button className="profile-edit" icon={<Pencil size={15} />} onClick={onEdit}>Edit profile</Button>
      </div>
      <div className="profile-summary"><div><span>Tajneed code</span><strong>{member.tajneedCode || 'Not recorded'}</strong></div><div><span>Halqa</span><strong>{member.halqa || family?.halqa || 'Not recorded'}</strong></div><div><span>Age on record</span><strong>{member.age} years</strong></div></div>
      <div className="profile-actions">{phone ? <a href={`tel:${phone}`}><Phone size={16} /> Call person <ArrowUpRight size={14} /></a> : <span><Phone size={16} /> No phone recorded</span>}{family && <button onClick={() => navigate(`/families/${encodeURIComponent(family.id)}`)}><Users size={16} /> View family <ArrowUpRight size={14} /></button>}</div>
    </section>
    <div className="profile-actions">{onReligiousEdit && <Button icon={<Heart size={16} />} onClick={onReligiousEdit}>Update religious activities</Button>}{onRemove && <Popconfirm title="Remove member from this family?" description="The member record will be kept." onConfirm={onRemove} okText="Remove" cancelText="Cancel"><Button danger icon={<Trash2 size={16} />} loading={removing}>Remove from family</Button></Popconfirm>}</div>
    <div className="profile-tabs" role="tablist" aria-label="Profile sections">{[{ key: 'about', label: 'Overview', icon: UserRound }, { key: 'religious', label: 'Religious activities', icon: Heart }, { key: 'financial', label: 'Contributions', icon: Wallet }].map(item => <button key={item.key} id={`tab-${item.key}`} role="tab" aria-selected={tab === item.key} aria-controls="profile-panel" onClick={() => { setTab(item.key); if (item.key === 'financial') onFinancialOpen?.(); }} className={tab === item.key ? 'selected' : ''}><item.icon size={16} />{item.label}</button>)}</div>
    <div id="profile-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
      {tab === 'about' && <div className="profile-section-grid">{sections.map(section => <section className="profile-section" key={section.title}><h2><section.icon size={18} />{section.title}</h2><dl>{section.fields.filter(([label, value]) => !['Moved to', 'Date of death', 'Husband’s name'].includes(String(label)) || !!value).map(([label, value]) => <Field key={label} label={String(label)} value={value} />)}</dl></section>)}<section className="profile-section family-section"><h2><Users size={18} />Family connection</h2>{family ? <button onClick={() => navigate(`/families/${encodeURIComponent(family.id)}`)}><div><strong>{family.familyName}</strong><span>{family.totalMembers} family members{family.familyNumber ? ` · Family #${family.familyNumber}` : ''}</span></div><ArrowUpRight size={20} /></button> : <p className="profile-empty">No family linked to this person.</p>}</section></div>}
      {tab === 'religious' && <section className="profile-section"><h2><Heart size={18} />Religious activities</h2>{member.religiousActivities ? <><dl className="religious-grid">{Object.entries(member.religiousActivities).filter(([key]) => !['notes', 'lastUpdated'].includes(key)).map(([key, value]) => <Field key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, char => char.toUpperCase())} value={typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value)} />)}</dl>{member.religiousActivities.notes && <p className="profile-notes">{member.religiousActivities.notes}</p>}<p className="profile-stamp">Updated {date(member.religiousActivities.lastUpdated)}</p></> : <p className="profile-empty">Religious activities have not been recorded for this person.</p>}</section>}
      {tab === 'financial' && <><p className="contribution-year">Contributions for {new Date().getFullYear()}</p>{financialLoading ? <div className="profile-empty"><Spin /><p>Loading contributions…</p></div> : financialError ? <p className="profile-empty">Contribution records could not be loaded. Refresh the page to try again.</p> : <div className="profile-section-grid">{[{ title: 'Waqf-e-Jadeed', record: waqf }, { title: 'Tahreq Jadeed', record: tahreq }].map(({ title, record }) => {
        const promised = (record?.promiseAmount || 0) + (record?.nagarparAmount || 0);
        const paid = record?.paidAmount || 0;
        return <section className="profile-section contribution-card" key={title}><h2><Wallet size={18} />{title}</h2>{record ? <><span className="contribution-label">Amount paid</span><strong className="contribution-amount">Rs. {paid.toLocaleString()}</strong><div className="contribution-track"><div style={{ width: `${promised > 0 ? Math.min(100, Math.max(0, paid / promised * 100)) : 0}%` }} /></div><dl><Field label="Total promised" value={`Rs. ${promised.toLocaleString()}`} /><Field label={paid > promised ? 'Overpayment' : 'Remaining'} value={`Rs. ${Math.abs(promised - paid).toLocaleString()}`} /></dl></> : <p className="profile-empty">No contribution record for this year.</p>}</section>;
      })}</div>}</>}
    </div>
    <footer className="profile-stamp">Created {date(member.createdAt) || 'date not recorded'}<span> · </span>Updated {date(member.updatedAt) || 'date not recorded'}</footer>
  </div>;
}
