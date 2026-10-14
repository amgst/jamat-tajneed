import useMemberNavigation from '../hooks/useMemberNavigation';
import { useEffect, useState } from 'react';
import { Empty, Pagination, Segmented, Spin, Table } from 'antd';
import type { TableProps } from 'antd';
import { ArrowRight, LayoutGrid, List } from 'lucide-react';

import type { Member } from '../types';
import { getTanzeemDisplayName } from '../utils/helpers';
import { getRecordedPhone } from '../utils/phone';
import '../pages/Families.css';
import './MembershipRecords.css';

export default function MembershipRecords({ members, columns, loading, kind, hideCount = false }: {
  members: Member[]; columns: TableProps<Member>['columns']; loading: boolean; kind: 'mossi' | 'waqfe-nau' | 'tanzeem'; hideCount?: boolean;
}) {

  const openMember = useMemberNavigation();
  const [view, setView] = useState<'cards' | 'list'>('cards');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const memberIds = members.map(member => member.id).join(',');
  useEffect(() => { setPage(1); }, [memberIds]);
  const pagination = { current: page, pageSize: size, total: members.length, hideOnSinglePage: true, responsive: true, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100], onChange: (next: number, nextSize: number) => { setPage(size !== nextSize ? 1 : next); setSize(nextSize); } };
  return <>
    <div className="families-view-toolbar"><span className="families-view-label">{!hideCount && `${members.length} members`}</span><Segmented value={view} onChange={value => setView(value as 'cards' | 'list')} options={[{ value: 'cards', label: <span className="families-view-option"><LayoutGrid size={16} />Cards</span> }, { value: 'list', label: <span className="families-view-option"><List size={16} />List</span> }]} /></div>
    <Spin spinning={loading}>
      {!members.length && !loading ? <Empty description="No matching members" /> : view === 'list' ? <Table columns={columns} dataSource={members} rowKey="id" size="small" pagination={pagination} scroll={{ x: 650 }} /> : <>
        <div className="membership-record-grid">{members.slice((page - 1) * size, page * size).map(member => <button className="membership-record-card" key={member.id} onClick={() => openMember(member.id)}>
          <div className="membership-record-name"><strong dir="auto">{member.name}</strong><small>{member.age} yrs</small><ArrowRight size={17} /></div>
          {(member.husbandName || member.fatherName) && <span>{member.husbandName ? `Husband: ${member.husbandName}` : `Father: ${member.fatherName}`}</span>}
          {kind !== 'tanzeem' && <span className="membership-record-number">{kind === 'mossi' ? 'Musi number' : 'Waqf-e-Nau number'}: <strong>{kind === 'mossi' ? member.wasitNo : member.waqfeNauNumber}</strong></span>}
          {getRecordedPhone(member.phone) && <span>{getRecordedPhone(member.phone)}</span>}
          <div className="membership-record-footer"><span>{getTanzeemDisplayName(member.tanzeem)}</span><span>{member.isDeceased ? 'Deceased' : member.isMoved ? 'Moved' : member.isBList ? 'B List' : 'Active'}</span></div>
        </button>)}</div>
        {members.length > size && <Pagination className="families-pagination" {...pagination} />}
      </>}
    </Spin>
  </>;
}
