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
  Row,
  Col,
  Statistic,
  Descriptions,
  message,
  Spin,
  Popconfirm,
  Modal,
  Select,
  Form,
  Input,

  Tabs,
} from 'antd';
import {
  ArrowLeftOutlined,
  UserOutlined,
  DownloadOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { ApiService } from '../services/apiService';
import ReligiousActivitiesModal from '../components/ReligiousActivitiesModal';
import { getTanzeemDisplayName, formatDate, calculateAge, determineTanzeem, formatCNIC } from '../utils/helpers';
import { generateAvatarFromName } from '../utils/imageUtils';
import type { Family, Member } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import MemberForm from '../components/MemberForm';
const { Title, Text } = Typography;
const { Option } = Select;

const FamilyDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

      const memberData: any = {
        name: values.name,
        fatherName: values.fatherName || '',
        husbandName: values.husbandName || '',
        gender: values.gender,
        cnic: values.cnic ? formatCNIC(values.cnic) : '',
        dateOfBirth: values.dateOfBirth.format('YYYY-MM-DD'),
        age,
        phone: values.phone || '',
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
        updatedAt: new Date().toISOString(),
      };

      // Preserve createdAt when updating
      memberData.createdAt = selectedMember?.createdAt || new Date().toISOString();

      if (values.dateOfDeath) {
        memberData.dateOfDeath = values.dateOfDeath.format('YYYY-MM-DD');
      }

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
      title: 'Photo',
      key: 'photo',
      render: (record: Member) => (
        <Avatar
          size="small"
          src={record.profilePhoto || undefined}
          icon={<UserOutlined />}
        />
      ),
      width: 60,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Member) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            <span
              style={{ color: '#1890ff', cursor: 'pointer' }}
              onClick={() => {
                setSelectedMember(record);
                // Form state is now handled by MemberForm via initialValues prop
                setMemberDetailModalVisible(true);
              }}
            >
              {name}
            </span>
            {record.id === family?.headId && (
              <Tag color="gold" style={{ marginLeft: 8 }}>Head</Tag>
            )}
          </div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.husbandName ? `Husband: ${record.husbandName}` : `Father: ${record.fatherName}`}
          </Text>
          {record.isMoved && (
            <Tag color="orange" style={{ marginTop: 4, display: 'block' }}>
              Moved to {record.movedTo || 'unknown location'}
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Age & Gender',
      key: 'demographics',
      render: (record: Member) => (
        <div>
          <div>{record.age} years</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.gender === 'male' ? 'Male' : 'Female'}
          </Text>
        </div>
      ),
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
      render: (phone: string, record: Member) => (
        <div>
          <div>{phone}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.cnic}
          </Text>
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: Member) => (
        <Space>
          <Button
            type={record.religiousActivities ? 'primary' : 'default'}
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setSelectedMemberForReligious(record);
              setReligiousModalVisible(true);
            }}
            title="Update Religious Activities"
          >
            Religious
          </Button>
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
              >
                Remove
              </Button>
            </Popconfirm>
          )}
          {record.id === family?.headId && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Family Head
            </Text>
          )}
        </Space>
      ),
      width: 180,
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

  return (
    <div>
      {/* Header Section */}
      <div style={{ marginBottom: 24 }}>
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/families')}
          >
            Back
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            {family.familyName}
          </Title>
        </Space>
        <Text type="secondary">
          Family Details & Member Management
        </Text>
      </div>

      {/* Family Information */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={16}>
          <Card title="Family Information">
            <Descriptions column={2}>
              <Descriptions.Item label="Family Name">
                {family.familyName}
              </Descriptions.Item>
              <Descriptions.Item label="Family Head">
                {familyHead ? familyHead.name : 'Not Found'}
              </Descriptions.Item>
              <Descriptions.Item label="Total Members">
                {familyMembers.length}
              </Descriptions.Item>
              <Descriptions.Item label="Halqa">
                {family.halqa || 'Not Assigned'}
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {formatDate(family.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="Updated">
                {formatDate(family.updatedAt)}
              </Descriptions.Item>
            </Descriptions>

            {/* Family History Section */}
            <div style={{ marginTop: 24 }}>
              <Title level={4}>Family History</Title>
              <Input.TextArea
                rows={4}
                placeholder="Write family history, background, or any important notes..."
                value={family.familyHistory || ''}
                onChange={(e) => {
                  const updatedFamily = { ...family, familyHistory: e.target.value };
                  setFamily(updatedFamily);
                }}
                onBlur={async () => {
                  try {
                    await ApiService.updateFamily(family.id, {
                      familyHistory: family.familyHistory || '',
                      updatedAt: new Date().toISOString()
                    });
                    message.success('Family history updated');
                  } catch (error) {
                    message.error('Failed to update family history');
                  }
                }}
              />
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Family Statistics">
            <Space direction="vertical" style={{ width: '100%' }}>
              {Object.entries(tanzeemStats).map(([tanzeem, count]) => (
                <div key={tanzeem} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>{tanzeem}:</Text>
                  <Tag color="blue">{count}</Tag>
                </div>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Quick Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Members"
              value={familyMembers.length}
              prefix={<UserOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Male Members"
              value={familyMembers.filter(m => m.gender === 'male').length}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Female Members"
              value={familyMembers.filter(m => m.gender === 'female').length}
              valueStyle={{ color: '#f759ab' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Family Members Tabs */}
      <Card
        title="Family Members"
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
        <Tabs
          defaultActiveKey="active"
          items={[
            {
              key: 'active',
              label: `Active Members (${familyMembers.length})`,
              children: (
                <Table
                  columns={columns}
                  dataSource={familyMembers}
                  rowKey="id"
                  pagination={false}
                  size="middle"
                />
              ),
            },
            {
              key: 'moved',
              label: `Moved (${movedFamilyMembers.length})`,
              children: (
                <Table
                  columns={columns}
                  dataSource={movedFamilyMembers}
                  rowKey="id"
                  pagination={false}
                  size="middle"
                />
              ),
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
        destroyOnClose
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
