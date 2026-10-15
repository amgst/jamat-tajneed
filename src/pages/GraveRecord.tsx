import { useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Card, Descriptions, Empty, Form, Input, InputNumber, Modal, Pagination, Segmented, Select, Spin, Table } from 'antd';
import { ArrowRight, BookOpen, LayoutGrid, List, Search } from 'lucide-react';
import { EditOutlined } from '@ant-design/icons';
import { getGraveRecords, updateGraveRecord } from '../services/graveRecords';
import type { GraveRecord as RecordType } from '../services/graveRecords';
import { matchesNameSearch } from '../utils/nameSearch';

import './PeopleHome.css';
import './Families.css';
import './GraveRecord.css';

const fields: { key: keyof RecordType; title: string; width?: number }[] = [
  { key: 'graveNumber', title: 'Grave number', width: 130 },
  { key: 'deceasedFullName', title: 'Deceased name', width: 210 },
  { key: 'parentNames', title: 'Parents’ names', width: 200 },
  { key: 'husbandName', title: 'Husband’s name', width: 180 },
  { key: 'gender', title: 'Gender', width: 100 },
  { key: 'dateOfBirth', title: 'Date of birth', width: 140 },
  { key: 'dateOfDeath', title: 'Date of death', width: 140 },
  { key: 'ageAtDeath', title: 'Age at death', width: 120 },
  { key: 'relativeContact', title: 'Relative contact', width: 170 },
  { key: 'notes', title: 'Notes', width: 300 },
  { key: 'createdAt', title: 'Created at', width: 220 },
];

const hasFamilyName = (value: string | null | undefined) =>
  !!value?.trim() && !['null', 'undefined', 'n/a', 'not provided', 'not mentioned', '-'].includes(value.trim().toLowerCase());

export default function GraveRecord() {
  const { message } = App.useApp();
  const [records, setRecords] = useState<RecordType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [gender, setGender] = useState('all');
  const [sortField, setSortField] = useState('graveNumber');
  const [selected, setSelected] = useState<RecordType | null>(null);
  const [editing, setEditing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editForm] = Form.useForm<RecordType>();
  const openDetails = (record: RecordType) => { setEditing(false); setSelected(record); };
  const saveDetails = async (values: RecordType) => {
    if (!selected) return;
    setUpdating(true);
    try {
      const updated = await updateGraveRecord({ ...selected, ...values, id: selected.id });
      setRecords(previous => previous.map(record => record.id === updated.id ? updated : record));
      setSelected(updated);
      setEditing(false);
      message.success('Grave record updated.');
    } catch { message.error('Unable to save changes. Check your connection and permissions, then try again.'); }
    finally { setUpdating(false); }
  };
  const load = async () => {
    setLoading(true); setError('');
    try { setRecords(await getGraveRecords()); }
    catch { setError('Unable to load grave records. Check your connection and database permissions, then retry.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const filtered = useMemo(() => {
    return records.filter(record => (gender === 'all' || record.gender?.toLowerCase() === gender) && matchesNameSearch(fields.map(field => record[field.key] ?? '').join(' '), [record.deceasedFullName, record.parentNames, record.husbandName].filter(Boolean), query))
      .sort((a, b) => String(a[sortField as keyof RecordType] ?? '').localeCompare(String(b[sortField as keyof RecordType] ?? ''), undefined, { numeric: true }));
  }, [records, query, gender, sortField]);
  const columns = fields.map(field => ({ ...field, dataIndex: field.key, render: (value: unknown, record: RecordType) => field.key === 'deceasedFullName' ? <Button type="link" onClick={() => openDetails(record)}>{String(value || 'View details')}</Button> : <span dir="auto" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value === '' || value == null ? '—' : String(value)}</span> }));
  return <div className="families-page grave-record-page">
    <header className="families-header families-page-heading">
      <div><div className="families-title-line"><h1>Grave Record</h1><span className="families-total">{records.length}</span></div><p>Burial records, family details and relative contacts.</p></div>
    </header>
    {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
    <Card className="families-panel" title="Grave directory">
      <div className="grave-directory-controls">
        <Input prefix={<Search size={16} />} aria-label="Search grave records" placeholder="Search in English or Urdu, grave number or contact" allowClear value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} />
        <Select aria-label="Filter by gender" value={gender} onChange={value => { setGender(value); setPage(1); }} options={[{ value: 'all', label: 'All genders' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} />
        <Select aria-label="Sort grave records" value={sortField} onChange={value => { setSortField(value); setPage(1); }} options={[{ value: 'graveNumber', label: 'Grave number' }, { value: 'deceasedFullName', label: 'Name' }, { value: 'dateOfDeath', label: 'Date of death' }]} />
      </div>
      <div className="families-view-toolbar"><span className="families-view-label">{filtered.length} records</span><Segmented value={viewMode} onChange={value => setViewMode(value as 'cards' | 'list')} options={[{ value: 'cards', label: <span className="families-view-option"><LayoutGrid size={15} />Cards</span> }, { value: 'list', label: <span className="families-view-option"><List size={15} />List</span> }]} /></div>
      {viewMode === 'list' ? <Table<RecordType> className="families-list" rowKey="id" columns={columns} dataSource={filtered} loading={loading} scroll={{ x: 2010 }} pagination={{ current: page, pageSize, onChange: (next, size) => { setPage(next); setPageSize(size); }, showSizeChanger: true, showTotal: total => `${total} records` }} locale={{ emptyText: error ? 'Records could not be loaded.' : 'No matching grave records.' }} /> : loading ? <div className="people-loading"><Spin /></div> : filtered.length ? <>
        <div className="family-search-grid families-card-grid">{filtered.slice((page - 1) * pageSize, page * pageSize).map(record => <button key={record.id} className="family-search-card grave-directory-card" onClick={() => openDetails(record)}>
          <div className="family-card-top"><span className="family-house grave-record-icon"><BookOpen size={20} /></span><span className="family-number">Grave {record.graveNumber || 'number not recorded'}</span><ArrowRight size={17} /></div>
          <strong className="family-card-name" dir="auto">{record.deceasedFullName}</strong>
          {hasFamilyName(record.parentNames) && <span className="family-card-head">Parent: <bdi>{record.parentNames}</bdi></span>}
          {hasFamilyName(record.husbandName) && <span className="family-card-head">Husband: <bdi>{record.husbandName}</bdi></span>}
          <div className="family-card-bottom"><span className="family-card-members">{record.dateOfDeath || 'Date not recorded'}</span><span className="family-status muted">{record.ageAtDeath == null ? record.gender || 'Not recorded' : `Age ${record.ageAtDeath}`}</span></div>
          <span className="family-card-preview" dir="auto">{record.relativeContact || 'Contact not recorded'}</span>
        </button>)}</div>
        <Pagination className="families-pagination" current={page} pageSize={pageSize} total={filtered.length} showSizeChanger onChange={(next, size) => { setPage(next); setPageSize(size); }} />
      </> : <Empty description={error ? 'Records could not be loaded.' : query || gender !== 'all' ? 'No matching grave records.' : 'No grave records yet.'} />}
    </Card>
    <Modal title={editing ? 'Edit grave record' : selected?.deceasedFullName || 'Grave details'} open={!!selected} onCancel={() => { if (!updating) { setSelected(null); setEditing(false); } }} closable={!updating} maskClosable={!editing} keyboard={!updating} footer={editing ? [
      <Button key="cancel" disabled={updating} onClick={() => setEditing(false)}>Cancel</Button>,
      <Button key="save" type="primary" loading={updating} onClick={() => editForm.submit()}>Save changes</Button>,
    ] : [
      <Button key="close" onClick={() => setSelected(null)}>Close</Button>,
      <Button key="edit" type="primary" icon={<EditOutlined />} onClick={() => { editForm.setFieldsValue(selected!); setEditing(true); }}>Edit</Button>,
    ]} width={760}>
      {editing ? <Form form={editForm} layout="vertical" onFinish={saveDetails} disabled={updating}>
        {fields.map(field => <Form.Item key={field.key} name={field.key} label={field.title} rules={field.key === 'deceasedFullName' ? [{ required: true, whitespace: true, message: 'Enter the deceased name.' }] : undefined}>
          {field.key === 'ageAtDeath' ? <InputNumber min={0} style={{ width: '100%' }} /> : field.key === 'gender' ? <Select allowClear options={Array.from(new Set(['Male', 'Female', 'Other', selected?.gender].filter((value): value is string => !!value))).map(value => ({ value, label: value }))} /> : field.key === 'notes' ? <Input.TextArea rows={4} dir="auto" /> : <Input dir="auto" placeholder={field.key === 'dateOfBirth' || field.key === 'dateOfDeath' ? 'YYYY-MM-DD' : undefined} />}
        </Form.Item>)}
      </Form> : <Descriptions bordered column={1} size="small" items={fields.filter(field => field.key !== 'deceasedFullName').map(field => ({ key: field.key, label: field.title, children: <span dir="auto" className="grave-detail-value">{selected?.[field.key] === '' || selected?.[field.key] == null ? '—' : String(selected[field.key])}</span> }))} />}
    </Modal>

  </div>;
}

