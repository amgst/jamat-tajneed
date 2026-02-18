import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Avatar, Tag, Button, Descriptions, message, Tabs, Modal, Space } from 'antd';
import { UserOutlined, ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { ApiService } from '../services/apiService';
import type { Member, Family, WaqfJadeedRecord, TahreqJadeedRecord } from '../types';
import { getTanzeemDisplayName, formatDate, calculateAge, determineTanzeem, formatCNIC } from '../utils/helpers';
import MemberForm from '../components/MemberForm';
import { generateAvatarFromName } from '../utils/imageUtils';
import { validateMemberData, sanitizeMemberData } from '../utils/validation';

const MemberDetails: React.FC = () => {
  const navigate = useNavigate();
  const { slugId } = useParams<{ slugId: string }>();
  const [member, setMember] = useState<Member | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [waqfJadeedRecord, setWaqfJadeedRecord] = useState<WaqfJadeedRecord | null>(null);
  const [tahreqJadeedRecord, setTahreqJadeedRecord] = useState<TahreqJadeedRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isEditModalVisible, setIsEditModalVisible] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const memberId = useMemo(() => {
    if (!slugId) return '';
    const lastDash = slugId.lastIndexOf('-');
    if (lastDash === -1) return slugId; // fallback
    return slugId.substring(lastDash + 1);
  }, [slugId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [members, families, waqfRecords, tahreqRecords] = await Promise.all([
          ApiService.getAllMembers(),
          ApiService.getAllFamilies(),
          ApiService.getWaqfJadeedRecords(new Date().getFullYear()),
          ApiService.getTahreqJadeedRecords(new Date().getFullYear())
        ]);
        const found = members.find((m: Member) => m.id === memberId) || null;
        setMember(found);
        if (found) {
          const fam = families.find((f: Family) => (f.memberIds || []).includes(found.id)) || null;
          setFamily(fam);

          // Find Waqf Jadeed record for this member
          const waqfRecord = waqfRecords.find((r: WaqfJadeedRecord) => r.memberId === found.id) || null;
          setWaqfJadeedRecord(waqfRecord);

          // Find Tahreq Jadeed record for this member
          const tahreqRecord = tahreqRecords.find((r: TahreqJadeedRecord) => r.memberId === found.id) || null;
          setTahreqJadeedRecord(tahreqRecord);
        }
        if (!found) {
          message.error('Member not found');
        }
      } catch (e) {
        message.error('Failed to load member');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [memberId]);

  const handleEditSave = async (values: any) => {
    if (!member) return;
    try {
      setIsSaving(true);
      const formData = values;

      const age = calculateAge(formData.dateOfBirth.format('YYYY-MM-DD'));
      const tanzeem = determineTanzeem(age, formData.gender);

      const memberDataRaw: any = {
        ...member,
        name: formData.name,
        fatherName: formData.fatherName || '',
        husbandName: formData.husbandName || '',
        gender: formData.gender,
        cnic: formData.cnic ? formatCNIC(formData.cnic) : '',
        dateOfBirth: formData.dateOfBirth.format('YYYY-MM-DD'),
        age,
        phone: formData.phone || '',
        address: formData.address,
        tanzeem,
        profilePhoto: formData.profilePhoto || generateAvatarFromName(formData.name),
        isDeceased: formData.isDeceased || false,
        isMoved: formData.isMoved || false,
        movedTo: formData.movedTo || '',
        isBList: formData.isBList || false,
        isBaitByBirth: formData.isBaitByBirth,
        baitYear: formData.isBaitByBirth ? undefined : formData.baitYear,
        wasitNo: formData.wasitNo || '',
        education: formData.education || '',
        bloodGroup: formData.bloodGroup || '',
        waqfeNauNumber: formData.waqfeNauNumber || '',
        updatedAt: new Date().toISOString(),
      };

      if (formData.dateOfDeath) {
        memberDataRaw.dateOfDeath = formData.dateOfDeath.format('YYYY-MM-DD');
      }

      const validation = validateMemberData(memberDataRaw);
      if (!validation.valid) {
        message.error(`Validation failed: ${validation.errors.join(', ')}`);
        return;
      }

      const memberData = sanitizeMemberData(memberDataRaw);
      await ApiService.updateMember(member.id, memberData);

      setMember({ ...member, ...memberData });
      message.success('Member updated successfully');
      setIsEditModalVisible(false);
    } catch (error) {
      message.error('Failed to update member');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!member && !loading) {
    return (
      <Card>
        <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/members')}>
          Back to Members
        </Button>
        <div>Member not found.</div>
      </Card>
    );
  }

  return (
    <>
      <Card loading={loading} title="Member Details" extra={
        <Space>
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => setIsEditModalVisible(true)}
          >
            Edit Member
          </Button>
          <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/members')}>
            Back to Members
          </Button>
        </Space>
      }>
        {member && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
              <Avatar size={72} src={member.profilePhoto || undefined} icon={<UserOutlined />} />
              <div style={{ marginLeft: 16 }}>
                <h2 style={{ margin: 0 }}>{member.name}</h2>
                <div style={{ color: '#888' }}>
                  {member.husbandName ? `Husband: ${member.husbandName}` : member.fatherName}
                </div>
              </div>
            </div>

            <Tabs defaultActiveKey="1">
              <Tabs.TabPane tab="Personal Information" key="1">
                <Card>
                  <Descriptions column={1} bordered size="middle">
                    <Descriptions.Item label="Gender">
                      <Tag color={member.gender === 'male' ? 'blue' : 'pink'}>{member.gender.toUpperCase()}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Age">{member.age}</Descriptions.Item>
                    <Descriptions.Item label="CNIC">{member.cnic || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Date of Birth">{formatDate(member.dateOfBirth)}</Descriptions.Item>
                    <Descriptions.Item label="Phone">{member.phone || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Address">{member.address}</Descriptions.Item>
                    <Descriptions.Item label="Tanzeem">
                      <Tag color="green">{getTanzeemDisplayName(member.tanzeem)}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Halqa">{family?.halqa || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Family">
                      {family ? (
                        <Button type="link" onClick={() => navigate(`/families/${family.id}`)}>
                          {family.familyName}
                        </Button>
                      ) : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Year of Bait">
                      {member.isBaitByBirth ? 'By Birth' : (member.baitYear || '-')}
                    </Descriptions.Item>
                    <Descriptions.Item label="Wasit No">{member.wasitNo || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Education">{member.education || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Blood Group">{member.bloodGroup || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Waqf-e-Nau No">{member.waqfeNauNumber || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Created At">{formatDate(member.createdAt)}</Descriptions.Item>
                    <Descriptions.Item label="Updated At">{formatDate(member.updatedAt)}</Descriptions.Item>
                    {member.isMoved && (
                      <Descriptions.Item label="Status">
                        <Tag color="orange">Moved to {member.movedTo || 'unknown location'}</Tag>
                      </Descriptions.Item>
                    )}
                    {member.isBList && (
                      <Descriptions.Item label="Status">
                        <Tag color="blue">B List</Tag>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Card>
              </Tabs.TabPane>

              <Tabs.TabPane tab="Financial Records" key="2">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                  <Card title="Waqf-e-Jadeed">
                    {waqfJadeedRecord ? (
                      <>
                        <Descriptions column={1}>
                          <Descriptions.Item label="Promised Amount">
                            Rs. {((waqfJadeedRecord.promiseAmount || 0) + (waqfJadeedRecord.nagarparAmount || 0)).toLocaleString()}
                          </Descriptions.Item>
                          <Descriptions.Item label="Paid Amount">
                            Rs. {(waqfJadeedRecord.paidAmount || 0).toLocaleString()}
                          </Descriptions.Item>
                          <Descriptions.Item label="Remaining">
                            Rs. {(((waqfJadeedRecord.promiseAmount || 0) + (waqfJadeedRecord.nagarparAmount || 0)) - (waqfJadeedRecord.paidAmount || 0)).toLocaleString()}
                          </Descriptions.Item>
                        </Descriptions>
                      </>
                    ) : (
                      <div>No Waqf-e-Jadeed record found for this member</div>
                    )}
                  </Card>

                  <Card title="Tahreq Jadeed">
                    {tahreqJadeedRecord ? (
                      <>
                        <Descriptions column={1}>
                          <Descriptions.Item label="Promised Amount">
                            Rs. {((tahreqJadeedRecord.promiseAmount || 0) + (tahreqJadeedRecord.nagarparAmount || 0)).toLocaleString()}
                          </Descriptions.Item>
                          <Descriptions.Item label="Paid Amount">
                            Rs. {(tahreqJadeedRecord.paidAmount || 0).toLocaleString()}
                          </Descriptions.Item>
                          <Descriptions.Item label="Remaining">
                            Rs. {(((tahreqJadeedRecord.promiseAmount || 0) + (tahreqJadeedRecord.nagarparAmount || 0)) - (tahreqJadeedRecord.paidAmount || 0)).toLocaleString()}
                          </Descriptions.Item>
                        </Descriptions>
                      </>
                    ) : (
                      <div>No Tahreq Jadeed record found for this member</div>
                    )}
                  </Card>
                </div>
              </Tabs.TabPane>
            </Tabs>
          </>
        )}
      </Card>

      <Modal
        title="Edit Member"
        open={isEditModalVisible}
        onCancel={() => setIsEditModalVisible(false)}
        width={700}
        destroyOnHidden
        footer={null}
      >
        <MemberForm
          initialValues={member || undefined}
          onFinish={handleEditSave}
          isSaving={isSaving}
          familyHalqa={family?.halqa}
          showCancel
          onCancel={() => setIsEditModalVisible(false)}
        />
      </Modal>
    </>
  );
};

export default MemberDetails;
