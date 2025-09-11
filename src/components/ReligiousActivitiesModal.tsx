import React from 'react';
import {
  Modal,
  Form,
  Input,
  Row,
  Col,
  Checkbox,
  InputNumber,
  Divider,
  message
} from 'antd';
import { updateMember } from '../services/firebase';
import type { Member, ReligiousActivities, Tanzeem } from '../types';
import { getTanzeemDisplayName } from '../utils/helpers';

interface ReligiousActivitiesModalProps {
  visible: boolean;
  member: Member | null;
  onClose: () => void;
  onSuccess?: () => void;
  readOnly?: boolean;
}

const ReligiousActivitiesModal: React.FC<ReligiousActivitiesModalProps> = ({
  visible,
  member,
  onClose,
  onSuccess,
  readOnly = false
}) => {
  const [form] = Form.useForm();

  React.useEffect(() => {
    if (member && visible) {
      form.setFieldsValue({
        ...member.religiousActivities,
        memberName: member.name,
        memberTanzeem: getTanzeemDisplayName(member.tanzeem)
      });
    }
  }, [member, visible, form]);

  const handleModalOk = async () => {
    if (readOnly) {
      onClose();
      return;
    }

    try {
      const values = await form.validateFields();
      const religiousData: ReligiousActivities = {
        fiveDailyPrayers: values.fiveDailyPrayers || 0,
        congregationalPrayers: values.congregationalPrayers || 0,
        weeklyTahajjud: values.weeklyTahajjud || false,
        dailyRecitation: values.dailyRecitation || false,
        fridayPrayer: values.fridayPrayer || false,
        twoNaflDaily: values.twoNaflDaily || false,
        weeklyVoluntaryFast: values.weeklyVoluntaryFast || false,
        prayerMovement: values.prayerMovement || false,
        dailyThreePrayers: values.dailyThreePrayers || false,
        sermonListening: values.sermonListening || false,
        listenedThisWeek: values.listenedThisWeek || false,
        quranRecitation: values.quranRecitation || false,
        prayerWithTranslation: values.prayerWithTranslation || false,
        prayerLetterWriting: values.prayerLetterWriting || false,
        willWritten: values.willWritten || false,
        mtaDish: values.mtaDish || false,
        mtaCable: values.mtaCable || false,
        mtaInternet: values.mtaInternet || false,
        internetAccess: values.internetAccess || false,
        notes: values.notes || '',
        lastUpdated: new Date().toISOString(),
      };

      if (member) {
        await updateMember(member.id, {
          ...member,
          religiousActivities: religiousData,
          updatedAt: new Date().toISOString(),
        });
        message.success('Religious activities updated successfully');
      }

      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      message.error('Failed to save religious activities');
      console.error(error);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={`مذہبی سرگرمیاں: ${member?.name}`}
      open={visible}
      onOk={handleModalOk}
      onCancel={handleCancel}
      width={800}
      destroyOnClose
      okText={readOnly ? 'Close' : 'Save'}
      cancelText="Cancel"
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        disabled={readOnly}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="نام">
              <Input disabled value={member?.name} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="تنظیم">
              <Input disabled value={getTanzeemDisplayName(member?.tanzeem || 'khuddam' as Tanzeem)} />
            </Form.Item>
          </Col>
        </Row>

        <Divider>Daily tasks</Divider>
        
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="fiveDailyPrayers"
              label="پنجگانہ نماز کا قیام"
            >
              <InputNumber
                min={0}
                max={5}
                placeholder="0-5"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="congregationalPrayers"
              label="با جماعت نمازیں"
            >
              <InputNumber
                min={0}
                max={5}
                placeholder="0-5"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="fridayPrayer"
              label="نماز جمعہ"
              valuePropName="checked"
            >
              <Checkbox>ہاں</Checkbox>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={6}>
            <Form.Item
              name="weeklyVoluntaryFast"
              label="نفلی روزہ"
              valuePropName="checked"
            >
              <Checkbox>ہاں</Checkbox>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              name="twoNaflDaily"
              label="دو نوافل"
              valuePropName="checked"
            >
              <Checkbox>ہاں</Checkbox>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              name="dailyRecitation"
              label="تلاوت"
              valuePropName="checked"
            >
              <Checkbox>ہاں</Checkbox>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              name="dailyThreePrayers"
              label="روزانہ 3 دعائیں"
              valuePropName="checked"
            >
              <Checkbox>ہاں</Checkbox>
            </Form.Item>
          </Col>
        </Row>

        <Divider>Weekly tasks</Divider>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="weeklyTahajjud"
              label="تہجد"
              valuePropName="checked"
            >
              <Checkbox>ہاں</Checkbox>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="sermonListening"
              label="خطبہ حضور انور"
              valuePropName="checked"
            >
              <Checkbox>ہاں</Checkbox>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="prayerLetterWriting"
              label="دعائیہ خط"
              valuePropName="checked"
            >
              <Checkbox>ہاں</Checkbox>
            </Form.Item>
          </Col>
        </Row>

        <Divider>Others info</Divider>

        <Row gutter={16}>
          <Col span={6}>
            <Form.Item
              name="prayerWithTranslation"
              label="نماز با ترجمہ"
              valuePropName="checked"
            >
              <Checkbox>ہاں</Checkbox>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              name="quranRecitation"
              label="قرآن ناظرہ"
              valuePropName="checked"
            >
              <Checkbox>ہاں</Checkbox>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              name="willWritten"
              label="وصیت"
              valuePropName="checked"
            >
              <Checkbox>ہاں</Checkbox>
            </Form.Item>
          </Col>
        </Row>

        <Divider>MTA</Divider>

        <Row gutter={16}>
          <Col span={6}>
            <Form.Item
              name="mtaDish"
              label="MTA ڈش"
              valuePropName="checked"
            >
              <Checkbox>ہاں</Checkbox>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              name="mtaCable"
              label="MTA کیبل"
              valuePropName="checked"
            >
              <Checkbox>ہاں</Checkbox>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              name="mtaInternet"
              label="MTA انٹرنیٹ"
              valuePropName="checked"
            >
              <Checkbox>ہاں</Checkbox>
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item
              name="internetAccess"
              label="انٹرنیٹ"
              valuePropName="checked"
            >
              <Checkbox>ہاں</Checkbox>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="notes"
          label="نوٹس"
        >
          <Input.TextArea
            rows={3}
            placeholder="اضافی معلومات..."
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ReligiousActivitiesModal;