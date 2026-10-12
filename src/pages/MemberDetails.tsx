import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Alert, Button, message, Modal, Skeleton } from 'antd';
import MemberProfileView from '../components/MemberProfileView';
import { ApiService } from '../services/apiService';
import type { Member, Family, WaqfJadeedRecord, TahreqJadeedRecord } from '../types';
import { calculateAge, determineTanzeem, formatCNIC } from '../utils/helpers';
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
  const [loadError, setLoadError] = useState(false);
  const [financialError, setFinancialError] = useState(false);
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
      setLoading(true); setLoadError(false); setMember(null); setFamily(null);
      try {
        const [members, families, financialRecords] = await Promise.all([
          ApiService.getAllMembers(),
          ApiService.getAllFamilies(),
          Promise.allSettled([
            ApiService.getWaqfJadeedRecords(new Date().getFullYear()),
            ApiService.getTahreqJadeedRecords(new Date().getFullYear())
          ])
        ]);
        setFinancialError(financialRecords.some(result => result.status === 'rejected'));
        const waqfRecords = financialRecords[0].status === 'fulfilled' ? financialRecords[0].value : [];
        const tahreqRecords = financialRecords[1].status === 'fulfilled' ? financialRecords[1].value : [];
        const found = members.find((m: Member) => slugId === m.id || slugId?.endsWith(`-${m.id}`)) || null;
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
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [memberId, slugId]);

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
        phone: formData.phone && String(formData.phone).trim() ? String(formData.phone).trim() : '',
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
        maritalStatus: formData.maritalStatus,
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

  if (loading) return <div style={{ maxWidth: 960, margin: 'auto', padding: 24 }}><Skeleton active avatar paragraph={{ rows: 8 }} /></div>;
  if (!member) return <div style={{ maxWidth: 600, margin: '32px auto' }}><Alert type={loadError ? 'error' : 'info'} showIcon message={loadError ? 'Unable to load this profile' : 'Person not found'} description={loadError ? 'Check your connection and refresh the page to try again.' : 'This record may have been removed.'} /><Button style={{ marginTop: 16 }} onClick={() => navigate('/people')}>Back to people</Button></div>;

  return (
    <>
      <MemberProfileView member={member} family={family} waqf={waqfJadeedRecord} tahreq={tahreqJadeedRecord} financialError={financialError} onEdit={() => setIsEditModalVisible(true)} />
      <Modal
        className="member-edit-modal"
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
