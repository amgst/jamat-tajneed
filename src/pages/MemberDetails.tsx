import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Alert, Button, message, Modal, Skeleton } from 'antd';
import MemberProfileView from '../components/MemberProfileView';
import { ApiService } from '../services/apiService';
import type { Member, Family, WaqfJadeedRecord, TahreqJadeedRecord } from '../types';
import { calculateAge, determineTanzeem, formatCNIC } from '../utils/helpers';
import MemberForm from '../components/MemberForm';
import { generateAvatarFromName } from '../utils/imageUtils';
import { validateMemberData, sanitizeMemberData } from '../utils/validation';
import ReligiousActivitiesModal from '../components/ReligiousActivitiesModal';

const MemberDetails: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fromFamilyId = typeof location.state?.fromFamilyId === 'string' ? location.state.fromFamilyId : null;
  const returnTo = typeof location.state?.returnTo === 'string' && (/^\/(?:[?#]|$)/.test(location.state.returnTo) || /^\/(?:people|tanzeem|reports\/(?:mossi|waqfe-nau)|families\/[^/?#]+)(?:[?#]|$)/.test(location.state.returnTo)) ? location.state.returnTo : null;
  const backTo = returnTo || (fromFamilyId ? `/families/${encodeURIComponent(fromFamilyId)}` : '/people');
  const backLabel = /^\/(?:[?#]|$)/.test(backTo) ? 'Back to home' : backTo.startsWith('/families/') ? 'Back to family tree' : backTo.startsWith('/reports/mossi') ? 'Back to Mossi' : backTo.startsWith('/reports/waqfe-nau') ? 'Back to Waqf-e-Nau' : backTo.startsWith('/tanzeem') ? 'Back to Tanzeem' : 'Back to members';
  const { slugId } = useParams<{ slugId: string }>();
  const snapshot = ApiService.getDirectorySnapshot();
  const initialMember = snapshot.members.find(person => slugId === person.id || slugId?.endsWith(`-${person.id}`)) || null;
  const [member, setMember] = useState<Member | null>(initialMember);
  const [family, setFamily] = useState<Family | null>(snapshot.families.find(item => item.id === fromFamilyId || item.id === initialMember?.familyId || item.memberIds.includes(initialMember?.id || '') || item.headId === initialMember?.id) || null);
  const [waqfJadeedRecord, setWaqfJadeedRecord] = useState<WaqfJadeedRecord | null>(null);
  const [tahreqJadeedRecord, setTahreqJadeedRecord] = useState<TahreqJadeedRecord | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [financialError, setFinancialError] = useState(false);
  const [financialLoading, setFinancialLoading] = useState(false);
  const [financialRequested, setFinancialRequested] = useState(false);
  const [loading, setLoading] = useState<boolean>(!initialMember);
  const [isEditModalVisible, setIsEditModalVisible] = useState<boolean>(false);
  const [religiousOpen, setReligiousOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    const cached = ApiService.getDirectorySnapshot();
    const known = cached.members.find(person => slugId === person.id || slugId?.endsWith(`-${person.id}`)) || null;
    setMember(known);
    setFamily(cached.families.find(item => item.id === fromFamilyId || item.id === known?.familyId || item.memberIds.includes(known?.id || '') || item.headId === known?.id) || null);
    setLoading(!known); setLoadError(false);
    setFinancialRequested(false); setFinancialError(false);
    setWaqfJadeedRecord(null); setTahreqJadeedRecord(null);
    const load = async () => {
      try {
        let found = slugId ? await ApiService.getMember(known?.id || slugId) : null;
        if (!found && slugId?.includes('-')) found = await ApiService.getMember(slugId.substring(slugId.lastIndexOf('-') + 1));
        if (cancelled) return;
        setMember(found); setLoading(false);
        if (found) {
          const household = fromFamilyId ? await ApiService.getFamily(fromFamilyId) : await ApiService.getMemberFamily(found);
          if (!cancelled) setFamily(household);
        }
      } catch {
        if (!cancelled) { setLoadError(true); setLoading(false); }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [slugId, fromFamilyId]);

  useEffect(() => {
    if (!financialRequested || !member) return;
    let cancelled = false;
    const id = member.id;
    setFinancialLoading(true);
    void Promise.allSettled([
      ApiService.getWaqfJadeedRecords(new Date().getFullYear()),
      ApiService.getTahreqJadeedRecords(new Date().getFullYear())
    ]).then(([waqf, tahreq]) => {
      if (cancelled) return;
      setFinancialError(waqf.status === 'rejected' || tahreq.status === 'rejected');
      setWaqfJadeedRecord(waqf.status === 'fulfilled' ? waqf.value.find(record => record.memberId === id) || null : null);
      setTahreqJadeedRecord(tahreq.status === 'fulfilled' ? tahreq.value.find(record => record.memberId === id) || null : null);
      setFinancialLoading(false);
    });
    return () => { cancelled = true; };
  }, [financialRequested, member?.id]);
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

  const removeFromFamily = async () => {
    if (!member || !family || removing) return;
    setRemoving(true);
    try {
      const current = await ApiService.getFamily(family.id);
      if (!current) throw new Error('Family not found');
      if (current.headId === member.id) { message.error('Change the family head before removing this member.'); return; }
      const ids = current.memberIds.filter(id => id !== member.id);
      if (member.familyId === current.id) await ApiService.updateMember(member.id, { familyId: '' });
      await ApiService.updateFamily(current.id, { memberIds: ids, totalMembers: ids.length });
      message.success('Member removed from family');
      navigate(`/families/${encodeURIComponent(current.id)}`);
    } catch { message.error('Unable to remove this member. Please try again.'); }
    finally { setRemoving(false); }
  };

  if (loading) return <div style={{ maxWidth: 960, margin: 'auto', padding: 24 }}><Skeleton active avatar paragraph={{ rows: 8 }} /></div>;
  if (!member) return <div style={{ maxWidth: 600, margin: '32px auto' }}><Alert type={loadError ? 'error' : 'info'} showIcon message={loadError ? 'Unable to load this profile' : 'Person not found'} description={loadError ? 'Check your connection and refresh the page to try again.' : 'This record may have been removed.'} /><Button style={{ marginTop: 16 }} onClick={() => navigate(backTo)}>{backLabel}</Button></div>;

  return (
    <>
      <MemberProfileView key={member.id} member={member} family={family} waqf={waqfJadeedRecord} tahreq={tahreqJadeedRecord} financialError={financialError} financialLoading={financialLoading || !financialRequested} onFinancialOpen={() => setFinancialRequested(true)} onEdit={() => setIsEditModalVisible(true)} backTo={backTo} backLabel={backLabel} onReligiousEdit={() => setReligiousOpen(true)} onRemove={family && member.id !== family.headId ? removeFromFamily : undefined} removing={removing} />
      <ReligiousActivitiesModal visible={religiousOpen} member={member} onClose={() => setReligiousOpen(false)} onSuccess={async () => { const people = await ApiService.getAllMembers(); setMember(people.find(person => person.id === member.id) || member); }} />
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
