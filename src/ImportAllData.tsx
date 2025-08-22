import React, { useState } from 'react';
import { Button, Card, Spin, Alert, Typography, Space, Checkbox, Popconfirm } from 'antd';
import { CloudUploadOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc as updateDocFirestore,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// --- Your Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyAa6zRE_7TKpT5nVq3VmO8Kr5-h12PpfGM",
  authDomain: "jamat-tajneed-44f6d.firebaseapp.com",
  projectId: "jamat-tajneed-44f6d",
  storageBucket: "jamat-tajneed-44f6d.firebasestorage.app",
  messagingSenderId: "794157972693",
  appId: "1:794157972693:web:2f012a4f481c5dbc38f65c",
  measurementId: "G-QGXD60BLHC"
};

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

// --- Firebase Service Functions ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

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
const allDataToImport = [
    {
        familyName: 'خان فیملی',
        familyHeadName: 'حارث محمود',
        members: [
            { name: 'حارث محمود', fatherName: 'طارق محمود', gender: 'male', phone: '03357752900', age: 32, address: 'Unknown', dateOfBirth: '1993-01-01', halqa: 'کینال پارک' },
            { name: 'سعیدہ حارث', husbandName: 'حارث محمود', gender: 'female', phone: 'Unknown', age: 32, address: 'Unknown', dateOfBirth: '1993-01-01', halqa: 'کینال پارک' },
            { name: 'سلمان حارث', fatherName: 'حارث محمود', gender: 'male', phone: 'Unknown', age: 10, address: 'Unknown', dateOfBirth: '2015-01-01', halqa: 'کینال پارک' },
            { name: 'راهب احمد واصف', fatherName: 'حارث محمود', gender: 'male', phone: 'Unknown', age: 5, address: 'Unknown', dateOfBirth: '2020-01-01', halqa: 'کینال پارک' },
            { name: 'شہر و ز حارث', fatherName: 'حارث محمود', gender: 'male', phone: 'Unknown', age: 2, address: 'Unknown', dateOfBirth: '2023-01-01', halqa: 'کینال پارک' },
        ],
    },
    {
        familyName: 'بٹ فیملی',
        familyHeadName: 'لقمان احمد بٹ',
        members: [
            { name: 'لقمان احمد بٹ', fatherName: 'حبیب احمد بٹ', gender: 'male', phone: '03214117507', age: 39, address: 'Unknown', dateOfBirth: '1986-01-01', halqa: 'کینال پارک' },
            { name: 'سعدیہ لقمان', husbandName: 'لقمان احمد بٹ', gender: 'female', phone: 'Unknown', age: 32, address: 'Unknown', dateOfBirth: '1993-01-01', halqa: 'کینال پارک' },
            { name: 'فریدہ لقمان', fatherName: 'لقمان احمد بٹ', gender: 'female', phone: 'Unknown', age: 13, address: 'Unknown', dateOfBirth: '2012-01-01', halqa: 'کینال پارک' },
            { name: 'شمائلہ لقمان', fatherName: 'لقمان احمد بٹ', gender: 'female', phone: 'Unknown', age: 10, address: 'Unknown', dateOfBirth: '2015-01-01', halqa: 'کینال پارک' },
            { name: 'حمد ان احمد', fatherName: 'لقمان احمد بٹ', gender: 'male', phone: 'Unknown', age: 7, address: 'Unknown', dateOfBirth: '2018-01-01', halqa: 'کینال پارک' },
            { name: 'عبد القدوس', fatherName: 'لقمان احمد بٹ', gender: 'male', phone: 'Unknown', age: 3, address: 'Unknown', dateOfBirth: '2022-01-01', halqa: 'کینال پارک' },
        ],
    },
    {
        familyName: 'فاروق فیملی',
        familyHeadName: 'فاروق احمد',
        members: [
            { name: 'فاروق احمد', fatherName: 'منشی نور حسین', gender: 'male', phone: '03214322841', age: 67, address: 'Unknown', dateOfBirth: '1958-01-01', halqa: 'Unknown' },
            { name: 'مسرت فاروق', husbandName: 'فاروق احمد', gender: 'female', phone: 'Unknown', age: 62, address: 'Unknown', dateOfBirth: '1963-01-01', halqa: 'Unknown' },
            { name: 'امتیاز احمد', fatherName: 'منشی نور حسین', gender: 'male', phone: 'Unknown', age: 60, address: 'Unknown', dateOfBirth: '1965-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'خالد فیملی',
        familyHeadName: 'یسمین خالد',
        members: [
            { name: 'یسمین خالد', husbandName: 'خالد احمد', gender: 'female', phone: '03024639163', age: 47, address: 'Unknown', dateOfBirth: '1978-01-01', halqa: 'Unknown' },
            { name: 'افشاں عروج', fatherName: 'خالد احمد', gender: 'female', phone: 'Unknown', age: 25, address: 'Unknown', dateOfBirth: '2000-01-01', halqa: 'Unknown' },
            { name: 'يشفع عروج', fatherName: 'خالد احمد', gender: 'female', phone: 'Unknown', age: 22, address: 'Unknown', dateOfBirth: '2003-01-01', halqa: 'Unknown' },
            { name: 'نائمہ نوشین', fatherName: 'خالد احمد', gender: 'female', phone: 'Unknown', age: 19, address: 'Unknown', dateOfBirth: '2006-01-01', halqa: 'Unknown' },
            { name: 'مسرور احمد', fatherName: 'خالد احمد', gender: 'male', phone: 'Unknown', age: 16, address: 'Unknown', dateOfBirth: '2009-01-01', halqa: 'Unknown' },
            { name: 'تحمید احمد', fatherName: 'ولید احمد', gender: 'male', phone: 'Unknown', age: 2, address: 'Unknown', dateOfBirth: '2023-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'یوسف شاہد فیملی',
        familyHeadName: 'محمد یوسف شاہد',
        members: [
            { name: 'محمد یوسف شاہد', fatherName: 'Unknown', gender: 'male', phone: '03344188485', age: 77, address: 'Unknown', dateOfBirth: '1948-01-01', halqa: 'Unknown' },
            { name: 'مقبول یوسف', husbandName: 'محمد یوسف', gender: 'female', phone: 'Unknown', age: 73, address: 'Unknown', dateOfBirth: '1952-01-01', halqa: 'Unknown' },
            { name: 'امة السبوح', fatherName: 'Unknown', gender: 'female', phone: 'Unknown', age: 23, address: 'Unknown', dateOfBirth: '2002-01-01', halqa: 'Unknown' },
            { name: 'از کی منیر', fatherName: 'Unknown', gender: 'female', phone: 'Unknown', age: 21, address: 'Unknown', dateOfBirth: '2004-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'بشیر احمد فیملی',
        familyHeadName: 'منشی بشیر احمد',
        members: [
            { name: 'منشی بشیر احمد', fatherName: 'Unknown', gender: 'male', phone: '03349762252', age: 75, address: 'Unknown', dateOfBirth: '1950-01-01', halqa: 'Unknown' },
            { name: 'امة المومنہ', husbandName: 'بشیر احمد', gender: 'female', phone: 'Unknown', age: 72, address: 'Unknown', dateOfBirth: '1953-01-01', halqa: 'Unknown' },
            { name: 'تو قیر احمد', fatherName: 'بشیر احمد', gender: 'male', phone: 'Unknown', age: 46, address: 'Unknown', dateOfBirth: '1979-01-01', halqa: 'Unknown' },
            { name: 'حمیر اتوقیر', husbandName: 'توقیر احمد', gender: 'female', phone: 'Unknown', age: 46, address: 'Unknown', dateOfBirth: '1979-01-01', halqa: 'Unknown' },
            { name: 'ماریہ تو قیر', fatherName: 'توقیر احمد', gender: 'female', phone: 'Unknown', age: 19, address: 'Unknown', dateOfBirth: '2006-01-01', halqa: 'Unknown' },
            { name: 'توصیف احمد', fatherName: 'توقیر احمد', gender: 'male', phone: 'Unknown', age: 15, address: 'Unknown', dateOfBirth: '2010-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'ظہیر احمد بابر فیملی',
        familyHeadName: 'ظہیر احمد بابر',
        members: [
            { name: 'ظہیر احمد بابر', fatherName: 'منیر احمد', gender: 'male', phone: '03009497502', age: 56, address: 'Unknown', dateOfBirth: '1969-01-01', halqa: 'Unknown' },
            { name: 'عاطفه ظہیر', husbandName: 'ظہیر احمد', gender: 'female', phone: 'Unknown', age: 48, address: 'Unknown', dateOfBirth: '1977-01-01', halqa: 'Unknown' },
            { name: 'شمیم اختر', husbandName: 'منیر احمد', gender: 'female', phone: 'Unknown', age: 78, address: 'Unknown', dateOfBirth: '1947-01-01', halqa: 'Unknown' },
            { name: 'خوله احمد', fatherName: 'ظہیر احمد', gender: 'female', phone: 'Unknown', age: 13, address: 'Unknown', dateOfBirth: '2012-01-01', halqa: 'Unknown' },
            { name: 'ماه نور', husbandName: 'عمیر احمد', gender: 'female', phone: 'Unknown', age: 23, address: 'Unknown', dateOfBirth: '2002-01-01', halqa: 'Unknown' },
            { name: 'حازق احمد', fatherName: 'عمیر احمد', gender: 'male', phone: 'Unknown', age: 0, address: 'Unknown', dateOfBirth: '2025-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'مبشر احمد گل فیملی',
        familyHeadName: 'مبشر احمد گل',
        members: [
            { name: 'مبشر احمد گل', fatherName: 'منیر احمد گل', gender: 'male', phone: '03024343481', age: 51, address: 'Unknown', dateOfBirth: '1974-01-01', halqa: 'Unknown' },
            { name: 'عمیره مبشر', husbandName: 'مبشر احمد گل', gender: 'female', phone: 'Unknown', age: 48, address: 'Unknown', dateOfBirth: '1977-01-01', halqa: 'Unknown' },
            { name: 'صوفیہ مبشر', fatherName: 'مبشر احمد گل', gender: 'female', phone: 'Unknown', age: 24, address: 'Unknown', dateOfBirth: '2001-01-01', halqa: 'Unknown' },
            { name: 'نسیم احمد گل', fatherName: 'مبشر احمد گل', gender: 'male', phone: 'Unknown', age: 21, address: 'Unknown', dateOfBirth: '2004-01-01', halqa: 'Unknown' },
            { name: 'افراح مبشر', fatherName: 'مبشر احمد گل', gender: 'female', phone: 'Unknown', age: 20, address: 'Unknown', dateOfBirth: '2005-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'اعظم منیر گل فیملی',
        familyHeadName: 'اعظم منیر گل',
        members: [
            { name: 'اعظم منیر گل', fatherName: 'منیر احمد گل', gender: 'male', phone: '03347507666', age: 47, address: 'Unknown', dateOfBirth: '1978-01-01', halqa: 'Unknown' },
            { name: 'بشری فریال', husbandName: 'اعظم منیر', gender: 'female', phone: 'Unknown', age: 37, address: 'Unknown', dateOfBirth: '1988-01-01', halqa: 'Unknown' },
            { name: 'عادل احمد گل', fatherName: 'اعظم منیر گل', gender: 'male', phone: 'Unknown', age: 12, address: 'Unknown', dateOfBirth: '2013-01-01', halqa: 'Unknown' },
            { name: 'باسل احمد گل', fatherName: 'اعظم منیر گل', gender: 'male', phone: 'Unknown', age: 9, address: 'Unknown', dateOfBirth: '2016-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'احمد مالک فیملی',
        familyHeadName: 'احمد مالک',
        members: [
            { name: 'احمد مالک', fatherName: 'بٹر', gender: 'male', phone: '03240454334', age: 55, address: 'Unknown', dateOfBirth: '1970-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'محمد عرفان فیملی',
        familyHeadName: 'محمد عرفان',
        members: [
            { name: 'محمد عرفان', fatherName: 'خوشی محمد', gender: 'male', phone: '03034099508', age: 38, address: 'Unknown', dateOfBirth: '1987-01-01', halqa: 'Unknown' },
            { name: 'رشیدہ بیگم', husbandName: 'خوشی محمد', gender: 'female', phone: 'Unknown', age: 66, address: 'Unknown', dateOfBirth: '1959-01-01', halqa: 'Unknown' },
            { name: 'محمد عبد اللہ', fatherName: 'خوشی محمد', gender: 'male', phone: 'Unknown', age: 33, address: 'Unknown', dateOfBirth: '1992-01-01', halqa: 'Unknown' },
            { name: 'مزمل رانی', husbandName: 'محمد عبد الله', gender: 'female', phone: 'Unknown', age: 32, address: 'Unknown', dateOfBirth: '1993-01-01', halqa: 'Unknown' },
            { name: 'دعا خوشی', fatherName: 'محمد عبد الله', gender: 'female', phone: 'Unknown', age: 6, address: 'Unknown', dateOfBirth: '2019-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'محمد جاوید اقبال فیملی',
        familyHeadName: 'محمد جاوید اقبال',
        members: [
            { name: 'محمد جاوید اقبال', fatherName: 'خوشی محمد', gender: 'male', phone: '03004365212', age: 65, address: 'Unknown', dateOfBirth: '1960-01-01', halqa: 'Unknown' },
            { name: 'زبیدہ جاوید', husbandName: 'محمد جاوید اقبال', gender: 'female', phone: 'Unknown', age: 63, address: 'Unknown', dateOfBirth: '1962-01-01', halqa: 'Unknown' },
            { name: 'مسرت اقبال', fatherName: 'محمد جاوید اقبال', gender: 'female', phone: 'Unknown', age: 35, address: 'Unknown', dateOfBirth: '1990-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'ظفر اقبال فیملی',
        familyHeadName: 'ظفر اقبال',
        members: [
            { name: 'ظفر اقبال', fatherName: 'محمد جاوید اقبال', gender: 'male', phone: '03080945049', age: 38, address: 'Unknown', dateOfBirth: '1987-01-01', halqa: 'Unknown' },
            { name: 'مدیحہ ظفر', husbandName: 'ظفر اقبال', gender: 'female', phone: 'Unknown', age: 34, address: 'Unknown', dateOfBirth: '1991-01-01', halqa: 'Unknown' },
            { name: 'بانیہ ظفر', fatherName: 'ظفر اقبال', gender: 'female', phone: 'Unknown', age: 4, address: 'Unknown', dateOfBirth: '2021-01-01', halqa: 'Unknown' },
            { name: 'ہادیہ ظفر', fatherName: 'ظفر اقبال', gender: 'female', phone: 'Unknown', age: 2, address: 'Unknown', dateOfBirth: '2023-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'سر سہیل بھٹہ فیملی',
        familyHeadName: 'سر سہیل بھٹہ',
        members: [
            { name: 'سر سہیل بھٹہ', fatherName: 'صدر الدین', gender: 'male', phone: '03334401678', age: 51, address: 'Unknown', dateOfBirth: '1974-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'ذو الفقار احمد فیملی',
        familyHeadName: 'ذو الفقار احمد',
        members: [
            { name: 'ذو الفقار احمد', fatherName: 'Unknown', gender: 'male', phone: '03139004844', age: 38, address: 'Unknown', dateOfBirth: '1987-01-01', halqa: 'Unknown' },
            { name: 'شمائلہ ذوالفقار', husbandName: 'ذو الفقار احمد', gender: 'female', phone: 'Unknown', age: 35, address: 'Unknown', dateOfBirth: '1990-01-01', halqa: 'Unknown' },
            { name: 'ایان احمد', fatherName: 'ذو الفقار احمد', gender: 'male', phone: 'Unknown', age: 10, address: 'Unknown', dateOfBirth: '2015-01-01', halqa: 'Unknown' },
            { name: 'و قار احمد', fatherName: 'ذو الفقار احمد', gender: 'male', phone: 'Unknown', age: 6, address: 'Unknown', dateOfBirth: '2019-01-01', halqa: 'Unknown' },
            { name: 'علیان احمد', fatherName: 'ذو الفقار احمد', gender: 'male', phone: 'Unknown', age: 2, address: 'Unknown', dateOfBirth: '2023-01-01', halqa: 'Unknown' },
            { name: 'عمر فاروق', fatherName: 'Unknown', gender: 'male', phone: 'Unknown', age: 30, address: 'Unknown', dateOfBirth: '1995-01-01', halqa: 'Unknown' },
            { name: 'صدف غلام رسول', husbandName: 'عمر فاروق', gender: 'female', phone: 'Unknown', age: 32, address: 'Unknown', dateOfBirth: '1993-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'اعجاز احمد فیملی',
        familyHeadName: 'اعجاز احمد',
        members: [
            { name: 'اعجاز احمد', fatherName: 'Unknown', gender: 'male', phone: '03039913001', age: 48, address: 'Unknown', dateOfBirth: '1977-01-01', halqa: 'Unknown' },
            { name: 'امة القدوس', husbandName: 'اعجاز احمد', gender: 'female', phone: 'Unknown', age: 39, address: 'Unknown', dateOfBirth: '1986-01-01', halqa: 'Unknown' },
            { name: 'جازب احمد', fatherName: 'اعجاز احمد', gender: 'male', phone: 'Unknown', age: 20, address: 'Unknown', dateOfBirth: '2005-01-01', halqa: 'Unknown' },
            { name: 'اسد و قاص ثانی', fatherName: 'اعجاز احمد', gender: 'male', phone: 'Unknown', age: 18, address: 'Unknown', dateOfBirth: '2007-01-01', halqa: 'Unknown' },
            { name: 'ارمان احمد شازل', fatherName: 'اعجاز احمد', gender: 'male', phone: 'Unknown', age: 17, address: 'Unknown', dateOfBirth: '2008-01-01', halqa: 'Unknown' },
            { name: 'ملائکہ اعجاز', fatherName: 'اعجاز احمد', gender: 'female', phone: 'Unknown', age: 12, address: 'Unknown', dateOfBirth: '2013-01-01', halqa: 'Unknown' },
            { name: 'سبحان احمد', fatherName: 'اعجاز احمد', gender: 'male', phone: 'Unknown', age: 10, address: 'Unknown', dateOfBirth: '2015-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'خلیل احمد خالد فیملی',
        familyHeadName: 'خلیل احمد خالد',
        members: [
            { name: 'خلیل احمد خالد', fatherName: 'Unknown', gender: 'male', phone: '03027279313', age: 49, address: 'Unknown', dateOfBirth: '1976-01-01', halqa: 'Unknown' },
            { name: 'امة الحفیظ', husbandName: 'خلیل احمد خالد', gender: 'female', phone: 'Unknown', age: 40, address: 'Unknown', dateOfBirth: '1985-01-01', halqa: 'Unknown' },
            { name: 'هشام احمد', fatherName: 'خلیل احمد خالد', gender: 'male', phone: 'Unknown', age: 27, address: 'Unknown', dateOfBirth: '1998-01-01', halqa: 'Unknown' },
            { name: 'عدیل احمد', fatherName: 'خلیل احمد خالد', gender: 'male', phone: 'Unknown', age: 25, address: 'Unknown', dateOfBirth: '2000-01-01', halqa: 'Unknown' },
            { name: 'عدیلہ خلیل', fatherName: 'خلیل احمد خالد', gender: 'female', phone: 'Unknown', age: 23, address: 'Unknown', dateOfBirth: '2002-01-01', halqa: 'Unknown' },
            { name: 'اولیس احمد', fatherName: 'خلیل احمد خالد', gender: 'male', phone: 'Unknown', age: 22, address: 'Unknown', dateOfBirth: '2003-01-01', halqa: 'Unknown' },
            { name: 'امة الودود', fatherName: 'خلیل احمد خالد', gender: 'female', phone: 'Unknown', age: 20, address: 'Unknown', dateOfBirth: '2005-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'محمد اسلم فیملی',
        familyHeadName: 'محمد اسلم',
        members: [
            { name: 'محمد اسلم', fatherName: 'رانا', gender: 'male', phone: '03364437983', age: 87, address: 'Unknown', dateOfBirth: '1938-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'سلیم اللہ فیملی',
        familyHeadName: 'سلیم اللہ',
        members: [
            { name: 'سلیم اللہ', fatherName: 'Unknown', gender: 'male', phone: '03364160754', age: 68, address: 'Unknown', dateOfBirth: '1957-01-01', halqa: 'Unknown' },
            { name: 'صفیہ بی بی', husbandName: 'سلیم اللہ', gender: 'female', phone: 'Unknown', age: 58, address: 'Unknown', dateOfBirth: '1967-01-01', halqa: 'Unknown' },
            { name: 'ثمرین نواز', husbandName: 'یا سر احمد', gender: 'female', phone: 'Unknown', age: 31, address: 'Unknown', dateOfBirth: '1994-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'فاضل مغیب فیملی',
        familyHeadName: 'فاضل مغیب',
        members: [
            { name: 'فاضل مغیب', fatherName: 'مستری حنیف', gender: 'male', phone: '03046317120', age: 44, address: 'Unknown', dateOfBirth: '1981-01-01', halqa: 'Unknown' },
            { name: 'نادیہ صدیقہ', husbandName: 'فاضل غیب', gender: 'female', phone: 'Unknown', age: 44, address: 'Unknown', dateOfBirth: '1981-01-01', halqa: 'Unknown' },
            { name: 'مشفع غیب', fatherName: 'فاضل غیب', gender: 'female', phone: 'Unknown', age: 4, address: 'Unknown', dateOfBirth: '2021-01-01', halqa: 'Unknown' },
            { name: 'نافع احمد', fatherName: 'فاضل مغیب', gender: 'male', phone: 'Unknown', age: 1, address: 'Unknown', dateOfBirth: '2024-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'پروین اختر فیملی',
        familyHeadName: 'پروین اختر',
        members: [
            { name: 'پروین اختر', husbandName: 'محمد نواز', gender: 'female', phone: '03240706704', age: 70, address: 'Unknown', dateOfBirth: '1955-01-01', halqa: 'Unknown' },
            { name: 'ساجد نواز', fatherName: 'محمد نواز', gender: 'male', phone: 'Unknown', age: 50, address: 'Unknown', dateOfBirth: '1975-01-01', halqa: 'Unknown' },
            { name: 'راشد نواز', fatherName: 'محمد نواز', gender: 'male', phone: 'Unknown', age: 48, address: 'Unknown', dateOfBirth: '1977-01-01', halqa: 'Unknown' },
            { name: 'آصف نواز', fatherName: 'محمد نواز', gender: 'male', phone: 'Unknown', age: 43, address: 'Unknown', dateOfBirth: '1982-01-01', halqa: 'Unknown' },
            { name: 'شاہ نواز', fatherName: 'محمد نواز', gender: 'male', phone: 'Unknown', age: 40, address: 'Unknown', dateOfBirth: '1985-01-01', halqa: 'Unknown' },
            { name: 'همنیه شاہ نواز', husbandName: 'شاہ نواز', gender: 'female', phone: 'Unknown', age: 38, address: 'Unknown', dateOfBirth: '1987-01-01', halqa: 'Unknown' },
            { name: 'علی نواز', fatherName: 'محمد نواز', gender: 'male', phone: 'Unknown', age: 38, address: 'Unknown', dateOfBirth: '1987-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'محمود احمد بٹ فیملی',
        familyHeadName: 'محمود احمد بٹ',
        members: [
            { name: 'محمود احمد بٹ', fatherName: 'Unknown', gender: 'male', phone: '03025257597', age: 54, address: 'Unknown', dateOfBirth: '1971-01-01', halqa: 'Unknown' },
            { name: 'انیلہ محمود', husbandName: 'محمود احمد بٹ', gender: 'female', phone: 'Unknown', age: 46, address: 'Unknown', dateOfBirth: '1979-01-01', halqa: 'Unknown' },
            { name: 'ماہرہ محمود', fatherName: 'محمود احمد بٹ', gender: 'female', phone: 'Unknown', age: 24, address: 'Unknown', dateOfBirth: '2001-01-01', halqa: 'Unknown' },
            { name: 'مہوش محمود', fatherName: 'محمود احمد بٹ', gender: 'female', phone: 'Unknown', age: 23, address: 'Unknown', dateOfBirth: '2002-01-01', halqa: 'Unknown' },
            { name: 'سلمان احمد', fatherName: 'محمود احمد بٹ', gender: 'male', phone: 'Unknown', age: 19, address: 'Unknown', dateOfBirth: '2006-01-01', halqa: 'Unknown' },
            { name: 'نعمان احمد', fatherName: 'محمود احمد بٹ', gender: 'male', phone: 'Unknown', age: 17, address: 'Unknown', dateOfBirth: '2008-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'حبیب احمد بٹ فیملی',
        familyHeadName: 'حبیب احمد بٹ',
        members: [
            { name: 'حبیب احمد بٹ', fatherName: 'محمد اسماعیل', gender: 'male', phone: '03014070938', age: 71, address: 'Unknown', dateOfBirth: '1954-01-01', halqa: 'Unknown' },
            { name: 'بشری حبیب', husbandName: 'حبیب احمد بٹ', gender: 'female', phone: 'Unknown', age: 62, address: 'Unknown', dateOfBirth: '1963-01-01', halqa: 'Unknown' },
            { name: 'اہلیہ حبیب احمد بٹ', husbandName: 'حبیب احمد بٹ', gender: 'female', phone: 'Unknown', age: 53, address: 'Unknown', dateOfBirth: '1972-01-01', halqa: 'Unknown' },
            { name: 'احتشام احمد بٹ', fatherName: 'حبیب احمد بٹ', gender: 'male', phone: 'Unknown', age: 27, address: 'Unknown', dateOfBirth: '1998-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'عبد اللہ بٹ فیملی',
        familyHeadName: 'عبد اللہ بٹ',
        members: [
            { name: 'عبد اللہ بٹ', fatherName: 'Unknown', gender: 'male', phone: 'Unknown', age: 50, address: 'Unknown', dateOfBirth: '1975-01-01', halqa: 'Unknown' },
            { name: 'سعود احمد', fatherName: 'عبد اللہ بٹ', gender: 'male', phone: 'Unknown', age: 20, address: 'Unknown', dateOfBirth: '2005-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'حفیظ احمد بٹ فیملی',
        familyHeadName: 'حفیظ احمد بٹ',
        members: [
            { name: 'حفیظ احمد بٹ', fatherName: 'محمد اسماعیل', gender: 'male', phone: '03164809073', age: 61, address: 'Unknown', dateOfBirth: '1964-01-01', halqa: 'Unknown' },
            { name: 'رضیہ بی بی', husbandName: 'حفیظ احمد بٹ', gender: 'female', phone: 'Unknown', age: 55, address: 'Unknown', dateOfBirth: '1970-01-01', halqa: 'Unknown' },
            { name: 'سدید احمد بٹ', fatherName: 'حفیظ احمد بٹ', gender: 'male', phone: 'Unknown', age: 30, address: 'Unknown', dateOfBirth: '1995-01-01', halqa: 'Unknown' },
            { name: 'نفیس احمد بٹ', fatherName: 'حفیظ احمد بٹ', gender: 'male', phone: 'Unknown', age: 29, address: 'Unknown', dateOfBirth: '1996-01-01', halqa: 'Unknown' },
            { name: 'ثوبیہ حفیظ', fatherName: 'حفیظ احمد بٹ', gender: 'female', phone: 'Unknown', age: 23, address: 'Unknown', dateOfBirth: '2002-01-01', halqa: 'Unknown' },
            { name: 'نوید احمد حفیظ', fatherName: 'حفیظ احمد بٹ', gender: 'male', phone: 'Unknown', age: 19, address: 'Unknown', dateOfBirth: '2006-01-01', halqa: 'Unknown' },
            { name: 'عاصمہ حفیظ', fatherName: 'حفیظ احمد بٹ', gender: 'female', phone: 'Unknown', age: 16, address: 'Unknown', dateOfBirth: '2009-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'منیر احمد فیملی',
        familyHeadName: 'منیر احمد',
        members: [
            { name: 'منیر احمد', fatherName: 'بشیر احمد', gender: 'male', phone: '03338109545', age: 50, address: 'Unknown', dateOfBirth: '1975-01-01', halqa: 'Unknown' },
            { name: 'شبانه منیر', husbandName: 'منیر احمد', gender: 'female', phone: 'Unknown', age: 42, address: 'Unknown', dateOfBirth: '1983-01-01', halqa: 'Unknown' },
            { name: 'مصور احمد', fatherName: 'منیر احمد', gender: 'male', phone: 'Unknown', age: 27, address: 'Unknown', dateOfBirth: '1998-01-01', halqa: 'Unknown' },
            { name: 'حفظه منیر', fatherName: 'منیر احمد', gender: 'female', phone: 'Unknown', age: 23, address: 'Unknown', dateOfBirth: '2002-01-01', halqa: 'Unknown' },
            { name: 'تحریمہ شہزادی', fatherName: 'منیر احمد', gender: 'female', phone: 'Unknown', age: 21, address: 'Unknown', dateOfBirth: '2004-01-01', halqa: 'Unknown' },
            { name: 'عائشہ منیر', fatherName: 'منیر احمد', gender: 'female', phone: 'Unknown', age: 16, address: 'Unknown', dateOfBirth: '2009-01-01', halqa: 'Unknown' },
            { name: 'سحر منير', fatherName: 'منیر احمد', gender: 'female', phone: 'Unknown', age: 13, address: 'Unknown', dateOfBirth: '2012-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'طلعت حسین فیملی',
        familyHeadName: 'طلعت حسین',
        members: [
            { name: 'طلعت حسین', fatherName: 'Unknown', gender: 'male', phone: 'Unknown', age: 55, address: 'Unknown', dateOfBirth: '1970-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'محمد بشیر کشمیری فیملی',
        familyHeadName: 'محمد بشیر کشمیری',
        members: [
            { name: 'محمد بشیر کشمیری', fatherName: 'Unknown', gender: 'male', phone: '03134951044', age: 78, address: 'Unknown', dateOfBirth: '1947-01-01', halqa: 'Unknown' },
            { name: 'د اور احمد', fatherName: 'محمد بشیر', gender: 'male', phone: 'Unknown', age: 35, address: 'Unknown', dateOfBirth: '1990-01-01', halqa: 'Unknown' },
            { name: 'رخانه داود', husbandName: 'داور احمد', gender: 'female', phone: 'Unknown', age: 26, address: 'Unknown', dateOfBirth: '1999-01-01', halqa: 'Unknown' },
            { name: 'مقدم امیر', fatherName: 'داور احمد', gender: 'male', phone: 'Unknown', age: 8, address: 'Unknown', dateOfBirth: '2017-01-01', halqa: 'Unknown' },
            { name: 'ارحم داود', fatherName: 'داور احمد', gender: 'male', phone: 'Unknown', age: 7, address: 'Unknown', dateOfBirth: '2018-01-01', halqa: 'Unknown' },
            { name: 'مومن رشید', fatherName: 'داور احمد', gender: 'male', phone: 'Unknown', age: 5, address: 'Unknown', dateOfBirth: '2020-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'منصور احمد کشمیری فیملی',
        familyHeadName: 'منصور احمد کشمیری',
        members: [
            { name: 'منصور احمد کشمیری', fatherName: 'محمد رشید', gender: 'male', phone: '03035861927', age: 30, address: 'Unknown', dateOfBirth: '1995-01-01', halqa: 'Unknown' },
            { name: 'را شده لیاقت', husbandName: 'منصور احمد', gender: 'female', phone: 'Unknown', age: 36, address: 'Unknown', dateOfBirth: '1989-01-01', halqa: 'Unknown' },
            { name: 'ایان علی', fatherName: 'منصور احمد', gender: 'male', phone: 'Unknown', age: 8, address: 'Unknown', dateOfBirth: '2017-01-01', halqa: 'Unknown' },
            { name: 'ایمان منصور', fatherName: 'منصور احمد', gender: 'female', phone: 'Unknown', age: 6, address: 'Unknown', dateOfBirth: '2019-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'ذیشان علی کشمیری فیملی',
        familyHeadName: 'ذیشان علی',
        members: [
            { name: 'ذیشان علی', fatherName: 'محمد رشید', gender: 'male', phone: '03038164325', age: 22, address: 'Unknown', dateOfBirth: '2003-01-01', halqa: 'Unknown' },
            { name: 'وسیم اختر', husbandName: 'محمد رشید', gender: 'female', phone: 'Unknown', age: 55, address: 'Unknown', dateOfBirth: '1970-01-01', halqa: 'Unknown' },
            { name: 'افسانہ کو ثر', fatherName: 'محمد رشید', gender: 'female', phone: 'Unknown', age: 27, address: 'Unknown', dateOfBirth: '1998-01-01', halqa: 'Unknown' },
            { name: 'اریبہ رشید', fatherName: 'محمد رشید', gender: 'female', phone: 'Unknown', age: 20, address: 'Unknown', dateOfBirth: '2005-01-01', halqa: 'Unknown' },
            { name: 'غیب احمد', fatherName: 'Unknown', gender: 'male', phone: 'Unknown', age: 8, address: 'Unknown', dateOfBirth: '2017-01-01', halqa: 'Unknown' },
            { name: 'میرب کاشف', fatherName: 'Unknown', gender: 'female', phone: 'Unknown', age: 4, address: 'Unknown', dateOfBirth: '2021-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'عطاء الحبيب فیملی',
        familyHeadName: 'عطاء الحبيب',
        members: [
            { name: 'عطاء الحبيب', fatherName: 'Unknown', gender: 'male', phone: '03004055163', age: 45, address: 'Unknown', dateOfBirth: '1980-01-01', halqa: 'Unknown' },
            { name: 'صائمہ ناز', husbandName: 'عطاء الحجيب', gender: 'female', phone: 'Unknown', age: 45, address: 'Unknown', dateOfBirth: '1980-01-01', halqa: 'Unknown' },
            { name: 'دعا ناز', fatherName: 'عطاء الحجيب', gender: 'female', phone: 'Unknown', age: 8, address: 'Unknown', dateOfBirth: '2017-01-01', halqa: 'Unknown' },
            { name: 'ام بانی', fatherName: 'عطاء الحجيب', gender: 'female', phone: 'Unknown', age: 3, address: 'Unknown', dateOfBirth: '2022-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'فیاض احمد فیملی',
        familyHeadName: 'فیاض احمد',
        members: [
            { name: 'فیاض احمد', fatherName: 'Unknown', gender: 'male', phone: '03077281839', age: 37, address: 'Unknown', dateOfBirth: '1988-01-01', halqa: 'Unknown' },
            { name: 'سفینہ بی بی', husbandName: 'فیاض احمد', gender: 'female', phone: 'Unknown', age: 27, address: 'Unknown', dateOfBirth: '1998-01-01', halqa: 'Unknown' },
            { name: 'احمد رضا', fatherName: 'فیاض احمد', gender: 'male', phone: 'Unknown', age: 7, address: 'Unknown', dateOfBirth: '2018-01-01', halqa: 'Unknown' },
            { name: 'حسیب احمد', fatherName: 'فیاض احمد', gender: 'male', phone: 'Unknown', age: 6, address: 'Unknown', dateOfBirth: '2019-01-01', halqa: 'Unknown' },
            { name: 'خورشید بی بی', fatherName: 'Unknown', gender: 'female', phone: 'Unknown', age: 60, address: 'Unknown', dateOfBirth: '1965-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'اشفاق احمد فیملی',
        familyHeadName: 'اشفاق احمد',
        members: [
            { name: 'اشفاق احمد', fatherName: 'Unknown', gender: 'male', phone: '03217590763', age: 25, address: 'Unknown', dateOfBirth: '2000-01-01', halqa: 'Unknown' },
            { name: 'انتم اشفاق', husbandName: 'اشفاق احمد', gender: 'female', phone: 'Unknown', age: 25, address: 'Unknown', dateOfBirth: '2000-01-01', halqa: 'Unknown' },
            { name: 'شمن پری', fatherName: 'اشفاق احمد', gender: 'female', phone: 'Unknown', age: 4, address: 'Unknown', dateOfBirth: '2021-01-01', halqa: 'Unknown' },
            { name: 'امتیاز احمد', fatherName: 'Unknown', gender: 'male', phone: 'Unknown', age: 27, address: 'Unknown', dateOfBirth: '1998-01-01', halqa: 'Unknown' },
            { name: 'فضیلت امتیاز', husbandName: 'امتیاز احمد', gender: 'female', phone: 'Unknown', age: 27, address: 'Unknown', dateOfBirth: '1998-01-01', halqa: 'Unknown' },
            { name: 'ریحان احمد', fatherName: 'امتیاز احمد', gender: 'male', phone: 'Unknown', age: 2, address: 'Unknown', dateOfBirth: '2023-01-01', halqa: 'Unknown' },
            { name: 'ریاض احمد', fatherName: 'Unknown', gender: 'male', phone: 'Unknown', age: 25, address: 'Unknown', dateOfBirth: '2000-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'ارشد علی فیملی',
        familyHeadName: 'ارشد علی',
        members: [
            { name: 'ارشد علی', fatherName: 'Unknown', gender: 'male', phone: '03245249779', age: 58, address: 'Unknown', dateOfBirth: '1967-01-01', halqa: 'Unknown' },
            { name: 'نسرین اختر', husbandName: 'ارشد علی', gender: 'female', phone: 'Unknown', age: 42, address: 'Unknown', dateOfBirth: '1983-01-01', halqa: 'Unknown' },
            { name: 'سائرہ ارشد', fatherName: 'ارشد علی', gender: 'female', phone: 'Unknown', age: 22, address: 'Unknown', dateOfBirth: '2003-01-01', halqa: 'Unknown' },
            { name: 'کامران ارشد', fatherName: 'ارشد علی', gender: 'male', phone: 'Unknown', age: 19, address: 'Unknown', dateOfBirth: '2006-01-01', halqa: 'Unknown' },
            { name: 'سلمان ارشد', fatherName: 'ارشد علی', gender: 'male', phone: 'Unknown', age: 17, address: 'Unknown', dateOfBirth: '2008-01-01', halqa: 'Unknown' },
            { name: 'عدنان ارشد', fatherName: 'ارشد علی', gender: 'male', phone: 'Unknown', age: 16, address: 'Unknown', dateOfBirth: '2009-01-01', halqa: 'Unknown' },
            { name: 'مائرہ ارشد', fatherName: 'ارشد علی', gender: 'female', phone: 'Unknown', age: 14, address: 'Unknown', dateOfBirth: '2011-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'مبارکہ بیگم فیملی',
        familyHeadName: 'مبارکہ بیگم',
        members: [
            { name: 'مبارکہ بیگم', husbandName: 'قدرت الله', gender: 'female', phone: '03217590763', age: 60, address: 'Unknown', dateOfBirth: '1965-01-01', halqa: 'Unknown' },
            { name: 'محمد سلیم', fatherName: 'Unknown', gender: 'male', phone: 'Unknown', age: 34, address: 'Unknown', dateOfBirth: '1991-01-01', halqa: 'Unknown' },
            { name: 'کلیم احمد', fatherName: 'Unknown', gender: 'male', phone: 'Unknown', age: 32, address: 'Unknown', dateOfBirth: '1993-01-01', halqa: 'Unknown' },
            { name: 'و سیم احمد', fatherName: 'Unknown', gender: 'male', phone: 'Unknown', age: 24, address: 'Unknown', dateOfBirth: '2001-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'بشارت احمد بسراء فیملی',
        familyHeadName: 'بشارت احمد بسراء',
        members: [
            { name: 'بشارت احمد بسراء', fatherName: 'Unknown', gender: 'male', phone: '03014495917', age: 70, address: 'Unknown', dateOfBirth: '1955-01-01', halqa: 'Unknown' },
            { name: 'صداقت اختر', husbandName: 'بشارت احمد', gender: 'female', phone: 'Unknown', age: 68, address: 'Unknown', dateOfBirth: '1957-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'نصیر احمد باجوہ فیملی',
        familyHeadName: 'نصیر احمد باجوہ',
        members: [
            { name: 'نصیر احمد باجوہ', fatherName: 'Unknown', gender: 'male', phone: '03414200792', age: 67, address: 'Unknown', dateOfBirth: '1958-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'محمد حسین چوہدری فیملی',
        familyHeadName: 'محمد حسین چوہدری',
        members: [
            { name: 'محمد حسین چوہدری', fatherName: 'Unknown', gender: 'male', phone: 'Unknown', age: 71, address: 'Unknown', dateOfBirth: '1954-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'محمد اسلم فیملی',
        familyHeadName: 'محمد اسلم',
        members: [
            { name: 'محمد اسلم', fatherName: 'Unknown', gender: 'male', phone: 'Unknown', age: 60, address: 'Unknown', dateOfBirth: '1965-01-01', halqa: 'Unknown' },
            { name: 'نوشابه اسلم', husbandName: 'محمد اسلم', gender: 'female', phone: 'Unknown', age: 50, address: 'Unknown', dateOfBirth: '1975-01-01', halqa: 'Unknown' },
            { name: 'زارہ اسلم', fatherName: 'محمد اسلم', gender: 'female', phone: 'Unknown', age: 25, address: 'Unknown', dateOfBirth: '2000-01-01', halqa: 'Unknown' },
            { name: 'در همین اسلم', fatherName: 'محمد اسلم', gender: 'female', phone: 'Unknown', age: 22, address: 'Unknown', dateOfBirth: '2003-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'شیر فلک فیملی',
        familyHeadName: 'شیر فلک',
        members: [
            { name: 'شیر فلک', fatherName: 'Unknown', gender: 'male', phone: 'Unknown', age: 65, address: 'Unknown', dateOfBirth: '1960-01-01', halqa: 'Unknown' },
            { name: 'ناز کرن', husbandName: 'شیر فلک', gender: 'female', phone: 'Unknown', age: 60, address: 'Unknown', dateOfBirth: '1965-01-01', halqa: 'Unknown' },
            { name: 'اسلم محمد', fatherName: 'شیر فلک', gender: 'male', phone: 'Unknown', age: 40, address: 'Unknown', dateOfBirth: '1985-01-01', halqa: 'Unknown' },
            { name: 'بچی', fatherName: 'Unknown', gender: 'female', phone: 'Unknown', age: 4, address: 'Unknown', dateOfBirth: '2021-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'آصف احمد فیملی',
        familyHeadName: 'آصف احمد',
        members: [
            { name: 'آصف احمد', fatherName: 'Unknown', gender: 'male', phone: '03051383145', age: 37, address: 'Unknown', dateOfBirth: '1988-01-01', halqa: 'Unknown' },
            { name: 'صائمہ آصف', husbandName: 'آصف احمد', gender: 'female', phone: 'Unknown', age: 38, address: 'Unknown', dateOfBirth: '1987-01-01', halqa: 'Unknown' },
            { name: 'تاشقها صف', fatherName: 'آصف احمد', gender: 'female', phone: 'Unknown', age: 14, address: 'Unknown', dateOfBirth: '2011-01-01', halqa: 'Unknown' },
            { name: 'کاشفہ آصف', fatherName: 'آصف احمد', gender: 'female', phone: 'Unknown', age: 11, address: 'Unknown', dateOfBirth: '2014-01-01', halqa: 'Unknown' },
            { name: 'عاطفه آصف', fatherName: 'آصف احمد', gender: 'female', phone: 'Unknown', age: 6, address: 'Unknown', dateOfBirth: '2019-01-01', halqa: 'Unknown' },
            { name: 'زبان احمد', fatherName: 'Unknown', gender: 'male', phone: 'Unknown', age: 3, address: 'Unknown', dateOfBirth: '2022-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'محمد ناجی احمد فیملی',
        familyHeadName: 'محمد ناجی احمد',
        members: [
            { name: 'محمد ناجی احمد', fatherName: 'Unknown', gender: 'male', phone: '03084264626', age: 27, address: 'Unknown', dateOfBirth: '1998-01-01', halqa: 'Unknown' },
            { name: 'فائزه منظور', husbandName: 'محمد ناجی احمد', gender: 'female', phone: 'Unknown', age: 27, address: 'Unknown', dateOfBirth: '1998-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'حمید الله رووف فیملی',
        familyHeadName: 'حمید الله',
        members: [
            { name: 'حمید الله', fatherName: 'Unknown', gender: 'male', phone: '03007209657', age: 62, address: 'Unknown', dateOfBirth: '1963-01-01', halqa: 'Unknown' },
            { name: 'شاہدہ بی بی', husbandName: 'حمید الله', gender: 'female', phone: 'Unknown', age: 50, address: 'Unknown', dateOfBirth: '1975-01-01', halqa: 'Unknown' },
            { name: 'سمیرہ اعجاز', fatherName: 'اعجاز احمد', gender: 'female', phone: 'Unknown', age: 23, address: 'Unknown', dateOfBirth: '2002-01-01', halqa: 'Unknown' },
            { name: 'شازیہ اعجاز', fatherName: 'اعجاز احمد', gender: 'female', phone: 'Unknown', age: 20, address: 'Unknown', dateOfBirth: '2005-01-01', halqa: 'Unknown' },
            { name: 'صباء شہزادی', fatherName: 'حمید اللہ', gender: 'female', phone: 'Unknown', age: 13, address: 'Unknown', dateOfBirth: '2012-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'خرم شیر از فیملی',
        familyHeadName: 'خرم شیر از',
        members: [
            { name: 'خرم شیر از', fatherName: 'مبارک احمد', gender: 'male', phone: '03317990937', age: 49, address: 'Unknown', dateOfBirth: '1976-01-01', halqa: 'Unknown' },
            { name: 'شمعونه شیر از', husbandName: 'خرم شیر از', gender: 'female', phone: 'Unknown', age: 48, address: 'Unknown', dateOfBirth: '1977-01-01', halqa: 'Unknown' },
            { name: 'اشعر شیر از', fatherName: 'خرم شیر از', gender: 'male', phone: 'Unknown', age: 22, address: 'Unknown', dateOfBirth: '2003-01-01', halqa: 'Unknown' },
            { name: 'ریشا شیر از', fatherName: 'خرم شیر از', gender: 'female', phone: 'Unknown', age: 19, address: 'Unknown', dateOfBirth: '2006-01-01', halqa: 'Unknown' },
            { name: 'عیزه شیر از', fatherName: 'خرم شیر از', gender: 'female', phone: 'Unknown', age: 16, address: 'Unknown', dateOfBirth: '2009-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'عاصم فراز فیملی',
        familyHeadName: 'عاصم فراز',
        members: [
            { name: 'عاصم فراز', fatherName: 'مبارک احمد', gender: 'male', phone: '03004215338', age: 43, address: 'Unknown', dateOfBirth: '1982-01-01', halqa: 'Unknown' },
            { name: 'مبارکہ بیگم', husbandName: 'مبارک احمد', gender: 'female', phone: 'Unknown', age: 60, address: 'Unknown', dateOfBirth: '1965-01-01', halqa: 'Unknown' },
            { name: 'سلمی عاصم', husbandName: 'عاصم فراز', gender: 'female', phone: 'Unknown', age: 43, address: 'Unknown', dateOfBirth: '1982-01-01', halqa: 'Unknown' },
            { name: 'حشام احمد', fatherName: 'عاصم فراز', gender: 'male', phone: 'Unknown', age: 18, address: 'Unknown', dateOfBirth: '2007-01-01', halqa: 'Unknown' },
            { name: 'شایان احمد', fatherName: 'عاصم فراز', gender: 'male', phone: 'Unknown', age: 16, address: 'Unknown', dateOfBirth: '2009-01-01', halqa: 'Unknown' },
            { name: 'شانزه عاصم', fatherName: 'عاصم فراز', gender: 'female', phone: 'Unknown', age: 12, address: 'Unknown', dateOfBirth: '2013-01-01', halqa: 'Unknown' },
            { name: 'شابان احمد', fatherName: 'عاصم فراز', gender: 'male', phone: 'Unknown', age: 11, address: 'Unknown', dateOfBirth: '2014-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'ضیاء الرحمن کاشف فیملی',
        familyHeadName: 'ضیاء الرحمن کاشف',
        members: [
            { name: 'ضیاء الرحمن کاشف', fatherName: 'Unknown', gender: 'male', phone: '03074133998', age: 41, address: 'Unknown', dateOfBirth: '1984-01-01', halqa: 'Unknown' },
            { name: 'سمیرہ کاشف', husbandName: 'ضیاء الرحمن', gender: 'female', phone: 'Unknown', age: 38, address: 'Unknown', dateOfBirth: '1987-01-01', halqa: 'Unknown' },
            { name: 'مطیع الرحمن سعید', fatherName: 'ضیاء الرحمن', gender: 'male', phone: 'Unknown', age: 8, address: 'Unknown', dateOfBirth: '2017-01-01', halqa: 'Unknown' },
            { name: 'فارعہ رحمٰن', fatherName: 'ضیاء الرحمن', gender: 'female', phone: 'Unknown', age: 5, address: 'Unknown', dateOfBirth: '2020-01-01', halqa: 'Unknown' },
            { name: 'ایز در حمن', fatherName: 'Unknown', gender: 'male', phone: 'Unknown', age: 2, address: 'Unknown', dateOfBirth: '2023-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'شیخ محمد یوسف فیملی',
        familyHeadName: 'شیخ محمد یوسف',
        members: [
            { name: 'شیخ محمد یوسف', fatherName: 'Unknown', gender: 'male', phone: '03057760873', age: 72, address: 'Unknown', dateOfBirth: '1953-01-01', halqa: 'Unknown' },
            { name: 'ظفر احمد', fatherName: 'شیخ محمد یوسف', gender: 'male', phone: 'Unknown', age: 40, address: 'Unknown', dateOfBirth: '1985-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'شہباز احمد فیملی',
        familyHeadName: 'شہباز احمد',
        members: [
            { name: 'شہباز احمد', fatherName: 'Unknown', gender: 'male', phone: '03009467342', age: 60, address: 'Unknown', dateOfBirth: '1965-01-01', halqa: 'Unknown' },
            { name: 'پروین اختر', husbandName: 'شہباز احمد', gender: 'female', phone: 'Unknown', age: 56, address: 'Unknown', dateOfBirth: '1969-01-01', halqa: 'Unknown' },
            { name: 'محمد زاہد', fatherName: 'شہباز احمد', gender: 'male', phone: 'Unknown', age: 30, address: 'Unknown', dateOfBirth: '1995-01-01', halqa: 'Unknown' },
            { name: 'حفظه منیر', husbandName: 'محمد زاہد', gender: 'female', phone: 'Unknown', age: 24, address: 'Unknown', dateOfBirth: '2001-01-01', halqa: 'Unknown' },
            { name: 'ارم شهباز', fatherName: 'شہباز احمد', gender: 'female', phone: 'Unknown', age: 27, address: 'Unknown', dateOfBirth: '1998-01-01', halqa: 'Unknown' },
            { name: 'فہد شهباز', fatherName: 'شہباز احمد', gender: 'male', phone: 'Unknown', age: 25, address: 'Unknown', dateOfBirth: '2000-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'شیخ طاہر احمد فیملی',
        familyHeadName: 'شیخ طاہر احمد',
        members: [
            { name: 'شیخ طاہر احمد', fatherName: 'Unknown', gender: 'male', phone: '03334521502', age: 51, address: 'Unknown', dateOfBirth: '1974-01-01', halqa: 'Unknown' },
            { name: 'فاطمہ طاہر', husbandName: 'طاہر احمد', gender: 'female', phone: 'Unknown', age: 46, address: 'Unknown', dateOfBirth: '1979-01-01', halqa: 'Unknown' },
            { name: 'طلحه طاهر', fatherName: 'طاہر احمد', gender: 'male', phone: 'Unknown', age: 22, address: 'Unknown', dateOfBirth: '2003-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'نصرت امین فیملی',
        familyHeadName: 'نصرت امین',
        members: [
            { name: 'نصرت امین', husbandName: 'Unknown', gender: 'female', phone: '03367400919', age: 65, address: 'Unknown', dateOfBirth: '1960-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'شفقت محمود طارق فیملی',
        familyHeadName: 'شفقت محمود طارق',
        members: [
            { name: 'شفقت محمود طارق', fatherName: 'Unknown', gender: 'male', phone: '03004945476', age: 68, address: 'Unknown', dateOfBirth: '1957-01-01', halqa: 'Unknown' },
            { name: 'زبیدہ بیگم', husbandName: 'Unknown', gender: 'female', phone: 'Unknown', age: 95, address: 'Unknown', dateOfBirth: '1930-01-01', halqa: 'Unknown' },
            { name: 'مبشره بیگم', husbandName: 'شفقت محمود', gender: 'female', phone: 'Unknown', age: 67, address: 'Unknown', dateOfBirth: '1958-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'نوید احمد فیملی',
        familyHeadName: 'نوید احمد',
        members: [
            { name: 'نوید احمد', fatherName: 'Unknown', gender: 'male', phone: '03229422095', age: 38, address: 'Unknown', dateOfBirth: '1987-01-01', halqa: 'Unknown' },
            { name: 'عدیلہ نوید', husbandName: 'نوید احمد', gender: 'female', phone: 'Unknown', age: 26, address: 'Unknown', dateOfBirth: '1999-01-01', halqa: 'Unknown' },
            { name: 'معید احمد', fatherName: 'نوید احمد', gender: 'male', phone: 'Unknown', age: 9, address: 'Unknown', dateOfBirth: '2016-01-01', halqa: 'Unknown' },
            { name: 'عبد المقیت', fatherName: 'نوید احمد', gender: 'male', phone: 'Unknown', age: 4, address: 'Unknown', dateOfBirth: '2021-01-01', halqa: 'Unknown' },
            { name: 'منامل نور', fatherName: 'نوید احمد', gender: 'female', phone: 'Unknown', age: 2, address: 'Unknown', dateOfBirth: '2023-01-01', halqa: 'Unknown' },
            { name: 'مد مراحمد', fatherName: 'Unknown', gender: 'male', phone: 'Unknown', age: 17, address: 'Unknown', dateOfBirth: '2008-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'متین الحق چوہدری فیملی',
        familyHeadName: 'متین الحق چوہدری',
        members: [
            { name: 'متین الحق چوہدری', fatherName: 'Unknown', gender: 'male', phone: '03004139330', age: 54, address: 'Unknown', dateOfBirth: '1971-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'زاہد محمود فیملی',
        familyHeadName: 'زاہد محمود',
        members: [
            { name: 'زاہد محمود', fatherName: 'Unknown', gender: 'male', phone: '03074798549', age: 68, address: 'Unknown', dateOfBirth: '1957-01-01', halqa: 'Unknown' },
            { name: 'منورہ سلطانہ', husbandName: 'زاہد محمود', gender: 'female', phone: 'Unknown', age: 61, address: 'Unknown', dateOfBirth: '1964-01-01', halqa: 'Unknown' },
            { name: 'فاطمه عدنان', fatherName: 'زاہد محمود', gender: 'female', phone: 'Unknown', age: 26, address: 'Unknown', dateOfBirth: '1999-01-01', halqa: 'Unknown' },
            { name: 'نعمان احمد', fatherName: 'زاہد محمود', gender: 'male', phone: 'Unknown', age: 28, address: 'Unknown', dateOfBirth: '1997-01-01', halqa: 'Unknown' },
            { name: 'رحمن احم', fatherName: 'زاہد محمود', gender: 'male', phone: 'Unknown', age: 24, address: 'Unknown', dateOfBirth: '2001-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'عصمت اللہ بٹر فیملی',
        familyHeadName: 'عصمت اللہ بٹر',
        members: [
            { name: 'عصمت اللہ بٹر', fatherName: 'Unknown', gender: 'male', phone: '03434517788', age: 58, address: 'Unknown', dateOfBirth: '1967-01-01', halqa: 'Unknown' },
            { name: 'طاہرہ بی بی', husbandName: 'عصمت الله بر', gender: 'female', phone: 'Unknown', age: 56, address: 'Unknown', dateOfBirth: '1969-01-01', halqa: 'Unknown' },
            { name: 'شافیہ عصمت', fatherName: 'عصمت الله', gender: 'female', phone: 'Unknown', age: 23, address: 'Unknown', dateOfBirth: '2002-01-01', halqa: 'Unknown' },
            { name: 'وجاہت احمد بر', fatherName: 'عصمت اللہ', gender: 'male', phone: 'Unknown', age: 21, address: 'Unknown', dateOfBirth: '2004-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'مختار احمد فیملی',
        familyHeadName: 'مختار احمد',
        members: [
            { name: 'مختار احمد', fatherName: 'Unknown', gender: 'male', phone: '03347049580', age: 58, address: 'Unknown', dateOfBirth: '1967-01-01', halqa: 'Unknown' },
            { name: 'راحت پروین', husbandName: 'مختار احمد', gender: 'female', phone: 'Unknown', age: 51, address: 'Unknown', dateOfBirth: '1974-01-01', halqa: 'Unknown' },
            { name: 'افتخار احمد', fatherName: 'مختار احمد', gender: 'male', phone: 'Unknown', age: 28, address: 'Unknown', dateOfBirth: '1997-01-01', halqa: 'Unknown' },
            { name: 'عشاء سحر', fatherName: 'مختار احمد', gender: 'female', phone: 'Unknown', age: 26, address: 'Unknown', dateOfBirth: '1999-01-01', halqa: 'Unknown' },
            { name: 'تفرید احمد', fatherName: 'مختار احمد', gender: 'male', phone: 'Unknown', age: 19, address: 'Unknown', dateOfBirth: '2006-01-01', halqa: 'Unknown' },
            { name: 'ثمینہ کوثر', fatherName: 'Unknown', gender: 'female', phone: 'Unknown', age: 25, address: 'Unknown', dateOfBirth: '2000-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'نواز احمد فیملی',
        familyHeadName: 'نواز احمد',
        members: [
            { name: 'نواز احمد', fatherName: 'Unknown', gender: 'male', phone: '03464004651', age: 51, address: 'Unknown', dateOfBirth: '1974-01-01', halqa: 'Unknown' },
            { name: 'نسرین بی بی', husbandName: 'نواز احمد', gender: 'female', phone: 'Unknown', age: 48, address: 'Unknown', dateOfBirth: '1977-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'نذیر احمد فیملی',
        familyHeadName: 'نذیر احمد',
        members: [
            { name: 'نذیر احمد', fatherName: 'Unknown', gender: 'male', phone: '03344968575', age: 55, address: 'Unknown', dateOfBirth: '1970-01-01', halqa: 'Unknown' },
            { name: 'شبیر احمد', fatherName: 'نذیر احمد', gender: 'male', phone: 'Unknown', age: 28, address: 'Unknown', dateOfBirth: '1997-01-01', halqa: 'Unknown' },
            { name: 'منصوره شبیر', husbandName: 'شبیر احمد', gender: 'female', phone: 'Unknown', age: 22, address: 'Unknown', dateOfBirth: '2003-01-01', halqa: 'Unknown' },
            { name: 'سفیر احمد', fatherName: 'شبیر احمد', gender: 'male', phone: 'Unknown', age: 5, address: 'Unknown', dateOfBirth: '2020-01-01', halqa: 'Unknown' },
            { name: 'سمیر احمد', fatherName: 'شبیر احمد', gender: 'male', phone: 'Unknown', age: 2, address: 'Unknown', dateOfBirth: '2023-01-01', halqa: 'Unknown' },
            { name: 'ایمن شبیر', fatherName: 'شبیر احمد', gender: 'female', phone: 'Unknown', age: 2, address: 'Unknown', dateOfBirth: '2023-01-01', halqa: 'Unknown' },
            { name: 'ثاقب احمد', fatherName: 'شبیر احمد', gender: 'male', phone: 'Unknown', age: 2, address: 'Unknown', dateOfBirth: '2023-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'صغیر احمد فیملی',
        familyHeadName: 'صغیر احمد',
        members: [
            { name: 'صغیر احمد', fatherName: 'Unknown', gender: 'male', phone: '03254005476', age: 82, address: 'Unknown', dateOfBirth: '1943-01-01', halqa: 'Unknown' },
            { name: 'ناصره بیگم', husbandName: 'صغیر احمد', gender: 'female', phone: 'Unknown', age: 70, address: 'Unknown', dateOfBirth: '1955-01-01', halqa: 'Unknown' },
            { name: 'فوزیه نسیم', fatherName: 'Unknown', gender: 'female', phone: 'Unknown', age: 48, address: 'Unknown', dateOfBirth: '1977-01-01', halqa: 'Unknown' },
            { name: 'نایاب احمد', fatherName: 'Unknown', gender: 'male', phone: 'Unknown', age: 23, address: 'Unknown', dateOfBirth: '2002-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'عاشق محمد فیملی',
        familyHeadName: 'عاشق محمد',
        members: [
            { name: 'عاشق محمد', fatherName: 'Unknown', gender: 'male', phone: 'Unknown', age: 61, address: 'Unknown', dateOfBirth: '1964-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'نذر محمد فیملی',
        familyHeadName: 'نذر محمد',
        members: [
            { name: 'نذر محمد', fatherName: 'Unknown', gender: 'male', phone: '03454522384', age: 68, address: 'Unknown', dateOfBirth: '1957-01-01', halqa: 'Unknown' },
            { name: 'خالده بی بی', husbandName: 'نذر محمد', gender: 'female', phone: 'Unknown', age: 64, address: 'Unknown', dateOfBirth: '1961-01-01', halqa: 'Unknown' },
            { name: 'انصر نذر', fatherName: 'نذر محمد', gender: 'male', phone: 'Unknown', age: 39, address: 'Unknown', dateOfBirth: '1986-01-01', halqa: 'Unknown' },
            { name: 'العم العر', husbandName: 'انصر نذر', gender: 'female', phone: 'Unknown', age: 39, address: 'Unknown', dateOfBirth: '1986-01-01', halqa: 'Unknown' },
            { name: 'عصر نذر', fatherName: 'نذر محمد', gender: 'male', phone: 'Unknown', age: 39, address: 'Unknown', dateOfBirth: '1986-01-01', halqa: 'Unknown' },
            { name: 'ناشفه عصر', husbandName: 'عصر نذر', gender: 'female', phone: 'Unknown', age: 32, address: 'Unknown', dateOfBirth: '1993-01-01', halqa: 'Unknown' },
            { name: 'غضنفر نذر', fatherName: 'نذر محمد', gender: 'male', phone: 'Unknown', age: 25, address: 'Unknown', dateOfBirth: '2000-01-01', halqa: 'Unknown' },
            { name: 'علیزہ چوہدری', fatherName: 'انصر نذر', gender: 'female', phone: 'Unknown', age: 2, address: 'Unknown', dateOfBirth: '2023-01-01', halqa: 'Unknown' },
            { name: 'امیر بالاج', fatherName: 'انصر نذر', gender: 'male', phone: 'Unknown', age: 2, address: 'Unknown', dateOfBirth: '2023-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'محمد اعظم فیملی',
        familyHeadName: 'محمد اعظم',
        members: [
            { name: 'محمد اعظم', fatherName: 'Unknown', gender: 'male', phone: '03008009409', age: 83, address: 'Unknown', dateOfBirth: '1942-01-01', halqa: 'Unknown' },
            { name: 'محمد نعیم', fatherName: 'محمد اعظم', gender: 'male', phone: 'Unknown', age: 45, address: 'Unknown', dateOfBirth: '1980-01-01', halqa: 'Unknown' },
            { name: 'مدیحه نعیم', husbandName: 'محمد نعیم', gender: 'female', phone: 'Unknown', age: 34, address: 'Unknown', dateOfBirth: '1991-01-01', halqa: 'Unknown' },
            { name: 'حریم احمد', fatherName: 'محمد نعیم', gender: 'male', phone: 'Unknown', age: 15, address: 'Unknown', dateOfBirth: '2010-01-01', halqa: 'Unknown' },
            { name: 'محمد سلیم شہزاد', fatherName: 'محمد اعظم', gender: 'male', phone: 'Unknown', age: 42, address: 'Unknown', dateOfBirth: '1983-01-01', halqa: 'Unknown' },
            { name: 'ماریہ سلیم', husbandName: 'سلیم احمد', gender: 'female', phone: 'Unknown', age: 34, address: 'Unknown', dateOfBirth: '1991-01-01', halqa: 'Unknown' },
            { name: 'تفہیم احمد شہزاد', fatherName: 'سلیم احمد', gender: 'male', phone: 'Unknown', age: 15, address: 'Unknown', dateOfBirth: '2010-01-01', halqa: 'Unknown' },
            { name: 'جاذب احمد شہزاد', fatherName: 'سلیم احمد', gender: 'male', phone: 'Unknown', age: 12, address: 'Unknown', dateOfBirth: '2013-01-01', halqa: 'Unknown' },
            { name: 'آصفہ احمد شہزاد', fatherName: 'سلیم احمد', gender: 'female', phone: 'Unknown', age: 5, address: 'Unknown', dateOfBirth: '2020-01-01', halqa: 'Unknown' },
            { name: 'آسید اعظم', fatherName: 'Unknown', gender: 'male', phone: 'Unknown', age: 44, address: 'Unknown', dateOfBirth: '1981-01-01', halqa: 'Unknown' },
        ],
    },
    {
        familyName: 'عاصم منیر گل فیملی',
        familyHeadName: 'عاصم منیر گل',
        members: [
            { name: 'عاصم منیر گل', fatherName: 'Unknown', gender: 'male', phone: '03349957259', age: 38, address: 'Unknown', dateOfBirth: '1987-01-01', halqa: 'Unknown' },
            { name: 'عالیہ عاصم', husbandName: 'عاصم منر گل', gender: 'female', phone: 'Unknown', age: 30, address: 'Unknown', dateOfBirth: '1995-01-01', halqa: 'Unknown' },
            { name: 'منها عاصم', fatherName: 'عاصم منیر گل', gender: 'female', phone: 'Unknown', age: 4, address: 'Unknown', dateOfBirth: '2021-01-01', halqa: 'Unknown' },
        ],
    },
];

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
