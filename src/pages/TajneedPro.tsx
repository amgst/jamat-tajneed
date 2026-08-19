import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    App,
    Avatar,
    Button,
    Card,
    Col,
    Input,
    Modal,
    Popconfirm,
    Progress,
    Row,
    Segmented,
    Select,
    Space,
    Table,
    Tag,
    Tooltip,
    Typography
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
    DeleteOutlined,
    DownloadOutlined,
    EditOutlined,
    EyeOutlined,
    FilePdfOutlined,
    HeartOutlined,
    HomeOutlined,
    ManOutlined,
    PlusOutlined,
    ReloadOutlined,
    SearchOutlined,
    SendOutlined,
    TeamOutlined,
    UserOutlined,
    WomanOutlined
} from '@ant-design/icons';
import MemberForm from '../components/MemberForm';
import { ApiService } from '../services/apiService';
import type { Family, Member } from '../types';
import { calculateAge, determineTanzeem, getTanzeemDisplayName, exportToPDF } from '../utils/helpers';
import { generateAvatarFromName } from '../utils/imageUtils';
import { validateMemberData, sanitizeMemberData } from '../utils/validation';

const { Text, Title } = Typography;

type MemberStatus = 'active' | 'deceased' | 'moved' | 'b-list';

interface MemberRow {
    key: string;
    member: Member;
    familyName: string;
    familyNumber?: number;
    halqa: string;
    status: MemberStatus;
}

const TANZEEM_COLORS: Record<string, string> = {
    'ansar': 'gold',
    'khuddam': 'green',
    'lajna': 'magenta',
    'atfal': 'blue',
    'nasirat': 'purple',
    'saf-e-awal': 'cyan',
    'saf-e-awal-girls': 'pink'
};

const MARITAL_LABELS: Record<string, { label: string; color: string }> = {
    'married': { label: 'Married', color: 'green' },
    'unmarried': { label: 'Unmarried', color: 'default' },
    'divorced': { label: 'Divorced', color: 'orange' },
    'widower': { label: 'Widower', color: 'volcano' },
    'widow': { label: 'Widow', color: 'volcano' }
};

const memberStatus = (m: Member): MemberStatus => {
    if (m.isBList) return 'b-list';
    if (m.isDeceased) return 'deceased';
    if (m.isMoved) return 'moved';
    return 'active';
};

const memberSlug = (m: Member) =>
    `${m.name.toLowerCase().trim().replace(/\s+/g, '-')}-${m.id}`;

const TajneedPro: React.FC = () => {
    const { message } = App.useApp();
    const navigate = useNavigate();

    // ---------- State ----------
    const [loading, setLoading] = useState(false);
    const [members, setMembers] = useState<Member[]>([]);
    const [families, setFamilies] = useState<Family[]>([]);
    const [reloadKey, setReloadKey] = useState(0);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<MemberStatus>('active');
    const [tanzeemFilter, setTanzeemFilter] = useState<string | undefined>(undefined);
    const [familyFilter, setFamilyFilter] = useState<string | undefined>(undefined);
    const [genderFilter, setGenderFilter] = useState<'male' | 'female' | undefined>(undefined);
    const [viewMode, setViewMode] = useState<'members' | 'families'>('members');

    // Edit modal
    const [modalVisible, setModalVisible] = useState(false);
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // ---------- Data loading ----------
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const [membersData, familiesData] = await Promise.all([
                    ApiService.getAllMembers(),
                    ApiService.getAllFamilies()
                ]);
                if (cancelled) return;
                setMembers(membersData);
                setFamilies(familiesData);
            } catch (error) {
                if (!cancelled) {
                    console.error('Failed to load tajneed data:', error);
                    message.error('Failed to load data');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reloadKey]);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchTerm.trim().toLowerCase()), 250);
        return () => clearTimeout(t);
    }, [searchTerm]);

    // ---------- Lookups & rows ----------
    const familyById = useMemo(() => {
        const map = new Map<string, Family>();
        families.forEach(f => map.set(f.id, f));
        return map;
    }, [families]);

    const allRows = useMemo<MemberRow[]>(() => {
        return members.map(m => {
            const family = m.familyId ? familyById.get(m.familyId) : undefined;
            return {
                key: m.id,
                member: m,
                familyName: family?.familyName || '-',
                familyNumber: family?.familyNumber,
                halqa: m.halqa || family?.halqa || '',
                status: memberStatus(m)
            };
        });
    }, [members, familyById]);

    // Rows after search + dropdown filters (status applied separately so counts stay live)
    const preStatusRows = useMemo(() => {
        let rows = allRows;
        if (debouncedSearch) {
            rows = rows.filter(r => {
                const m = r.member;
                return (
                    m.name.toLowerCase().includes(debouncedSearch) ||
                    (m.fatherName || '').toLowerCase().includes(debouncedSearch) ||
                    (m.husbandName || '').toLowerCase().includes(debouncedSearch) ||
                    (m.phone || '').toLowerCase().includes(debouncedSearch) ||
                    (m.wasitNo || '').toLowerCase().includes(debouncedSearch) ||
                    r.familyName.toLowerCase().includes(debouncedSearch) ||
                    r.halqa.toLowerCase().includes(debouncedSearch)
                );
            });
        }
        if (tanzeemFilter) rows = rows.filter(r => r.member.tanzeem === tanzeemFilter);
        if (familyFilter) rows = rows.filter(r => r.member.familyId === familyFilter);
        if (genderFilter) rows = rows.filter(r => r.member.gender === genderFilter);
        return rows;
    }, [allRows, debouncedSearch, tanzeemFilter, familyFilter, genderFilter]);

    const statusCounts = useMemo(() => {
        const counts: Record<MemberStatus, number> = { 'active': 0, 'deceased': 0, 'moved': 0, 'b-list': 0 };
        preStatusRows.forEach(r => { counts[r.status] += 1; });
        return counts;
    }, [preStatusRows]);

    const filteredRows = useMemo(
        () => preStatusRows.filter(r => r.status === statusFilter),
        [preStatusRows, statusFilter]
    );

    // ---------- KPIs (whole dataset, not filtered) ----------
    const kpis = useMemo(() => {
        const active = allRows.filter(r => r.status === 'active').map(r => r.member);
        const males = active.filter(m => m.gender === 'male').length;
        const females = active.length - males;
        const children = active.filter(m => (m.age ?? 0) < 15).length;
        const avgAge = active.length > 0
            ? active.reduce((sum, m) => sum + (m.age || 0), 0) / active.length
            : 0;
        const activeFamilies = families.filter(f => !f.isMoved && !f.isBList).length;
        const deceased = allRows.filter(r => r.status === 'deceased').length;
        const moved = allRows.filter(r => r.status === 'moved').length;
        const bList = allRows.filter(r => r.status === 'b-list').length;
        return { active: active.length, males, females, children, avgAge, activeFamilies, deceased, moved, bList };
    }, [allRows, families]);

    const tanzeemDistribution = useMemo(() => {
        const counts = new Map<string, number>();
        allRows
            .filter(r => r.status === 'active')
            .forEach(r => {
                const t = r.member.tanzeem || 'unknown';
                counts.set(t, (counts.get(t) || 0) + 1);
            });
        const total = [...counts.values()].reduce((a, b) => a + b, 0);
        return [...counts.entries()]
            .map(([tanzeem, count]) => ({
                tanzeem,
                count,
                percent: total > 0 ? Math.round((count / total) * 100) : 0
            }))
            .sort((a, b) => b.count - a.count);
    }, [allRows]);

    // ---------- Filter options ----------
    const tanzeemOptions = useMemo(() => {
        const set = new Set(allRows.map(r => r.member.tanzeem).filter(Boolean));
        return [...set].sort().map(t => ({ value: t, label: getTanzeemDisplayName(t) }));
    }, [allRows]);

    const familyOptions = useMemo(() =>
        [...families]
            .sort((a, b) => (a.familyNumber || 999999) - (b.familyNumber || 999999))
            .map(f => ({
                value: f.id,
                label: f.familyNumber ? `${f.familyNumber}. ${f.familyName}` : f.familyName
            })),
        [families]
    );

    // ---------- Family grouping ----------
    const familyGroups = useMemo(() => {
        const groups = new Map<string, { family: Family; rows: MemberRow[] }>();
        filteredRows.forEach(row => {
            const family = row.member.familyId ? familyById.get(row.member.familyId) : undefined;
            if (!family) return;
            if (!groups.has(family.id)) groups.set(family.id, { family, rows: [] });
            groups.get(family.id)!.rows.push(row);
        });
        return [...groups.values()]
            .map(g => ({
                key: g.family.id,
                family: g.family,
                rows: g.rows,
                total: g.rows.length,
                males: g.rows.filter(r => r.member.gender === 'male').length,
                females: g.rows.filter(r => r.member.gender === 'female').length,
                children: g.rows.filter(r => (r.member.age ?? 0) < 15).length
            }))
            .sort((a, b) => (a.family.familyNumber || 999999) - (b.family.familyNumber || 999999));
    }, [filteredRows, familyById]);

    // ---------- Actions ----------
    const handleSaveMember = async (values: {
        name: string; fatherName?: string; husbandName?: string; gender: 'male' | 'female';
        dateOfBirth: { format: (f: string) => string }; dateOfDeath?: { format: (f: string) => string };
        phone?: string | number; address: string; profilePhoto?: string;
        isDeceased?: boolean; isMoved?: boolean; movedTo?: string; isBList?: boolean;
        isBaitByBirth?: boolean; baitYear?: number; wasitNo?: string; education?: string;
        bloodGroup?: string; waqfeNauNumber?: string; maritalStatus?: string; isMarried?: boolean;
    }) => {
        try {
            setIsSaving(true);
            const age = calculateAge(values.dateOfBirth.format('YYYY-MM-DD'));
            const tanzeem = determineTanzeem(age, values.gender);

            const memberDataRaw: Record<string, unknown> = {
                name: values.name,
                fatherName: values.fatherName || '',
                husbandName: values.husbandName || '',
                gender: values.gender,
                dateOfBirth: values.dateOfBirth.format('YYYY-MM-DD'),
                age,
                phone: values.phone && String(values.phone).trim() ? String(values.phone).trim() : '',
                address: values.address,
                tanzeem,
                halqa: editingMember?.halqa || '',
                profilePhoto: values.profilePhoto || generateAvatarFromName(values.name),
                hasNewTanzeemTransition: false,
                isDeceased: values.isDeceased || false,
                isMoved: values.isMoved || false,
                movedTo: values.movedTo || '',
                isBList: values.isBList || false,
                isBaitByBirth: values.isBaitByBirth,
                baitYear: values.isBaitByBirth ? undefined : values.baitYear,
                wasitNo: values.wasitNo || '',
                education: values.education || '',
                bloodGroup: values.bloodGroup || '',
                waqfeNauNumber: values.waqfeNauNumber || '',
                maritalStatus: values.maritalStatus || (values.isMarried ? 'married' : 'unmarried'),
                isMarried: values.maritalStatus ? values.maritalStatus === 'married' : !!values.isMarried,
                createdAt: editingMember ? editingMember.createdAt : new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            if (values.dateOfDeath) {
                memberDataRaw.dateOfDeath = values.dateOfDeath.format('YYYY-MM-DD');
            }

            const validation = validateMemberData(memberDataRaw);
            if (!validation.valid) {
                message.error(`Validation failed: ${validation.errors.join(', ')}`);
                return;
            }
            const memberData = sanitizeMemberData(memberDataRaw);

            if (editingMember) {
                await ApiService.updateMember(editingMember.id, memberData);
                setMembers(prev => prev.map(m => m.id === editingMember.id ? { ...m, ...memberData, id: m.id } as Member : m));
                message.success('Member updated successfully');
            } else {
                const created = await ApiService.createMember(memberData);
                setMembers(prev => created ? [...prev, created] : prev);
                message.success('Member added successfully');
            }
            setModalVisible(false);
            setEditingMember(null);
        } catch (error) {
            console.error('Save member failed:', error);
            message.error('Failed to save member');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteMember = async (member: Member) => {
        try {
            await ApiService.deleteMember(member.id);
            setMembers(prev => prev.filter(m => m.id !== member.id));
            message.success(`${member.name} deleted`);
        } catch (error) {
            console.error('Delete member failed:', error);
            message.error('Failed to delete member');
        }
    };

    const handleExportCSV = () => {
        const header = ['Name', 'Father Name', 'Husband Name', 'Gender', 'Date of Birth', 'Age', 'Tanzeem', 'Marital Status', 'Family', 'Halqa', 'Phone', 'Wasit No', 'Address', 'Status'];
        const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const lines = filteredRows.map(r => [
            r.member.name, r.member.fatherName, r.member.husbandName, r.member.gender,
            r.member.dateOfBirth, r.member.age, getTanzeemDisplayName(r.member.tanzeem),
            r.member.maritalStatus || '', r.familyName, r.halqa, r.member.phone,
            r.member.wasitNo, r.member.address, r.status
        ].map(escape).join(','));
        const bom = String.fromCharCode(0xFEFF);
        const csv = bom + [header.map(escape).join(','), ...lines].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tajneed_${statusFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        message.success('CSV exported');
    };

    const handleExportPDF = async () => {
        const rows = filteredRows.map((r, i) => ({
            no: i + 1,
            name: r.member.name,
            father: r.member.fatherName || r.member.husbandName || '-',
            family: r.familyName,
            age: r.member.age,
            tanzeem: getTanzeemDisplayName(r.member.tanzeem),
            phone: r.member.phone || '-'
        }));
        await exportToPDF(
            rows,
            ['no', 'name', 'father', 'family', 'age', 'tanzeem', 'phone'],
            `tajneed_${statusFilter}_report`,
            `Tajneed - ${statusFilter.toUpperCase()} Members Report`
        );
        message.success('PDF exported');
    };

    // ---------- Columns ----------
    const memberColumns: ColumnsType<MemberRow> = [
        {
            title: 'Member',
            key: 'name',
            fixed: 'left',
            sorter: (a, b) => a.member.name.localeCompare(b.member.name),
            render: (_, row) => (
                <Space size={10}>
                    <Avatar src={row.member.profilePhoto || undefined} icon={<UserOutlined />} size={38} />
                    <div style={{ minWidth: 140 }}>
                        <Space size={6}>
                            <Text strong>{row.member.name}</Text>
                            {row.status === 'deceased' && <Tag color="default" style={{ marginInlineEnd: 0 }}>Marhoom</Tag>}
                            {row.status === 'moved' && <Tag color="orange" style={{ marginInlineEnd: 0 }}>Moved</Tag>}
                            {row.status === 'b-list' && <Tag color="red" style={{ marginInlineEnd: 0 }}>B-List</Tag>}
                        </Space>
                        <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                {row.member.fatherName
                                    ? `S/O ${row.member.fatherName}`
                                    : row.member.husbandName
                                        ? `W/O ${row.member.husbandName}`
                                        : ''}
                            </Text>
                        </div>
                    </div>
                </Space>
            )
        },
        {
            title: 'Family',
            key: 'family',
            responsive: ['md'],
            sorter: (a, b) => (a.familyNumber || 999999) - (b.familyNumber || 999999),
            render: (_, row) => (
                <div>
                    <Text>{row.familyNumber ? `${row.familyNumber}. ` : ''}{row.familyName}</Text>
                    {row.halqa && (
                        <div><Text type="secondary" style={{ fontSize: 12 }}>{row.halqa}</Text></div>
                    )}
                </div>
            )
        },
        {
            title: 'Age',
            key: 'age',
            width: 80,
            sorter: (a, b) => (a.member.age || 0) - (b.member.age || 0),
            render: (_, row) => (
                <Tooltip title={`DOB: ${row.member.dateOfBirth || '-'}`}>
                    <Text>{row.member.age ?? '-'}</Text>
                </Tooltip>
            )
        },
        {
            title: 'Tanzeem',
            key: 'tanzeem',
            sorter: (a, b) => (a.member.tanzeem || '').localeCompare(b.member.tanzeem || ''),
            render: (_, row) => (
                <Tag color={TANZEEM_COLORS[row.member.tanzeem] || 'default'}>
                    {getTanzeemDisplayName(row.member.tanzeem)}
                </Tag>
            )
        },
        {
            title: 'Marital',
            key: 'marital',
            responsive: ['lg'],
            render: (_, row) => {
                const meta = row.member.maritalStatus ? MARITAL_LABELS[row.member.maritalStatus] : undefined;
                return meta ? <Tag color={meta.color}>{meta.label}</Tag> : <Text type="secondary">-</Text>;
            }
        },
        {
            title: 'Phone',
            key: 'phone',
            responsive: ['lg'],
            render: (_, row) => row.member.phone
                ? <Text copyable style={{ whiteSpace: 'nowrap' }}>{row.member.phone}</Text>
                : <Text type="secondary">-</Text>
        },
        {
            title: 'Wasit #',
            key: 'wasit',
            responsive: ['xl'],
            render: (_, row) => row.member.wasitNo || <Text type="secondary">-</Text>
        },
        {
            title: 'Actions',
            key: 'actions',
            fixed: 'right',
            width: 130,
            render: (_, row) => (
                <Space size={4}>
                    <Tooltip title="View full details">
                        <Button
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => navigate(`/members/${memberSlug(row.member)}`)}
                        />
                    </Tooltip>
                    <Tooltip title="Edit">
                        <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => { setEditingMember(row.member); setModalVisible(true); }}
                        />
                    </Tooltip>
                    <Popconfirm
                        title={`Delete ${row.member.name}?`}
                        description="This cannot be undone."
                        onConfirm={() => handleDeleteMember(row.member)}
                        okText="Delete"
                        okButtonProps={{ danger: true }}
                    >
                        <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    const kpiTiles = [
        { label: 'Active Members', value: `${kpis.active}`, sub: `Avg age ${kpis.avgAge.toFixed(0)}`, icon: <TeamOutlined />, color: '#0f766e', bg: '#e6fffb' },
        { label: 'Families', value: `${kpis.activeFamilies}`, icon: <HomeOutlined />, color: '#0958d9', bg: '#e6f4ff' },
        { label: 'Male', value: `${kpis.males}`, icon: <ManOutlined />, color: '#1d39c4', bg: '#f0f5ff' },
        { label: 'Female', value: `${kpis.females}`, icon: <WomanOutlined />, color: '#c41d7f', bg: '#fff0f6' },
        { label: 'Children (< 15)', value: `${kpis.children}`, icon: <UserOutlined />, color: '#d46b08', bg: '#fff7e6' },
        { label: 'Deceased / Moved', value: `${kpis.deceased} / ${kpis.moved}`, sub: `${kpis.bList} on B-List`, icon: <HeartOutlined />, color: '#cf1322', bg: '#fff1f0' }
    ];

    // ---------- Render ----------
    return (
        <div style={{ padding: '0 8px 80px', width: '100%', boxSizing: 'border-box' }}>
            {/* Hero header */}
            <div
                style={{
                    background: 'linear-gradient(135deg, #064e3b 0%, #0f766e 55%, #14b8a6 100%)',
                    borderRadius: 16,
                    padding: '20px 24px',
                    marginBottom: 16,
                    color: 'white'
                }}
            >
                <Row gutter={[12, 12]} align="middle" justify="space-between">
                    <Col xs={24} md={10}>
                        <Title level={3} style={{ color: 'white', margin: 0 }}>Tajneed</Title>
                        <Text style={{ color: 'rgba(255,255,255,0.75)' }}>
                            Member records workspace
                        </Text>
                    </Col>
                    <Col xs={24} md={14}>
                        <Row gutter={[8, 8]} justify="end">
                            <Col>
                                <Button icon={<ReloadOutlined />} onClick={() => setReloadKey(k => k + 1)} loading={loading}>
                                    Refresh
                                </Button>
                            </Col>
                            <Col>
                                <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>CSV</Button>
                            </Col>
                            <Col>
                                <Button icon={<FilePdfOutlined />} onClick={handleExportPDF}>PDF</Button>
                            </Col>
                            <Col>
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    style={{ background: '#052e2b', borderColor: '#052e2b' }}
                                    onClick={() => { setEditingMember(null); setModalVisible(true); }}
                                >
                                    Add Member
                                </Button>
                            </Col>
                        </Row>
                    </Col>
                </Row>
            </div>

            {/* KPI tiles */}
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                {kpiTiles.map(tile => (
                    <Col xs={12} sm={12} md={8} xl={4} key={tile.label}>
                        <Card styles={{ body: { padding: 14 } }} style={{ borderRadius: 12, height: '100%' }}>
                            <Space align="start" size={10}>
                                <div
                                    style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 10,
                                        background: tile.bg,
                                        color: tile.color,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 16,
                                        flexShrink: 0
                                    }}
                                >
                                    {tile.icon}
                                </div>
                                <div>
                                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{tile.label}</Text>
                                    <Text strong style={{ fontSize: 16 }}>{tile.value}</Text>
                                    {tile.sub && (
                                        <div><Text type="secondary" style={{ fontSize: 11 }}>{tile.sub}</Text></div>
                                    )}
                                </div>
                            </Space>
                        </Card>
                    </Col>
                ))}
            </Row>

            {/* Tanzeem distribution */}
            <Card
                title={<Text strong>Tanzeem Distribution (Active Members)</Text>}
                style={{ borderRadius: 12, marginBottom: 16 }}
                styles={{ body: { padding: '12px 16px' } }}
            >
                <Row gutter={[16, 8]}>
                    {tanzeemDistribution.map(t => (
                        <Col xs={12} sm={8} md={6} xl={3} key={t.tanzeem}>
                            <Text style={{ fontSize: 12 }}>
                                {getTanzeemDisplayName(t.tanzeem)} <Text type="secondary">({t.count})</Text>
                            </Text>
                            <Progress
                                percent={t.percent}
                                size="small"
                                strokeColor="#0f766e"
                                format={(p) => `${p}%`}
                            />
                        </Col>
                    ))}
                </Row>
            </Card>

            {/* Toolbar */}
            <Card style={{ borderRadius: 12, marginBottom: 16 }} styles={{ body: { padding: 12 } }}>
                <Row gutter={[8, 8]} align="middle">
                    <Col xs={24} md={8}>
                        <Input
                            prefix={<SearchOutlined />}
                            placeholder="Search name, father, family, phone, wasit..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            allowClear
                        />
                    </Col>
                    <Col xs={12} md={4}>
                        <Select
                            placeholder="Tanzeem"
                            value={tanzeemFilter}
                            onChange={setTanzeemFilter}
                            options={tanzeemOptions}
                            allowClear
                            style={{ width: '100%' }}
                        />
                    </Col>
                    <Col xs={12} md={5}>
                        <Select
                            placeholder="Family"
                            value={familyFilter}
                            onChange={setFamilyFilter}
                            options={familyOptions}
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            style={{ width: '100%' }}
                        />
                    </Col>
                    <Col xs={12} md={3}>
                        <Select
                            placeholder="Gender"
                            value={genderFilter}
                            onChange={setGenderFilter}
                            options={[
                                { value: 'male', label: 'Male' },
                                { value: 'female', label: 'Female' }
                            ]}
                            allowClear
                            style={{ width: '100%' }}
                        />
                    </Col>
                    <Col xs={12} md={4} style={{ textAlign: 'right' }}>
                        <Segmented
                            value={viewMode}
                            onChange={(v) => setViewMode(v as 'members' | 'families')}
                            options={[
                                { value: 'members', label: 'Members', icon: <UserOutlined /> },
                                { value: 'families', label: 'Families', icon: <TeamOutlined /> }
                            ]}
                        />
                    </Col>
                    <Col span={24}>
                        <Segmented
                            block
                            value={statusFilter}
                            onChange={(v) => setStatusFilter(v as MemberStatus)}
                            options={[
                                { value: 'active', label: `Active (${statusCounts['active']})` },
                                { value: 'deceased', label: `Deceased (${statusCounts['deceased']})` },
                                { value: 'moved', label: `Moved (${statusCounts['moved']})` },
                                { value: 'b-list', label: `B-List (${statusCounts['b-list']})` }
                            ]}
                        />
                    </Col>
                </Row>
            </Card>

            {/* Main content */}
            {viewMode === 'members' ? (
                <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 0 } }}>
                    <Table<MemberRow>
                        dataSource={filteredRows}
                        columns={memberColumns}
                        rowKey="key"
                        loading={loading}
                        size="middle"
                        scroll={{ x: 'max-content' }}
                        pagination={{
                            defaultPageSize: 25,
                            showSizeChanger: true,
                            pageSizeOptions: ['25', '50', '100', '200'],
                            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} members`
                        }}
                    />
                </Card>
            ) : (
                <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 0 } }}>
                    <Table
                        dataSource={familyGroups}
                        rowKey="key"
                        loading={loading}
                        size="middle"
                        scroll={{ x: 'max-content' }}
                        pagination={{
                            defaultPageSize: 25,
                            showSizeChanger: true,
                            pageSizeOptions: ['25', '50', '100'],
                            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} families`
                        }}
                        columns={[
                            {
                                title: '#',
                                key: 'familyNumber',
                                width: 60,
                                sorter: (a: typeof familyGroups[number], b: typeof familyGroups[number]) =>
                                    (a.family.familyNumber || 999999) - (b.family.familyNumber || 999999),
                                render: (_: unknown, g: typeof familyGroups[number]) => g.family.familyNumber || '-'
                            },
                            {
                                title: 'Family',
                                key: 'familyName',
                                sorter: (a: typeof familyGroups[number], b: typeof familyGroups[number]) =>
                                    a.family.familyName.localeCompare(b.family.familyName),
                                render: (_: unknown, g: typeof familyGroups[number]) => (
                                    <div>
                                        <Text strong>{g.family.familyName}</Text>
                                        {g.family.halqa && (
                                            <div><Text type="secondary" style={{ fontSize: 12 }}>{g.family.halqa}</Text></div>
                                        )}
                                    </div>
                                )
                            },
                            {
                                title: 'Members',
                                dataIndex: 'total',
                                key: 'total',
                                align: 'center' as const,
                                sorter: (a: typeof familyGroups[number], b: typeof familyGroups[number]) => a.total - b.total,
                                render: (v: number) => <Tag color="blue">{v}</Tag>
                            },
                            {
                                title: 'Male',
                                dataIndex: 'males',
                                key: 'males',
                                align: 'center' as const,
                                render: (v: number) => v || '-'
                            },
                            {
                                title: 'Female',
                                dataIndex: 'females',
                                key: 'females',
                                align: 'center' as const,
                                render: (v: number) => v || '-'
                            },
                            {
                                title: 'Children',
                                dataIndex: 'children',
                                key: 'children',
                                align: 'center' as const,
                                render: (v: number) => v || '-'
                            },
                            {
                                title: 'Actions',
                                key: 'actions',
                                width: 100,
                                render: (_: unknown, g: typeof familyGroups[number]) => (
                                    <Tooltip title="Open family page">
                                        <Button
                                            size="small"
                                            icon={<SendOutlined />}
                                            onClick={() => navigate(`/families/${g.family.id}`)}
                                        />
                                    </Tooltip>
                                )
                            }
                        ]}
                        expandable={{
                            expandedRowRender: (g: typeof familyGroups[number]) => (
                                <Table<MemberRow>
                                    dataSource={g.rows}
                                    columns={memberColumns.filter(c => c.key !== 'family')}
                                    rowKey="key"
                                    size="small"
                                    pagination={false}
                                    scroll={{ x: 'max-content' }}
                                />
                            )
                        }}
                    />
                </Card>
            )}

            {/* Add / Edit member modal */}
            <Modal
                title={editingMember ? `Edit Member — ${editingMember.name}` : 'Add New Member'}
                open={modalVisible}
                onCancel={() => { setModalVisible(false); setEditingMember(null); }}
                footer={null}
                width={720}
                destroyOnClose
            >
                <MemberForm
                    initialValues={editingMember || undefined}
                    onFinish={handleSaveMember}
                    isSaving={isSaving}
                    familyHalqa={editingMember
                        ? families.find(f => f.memberIds.includes(editingMember.id))?.halqa
                        : undefined}
                    showCancel
                    onCancel={() => { setModalVisible(false); setEditingMember(null); }}
                    existingMembers={members}
                />
            </Modal>
        </div>
    );
};

export default TajneedPro;
