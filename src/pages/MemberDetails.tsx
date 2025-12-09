import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Space, Avatar, Tag, Button, Descriptions, message } from 'antd';
import { UserOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { ApiService } from '../services/apiService';
import type { Member, Family } from '../types';
import { getTanzeemDisplayName, formatDate } from '../utils/helpers';

const MemberDetails: React.FC = () => {
  const navigate = useNavigate();
  const { slugId } = useParams<{ slugId: string }>();
  const [member, setMember] = useState<Member | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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
        const [members, families] = await Promise.all([
          ApiService.getAllMembers(),
          ApiService.getAllFamilies(),
        ]);
        const found = members.find((m: Member) => m.id === memberId) || null;
        setMember(found);
        if (found) {
          const fam = families.find((f: Family) => (f.memberIds || []).includes(found.id)) || null;
          setFamily(fam);
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
    <Card loading={loading} title="Member Details" extra={
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/members')}>
        Back to Members
      </Button>
    }>
      {member && (
        <Space align="start" size={24}>
          <Avatar size={72} src={member.profilePhoto || undefined} icon={<UserOutlined />} />
          <Descriptions column={1} bordered size="middle" labelStyle={{ width: 180 }}>
            <Descriptions.Item label="Name">{member.name}</Descriptions.Item>
            <Descriptions.Item label="Father/Husband">
              {member.husbandName ? `Husband: ${member.husbandName}` : member.fatherName}
            </Descriptions.Item>
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
            <Descriptions.Item label="Created At">{formatDate(member.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="Updated At">{formatDate(member.updatedAt)}</Descriptions.Item>
          </Descriptions>
        </Space>
      )}
    </Card>
  );
};

export default MemberDetails;


