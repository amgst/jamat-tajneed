import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Tag,
  Avatar,
  Grid,
  Empty,
  Spin,
  Popconfirm,
  Modal,
  Select,
  Form,
  Input,

  Tabs,
  App
} from 'antd';
import {
  ArrowLeftOutlined,
  UserOutlined,
  DownloadOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { ApiService } from '../services/apiService';
import ReligiousActivitiesModal from '../components/ReligiousActivitiesModal';
import { getTanzeemDisplayName, formatDate, calculateAge, determineTanzeem } from '../utils/helpers';
import { generateAvatarFromName } from '../utils/imageUtils';
import type { Family, Member } from '../types';
import { validateMemberData, sanitizeMemberData } from '../utils/validation';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import MemberForm from '../components/MemberForm';
import { House, MapPin, Users, Search } from 'lucide-react';
import './PeopleHome.css';
import './FamilyDetails.css';
const { Title, Text } = Typography;
const { Option } = Select;

const FamilyDetails: React.FC = () => {
  const { message } = App.useApp();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const [family, setFamily] = useState<Family | null>(null);
  const [familyMembers, setFamilyMembers] = useState<Member[]>([]);
  const [movedFamilyMembers, setMovedFamilyMembers] = useState<Member[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [allFamilies, setAllFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [addMemberModalVisible, setAddMemberModalVisible] = useState(false);
  const [memberDetailModalVisible, setMemberDetailModalVisible] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [religiousModalVisible, setReligiousModalVisible] = useState(false);
  const [selectedMemberForReligious, setSelectedMemberForReligious] = useState<Member | null>(null);
  const [form] = Form.useForm();
  const [memberQuery, setMemberQuery] = useState('');
  // Removed memberForm as it's now handled inside MemberForm component

  const loadFamilyData = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    try {
      const [familiesData, allMembersData] = await Promise.all([
        ApiService.getAllFamilies(),
        ApiService.getAllMembers()
      ]);

      const familyData = familiesData.find((f: Family) => f.id === id);

      if (familyData) {
        setFamily(familyData);
        setAllMembers(allMembersData);
        setAllFamilies(familiesData);
        // Get family members and ensure head is included
        let members = allMembersData.filter((member: Member) =>
          familyData.memberIds.includes(member.id)
        );

        // Ensure family head is included even if not in memberIds
        if (familyData.headId) {
          const headMember = allMembersData.find(member => member.id === familyData.headId);
          if (headMember && !members.find(m => m.id === familyData.headId)) {
            members = [...members, headMember];
          }
        }


        const sortedMembers = members.sort((a: Member, b: Member) => {
          // Head of family first
          if (a.id === familyData.headId) return -1;
          if (b.id === familyData.headId) return 1;

          // Wife second (female who is not head)
          const aIsWife = a.gender === 'female' && a.id !== familyData.headId;
          const bIsWife = b.gender === 'female' && b.id !== familyData.headId;
          if (aIsWife && !bIsWife) return -1;
          if (!aIsWife && bIsWife) return 1;

          // Then by tanzeem order
          const tanzeemOrder = ['ansar', 'lajna', 'khuddam', 'atfal', 'nasirat', 'saf-e-awal', 'saf-e-awal-girls'];
          const aIndex = tanzeemOrder.indexOf(a.tanzeem);
          const bIndex = tanzeemOrder.indexOf(b.tanzeem);

          if (aIndex !== bIndex) {
            return aIndex - bIndex;
          }

          // Finally by age (older first)
          return b.age - a.age;
        });

        // Separate active and moved members
        const activeMembers = sortedMembers.filter(member => !member.isMoved);
        const movedMembers = sortedMembers.filter(member => member.isMoved);

        setFamilyMembers(activeMembers);
        setMovedFamilyMembers(movedMembers);
      } else {
        message.error('Family not found');
        navigate('/families');
      }
    } catch (error) {
      message.error('Failed to load family data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadFamilyData();
  }, [loadFamilyData]);

  const handleExportPDF = () => {
    if (!family) return;

    // Create new PDF document
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(18);
    doc.text(`${family.familyName} Family Members`, 14, 20);

    // Add generation date
    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);

    // Prepare table data
    const tableData = familyMembers.map((member, index) => [
      index + 1,
      member.name,
      member.husbandName ? `Husband: ${member.husbandName}` : member.fatherName || '',
      member.gender,
      member.age.toString(),
      formatDate(member.dateOfBirth),
      getTanzeemDisplayName(member.tanzeem),
      member.phone || ''
    ]);

    // Add table
    autoTable(doc, {
      head: [['S.No', 'Name', 'Father/Husband', 'Gender', 'Age', 'DOB', 'Tanzeem', 'Phone']],
      body: tableData,
      startY: 40,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [24, 144, 255] },
      alternateRowStyles: { fillColor: [240, 240, 240] },
      didDrawCell: (_data) => {
        // This helps with character encoding
        doc.setTextColor(0, 0, 0);
      }
    });

    // Save the PDF
    doc.save(`${family.familyName.toLowerCase().replace(/\s+/g, '_')}_members.pdf`);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!family) return;

    // Check if trying to remove family head
    if (memberId === family.headId) {
      message.error('Cannot remove family head. Please change family head first.');
      return;
    }

    try {
      // Update family by removing member ID
      const updatedMemberIds = family.memberIds.filter((id: string) => id !== memberId);
      const updatedFamily = {
        ...family,
        memberIds: updatedMemberIds,
        totalMembers: updatedMemberIds.length,
        updatedAt: new Date().toISOString(),
      };

      await ApiService.updateFamily(family.id, updatedFamily);
      message.success('Member removed from family successfully');

      // Reload family data
      loadFamilyData();
    } catch (error) {
      message.error('Failed to remove member from family');
      console.error(error);
    }
  };

  const handleAddMember = () => {
    setAddMemberModalVisible(true);
    form.resetFields();
  };



  const handleMemberUpdate = async (values: any) => {
    if (!selectedMember) return;

    try {
      // values are passed directly from MemberForm's onFinish
      const age = calculateAge(values.dateOfBirth.format('YYYY-MM-DD'));
      const tanzeem = determineTanzeem(age, values.gender);

      const memberDataRaw: any = {
        name: values.name,
        fatherName: values.fatherName || '',
        husbandName: values.husbandName || '',
        gender: values.gender,
        dateOfBirth: values.dateOfBirth.format('YYYY-MM-DD'),
        age,
        phone: values.phone && String(values.phone).trim() ? String(values.phone).trim() : '',
        address: values.address,
        tanzeem,
        halqa: '',
        profilePhoto: values.profilePhoto || generateAvatarFromName(values.name),
        hasNewTanzeemTransition: false,
        isDeceased: values.isDeceased || false,
        isMoved: values.isMoved || false,
        movedTo: values.movedTo || '',
        isBaitByBirth: values.isBaitByBirth,
        baitYear: values.isBaitByBirth ? undefined : values.baitYear,
        wasitNo: values.wasitNo || '',
        education: values.education || '',
        bloodGroup: values.bloodGroup || '',
        waqfeNauNumber: values.waqfeNauNumber || '',
        isBList: values.isBList || false,
        updatedAt: new Date().toISOString(),
      };

      // Preserve createdAt when updating
      memberDataRaw.createdAt = selectedMember?.createdAt || new Date().toISOString();

      if (values.dateOfDeath) {
        memberDataRaw.dateOfDeath = values.dateOfDeath.format('YYYY-MM-DD');
      }

      const validation = validateMemberData(memberDataRaw);
      if (!validation.valid) {
        message.error(`Validation failed: ${validation.errors.join(', ')}`);
        return;
      }

      const memberData = sanitizeMemberData(memberDataRaw);
      await ApiService.updateMember(selectedMember.id, memberData);
      message.success('Member updated successfully');
      setMemberDetailModalVisible(false);
      loadFamilyData();
    } catch (error) {
      message.error('Failed to update member');
      console.error(error);
    }
  };

  const handleAddMemberSubmit = async () => {
    if (!family) return;

    try {
      const values = await form.validateFields();
      const selectedMemberIds: string[] = values.memberIds;

      if (selectedMemberIds.length === 0) {
        message.error('Please select at least one member to add');
        return;
      }

      // Check for duplicates
      const duplicates = selectedMemberIds.filter(id => family.memberIds.includes(id));
      if (duplicates.length > 0) {
        message.error('Some selected members are already in this family');
        return;
      }

      // Update family with new members
      const updatedMemberIds = [...family.memberIds, ...selectedMemberIds];
      const updatedFamily = {
        ...family,
        memberIds: updatedMemberIds,
        totalMembers: updatedMemberIds.length,
        updatedAt: new Date().toISOString(),
      };

      await ApiService.updateFamily(family.id, updatedFamily);

      // If family is moved, ensure added members are also marked as moved and B List
      if (family.isMoved) {
        await Promise.all(selectedMemberIds.map(memberId =>
          ApiService.updateMember(memberId, {
            isMoved: true,
            movedTo: family.movedTo || '',
            isBList: true,
            updatedAt: new Date().toISOString()
          })
        ));
      }

      message.success(`${selectedMemberIds.length} member(s) added to family successfully`);

      setAddMemberModalVisible(false);
      // Reload family data
      loadFamilyData();
    } catch (error) {
      message.error('Failed to add members to family');
      console.error(error);
    }
  };

  // Get available members (not in current family)
  const getAvailableMembers = () => {
    if (!family) return allMembers;

    // Return all members that are not in the current family
    // This includes members with no family, members in other families, and deceased members
    const available = allMembers.filter(member => !family.memberIds.includes(member.id));

    // Sort by name for easier selection
    return available.sort((a, b) => a.name.localeCompare(b.name));
  };

  // Get the family name for a member (if they're in another family)
  const getMemberFamilyName = (memberId: string): string | null => {
    if (!family) return null;
    const memberFamily = allFamilies.find(f => f.memberIds.includes(memberId) && f.id !== family.id);
    return memberFamily ? memberFamily.familyName : null;
  };

  const getFamilyHead = () => {
    // First try to find in family members
    let head = familyMembers.find(member => member.id === family?.headId);

    // If not found in family members, try to find in all members
    if (!head && family?.headId) {
      head = allMembers.find(member => member.id === family?.headId);
    }

    return head;
  };

  const getTanzeemStats = () => {
    const stats: Record<string, number> = {};
    familyMembers.forEach(member => {
      const displayName = getTanzeemDisplayName(member.tanzeem);
      stats[displayName] = (stats[displayName] || 0) + 1;
    });
    return stats;
  };

  const columns = [
    {
      title: 'Member',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Member) => (
        <div className="family-table-member"><Avatar size={36} src={record.profilePhoto} icon={<UserOutlined />} /><div>
          <div style={{ fontWeight: 500 }}>
            <button
              className="family-member-name"
              onClick={() => {
                navigate(`/members/${encodeURIComponent(record.id)}`, { state: { fromFamilyId: id } });
              }}
            >
              {name}
            </button>
            {record.id === family?.headId && (
              <Tag color="gold" style={{ marginLeft: 8 }}>Head</Tag>
            )}
            {record.isDeceased && <Tag>Deceased</Tag>}
            {record.isBList && <Tag>B List</Tag>}
          </div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.husbandName ? `Husband: ${record.husbandName}` : record.fatherName ? `Father: ${record.fatherName}` : 'Relationship not recorded'}
          </Text>
          {record.isMoved && (
            <Tag color="orange" style={{ marginTop: 4, display: 'block' }}>
              Moved to {record.movedTo || 'unknown location'}
            </Tag>
          )}
        </div></div>
      ),
    },
    {
      title: 'Age',
      key: 'demographics',
      width: 70,
      render: (record: Member) => `${record.age} yrs`,
    },
    {
      title: 'Tanzeem',
      key: 'tanzeem',
      render: (record: Member) => (
        <div>
          <Tag color="blue">{getTanzeemDisplayName(record.tanzeem)}</Tag>
          {record.hasNewTanzeemTransition && (
            <Tag color="green">NEW</Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Contact',
      dataIndex: 'phone',
      key: 'contact',
      render: (phone: string) => (
        <div>
          {phone ? <a className="family-phone" href={`tel:${phone}`}>{phone}</a> : <span className="family-contact-empty">—</span>}
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: Member) => (
        <Space size={4}>
          <Button
            type="default"
            size="small"
            icon={<EyeOutlined />}
            title="View member"
            aria-label={`View ${record.name}`}
            onClick={() => navigate(`/members/${encodeURIComponent(record.id)}`, { state: { fromFamilyId: id } })}
          />
          <Button size="small" icon={<EditOutlined />} title="Edit member" aria-label={`Edit ${record.name}`} onClick={() => { setSelectedMember(record); setMemberDetailModalVisible(true); }} />
          <Button
            type={record.religiousActivities ? 'primary' : 'default'}
            size="small"
            icon={<BookOutlined />}
            onClick={() => {
              setSelectedMemberForReligious(record);
              setReligiousModalVisible(true);
            }}
            title="Update Religious Activities"
            aria-label={`Religious activities for ${record.name}`}
          />
          {record.id !== family?.headId && (
            <Popconfirm
              title="Remove member from family?"
              description="This will only remove the member from this family, not delete the member."
              onConfirm={() => handleRemoveMember(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Button
                type="primary"
                danger
                size="small"
                icon={<DeleteOutlined />}
                title="Remove from Family"
                aria-label={`Remove ${record.name} from family`}
              />
            </Popconfirm>
          )}
        </Space>
      ),
      width: 145,
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!family) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Title level={3}>Family not found</Title>
        <Button type="primary" onClick={() => navigate('/families')}>
          Back to Families
        </Button>
      </div>
    );
  }

  const familyHead = getFamilyHead();
  const tanzeemStats = getTanzeemStats();
  const renderMembers = (people: Member[]) => {
    const words = memberQuery.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    people = people.filter(member => {
      const text = [member.name, member.fatherName, member.husbandName, member.phone, member.tajneedCode, getTanzeemDisplayName(member.tanzeem)].filter(Boolean).join(' ').toLocaleLowerCase();
      return words.every(word => text.includes(word));
    });
    if (!people.length) return <Empty description={memberQuery.trim() ? 'No matching members. Try another name or phone.' : 'No members in this group'} />;
    if (screens.md) return <Table className="family-members-table" columns={columns} dataSource={people} rowKey="id" pagination={false} size="small" scroll={{ x: 700 }} />;
    return <div className="family-mobile-members">{people.map(member => <article className="family-mobile-member" key={member.id}>
      <div className="family-mobile-member-heading"><Avatar size={40} src={member.profilePhoto} icon={<UserOutlined />} /><div><button className="family-member-name" onClick={() => { setSelectedMember(member); setMemberDetailModalVisible(true); }} dir="auto">{member.name}</button><span>{member.age} years · {member.gender === 'male' ? 'Male' : 'Female'}</span></div>{member.id === family.headId && <Tag color="gold">Head</Tag>}</div>
      <div className="family-mobile-member-meta"><span>{getTanzeemDisplayName(member.tanzeem)}</span><span>{member.phone || 'No phone recorded'}</span>{member.isDeceased && <Tag>Deceased</Tag>}{member.isBList && <Tag>B List</Tag>}{member.isMoved && <Tag color="orange">Moved{member.movedTo ? ` · ${member.movedTo}` : ''}</Tag>}</div>
      <div className="family-mobile-member-actions"><Button onClick={() => navigate(`/members/${encodeURIComponent(member.id)}`, { state: { fromFamilyId: id } })}>Details</Button><Button icon={<EditOutlined />} onClick={() => { setSelectedMember(member); setMemberDetailModalVisible(true); }}>Edit</Button><Button onClick={() => { setSelectedMemberForReligious(member); setReligiousModalVisible(true); }}>Religious</Button>{member.id !== family.headId && <Popconfirm title="Remove member from family?" description="The member record will be kept." onConfirm={() => handleRemoveMember(member.id)}><Button danger icon={<DeleteOutlined />} aria-label={`Remove ${member.name} from family`} /></Popconfirm>}</div>
    </article>)}</div>;
  };

  return (
    <div className="family-detail-page">
      {/* Header Section */}
      <header className="family-detail-header">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/families')}
          >
            Back
          </Button>
          <div className="family-detail-identity"><span className="family-detail-icon"><House size={27} /></span><div><span className="section-eyebrow">{family.familyNumber != null ? `FAMILY #${family.familyNumber}` : 'FAMILY RECORD'}</span><h1 dir="auto">{family.familyName}</h1><div className="family-inline-stats" aria-label="Family member summary"><span><Users size={14} /><strong>{familyMembers.length}</strong> Members</span>{Object.entries(tanzeemStats).map(([tanzeem, count]) => <span className="family-inline-tanzeem" key={tanzeem}>{tanzeem} <strong>{count}</strong></span>)}</div><p><MapPin size={14} />{family.halqa || 'Halqa not assigned'}<span className={`family-status ${family.isMoved || family.isBList ? 'muted' : ''}`}>{family.isMoved ? 'Moved' : family.isBList ? 'B List' : 'Active'}</span></p></div></div>
      </header>
      <div className="family-head-line"><span>Family head</span>{familyHead ? <button className="family-member-name" dir="auto" onClick={() => navigate(`/members/${encodeURIComponent(familyHead.id)}`, { state: { fromFamilyId: id } })}>{familyHead.name}</button> : <span>Not recorded</span>}{family.isMoved && <span className="family-moved-location">Moved to: {family.movedTo || 'Not recorded'}</span>}</div>

      {/* Family Members Tabs */}
      <Card
        className="family-members-section"
        title={<div className="family-members-title"><span className="family-members-icon"><Users size={19} /></span><div><strong>Family Members</strong><span>Profiles, contacts and member records</span></div></div>}
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddMember}
            >
              Add Member
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExportPDF}
            >
              Export PDF
            </Button>
          </Space>
        }
      >
        <Input className="family-members-search" aria-label="Search family members" placeholder="Search members by name, phone or tanzeem" prefix={<Search size={16} />} allowClear value={memberQuery} onChange={event => setMemberQuery(event.target.value)} />
        <Tabs
          defaultActiveKey="active"
          items={[
            {
              key: 'active',
              label: 'Current Members',
              children: renderMembers(familyMembers),
            },
            {
              key: 'moved',
              label: `Moved (${movedFamilyMembers.length})`,
              children: renderMembers(movedFamilyMembers),
            },
          ]}
        />
      </Card>

      {/* Add Member Modal */}
      <Modal
        title="Add Members to Family"
        open={addMemberModalVisible}
        onOk={handleAddMemberSubmit}
        onCancel={() => setAddMemberModalVisible(false)}
        width={600}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="memberIds"
            label="Select Members to Add"
            rules={[
              { required: true, message: 'Please select at least one member' }
            ]}
          >
            <Select
              mode="multiple"
              placeholder="Select members to add to this family"
              style={{ width: '100%' }}
              optionFilterProp="label"
              showSearch
              filterOption={(input, option) => {
                const label = option?.label as string;
                return label ? label.toLowerCase().includes(input.toLowerCase()) : false;
              }}
            >
              {getAvailableMembers().map(member => {
                const otherFamilyName = getMemberFamilyName(member.id);
                return (
                  <Option key={member.id} value={member.id} label={member.name}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar
                        size="small"
                        src={member.profilePhoto || undefined}
                        icon={<UserOutlined />}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span>{member.name}</span>
                          {member.isDeceased && (
                            <Tag color="red">Deceased</Tag>
                          )}
                          {otherFamilyName && (
                            <Tag color="orange">In: {otherFamilyName}</Tag>
                          )}
                        </div>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {member.age} yrs • {getTanzeemDisplayName(member.tanzeem)} • {member.phone || 'No phone'}
                        </Text>
                      </div>
                    </div>
                  </Option>
                );
              })}
            </Select>
          </Form.Item>

          {getAvailableMembers().length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
              <Text type="secondary">
                All members are already in this family or no members available.
              </Text>
            </div>
          )}
        </Form>
      </Modal>

      {/* Member Edit Modal */}
      <Modal
        title={`Edit Member: ${selectedMember?.name}`}
        open={memberDetailModalVisible}
        onCancel={() => setMemberDetailModalVisible(false)}
        width={700}
        destroyOnHidden
        footer={null}
      >
        <MemberForm
          initialValues={selectedMember || undefined}
          onFinish={handleMemberUpdate}
          isSaving={false}
          familyHalqa={family?.halqa}
          showCancel
          onCancel={() => setMemberDetailModalVisible(false)}
          existingMembers={allMembers}
          familyHeadName={familyHead?.name}
        />
      </Modal>

      {/* Religious Activities Modal */}
      <ReligiousActivitiesModal
        visible={religiousModalVisible}
        member={selectedMemberForReligious}
        onClose={() => setReligiousModalVisible(false)}
        onSuccess={() => {
          loadFamilyData(); // Refresh the family data
        }}
      />
    </div>
  );
};

export default FamilyDetails;
