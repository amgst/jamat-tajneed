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
  Select,
  Spin,
  Alert,
} from 'antd';
import {
  DownloadOutlined,
  SaveOutlined,
  DatabaseOutlined,
  ImportOutlined,
  ExportOutlined,
  CloudUploadOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import Papa from 'papaparse';
import {
  getAllMembers,
  addMember,
  updateMember,
  deleteMember
} from '../services/firebase';
import { calculateAge, determineTanzeem, formatCNIC, validateCNIC, validatePhone, exportToCSV } from '../utils/helpers';
import type { ImportResult } from '../types';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc as updateDocFirestore,
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

const { Title, Text } = Typography;
const { Option } = Select;


// --- Firebase Configuration for Importer ---
// This configuration is needed here for the import function to be self-contained.
const firebaseConfig = {
  apiKey: "AIzaSyAa6zRE_7TKpT5nVq3VmO8Kr5-h12PpfGM",
  authDomain: "jamat-tajneed-44f6d.firebaseapp.com",
  projectId: "jamat-tajneed-44f6d",
  storageBucket: "jamat-tajneed-44f6d.firebasestorage.app",
  messagingSenderId: "794157972693",
  appId: "1:794157972693:web:2f012a4f481c5dbc38f65c",
  measurementId: "G-QGXD60BLHC"
};

// --- Mocked types from your project ---
export type Tanzeem =
  | 'saf-e-awal'
  | 'saf-e-awal-girls'
  | 'atfal'
  | 'nasirat'
  | 'khuddam'
  | 'lajna'
  | 'ansar';

export interface Member {
  id: string;
  name: string;
  fatherName?: string;
  husbandName?: string;
  gender: 'male' | 'female';
  cnic?: string;
  dateOfBirth: string;
  age: number;
  phone: string;
  address: string;
  profilePhoto?: string;
  tanzeem: Tanzeem;
  familyId?: string;
  halqa?: string;
  hasNewTanzeemTransition?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Family {
  id: string;
  headId: string; // Member ID of family head
  familyName: string;
  memberIds: string[];
  totalMembers: number;
  halqa?: string;
  createdAt: string;
  updatedAt: string;
}

// --- Utility function to determine Tanzeem based on age and gender ---
const localDetermineTanzeem = (age: number, gender: 'male' | 'female'): Tanzeem => {
  if (gender === 'male') {
    if (age < 7) return 'saf-e-awal';
    if (age < 15) return 'atfal';
    if (age < 40) return 'khuddam';
    return 'ansar';
  } else {
    if (age < 7) return 'saf-e-awal-girls';
    if (age < 15) return 'nasirat';
    return 'lajna';
  }
};

// --- Firebase Service Functions for Importer ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const MEMBERS_COLLECTION = 'members';
const FAMILIES_COLLECTION = 'families';

const localAddMember = async (member: Omit<Member, 'id'>): Promise<string> => {
  const tanzeem = localDetermineTanzeem(member.age, member.gender);
  const docRef = await addDoc(collection(db, MEMBERS_COLLECTION), {
    ...member,
    tanzeem,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  return docRef.id;
};

const localUpdateMember = async (id: string, updates: Partial<Member>): Promise<void> => {
  const memberRef = doc(db, MEMBERS_COLLECTION, id);
  await updateDoc(memberRef, {
    ...updates,
    updatedAt: new Date().toISOString()
  });
};

const localAddFamily = async (family: Omit<Family, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, FAMILIES_COLLECTION), {
    ...family,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  return docRef.id;
};

// --- Data Extracted from your PDF with corrected names ---
const dataToImport = [
  {
    familyName: 'خان فیملی',
    familyHeadName: 'حارث محمود',
    members: [
      {
        name: 'حارث محمود',
        fatherName: 'طارق محمود',
        gender: 'male' as 'male',
        phone: '03357752900',
        age: 32,
        address: 'Unknown',
        dateOfBirth: '1993-01-01',
        halqa: 'کینال پارک',
      },
      {
        name: 'سعیدہ حارث',
        husbandName: 'حارث محمود',
        gender: 'female' as 'female',
        phone: 'Unknown',
        age: 32,
        address: 'Unknown',
        dateOfBirth: '1993-01-01',
        halqa: 'کینال پارک',
      },
      {
        name: 'سلمان حارث',
        fatherName: 'حارث محمود',
        gender: 'male' as 'male',
        phone: 'Unknown',
        age: 10,
        address: 'Unknown',
        dateOfBirth: '2015-01-01',
        halqa: 'کینال پارک',
      },
      {
        name: 'راہب احمد واصف',
        fatherName: 'حارث محمود',
        gender: 'male' as 'male',
        phone: 'Unknown',
        age: 5,
        address: 'Unknown',
        dateOfBirth: '2020-01-01',
        halqa: 'کینال پارک',
      },
      {
        name: 'شہر و ز حارث',
        fatherName: 'حارث محمود',
        gender: 'male' as 'male',
        phone: 'Unknown',
        age: 2,
        address: 'Unknown',
        dateOfBirth: '2023-01-01',
        halqa: 'کینال پارک',
      },
    ],
  },
  {
    familyName: 'بٹ فیملی',
    familyHeadName: 'لقمان احمد بٹ',
    members: [
      {
        name: 'لقمان احمد بٹ',
        fatherName: 'حبیب احمد بٹ',
        gender: 'male' as 'male',
        phone: '03214117507',
        age: 39,
        address: 'Unknown',
        dateOfBirth: '1986-01-01',
        halqa: 'کینال پارک',
      },
      {
        name: 'سعدیہ لقمان',
        husbandName: 'لقمان احمد بٹ',
        gender: 'female' as 'female',
        phone: 'Unknown',
        age: 32,
        address: 'Unknown',
        dateOfBirth: '1993-01-01',
        halqa: 'کینال پارک',
      },
      {
        name: 'فریدہ لقمان',
        fatherName: 'لقمان احمد بٹ',
        gender: 'female' as 'female',
        phone: 'Unknown',
        age: 13,
        address: 'Unknown',
        dateOfBirth: '2012-01-01',
        halqa: 'کینال پارک',
      },
      {
        name: 'شمائلہ لقمان',
        fatherName: 'لقمان احمد بٹ',
        gender: 'female' as 'female',
        phone: 'Unknown',
        age: 10,
        address: 'Unknown',
        dateOfBirth: '2015-01-01',
        halqa: 'کینال پارک',
      },
      {
        name: 'حمد ان احمد',
        fatherName: 'لقمان احمد بٹ',
        gender: 'male' as 'male',
        phone: 'Unknown',
        age: 7,
        address: 'Unknown',
        dateOfBirth: '2018-01-01',
        halqa: 'کینال پارک',
      },
      {
        name: 'عبد القدوس',
        fatherName: 'لقمان احمد بٹ',
        gender: 'male' as 'male',
        phone: 'Unknown',
        age: 3,
        address: 'Unknown',
        dateOfBirth: '2022-01-01',
        halqa: 'کینال پارک',
      },
    ],
  },
];


const Settings: React.FC = () => {
  const [form] = Form.useForm();
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // New state for the custom data importer
  const [isExportingData, setIsExportingData] = useState(false);
  const [importerStatus, setImporterStatus] = useState<string | null>(null);

  const handleExportData = async () => {
    setIsExportingData(true);
    setImporterStatus('Starting data export...');

    try {
      // Step 1: Sign in anonymously to gain write permissions
      await signInAnonymously(auth);
      setImporterStatus('Authenticated anonymously. Starting data import...');
      
      for (const familyData of dataToImport) {
        // Step 2: Add all members and store their new IDs
        const memberDocs = [];
        for (const member of familyData.members) {
          const newMemberId = await localAddMember(member as any);
          memberDocs.push({ ...member, id: newMemberId });
          setImporterStatus(`Added member: ${member.name}`);
        }

        // Find the new member ID for the family head
        const familyHeadDoc = memberDocs.find(
          (m) => m.name === familyData.familyHeadName
        );
        if (!familyHeadDoc) {
          throw new Error(`Could not find family head: ${familyData.familyHeadName}`);
        }

        // Step 3: Create the family with the correct head and member IDs
        const newFamily = {
          familyName: familyData.familyName,
          headId: familyHeadDoc.id,
          memberIds: memberDocs.map((m) => m.id),
          totalMembers: memberDocs.length,
          halqa: familyData.members[0].halqa, // Assume first member's halqa
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const newFamilyId = await localAddFamily(newFamily);
        setImporterStatus(`Created family: ${familyData.familyName} with ID ${newFamilyId}`);

        // Step 4: Update each member to reference the new family ID
        for (const memberDoc of memberDocs) {
          await localUpdateMember(memberDoc.id, { familyId: newFamilyId });
          setImporterStatus(`Updated member ${memberDoc.name} with family ID ${newFamilyId}`);
        }
      }

      setImporterStatus('Data export completed successfully! You can now check your Firebase console.');
    } catch (error) {
      console.error('Error during data export:', error);
      setImporterStatus(`Error exporting data: ${error.message}`);
    } finally {
      setIsExportingData(false);
    }
  };


  const handleExportAll = async () => {
    setExporting(true);
    try {
      const members = await getAllMembers();
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
            if (!row.Name || !row['Father Name'] && !row['Husband Name'] || !row.Gender || !row.CNIC || !row['Date of Birth'] || !row.Phone || !row.Address) {
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
              <Title level={4}>Export All Data</Title>
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
            
            <Divider />
            
            {/* New section for the data import script */}
            <div>
              <Title level={4}>Initial Data Importer</Title>
              <Text type="secondary">
                This utility imports the sample family data extracted from your PDF into Firebase. This is a one-time operation.
              </Text>
              <div style={{ marginTop: 16 }}>
                <Button
                  type="primary"
                  icon={isExportingData ? <Spin /> : <CloudUploadOutlined />}
                  onClick={handleExportData}
                  disabled={isExportingData || importerStatus?.includes('completed')}
                >
                  {isExportingData ? 'Exporting...' : 'Run Data Importer'}
                </Button>
                {importerStatus && (
                  <Alert
                    style={{ marginTop: 16 }}
                    message={importerStatus}
                    type={importerStatus.includes('Error') ? 'error' : 'success'}
                    showIcon
                    icon={importerStatus.includes('Error') ? undefined : <CheckCircleOutlined />}
                  />
                )}
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
