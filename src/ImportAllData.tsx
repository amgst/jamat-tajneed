import React, { useState } from 'react';
import { Button, Card, Spin, Alert, Typography, Space, Checkbox, Popconfirm } from 'antd';
import { CloudUploadOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// --- Mocked types from your project (for self-containment) ---
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
const determineTanzeem = (age: number, gender: 'male' | 'female'): Tanzeem => {
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

// --- Helper function for robust name comparison ---
const sanitizeName = (name: string): string => {
  return name.replace(/\s/g, '').toLowerCase();
};

const MEMBERS_COLLECTION = 'members';
const FAMILIES_COLLECTION = 'families';

const addMember = async (member: Omit<Member, 'id'>): Promise<string> => {
  const tanzeem = determineTanzeem(member.age, member.gender);
  const docRef = await addDoc(collection(db, MEMBERS_COLLECTION), {
    ...member,
    tanzeem,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  return docRef.id;
};

const updateMember = async (id: string, updates: Partial<Member>): Promise<void> => {
  const memberRef = doc(db, MEMBERS_COLLECTION, id);
  await updateDocFirestore(memberRef, {
    ...updates,
    updatedAt: new Date().toISOString()
  });
};

const addFamily = async (family: Omit<Family, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, FAMILIES_COLLECTION), {
    ...family,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  return docRef.id;
};

const deleteCollection = async (collectionName: string) => {
  const q = query(collection(db, collectionName));
  const querySnapshot = await getDocs(q);
  const deletePromises = querySnapshot.docs.map(d => deleteDoc(doc(db, collectionName, d.id)));
  return Promise.all(deletePromises);
};


// --- All Extracted Data from PDF ---
const allDataToImport = [];

const ImportAllData: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [importerStatus, setImporterStatus] = useState<string | null>(null);
  const [deleteExisting, setDeleteExisting] = useState(false);

  const handleImport = async () => {
    setIsExporting(true);
    setImporterStatus('Starting data import...');

    try {
      await signInAnonymously(auth);
      setImporterStatus('Authenticated anonymously. Starting data import...');

      if (deleteExisting) {
        setImporterStatus('Deleting existing members and families...');
        await deleteCollection(MEMBERS_COLLECTION);
        await deleteCollection(FAMILIES_COLLECTION);
        setImporterStatus('Existing data deleted successfully.');
      }

      for (const familyData of allDataToImport) {
        try {
          setImporterStatus(`Processing family: ${familyData.familyName}`);

          // Step 1: Add all members and store their new IDs
          const memberDocs = [];
          for (const member of familyData.members) {
            const newMemberId = await addMember(member as any);
            memberDocs.push({ ...member, id: newMemberId });
            setImporterStatus(`Added member: ${member.name}`);
          }

          // Find the new member ID for the family head using a sanitized name comparison
          const familyHeadDoc = memberDocs.find(
            (m) => sanitizeName(m.name) === sanitizeName(familyData.familyHeadName)
          );
          if (!familyHeadDoc) {
            throw new Error(`Could not find family head: ${familyData.familyHeadName}`);
          }

          // Step 2: Create the family with the correct head and member IDs
          const newFamily = {
            familyName: familyData.familyName,
            headId: familyHeadDoc.id,
            memberIds: memberDocs.map((m) => m.id),
            totalMembers: memberDocs.length,
            halqa: familyData.members[0].halqa,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const newFamilyId = await addFamily(newFamily);
          setImporterStatus(`Created family: ${familyData.familyName} with ID ${newFamilyId}`);

          // Step 3: Update each member to reference the new family ID
          for (const memberDoc of memberDocs) {
            await updateMember(memberDoc.id, { familyId: newFamilyId });
            setImporterStatus(`Updated member ${memberDoc.name} with family ID ${newFamilyId}`);
          }
        } catch (error) {
          console.error(`Error processing family ${familyData.familyName}:`, error);
          setImporterStatus(`Skipped family: ${familyData.familyName} due to an error.`);
        }
      }

      setImporterStatus('All data import process finished. Please check the status messages above for any skipped families.');
    } catch (error) {
      console.error('Error during data export:', error);
      setImporterStatus(`Error exporting data: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card
      title="All-in-One Data Importer"
      style={{ margin: 'auto', maxWidth: 800, marginTop: 50, textAlign: 'center' }}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Title level={4}>Import All PDF Data to Firestore</Title>
        <Text>
          This powerful script will extract and import all family and member data from your PDF into your Firebase Firestore.
          You have the option to delete all existing data first for a clean import.
        </Text>
        <Popconfirm
          title="Are you sure you want to delete all existing data?"
          description="This action is irreversible. All current members and families will be permanently deleted before the import begins."
          okText="Yes, Delete"
          cancelText="No, Keep Data"
          onConfirm={() => setDeleteExisting(true)}
          disabled={isExporting}
        >
          <Checkbox checked={deleteExisting} onChange={(e) => setDeleteExisting(e.target.checked)} disabled={isExporting}>
            <Text type="danger" strong><WarningOutlined /> Delete All Existing Data</Text>
          </Checkbox>
        </Popconfirm>
        <Button
          type="primary"
          icon={isExporting ? <Spin /> : <CloudUploadOutlined />}
          onClick={handleImport}
          disabled={isExporting || importerStatus?.includes('All data import process finished')}
          size="large"
          style={{ width: '100%' }}
        >
          {isExporting ? 'Exporting...' : 'Run All-in-One Importer'}
        </Button>
        {importerStatus && (
          <Alert
            message={importerStatus}
            type={importerStatus.includes('Error') || importerStatus.includes('Skipped family') ? 'error' : 'success'}
            showIcon
            icon={importerStatus.includes('Error') || importerStatus.includes('Skipped family') ? undefined : <CheckCircleOutlined />}
          />
        )}
      </Space>
    </Card>
  );
};

export default ImportAllData;
