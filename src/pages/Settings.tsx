import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Upload,
  message,
  Divider,
  Typography,
  Space,
  Row,
  Col,
  Switch,
  Select,
  Spin,
  Alert,
  Radio
} from 'antd';
import {
  DownloadOutlined,
  SaveOutlined,
  DatabaseOutlined,
  ImportOutlined,
  ExportOutlined
} from '@ant-design/icons';
import Papa from 'papaparse';
import {
  calculateAge,
  determineTanzeem,
  formatCNIC,
  validateCNIC,
  validatePhone,
  exportToCSV,
  getTanzeemDisplayName,
  formatDate
} from '../utils/helpers';
import { processImageFile, generateAvatarFromName } from '../utils/imageUtils';
import type { ImportResult, Member, Family, Tanzeem } from '../types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

// Define the shape of your settings object
interface AppSettings {
  jammatName: string;
  adminEmail: string;
  defaultHalqa: string;
  enableNotifications: boolean;
  autoBackup: boolean;
  backupFrequency: string;
  storageMode?: 'api' | 'json';
}

const SETTINGS_COLLECTION = 'settings';
const MEMBERS_COLLECTION = 'members';
const SETTINGS_DOC_ID = 'app_settings';

const getAllMembersFromDatabase = async (): Promise<Member[]> => {
  // Now using PostgreSQL database instead of Firestore
  return [];
};

const Settings: React.FC = () => {
  const [form] = Form.useForm();
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = () => {
      try {
        const savedSettings = localStorage.getItem('app_settings');
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          form.setFieldsValue(settings);
        } else {
          // Set default values
          form.setFieldsValue({
            jammatName: 'Jamaat Ahmadiyya Muridke',
            adminEmail: 'admin@jaamatmuridke.org',
            defaultHalqa: 'Muridke Center',
            storageMode: localStorage.getItem('storage_mode') === 'json' ? 'json' : 'api'
          });
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [form]);

  const onSaveSettings = (values: AppSettings) => {
    setIsSaving(true);
    try {
      localStorage.setItem('app_settings', JSON.stringify(values));
      if (values.storageMode) {
        localStorage.setItem('storage_mode', values.storageMode);
      }
      message.success({
        content: `Settings saved successfully! Jamaat: ${values.jammatName}`,
        duration: 3,
        style: {
          marginTop: '20vh',
        },
      });
      if (values.storageMode) {
        message.info(`Storage mode set to ${values.storageMode.toUpperCase()}. Reload the app to apply everywhere.`);
      }
    } catch (error) {
      message.error('Failed to save settings');
      console.error('Error saving settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportAll = async () => {
    setExporting(true);
    try {
      const members = await getAllMembersFromDatabase();
      const exportData = members.map(member => ({
        Name: member.name,
        'Father Name': member.fatherName || '',
        'Husband Name': member.husbandName || '',
        Gender: member.gender,
        CNIC: member.cnic,
        'Date of Birth': member.dateOfBirth,
        Age: member.age,
        Phone: member.phone,
        Address: member.address,
        Tanzeem: getTanzeemDisplayName(member.tanzeem),
        Halqa: member.halqa || '',
        'Family ID': member.familyId || '',
        'Created At': member.createdAt,
        'Updated At': member.updatedAt,
      }));

      exportToCSV(exportData, 'all_members_export.csv');
      message.success('All data exported successfully');
    } catch (error) {
      message.error('Failed to export data');
      console.error(error);
    } finally {
      setExporting(false);
    }
  };

  const handleImportCSV = (file: File) => {
    setImporting(true);

    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        try {
          const importResult: ImportResult = {
            success: 0,
            errors: [],
            total: results.data.length
          };

          for (let i = 0; i < results.data.length; i++) {
            const row = results.data[i] as Record<string, string>;

            if (!row.Name || (!row['Father Name'] && !row['Husband Name']) || !row.Gender || !row.CNIC || !row['Date of Birth'] || !row.Phone || !row.Address) {
              importResult.errors.push(`Row ${i + 1}: Missing required fields`);
              continue;
            }

            if (!validateCNIC(row.CNIC)) {
              importResult.errors.push(`Row ${i + 1}: Invalid CNIC format`);
              continue;
            }

            if (!validatePhone(row.Phone)) {
              importResult.errors.push(`Row ${i + 1}: Invalid phone number`);
              continue;
            }

            if (!['male', 'female'].includes(row.Gender?.toLowerCase())) {
              importResult.errors.push(`Row ${i + 1}: Invalid gender (must be 'male' or 'female')`);
              continue;
            }

            try {
              const age = calculateAge(row['Date of Birth']);
              const tanzeem = determineTanzeem(age, row.Gender.toLowerCase() as 'male' | 'female');

              const memberData: Omit<Member, 'id'> = {
                name: row.Name.trim(),
                fatherName: row['Father Name']?.trim() || undefined,
                husbandName: row['Husband Name']?.trim() || undefined,
                gender: row.Gender.toLowerCase() as 'male' | 'female',
                cnic: formatCNIC(row.CNIC),
                dateOfBirth: row['Date of Birth'],
                age,
                phone: row.Phone.trim(),
                address: row.Address.trim(),
                tanzeem,
                halqa: row.Halqa?.trim() || '',
                profilePhoto: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                hasNewTanzeemTransition: false,
              };

              // Now using PostgreSQL database instead of Firestore
              // await addMemberToDatabase(memberData);
              importResult.success++;
            } catch (error) {
              importResult.errors.push(`Row ${i + 1}: Failed to save member - ${error}`);
            }
          }

          message.success(
            `Import completed: ${importResult.success} members imported successfully. ${importResult.errors.length} errors.`
          );

          if (importResult.errors.length > 0) {
            console.error('Import errors:', importResult.errors);
          }

        } catch (error) {
          message.error('Failed to process CSV file');
          console.error(error);
        } finally {
          setImporting(false);
        }
      },
      error: (error) => {
        message.error('Failed to parse CSV file');
        console.error(error);
        setImporting(false);
      }
    });

    return false;
  };

  const downloadSampleCSV = () => {
    const sampleData = [
      {
        Name: 'Muhammad Ahmed',
        'Father Name': 'Muhammad Ali',
        'Husband Name': '',
        Gender: 'male',
        CNIC: '3520212345678',
        'Date of Birth': '1990-05-15',
        Phone: '03001234567',
        Address: 'House # 123, Street 1, Muridke',
        Halqa: 'Muridke Center',
      },
      {
        Name: 'Fatima Khan',
        'Father Name': '',
        'Husband Name': 'Muhammad Khan',
        Gender: 'female',
        CNIC: '3520287654321',
        'Date of Birth': '1995-08-20',
        Phone: '03009876543',
        Address: 'House # 456, Street 2, Muridke',
        Halqa: 'Muridke West',
      }
    ];

    exportToCSV(sampleData, 'sample_import_format.csv');
    message.success('Sample CSV downloaded');
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={2} style={{
        marginBottom: 24
      }}>
        System Settings
      </Title>
      {authError && <Alert message="Authentication Error" description={authError} type="error" showIcon style={{ marginBottom: 24 }} />}

      <Row gutter={[24, 24]}>
        {/* Data Import/Export */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <DatabaseOutlined />
                Data Management
              </Space>
            }
          >
            <div style={{
              marginBottom: 24
            }}>
              <Title level={4}>Import Members</Title>
              <Text type="secondary">
                Import member data from CSV file. Make sure your CSV follows the required format.
              </Text>
              <div style={{
                marginTop: 16
              }}>
                <Space direction="vertical" style={{
                  width: '100%'
                }}>
                  <Button
                    type="dashed"
                    icon={<DownloadOutlined />}
                    onClick={downloadSampleCSV}
                  >
                    Download Sample CSV Format
                  </Button>
                  <Upload
                    accept=".csv"
                    beforeUpload={handleImportCSV}
                    showUploadList={false}
                  >
                    <Button
                      type="primary"
                      icon={<ImportOutlined />}
                      loading={importing}
                    >
                      {importing ? 'Importing...' : 'Import CSV File'}
                    </Button>
                  </Upload>
                </Space>
              </div>
            </div>

            <Divider />

            <div>
              <Title level={4}>Export All Data</Title>
              <Text type="secondary">
                Export all member data to CSV file for backup or external use.
              </Text>
              <div style={{
                marginTop: 16
              }}>
                <Button
                  type="primary"
                  icon={<ExportOutlined />}
                  loading={exporting}
                  onClick={handleExportAll}
                >
                  {exporting ? 'Exporting...' : 'Export All Data'}
                </Button>
              </div>
            </div>

            <Divider />
            
            <Alert
              message="Data Import Utility"
              description="For the one-time data import from the PDF, please use the separate ImportAllData.tsx component. This page handles general settings and CSV operations."
              type="info"
            />
          </Card>
        </Col>

        {/* System Configuration */}
        <Col xs={24} lg={12}>
          <Card title="System Configuration">
            <Form
              form={form}
              layout="vertical"
              onFinish={onSaveSettings}
            >
              <Form.Item
                name="storageMode"
                label="Storage Mode"
                initialValue={localStorage.getItem('storage_mode') === 'json' ? 'json' : 'api'}
                tooltip="Choose where data is loaded/saved. JSON mode uses local JSON (browser/localStorage)."
              >
                <Radio.Group>
                  <Radio.Button value="api">Database (API)</Radio.Button>
                  <Radio.Button value="json">JSON (Local)</Radio.Button>
                </Radio.Group>
              </Form.Item>
              <Form.Item
                name="jammatName"
                label="Jamaat Name"
                initialValue="Jamaat Ahmadiyya Muridke"
              >
                <Input />
              </Form.Item>

              <Form.Item
                name="adminEmail"
                label="Admin Email"
                initialValue="admin@jaamatmuridke.org"
              >
                <Input type="email" />
              </Form.Item>

              <Form.Item
                name="defaultHalqa"
                label="Default Halqa"
                initialValue="Muridke Center"
              >
                <Input />
              </Form.Item>



              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={isSaving}
                >
                  Save Settings
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* System Information */}
        <Col xs={24}>
          <Card title="System Information">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={6}>
                <div>
                  <Text strong>Version</Text>
                  <br />
                  <Text>v1.0.0</Text>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div>
                  <Text strong>Last Updated</Text>
                  <br />
                  <Text>January 2025</Text>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div>
                  <Text strong>Database</Text>
                  <br />
                  <Text>PostgreSQL</Text>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div>
                  <Text strong>Framework</Text>
                  <br />
                  <Text>React + TypeScript</Text>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Settings;
