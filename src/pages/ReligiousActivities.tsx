import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Tag,
  Avatar,
  Typography,
  Row,
  Col,
  Statistic,
  Checkbox,
  InputNumber,
  Divider
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  UserOutlined,
  TeamOutlined,
  ReloadOutlined,
  SearchOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { ApiService } from '../services/apiService';
import type { Member, ReligiousActivities, Tanzeem } from '../types';
import { getTanzeemDisplayName, formatDate, exportToCSV } from '../utils/helpers';

const { Option } = Select;
const { Text, Title } = Typography;

const ReligiousActivitiesPage: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const data = await ApiService.getAllMembers();
      setMembers(data);
    } catch (error) {
      message.error('Failed to load members');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredMembers = (): Member[] => {
    if (!searchText.trim()) {
      return members;
    }
    
    const searchLower = searchText.toLowerCase();
    return members.filter(member => {
      const name = member.name.toLowerCase();
      const fatherName = (member.fatherName || '').toLowerCase();
      const halqa = (member.halqa || '').toLowerCase();
      
      return name.includes(searchLower) || 
             fatherName.includes(searchLower) || 
             halqa.includes(searchLower);
    });
  };

  const getReligiousStats = () => {
    const totalMembers = members.length;
    const membersWithData = members.filter(m => m.religiousActivities).length;
    const fivePrayersCount = members.filter(m => 
      m.religiousActivities?.fiveDailyPrayers === 5
    ).length;
    const mtaUsers = members.filter(m => 
      m.religiousActivities?.mtaDish || 
      m.religiousActivities?.mtaCable || 
      m.religiousActivities?.mtaInternet
    ).length;
    const internetUsers = members.filter(m => 
      m.religiousActivities?.internetAccess
    ).length;

    return {
      totalMembers,
      membersWithData,
      fivePrayersCount,
      mtaUsers,
      internetUsers
    };
  };

  const handleEditActivities = (member: Member) => {
    setEditingMember(member);
    form.setFieldsValue({
      ...member.religiousActivities,
      memberName: member.name,
      memberTanzeem: getTanzeemDisplayName(member.tanzeem)
    });
    setModalVisible(true);
  };

  const handleModalOk = async () => {
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

      if (editingMember) {
        await ApiService.updateMember(editingMember.id, {
          ...editingMember,
          religiousActivities: religiousData,
          updatedAt: new Date().toISOString(),
        });
        message.success('Religious activities updated successfully');
      }

      setModalVisible(false);
      loadMembers();
    } catch (error) {
      message.error('Failed to save religious activities');
      console.error(error);
    }
  };

  const handleExport = () => {
    const exportData = members
      .filter(member => member.religiousActivities)
      .map(member => ({
        'نام': member.name,
        'والد کا نام': member.fatherName || '',
        'عمر': member.age,
        'تنظیم': getTanzeemDisplayName(member.tanzeem),
        'حلقہ': member.halqa || '',
        'پنجگانہ نماز': member.religiousActivities?.fiveDailyPrayers || 0,
        'با جماعت نمازیں': member.religiousActivities?.congregationalPrayers || 0,
        'ہفتہ وار تہجد': member.religiousActivities?.weeklyTahajjud ? 'ہاں' : 'نہیں',
        'روزانہ تلاوت': member.religiousActivities?.dailyRecitation ? 'ہاں' : 'نہیں',
        'MTA ڈش': member.religiousActivities?.mtaDish ? 'ہاں' : 'نہیں',
        'MTA کیبل': member.religiousActivities?.mtaCable ? 'ہاں' : 'نہیں',
        'MTA انٹرنیٹ': member.religiousActivities?.mtaInternet ? 'ہاں' : 'نہیں',
        'انٹرنیٹ': member.religiousActivities?.internetAccess ? 'ہاں' : 'نہیں',
        'آخری اپ ڈیٹ': formatDate(member.religiousActivities?.lastUpdated || ''),
      }));

    exportToCSV(exportData, 'religious_activities.csv');
    message.success('Data exported successfully');
  };

  const columns = [
    {
      title: 'S.No',
      key: 'serial',
      width: 80,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'تصویر',
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
      title: 'نام',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Member) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.fatherName}
          </Text>
        </div>
      ),
    },
    {
      title: 'عمر',
      dataIndex: 'age',
      key: 'age',
      width: 70,
    },
    {
      title: 'تنظیم',
      dataIndex: 'tanzeem',
      key: 'tanzeem',
      render: (tanzeem: string) => (
        <Tag color="green">{getTanzeemDisplayName(tanzeem)}</Tag>
      ),
    },
    {
      title: 'حلقہ',
      dataIndex: 'halqa',
      key: 'halqa',
      render: (halqa: string) => halqa || '-',
    },
    {
      title: 'پنجگانہ نماز',
      key: 'fivePrayers',
      render: (record: Member) => {
        const prayers = record.religiousActivities?.fiveDailyPrayers || 0;
        return (
          <Tag color={prayers === 5 ? 'green' : prayers > 0 ? 'orange' : 'red'}>
            {prayers}/5
          </Tag>
        );
      },
      width: 100,
    },
    {
      title: 'MTA',
      key: 'mta',
      render: (record: Member) => {
        const hasMTA = record.religiousActivities?.mtaDish || 
                      record.religiousActivities?.mtaCable || 
                      record.religiousActivities?.mtaInternet;
        return (
          <Tag color={hasMTA ? 'green' : 'red'}>
            {hasMTA ? 'ہاں' : 'نہیں'}
          </Tag>
        );
      },
      width: 80,
    },
    {
      title: 'انٹرنیٹ',
      key: 'internet',
      render: (record: Member) => {
        const hasInternet = record.religiousActivities?.internetAccess;
        return (
          <Tag color={hasInternet ? 'green' : 'red'}>
            {hasInternet ? 'ہاں' : 'نہیں'}
          </Tag>
        );
      },
      width: 100,
    },
    {
      title: 'آخری اپ ڈیٹ',
      key: 'lastUpdated',
      render: (record: Member) => {
        const lastUpdated = record.religiousActivities?.lastUpdated;
        return lastUpdated ? formatDate(lastUpdated) : 'کوئی ڈیٹا نہیں';
      },
      width: 120,
    },
    {
      title: 'عمل',
      key: 'actions',
      render: (record: Member) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditActivities(record)}
          >
            ترمیم
          </Button>
        </Space>
      ),
      width: 100,
    },
  ];

  const stats = getReligiousStats();

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>
        مذہبی سرگرمیاں
      </Title>

      {/* Summary Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="کل ارکان"
              value={stats.totalMembers}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="مذہبی ڈیٹا والے"
              value={stats.membersWithData}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="پانچ نمازیں"
              value={stats.fivePrayersCount}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="MTA صارفین"
              value={stats.mtaUsers}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={`مذہبی سرگرمیاں (${getFilteredMembers().length} میں سے ${stats.membersWithData} کا ڈیٹا)`}
        extra={
          <Space>
            <Button
              type="default"
              icon={<ReloadOutlined />}
              onClick={loadMembers}
              loading={loading}
            >
              ریفریش
            </Button>
            <Button
              type="default"
              icon={<DownloadOutlined />}
              onClick={handleExport}
            >
              ایکسپورٹ
            </Button>
          </Space>
        }
      >
        {/* Search Bar */}
        <Row style={{ marginBottom: 16 }}>
          <Col span={24}>
            <Input
              placeholder="نام، والد کا نام، یا حلقہ سے تلاش کریں..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ maxWidth: 400 }}
            />
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={getFilteredMembers()}
          rowKey="id"
          loading={loading}
          pagination={{
            defaultPageSize: 10,
            pageSizeOptions: [10, 20, 50, 100],
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} میں سے ${total} ارکان`,
            responsive: true,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* Edit Religious Activities Modal */}
      <Modal
        title={`مذہبی سرگرمیاں: ${editingMember?.name}`}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={800}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          preserve={false}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="نام">
                <Input disabled value={editingMember?.name} />
              </Form.Item>
            </Col>
                         <Col span={12}>
               <Form.Item label="تنظیم">
                 <Input disabled value={getTanzeemDisplayName(editingMember?.tanzeem || 'khuddam' as Tanzeem)} />
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
    </div>
  );
};

export default ReligiousActivitiesPage;
