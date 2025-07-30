import React, { useState } from 'react';
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
  Select
} from 'antd';
import {
  DownloadOutlined,
  SaveOutlined,
  DatabaseOutlined,
  ImportOutlined,
  ExportOutlined
} from '@ant-design/icons';
import Papa from 'papaparse';
import { getAllMembers, addMember } from '../services/firebase'; // Changed import
import { calculateAge, determineTanzeem, formatCNIC, validateCNIC, validatePhone, exportToCSV } from '../utils/helpers';
import type { ImportResult } from '../types';

const { Title, Text } = Typography;
const { Option } = Select;

const Settings: React.FC = () => {
  const [form] = Form.useForm();
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExportAll = async () => {
    setExporting(true);
    try {
      const members = await getAllMembers();
      const exportData = members.map(member => ({
        Name: member.name,
        'Father Name': member.fatherName,
        Gender: member.gender,
        CNIC: member.cnic,
        'Date of Birth': member.dateOfBirth,
        Age: member.age,
        Phone: member.phone,
        Address: member.address,
        Tanzeem: member.tanzeem,
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

            // Validate required fields
            if (!row.Name || !row['Father Name'] || !row.Gender || !row.CNIC || !row['Date of Birth'] || !row.Phone || !row.Address) {
              importResult.errors.push(`Row ${i + 1}: Missing required fields`);
              continue;
            }

            // Validate CNIC
            if (!validateCNIC(row.CNIC)) {
              importResult.errors.push(`Row ${i + 1}: Invalid CNIC format`);
              continue;
            }

            // Validate Phone
            if (!validatePhone(row.Phone)) {
              importResult.errors.push(`Row ${i + 1}: Invalid phone number`);
              continue;
            }

            // Validate Gender
            if (!['male', 'female'].includes(row.Gender?.toLowerCase())) {
              importResult.errors.push(`Row ${i + 1}: Invalid gender (must be 'male' or 'female')`);
              continue;
            }

            try {
              const age = calculateAge(row['Date of Birth']);
              const tanzeem = determineTanzeem(age, row.Gender.toLowerCase() as 'male' | 'female');

              const memberData = {
                name: row.Name.trim(),
                fatherName: row['Father Name'].trim(),
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
              };

              await addMember(memberData);
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

    return false; // Prevent default upload behavior
  };

  const downloadSampleCSV = () => {
    const sampleData = [
      {
        Name: 'Muhammad Ahmed',
        'Father Name': 'Muhammad Ali',
        Gender: 'male',
        CNIC: '3520212345678',
        'Date of Birth': '1990-05-15',
        Phone: '03001234567',
        Address: 'House # 123, Street 1, Muridke',
        Halqa: 'Muridke Center',
      },
      {
        Name: 'Fatima Khan',
        'Father Name': 'Muhammad Khan',
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

  return (
    <div>
      <Title level={2} style={{ marginBottom: 24 }}>
        System Settings
      </Title>

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
            <div style={{ marginBottom: 24 }}>
              <Title level={4}>Import Members</Title>
              <Text type="secondary">
                Import member data from CSV file. Make sure your CSV follows the required format.
              </Text>
              <div style={{ marginTop: 16 }}>
                <Space direction="vertical" style={{ width: '100%' }}>
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
              <Title level={4}>Export Data</Title>
              <Text type="secondary">
                Export all member data to CSV file for backup or external use.
              </Text>
              <div style={{ marginTop: 16 }}>
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
          </Card>
        </Col>

        {/* System Configuration */}
        <Col xs={24} lg={12}>
          <Card title="System Configuration">
            <Form
              form={form}
              layout="vertical"
              onFinish={(values) => {
                console.log('Settings saved:', values);
                message.success('Settings saved successfully');
              }}
            >
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

              <Form.Item
                name="enableNotifications"
                label="Enable Notifications"
                valuePropName="checked"
                initialValue={true}
              >
                <Switch />
              </Form.Item>

              <Form.Item
                name="autoBackup"
                label="Auto Backup"
                valuePropName="checked"
                initialValue={false}
              >
                <Switch />
              </Form.Item>

              <Form.Item
                name="backupFrequency"
                label="Backup Frequency"
                initialValue="weekly"
              >
                <Select>
                  <Option value="daily">Daily</Option>
                  <Option value="weekly">Weekly</Option>
                  <Option value="monthly">Monthly</Option>
                </Select>
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
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
                  <Text>7/28/2025</Text>
                </div>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <div>
                  <Text strong>Database</Text>
                  <br />
                  <Text>Firebase Firestore</Text>
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
