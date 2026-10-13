import React from 'react';
import { Modal, Form, Input, Checkbox, InputNumber, Button, Tag, message } from 'antd';
import { Heart } from 'lucide-react';
import { ApiService } from '../services/apiService';
import type { Member, ReligiousActivities } from '../types';
import { getTanzeemDisplayName } from '../utils/helpers';
import './ReligiousActivitiesModal.css';

interface ReligiousActivitiesModalProps {
  visible: boolean;
  member: Member | null;
  onClose: () => void;
  onSuccess?: () => void;
  readOnly?: boolean;
}

type ActivityField = { name: keyof ReligiousActivities; label: string; numeric?: boolean };
const groups: { title: string; urdu: string; fields: ActivityField[] }[] = [
  { title: 'Daily activities', urdu: 'روزانہ سرگرمیاں', fields: [
    { name: 'fiveDailyPrayers', label: 'پنجگانہ نماز کا قیام', numeric: true },
    { name: 'congregationalPrayers', label: 'با جماعت نمازیں', numeric: true },
    { name: 'twoNaflDaily', label: 'دو نوافل' },
    { name: 'dailyRecitation', label: 'تلاوت' },
    { name: 'dailyThreePrayers', label: 'روزانہ 3 دعائیں' },
  ] },
  { title: 'Weekly activities', urdu: 'ہفتہ وار سرگرمیاں', fields: [
    { name: 'fridayPrayer', label: 'نماز جمعہ' },
    { name: 'weeklyVoluntaryFast', label: 'نفلی روزہ' },
    { name: 'weeklyTahajjud', label: 'تہجد' },
    { name: 'sermonListening', label: 'خطبہ حضور انور' },
    { name: 'listenedThisWeek', label: 'اس ہفتے خطبہ سنا' },
    { name: 'prayerLetterWriting', label: 'دعائیہ خط' },
  ] },
  { title: 'Other activities', urdu: 'دیگر سرگرمیاں', fields: [
    { name: 'prayerWithTranslation', label: 'نماز با ترجمہ' },
    { name: 'quranRecitation', label: 'قرآن ناظرہ' },
    { name: 'willWritten', label: 'وصیت' },
    { name: 'prayerMovement', label: 'دعائیہ تحریک' },
  ] },
  { title: 'MTA & internet', urdu: 'ایم ٹی اے اور انٹرنیٹ', fields: [
    { name: 'mtaDish', label: 'MTA ڈش' },
    { name: 'mtaCable', label: 'MTA کیبل' },
    { name: 'mtaInternet', label: 'MTA انٹرنیٹ' },
    { name: 'internetAccess', label: 'انٹرنیٹ' },
  ] },
];

const ReligiousActivitiesModal: React.FC<ReligiousActivitiesModalProps> = ({ visible, member, onClose, onSuccess, readOnly = false }) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    if (visible && member) {
      form.resetFields();
      form.setFieldsValue(member.religiousActivities || {});
    }
  }, [visible, member?.id, form]);

  const save = async () => {
    if (!member || saving || readOnly) return;
    let values;
    try { values = await form.validateFields(); } catch { return; }
    setSaving(true);
    try {
      const religiousData = { ...member.religiousActivities, notes: values.notes || '', lastUpdated: new Date().toISOString() } as ReligiousActivities;
      groups.flatMap(group => group.fields).forEach(field => {
        Object.assign(religiousData, { [field.name]: field.numeric ? values[field.name] ?? 0 : !!values[field.name] });
      });
      await ApiService.updateMember(member.id, { religiousActivities: religiousData });
      message.success('Religious activities updated');
      onClose();
      onSuccess?.();
    } catch { message.error('Failed to save religious activities. Please try again.'); }
    finally { setSaving(false); }
  };

  return <Modal
    className="religious-activities-modal"
    title={<div className="religious-modal-heading"><span className="religious-modal-icon"><Heart size={20} /></span><div><span className="religious-modal-eyebrow">Religious activities</span><div className="religious-modal-member"><strong dir="auto">{member?.name}</strong>{member && <Tag>{getTanzeemDisplayName(member.tanzeem)}</Tag>}</div></div></div>}
    open={visible}
    onCancel={() => { if (!saving) onClose(); }}
    closable={!saving}
    maskClosable={!saving}
    keyboard={!saving}
    width={760}
    destroyOnHidden
    footer={readOnly ? <Button onClick={onClose}>Close</Button> : <><Button onClick={onClose} disabled={saving}>Cancel</Button><Button type="primary" loading={saving} disabled={!member} onClick={save}>Save changes</Button></>}
  >
    <Form form={form} layout="vertical" disabled={readOnly || saving} preserve={false}>
      {groups.map(group => <section className="religious-activity-group" key={group.title} aria-label={group.title}>
        <h3><span>{group.title}</span><span lang="ur" dir="rtl">{group.urdu}</span></h3>
        <div className="religious-activity-grid" dir="rtl">{group.fields.map(field => field.numeric ?
          <Form.Item key={field.name} name={field.name} label={<span lang="ur">{field.label}</span>} rules={[{ type: 'number', min: 0, max: 5, message: 'Enter a number from 0 to 5' }]}>
            <InputNumber min={0} max={5} precision={0} placeholder="0–5" aria-label={field.label} style={{ width: '100%' }} />
          </Form.Item> :
          <Form.Item key={field.name} name={field.name} valuePropName="checked" className="religious-check-field">
            <Checkbox><span lang="ur">{field.label}</span></Checkbox>
          </Form.Item>
        )}</div>
      </section>)}
      <Form.Item name="notes" label={<span lang="ur" dir="rtl">نوٹس</span>} className="religious-notes"><Input.TextArea dir="auto" rows={3} placeholder="اضافی معلومات..." aria-label="Additional notes" /></Form.Item>
    </Form>
  </Modal>;
};

export default ReligiousActivitiesModal;
