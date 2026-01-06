import React, { useState, useEffect, useMemo } from 'react';
import {
    Card,
    List,
    Avatar,
    Typography,
    Input,
    Select,
    Button,
    Drawer,
    Form,
    InputNumber,
    Progress,
    Space,
    Row,
    Col,
    Statistic,
    Tabs,
    Collapse,
    Modal,
    Radio,
    Checkbox,
    App,
    Table,
    Tag
} from 'antd';

const { Text, Title } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

import {
    UserOutlined,
    SearchOutlined,
    DollarOutlined,
    CheckCircleOutlined,
    DeleteOutlined,
    PlusOutlined,
    EditOutlined,
    PrinterOutlined,
    FilePdfOutlined,
    CopyOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { ApiService } from '../services/apiService';
import type { Member, WaqfJadeedRecord, Family, Payment, WaqfJadeedSpecialRecord } from '../types';
import { ReceiptTemplate } from '../components/ReceiptTemplate';
import PaymentPlanManager from '../components/PaymentPlanManager';
import { getTanzeemDisplayName } from '../utils/helpers';

const WaqfJadeed: React.FC = () => {
    const { message } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [members, setMembers] = useState<Member[]>([]);
    const [families, setFamilies] = useState<Family[]>([]);
    const [records, setRecords] = useState<WaqfJadeedRecord[]>([]);
    const [specialRecords, setSpecialRecords] = useState<WaqfJadeedSpecialRecord[]>([]);
    // Previous Year Data
    const [prevRecords, setPrevRecords] = useState<WaqfJadeedRecord[]>([]);
    const [prevSpecialRecords, setPrevSpecialRecords] = useState<WaqfJadeedSpecialRecord[]>([]);

    const [selectedYear, setSelectedYear] = useState<number>(2026);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('families');

    // Drawer & Edit State
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [editingSpecial, setEditingSpecial] = useState<WaqfJadeedSpecialRecord | null>(null);
    const [isEditingPromise, setIsEditingPromise] = useState(false);

    const [form] = Form.useForm();
    const [paymentForm] = Form.useForm(); // New form for adding payments
    const [specialForm] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);

    // Receipt Printing State
    const [printingPayment, setPrintingPayment] = useState<{ payment: Payment, recordName: string, memberCode?: string } | null>(null);
    const receiptRef = React.useRef<HTMLDivElement>(null);

    // Special Member State
    const [specialModalVisible, setSpecialModalVisible] = useState(false);
    const [activeFamilyId, setActiveFamilyId] = useState<string | null>(null);

    // State for pagination
    const [familyMembersCurrentPage, setFamilyMembersCurrentPage] = useState<Record<string, number>>({});
    const [familySpecialCurrentPage, setFamilySpecialCurrentPage] = useState<Record<string, number>>({});
    const [familyMembersPageSize, setFamilyMembersPageSize] = useState<Record<string, number>>({});
    const [familySpecialPageSize, setFamilySpecialPageSize] = useState<Record<string, number>>({});
    const [tanzeemMembersCurrentPage, setTanzeemMembersCurrentPage] = useState<Record<string, number>>({});
    const [tanzeemMembersPageSize, setTanzeemMembersPageSize] = useState<Record<string, number>>({});

    useEffect(() => {
        loadData();
    }, [selectedYear]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [membersData, familiesData, recordsData, specialData, prevRecordsData, prevSpecialData] = await Promise.all([
                ApiService.getAllMembers(),
                ApiService.getAllFamilies(),
                ApiService.getWaqfJadeedRecords(selectedYear),
                ApiService.getWaqfJadeedSpecialRecords(selectedYear),
                ApiService.getWaqfJadeedRecords(selectedYear - 1),
                ApiService.getWaqfJadeedSpecialRecords(selectedYear - 1)
            ]);
            setMembers(membersData);
            setFamilies(familiesData);
            // Filter records to ensure they match the selected year (in case API returns wrong data)
            const filteredRecords = Array.isArray(recordsData) 
                ? recordsData.filter(r => {
                    // Check if year matches
                    if (r.year !== selectedYear) {
                        console.warn(`Record for member ${r.memberId} has year ${r.year} but selected year is ${selectedYear}`);
                        return false;
                    }
                    return true;
                })
                : [];
            setRecords(filteredRecords);
            // Filter special records to ensure they match the selected year
            const filteredSpecial = Array.isArray(specialData)
                ? specialData.filter(r => {
                    // Check if year matches
                    if (r.year !== selectedYear) {
                        console.warn(`Special record ${r.id} has year ${r.year} but selected year is ${selectedYear}`);
                        return false;
                    }
                    return true;
                })
                : [];
            setSpecialRecords(filteredSpecial);
            setPrevRecords(prevRecordsData);
            setPrevSpecialRecords(Array.isArray(prevSpecialData) ? prevSpecialData : []);
            
            // Debug logging
            const totalPromise = filteredRecords.reduce((sum, r) => sum + (r.promiseAmount || 0) + (r.nagarparAmount || 0), 0) + 
                               filteredSpecial.reduce((sum, r) => sum + (r.promiseAmount || 0) + (r.nagarparAmount || 0), 0);
            console.log(`Loaded data for year ${selectedYear}:`, {
                recordsCount: filteredRecords.length,
                specialRecordsCount: filteredSpecial.length,
                totalPromise: totalPromise,
                rawRecordsCount: Array.isArray(recordsData) ? recordsData.length : 0,
                rawSpecialCount: Array.isArray(specialData) ? specialData.length : 0
            });
            
            // Warn user if no records found but raw data exists
            if (filteredRecords.length === 0 && Array.isArray(recordsData) && recordsData.length > 0) {
                const yearsInData = [...new Set(recordsData.map(r => r.year).filter(Boolean))];
                console.warn(`No records found for year ${selectedYear}. Records exist for years:`, yearsInData);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            message.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const updateLocalRecord = (savedRecord: WaqfJadeedRecord) => {
        setRecords(prev => {
            const idx = prev.findIndex(r => r.memberId === savedRecord.memberId);
            if (idx >= 0) {
                const newRecords = [...prev];
                newRecords[idx] = savedRecord;
                return newRecords;
            } else {
                return [...prev, savedRecord];
            }
        });
    };

    const handleEdit = (member: Member) => {
        setEditingMember(member);
        setEditingSpecial(null);
        const record = records.find(r => r.memberId === member.id);
        form.setFieldsValue({
            promiseAmount: record?.promiseAmount || 0,
            nagarparAmount: record?.nagarparAmount || 0,
        });
        // If no promise exists, default to editing mode. If it exists, view mode.
        setIsEditingPromise(!record?.promiseAmount);
        setDrawerVisible(true);
    };

    const handleEditSpecial = (record: WaqfJadeedSpecialRecord) => {
        setEditingMember(null);
        setEditingSpecial(record);
        form.setFieldsValue({
            promiseAmount: record.promiseAmount || 0,
            nagarparAmount: record.nagarparAmount || 0,
        });
        setIsEditingPromise(!record.promiseAmount);
        setDrawerVisible(true);
    };

    const handleSave = async () => {
        setSubmitting(true);
        try {
            const values = await form.validateFields();
            if (editingMember) {
                // Member update
                const payload = {
                    memberId: editingMember.id,
                    year: selectedYear,
                    promiseAmount: values.promiseAmount,
                    nagarparAmount: values.nagarparAmount,
                };

                const savedRecord = await ApiService.saveWaqfJadeedRecord(payload);
                if (savedRecord) {
                    updateLocalRecord(savedRecord);
                }
            } else if (editingSpecial) {
                // Special record update
                const payload = {
                    ...editingSpecial,
                    promiseAmount: values.promiseAmount,
                    nagarparAmount: values.nagarparAmount,
                };
                const saved = await ApiService.saveWaqfJadeedSpecialRecord(payload);
                setSpecialRecords(prev => {
                    const idx = prev.findIndex(r => r.id === saved.id);
                    if (idx >= 0) {
                        const newRecs = [...prev];
                        // Preserve payments
                        const oldPayments = prev[idx].payments;
                        newRecs[idx] = { ...saved, isDeceased: !!saved.isDeceased, payments: oldPayments } as WaqfJadeedSpecialRecord;
                        return newRecs;
                    }
                    return [...prev, { ...saved, isDeceased: !!saved.isDeceased } as WaqfJadeedSpecialRecord];
                });
            }

            message.success('Promise updated');
            setIsEditingPromise(false);
        } catch (error) {
            message.error('Failed to save promise');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddPayment = async (values: any) => {
        try {
            if (!editingMember && !editingSpecial) return;
            setSubmitting(true);

            if (editingMember) {
                const payload = {
                    memberId: editingMember.id,
                    year: selectedYear,
                    amount: values.amount,
                    date: dayjs().toISOString(),
                    notes: values.notes
                };

                const updatedRecord = await ApiService.addWaqfJadeedPayment(payload);
                if (updatedRecord) {
                    updateLocalRecord(updatedRecord);
                }
            } else if (editingSpecial) {
                const payload = {
                    specialId: editingSpecial.id,
                    amount: values.amount,
                    date: dayjs().toISOString(),
                    notes: values.notes
                };
                const updatedRecord = await ApiService.addWaqfJadeedSpecialPayment(payload);
                if (updatedRecord) {
                    setSpecialRecords(prev => {
                        const idx = prev.findIndex(r => r.id === updatedRecord.id);
                        if (idx >= 0) {
                            const newRecs = [...prev];
                            newRecs[idx] = updatedRecord;
                            return newRecs;
                        }
                        return prev;
                    });
                    // Also update editingSpecial to show new history immediately if needed, 
                    // but we usually derive history from the record list. 
                    // However, Drawer uses `records.find` for member, but for special we might need to look up in `specialRecords`.
                    setEditingSpecial(updatedRecord);
                }
            }

            paymentForm.resetFields();
            message.success('Payment added');
        } catch (error) {
            console.error('Add payment error:', error);
            message.error('Failed to add payment');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeletePayment = async (paymentId: string) => {
        try {
            const res = await ApiService.deleteWaqfJadeedPayment(paymentId);
            if (res.success) {
                if (editingMember) {
                    const [updatedRecords] = await Promise.all([ApiService.getWaqfJadeedRecords(selectedYear, editingMember.id)]);
                    if (updatedRecords && updatedRecords.length > 0) {
                        updateLocalRecord(updatedRecords[0]);
                    }
                } else if (editingSpecial) {
                    const updatedRecord = await ApiService.getWaqfJadeedSpecialRecordById(editingSpecial.id);
                    if (updatedRecord) {
                        setSpecialRecords(prev => {
                            const idx = prev.findIndex(r => r.id === updatedRecord.id);
                            if (idx >= 0) {
                                const newRecs = [...prev];
                                newRecs[idx] = updatedRecord;
                                return newRecs;
                            }
                            return prev;
                        });
                        setEditingSpecial(updatedRecord);
                    }
                }
                message.success('Payment deleted');
            }
        } catch (error) {
            message.error('Failed to delete payment');
        }
    };



    // Special Member Handlers
    const handleSaveSpecial = async () => {
        setSubmitting(true);
        try {
            const values = await specialForm.validateFields();
            const payload = {
                id: values.id,
                familyId: activeFamilyId,
                year: selectedYear,
                name: values.name,
                gender: values.gender,
                isDeceased: !!values.isDeceased, // Ensure boolean
                promiseAmount: values.promiseAmount || 0,
                nagarparAmount: values.nagarparAmount || 0,
            };
            const saved = await ApiService.saveWaqfJadeedSpecialRecord(payload);

            setSpecialRecords(prev => {
                const idx = prev.findIndex(r => r.id === saved.id);
                if (idx >= 0) {
                    const newRecs = [...prev];
                    newRecs[idx] = { ...saved, isDeceased: !!saved.isDeceased } as WaqfJadeedSpecialRecord;
                    return newRecs;
                }
                return [...prev, { ...saved, isDeceased: !!saved.isDeceased } as WaqfJadeedSpecialRecord];
            });

            message.success('Special record saved');
            setSpecialModalVisible(false);
            specialForm.resetFields();
        } catch (error) {
            message.error('Failed to save');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteSpecial = async (id: string) => {
        try {
            await ApiService.deleteWaqfJadeedSpecialRecord(id);
            setSpecialRecords(prev => prev.filter(r => r.id !== id));
            message.success('Record deleted');
        } catch (error) {
            message.error('Failed to delete');
        }
    };



    // Merge Data
    const getMemberData = (memberId: string) => {
        const member = members.find(m => m.id === memberId);
        if (!member) return null;
        const record = records.find(r => r.memberId === member.id);
        return {
            member,
            record,
            promise: (record?.promiseAmount || 0) + (record?.nagarparAmount || 0),
            paid: record?.paidAmount || 0,
            originalPromise: record?.promiseAmount || 0,
            nagarpar: record?.nagarparAmount || 0
        };
    };

    type MemberData = ReturnType<typeof getMemberData>;

    const filteredMemberData = useMemo(() => {
        let data = members
            .filter(member => {
                // Exclude deceased members from main members list
                return !member.isDeceased;
            })
            .map(member => {
            const record = records.find(r => r.memberId === member.id);
            return {
                member,
                record,
                promise: (record?.promiseAmount || 0) + (record?.nagarparAmount || 0),
                paid: record?.paidAmount || 0,
                originalPromise: record?.promiseAmount || 0,
                nagarpar: record?.nagarparAmount || 0
            };
        });

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            data = data.filter(item =>
                item.member.name.toLowerCase().includes(lower) ||
                (item.member.fatherName || '').toLowerCase().includes(lower) ||
                (item.member.halqa || '').toLowerCase().includes(lower)
            );
        }
        return data;
    }, [members, records, searchTerm]);

    const filteredFamilyData = useMemo(() => {
        let data = families;
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            data = data.filter(f =>
                f.familyName.toLowerCase().includes(lower) ||
                (f.halqa || '').toLowerCase().includes(lower)
            );
        }
        // numeric sort by familyNumber
        return data.sort((a, b) => {
            const numA = a.familyNumber || 999999;
            const numB = b.familyNumber || 999999;
            return numA - numB;
        });
    }, [families, searchTerm]);

    // Group members by tanzeem for Tanzeem Wise view
    const tanzeemGroupedData = useMemo(() => {
        const tanzeemOrder = ['ansar', 'lajna', 'khuddam', 'atfal', 'nasirat', 'saf-e-awal', 'saf-e-awal-girls'];
        const grouped: Record<string, typeof filteredMemberData> = {};

        filteredMemberData.forEach(item => {
            const tanzeem = item.member.tanzeem || 'Unknown';
            if (!grouped[tanzeem]) {
                grouped[tanzeem] = [];
            }
            grouped[tanzeem].push(item);
        });

        // Sort tanzeem groups by predefined order
        return tanzeemOrder
            .filter(t => grouped[t])
            .map(tanzeem => ({
                tanzeem,
                members: grouped[tanzeem],
                totalPromise: grouped[tanzeem].reduce((sum, m) => sum + m.promise, 0),
                totalPaid: grouped[tanzeem].reduce((sum, m) => sum + m.paid, 0),
                count: grouped[tanzeem].length
            }))
            .map(group => ({
                ...group,
                percent: group.totalPromise > 0 ? Math.round((group.totalPaid / group.totalPromise) * 100) : 0
            }));
    }, [filteredMemberData]);

    // Initialize pagination states when families change
    useEffect(() => {
        const initialMembersPageState: Record<string, number> = {};
        const initialSpecialPageState: Record<string, number> = {};
        const initialMembersPageSizeState: Record<string, number> = {};
        const initialSpecialPageSizeState: Record<string, number> = {};
        
        families.forEach(family => {
            initialMembersPageState[family.id] = 1;
            initialSpecialPageState[family.id] = 1;
            initialMembersPageSizeState[family.id] = 10;
            initialSpecialPageSizeState[family.id] = 10;
        });
        
        setFamilyMembersCurrentPage(initialMembersPageState);
        setFamilySpecialCurrentPage(initialSpecialPageState);
        setFamilyMembersPageSize(initialMembersPageSizeState);
        setFamilySpecialPageSize(initialSpecialPageSizeState);
    }, [families]);

    // Initialize pagination states when tanzeem groups change
    useEffect(() => {
        const initialTanzeemPageState: Record<string, number> = {};
        const initialTanzeemPageSizeState: Record<string, number> = {};
        
        tanzeemGroupedData.forEach(group => {
            initialTanzeemPageState[group.tanzeem] = 1;
            initialTanzeemPageSizeState[group.tanzeem] = 10;
        });
        
        setTanzeemMembersCurrentPage(prev => ({ ...prev, ...initialTanzeemPageState }));
        setTanzeemMembersPageSize(prev => ({ ...prev, ...initialTanzeemPageSizeState }));
    }, [tanzeemGroupedData]);


    // Stats
    const stats = useMemo(() => {
        const specialPromise = Array.isArray(specialRecords) ? specialRecords.reduce((sum, r) => sum + (r.promiseAmount || 0) + (r.nagarparAmount || 0), 0) : 0;
        const specialPaid = Array.isArray(specialRecords) ? specialRecords.reduce((sum, r) => sum + (r.paidAmount || 0), 0) : 0;

        const totalPromise = records.reduce((sum, r) => sum + (r.promiseAmount || 0) + (r.nagarparAmount || 0), 0) + specialPromise;
        const totalPaid = records.reduce((sum, r) => sum + (r.paidAmount || 0), 0) + specialPaid;
        const percent = totalPromise > 0 ? (totalPaid / totalPromise) * 100 : 0;
        return { totalPromise, totalPaid, percent };
    }, [records, specialRecords]);

    // Tanzeem Stats Aggregation
    const tanzeemStats = useMemo(() => {
        const statsMap: Record<string, { promise: number; paid: number; count: number }> = {};

        members.forEach(member => {
            const tanzeem = member.tanzeem || 'Unknown';
            if (!statsMap[tanzeem]) {
                statsMap[tanzeem] = { promise: 0, paid: 0, count: 0 };
            }
            const record = records.find(r => r.memberId === member.id);
            if (record) {
                statsMap[tanzeem].promise += (record.promiseAmount || 0) + (record.nagarparAmount || 0);
                statsMap[tanzeem].paid += record.paidAmount || 0;
            }
            statsMap[tanzeem].count += 1;
        });

        return Object.entries(statsMap).map(([name, data]) => ({
            name,
            ...data,
            percent: data.promise > 0 ? (data.paid / data.promise) * 100 : 0
        })).sort((a, b) => b.promise - a.promise); // Sort by highest promise
    }, [members, records]);

    // Deceased Stats
    const deceasedStats = useMemo(() => {
        const deceasedMaleRecords = specialRecords.filter(r => r.isDeceased && r.gender === 'male');
        const deceasedFemaleRecords = specialRecords.filter(r => r.isDeceased && r.gender === 'female');
        
        const malePromiseAmount = deceasedMaleRecords.reduce((sum, r) => sum + (r.promiseAmount || 0) + (r.nagarparAmount || 0), 0);
        const malePaidAmount = deceasedMaleRecords.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
        
        const femalePromiseAmount = deceasedFemaleRecords.reduce((sum, r) => sum + (r.promiseAmount || 0) + (r.nagarparAmount || 0), 0);
        const femalePaidAmount = deceasedFemaleRecords.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
        
        const totalDeceasedPromise = malePromiseAmount + femalePromiseAmount;
        const totalDeceasedPaid = malePaidAmount + femalePaidAmount;
        
        return {
            deceasedMales: deceasedMaleRecords.length,
            deceasedFemales: deceasedFemaleRecords.length,
            malePromiseAmount,
            malePaidAmount,
            femalePromiseAmount,
            femalePaidAmount,
            totalDeceasedPromise,
            totalDeceasedPaid
        };
    }, [specialRecords]);

    // اضافی (Additional) Stats
    const azafiStats = useMemo(() => {
        const azafiRecords = specialRecords.filter(r => r.name === 'اضافی');
        
        const azafiPromiseAmount = azafiRecords.reduce((sum, r) => sum + (r.promiseAmount || 0) + (r.nagarparAmount || 0), 0);
        const azafiPaidAmount = azafiRecords.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
        
        return {
            count: azafiRecords.length,
            promiseAmount: azafiPromiseAmount,
            paidAmount: azafiPaidAmount,
            percent: azafiPromiseAmount > 0 ? (azafiPaidAmount / azafiPromiseAmount) * 100 : 0
        };
    }, [specialRecords]);

    // Helper function to convert English names to Urdu for display
    const getUrduName = (name: string): string => {
        if (name === 'Hazrat Muhammad (pbuh)') {
            return 'حضرت محمد ﷺ';
        } else if (name === 'Hazrat Messiah Maoud (as)') {
            return 'حضرت مسیح موعودؑ';
        }
        return name;
    };

    const handleExportFamilyPDF = async (family: Family, familyMembersCtx: NonNullable<MemberData>[], familySpecialRecords: WaqfJadeedSpecialRecord[], familyTotalPromise: number, familyTotalPaid: number) => {
        try {
            message.loading({ content: 'Generating PDF with Urdu support...', key: 'pdf-export', duration: 0 });
            
            // Create a temporary HTML element with proper Urdu rendering
            const printDiv = document.createElement('div');
            printDiv.style.position = 'absolute';
            printDiv.style.left = '-9999px';
            printDiv.style.width = '210mm'; // A4 width
            printDiv.style.padding = '20px';
            printDiv.style.fontFamily = 'Arial, "Noto Sans Arabic", "Al Qalam Taj Nastaleeq", sans-serif';
            printDiv.style.direction = 'rtl';
            printDiv.style.unicodeBidi = 'embed';
            printDiv.style.backgroundColor = 'white';
            printDiv.style.color = 'black';
            
            // Get family head data
            const familyHead = getMemberData(family.headId);
            const headPhone = familyHead?.member.phone || 'N/A';
            
            // Build HTML content
            let htmlContent = `
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="font-size: 24px; margin: 0; font-weight: bold;">${family.familyName} - Waqf-e-Jadeed ${selectedYear}</h1>
                </div><div style="margin-bottom: 15px; font-size: 12px; direction: rtl; text-align: right;">
    <p style="margin: 5px 0;">
        <strong>خاندان نمبر:</strong> ${family.familyNumber || 'N/A'} |
        <strong>سربراہ:</strong> ${familyHead?.member.name || 'نامعلوم'} |
        <strong>رابطہ نمبرِ سربراہ:</strong> ${headPhone}
    </p>
    <p style="margin: 5px 0;">
        <strong>کل وعدہ شدہ رقم:</strong> روپے ${familyTotalPromise.toLocaleString()} |
        <strong>کل ادا شدہ رقم:</strong> روپے ${familyTotalPaid.toLocaleString()}
    </p>
</div>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px;" dir="rtl">
                    <thead>
                        <tr style="background-color: #1890ff; color: white;">
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center; direction: rtl;">نمبر</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: right; direction: rtl;">نام</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: right; direction: rtl;">تنظیم</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: right; direction: rtl;">حلقہ</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center; direction: rtl;">وعدہ + نگرپار</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center; direction: rtl;">ادا شدہ</th>
                            <th style="border: 1px solid #ddd; padding: 8px; text-align: center; direction: rtl;">پیش رفت</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            // Helper function to determine row color based on tanzeem and promise
            const getRowColor = (tanzeem: string | undefined, promise: number): string => {
                const isAtfalOrNasirat = tanzeem === 'atfal' || tanzeem === 'nasirat' || tanzeem === 'saf-e-awal' || tanzeem === 'saf-e-awal-girls';
                
                if (isAtfalOrNasirat) {
                    // Atfal/Nasirat/Saf-e-Awal: Light blue if >= 1000, Yellow if < 1000
                    if (promise >= 1000) {
                        return '#e6f7ff'; // Light blue - consistent color
                    } else {
                        return '#fff7e6'; // Light yellow/orange - consistent color
                    }
                } else {
                    // Others (Khuddam, Lajna, Ansar): Stage 1 (>=5000) or Stage 2 (>=2500)
                    if (promise >= 5000) {
                        return '#f6ffed'; // Light green (Stage 1) - consistent color
                    } else if (promise >= 2500) {
                        return '#fff1f0'; // Light red/pink (Stage 2) - consistent color
                    } else {
                        return '#ffffff'; // Default white - consistent color
                    }
                }
            };
            
            familyMembersCtx.forEach((item, index) => {
                const rowColor = getRowColor(item.member.tanzeem, item.promise);
                htmlContent += `
                    <tr style="background-color: ${rowColor};">
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${index + 1}</td>
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: right; direction: rtl; unicode-bidi: embed;">${item.member.name}</td>
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: right; direction: rtl; unicode-bidi: embed;">${item.member.tanzeem || ''}</td>
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: right; direction: rtl; unicode-bidi: embed;">${family.halqa || ''}</td>
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">Rs. ${item.promise.toLocaleString()}</td>
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">Rs. ${item.paid.toLocaleString()}</td>
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${item.promise > 0 ? Math.round((item.paid / item.promise) * 100) : 0}%</td>
                    </tr>
                `;
            });
            
            htmlContent += '</tbody></table>';
            
            // Add special records if any
            if (familySpecialRecords.length > 0) {
                htmlContent += `
                    <h3 style="font-size: 14px; margin-top: 20px; margin-bottom: 10px; direction: rtl; text-align: right;">خصوصی / متوفی ریکارڈ</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px;" dir="rtl">
                        <thead>
                            <tr style="background-color: #8b4513; color: white;">
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: center; direction: rtl;">نمبر</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: right; direction: rtl;">نام (خصوصی)</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: center; direction: rtl;">جنس</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: center; direction: rtl;">وعدہ + نگرپار</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: center; direction: rtl;">ادا شدہ</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: center; direction: rtl;">پیش رفت</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                
                familySpecialRecords.forEach((record, index) => {
                    const totalPromise = (record.promiseAmount || 0) + (record.nagarparAmount || 0);
                    const rowColor = index % 2 === 0 ? '#ffffff' : '#faf0e6';
                    
                    // Convert English names to Urdu for display
                    const displayName = getUrduName(record.name);
                    
                    // Get deceased text based on gender
                    let deceasedText = '';
                    if (record.isDeceased) {
                        deceasedText = record.gender === 'female' ? ' (مرحومہ)' : ' (مرحوم)';
                    }
                    
                    htmlContent += `
                        <tr style="background-color: ${rowColor};">
                            <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${index + 1}</td>
                            <td style="border: 1px solid #ddd; padding: 6px; text-align: right; direction: rtl; unicode-bidi: embed;">${displayName}${deceasedText}</td>
                            <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${record.gender || ''}</td>
                            <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">Rs. ${totalPromise.toLocaleString()}</td>
                            <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">Rs. ${(record.paidAmount || 0).toLocaleString()}</td>
                            <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${totalPromise > 0 ? Math.round(((record.paidAmount || 0) / totalPromise) * 100) : 0}%</td>
                        </tr>
                    `;
                });
                
                htmlContent += '</tbody></table>';
            }
            
            // Add footer notes with color legend in Urdu
            htmlContent += `
<div style="margin-top: 30px; padding: 15px; background-color: #fafafa; border: 1px solid #ddd; border-radius: 5px; font-size: 10px; direction: rtl; text-align: right;">
    <h4 style="margin: 0 0 10px 0; font-size: 12px; font-weight: bold; text-align: center; direction: rtl;">
        وعدہ کی ہدایات اور رنگوں کی وضاحت
    </h4>

    <div style="margin-bottom: 10px; direction: rtl;">
        <p style="margin: 5px 0; direction: rtl;">
            <strong>اطفال اور ناصرات کے لیے:</strong>
        </p>

        <div style="display: inline-block; width: 20px; height: 15px; background-color: #e6f7ff; border: 1px solid #91d5ff; margin-left: 8px; vertical-align: middle;"></div>
        <span style="margin-left: 20px; direction: rtl;">
            اچھا وعدہ: کم از کم 1,000 روپے یا اس سے زیادہ
        </span>

        <br style="margin-top: 5px;">

        <div style="display: inline-block; width: 20px; height: 15px; background-color: #fff7e6; border: 1px solid #ffd591; margin-left: 8px; vertical-align: middle; margin-top: 5px;"></div>
        <span style="margin-left: 20px; direction: rtl;">
            کم از کم سے کم: 1,000 روپے سے کم
        </span>
    </div>

    <div style="margin-top: 10px; direction: rtl;">
        <p style="margin: 5px 0; direction: rtl;">
            <strong>دیگر افراد کے لیے (خدام، لجنہ، انصار وغیرہ):</strong>
        </p>

        <div style="display: inline-block; width: 20px; height: 15px; background-color: #f6ffed; border: 1px solid #b7eb8f; margin-left: 8px; vertical-align: middle;"></div>
        <span style="margin-left: 20px; direction: rtl;">
            پہلا معیار: 5,000 روپے یا اس سے زیادہ
        </span>

        <br style="margin-top: 5px;">

        <div style="display: inline-block; width: 20px; height: 15px; background-color: #fff1f0; border: 1px solid #ffccc7; margin-left: 8px; vertical-align: middle; margin-top: 5px;"></div>
        <span style="margin-left: 20px; direction: rtl;">
            دوسرا معیار: 2,500 روپے یا اس سے زیادہ (لیکن 5,000 روپے سے کم)
        </span>

        <br style="margin-top: 5px;">

        <div style="display: inline-block; width: 20px; height: 15px; background-color: #ffffff; border: 1px solid #d9d9d9; margin-left: 8px; vertical-align: middle; margin-top: 5px;"></div>
        <span style="margin-left: 20px; direction: rtl;">
            دوسرے معیار سے کم: 2,500 روپے سے کم
        </span>
    </div>
</div>

                </div>
                <div style="margin-top: 15px; font-size: 10px; text-align: center; color: #666; direction: rtl;">
                    <p>تیار کیا گیا: ${new Date().toLocaleDateString()}</p>
                </div>
            `;
            
            printDiv.innerHTML = htmlContent;
            document.body.appendChild(printDiv);
            
            // Convert to canvas with high quality
            const canvas = await html2canvas(printDiv, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                onclone: (clonedDoc) => {
                    // Ensure fonts are loaded in cloned document
                    const clonedElement = clonedDoc.querySelector('[style*="font-family"]') as HTMLElement;
                    if (clonedElement) {
                        clonedElement.style.fontFamily = 'Arial, "Noto Sans Arabic", "Al Qalam Taj Nastaleeq", sans-serif';
                    }
                }
            });
            
            // Remove temporary element
            document.body.removeChild(printDiv);
            
            // Convert canvas to PDF
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;
            
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
            
            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }
            
            pdf.save(`${family.familyName.replace(/\s+/g, '_')}_waqf_${selectedYear}.pdf`);
            message.success({ content: 'PDF generated successfully with Urdu support!', key: 'pdf-export' });
        } catch (error) {
            console.error('Error generating PDF:', error);
            message.error({ content: 'Failed to generate PDF', key: 'pdf-export' });
        }
    };

    const handleCopyNamesFrom2025 = async () => {
        try {
            setLoading(true);
            message.loading({ content: 'Copying names from 2025 to 2026...', key: 'copying', duration: 0 });
            
            // Get 2025 records
            const records2025 = await ApiService.getWaqfJadeedRecords(2025);
            
            // Get 2026 records to check what already exists
            const records2026 = await ApiService.getWaqfJadeedRecords(2026);
            const existing2026MemberIds = new Set(records2026.map(r => r.memberId));
            
            // Copy only names (create records with 0 promise and 0 paid)
            let copiedMembers = 0;
            let skippedMembers = 0;
            
            for (const record2025 of records2025) {
                // Skip if already exists in 2026
                if (existing2026MemberIds.has(record2025.memberId)) {
                    skippedMembers++;
                    continue;
                }
                
                // Create new record with 0 promise and 0 paid
                await ApiService.saveWaqfJadeedRecord({
                    memberId: record2025.memberId,
                    year: 2026,
                    promiseAmount: 0,
                    nagarparAmount: 0
                });
                copiedMembers++;
            }
            
            // Copy special records (including deceased and اضافی)
            const special2025 = await ApiService.getWaqfJadeedSpecialRecords(2025);
            const special2026 = await ApiService.getWaqfJadeedSpecialRecords(2026);
            
            // Check by name and familyId combination to avoid duplicates (year is already 2026 for existing records)
            const existing2026SpecialKeys = new Set(
                special2026.map(r => `${r.familyId || 'no-family'}_${r.name || 'no-name'}`)
            );
            
            let copiedSpecial = 0;
            let skippedSpecial = 0;
            
            for (const special2025Record of special2025) {
                const key = `${special2025Record.familyId || 'no-family'}_${special2025Record.name || 'no-name'}`;
                
                // Skip if already exists in 2026
                if (existing2026SpecialKeys.has(key)) {
                    skippedSpecial++;
                    continue;
                }
                
                try {
                    // Create new record without the old ID so it gets a new one
                    const { id, payments, paidAmount, ...specialDataWithoutId } = special2025Record;
                    await ApiService.saveWaqfJadeedSpecialRecord({
                        ...specialDataWithoutId,
                        year: 2026,
                        promiseAmount: 0,
                        nagarparAmount: 0,
                        paidAmount: 0,
                        payments: []
                    });
                    copiedSpecial++;
                } catch (err) {
                    console.error('Error copying special record:', special2025Record.name, err);
                    skippedSpecial++;
                }
            }
            
            const totalCopied = copiedMembers + copiedSpecial;
            const totalSkipped = skippedMembers + skippedSpecial;
            
            message.success({ 
                content: `Copied ${totalCopied} names (${copiedMembers} members, ${copiedSpecial} special) from 2025 to 2026. ${totalSkipped} already existed.`, 
                key: 'copying',
                duration: 5
            });
            
            // Reload data
            await loadData();
        } catch (error) {
            console.error('Error copying names:', error);
            message.error({ content: `Failed to copy names: ${error instanceof Error ? error.message : 'Unknown error'}`, key: 'copying', duration: 5 });
        } finally {
            setLoading(false);
        }
    };


    return (
        <div style={{ margin: 0, padding: '0 8px', width: '100%', maxWidth: '100%', boxSizing: 'border-box', paddingBottom: 80 }} className="waqf-jadeed-container">
            {/* Search Header */}
            <Card style={{ marginBottom: 16, position: 'sticky', top: 0, zIndex: 10 }} bodyStyle={{ padding: 12 }}>
                <Row gutter={[8, 8]} align="middle">
                    <Col xs={24} sm={12} md={8}>
                        <Title level={4} style={{ margin: 0, fontSize: 'clamp(16px, 4vw, 20px)' }}>Waqf-e-Jadeed</Title>
                    </Col>
                    <Col xs={12} sm={6} md={4}>
                        <Select
                            value={selectedYear}
                            onChange={setSelectedYear}
                            style={{ width: '100%' }}
                        >
                            {[2023, 2024, 2025, 2026].map(y => (
                                <Option key={y} value={y}>{y}</Option>
                            ))}
                        </Select>
                    </Col>
                    <Col xs={12} sm={6} md={4}>
                        <Input
                            prefix={<SearchOutlined />}
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            allowClear
                        />
                    </Col>
                    {selectedYear === 2026 && (
                        <Col xs={24} sm={24} md={12}>
                            <Button
                                icon={<CopyOutlined />}
                                onClick={handleCopyNamesFrom2025}
                                loading={loading}
                                type="dashed"
                                block
                                size="large"
                            >
                                Copy All Names from 2025 (Members + Special)
                            </Button>
                        </Col>
                    )}
                </Row>
                <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ marginTop: 12 }} type="card">
                    <Tabs.TabPane tab="Members" key="members" />
                    <Tabs.TabPane tab="Family Wise" key="families" />
                    <Tabs.TabPane tab="Tanzeem Wise" key="tanzeem" />
                    <Tabs.TabPane tab="Dashboard" key="dashboard" />
                </Tabs>
            </Card>

            {/* Stats Cards */}
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12} md={8}>
                    <Card bodyStyle={{ padding: 16 }}>
                        <Statistic
                            title="Total Promise"
                            value={stats.totalPromise}
                            prefix={<DollarOutlined />}
                            precision={0}
                            valueStyle={{ fontSize: 'clamp(20px, 5vw, 32px)' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={8}>
                    <Card bodyStyle={{ padding: 16 }}>
                        <Statistic
                            title="Total Paid"
                            value={stats.totalPaid}
                            prefix={<CheckCircleOutlined />}
                            valueStyle={{ color: '#3f8600', fontSize: 'clamp(20px, 5vw, 32px)' }}
                            precision={0}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={24} md={8}>
                    <Card bodyStyle={{ padding: 16 }}>
                        <Text type="secondary" style={{ fontSize: 'clamp(12px, 3vw, 14px)' }}>Collection Progress</Text>
                        <Progress percent={Math.round(stats.percent)} status="active" />
                    </Card>
                </Col>
            </Row>

            {/* Content */}
            {activeTab === 'members' ? (
                <Card>
                    <Table
                    dataSource={filteredMemberData}
                    loading={loading}
                        rowKey={(record) => record.member.id}
                    pagination={{
                            pageSize: 20,
                            showSizeChanger: true,
                            pageSizeOptions: ['10', '20', '50', '100'],
                            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} members`
                        }}
                        scroll={{ x: 'max-content' }}
                        onRow={(record) => ({
                            onClick: () => handleEdit(record.member),
                            style: { cursor: 'pointer' }
                        })}
                        columns={[
                            {
                                title: '#',
                                key: 'serial',
                                width: 60,
                                render: (_, __, index) => index + 1,
                                sorter: false
                            },
                            {
                                title: 'Photo',
                                key: 'photo',
                                width: 80,
                                render: (_, record) => (
                                    <Avatar 
                                        size="large" 
                                        icon={<UserOutlined />} 
                                        src={record.member.profilePhoto} 
                                    />
                                ),
                                sorter: false
                            },
                            {
                                title: 'Name',
                                key: 'name',
                                dataIndex: ['member', 'name'],
                                sorter: (a, b) => a.member.name.localeCompare(b.member.name),
                                render: (_, record) => (
                                    <div>
                                        <Text strong style={{ fontSize: '14px' }}>{record.member.name}</Text>
                                        {record.member.fatherName && (
                                            <div>
                                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                                    {record.member.fatherName}
                                                </Text>
                                            </div>
                                        )}
                                    </div>
                                )
                            },
                            {
                                title: 'Halqa',
                                key: 'halqa',
                                dataIndex: ['member', 'halqa'],
                                sorter: (a, b) => (a.member.halqa || '').localeCompare(b.member.halqa || ''),
                                render: (halqa) => halqa || <Text type="secondary">No Halqa</Text>
                            },
                            {
                                title: 'Tanzeem',
                                key: 'tanzeem',
                                dataIndex: ['member', 'tanzeem'],
                                sorter: (a, b) => a.member.tanzeem.localeCompare(b.member.tanzeem),
                                filters: (() => {
                                    // Get unique tanzeem values from filtered data
                                    const uniqueTanzeems = Array.from(new Set(filteredMemberData.map(item => item.member.tanzeem)));
                                    return uniqueTanzeems
                                        .sort()
                                        .map(tanzeem => ({
                                            text: getTanzeemDisplayName(tanzeem),
                                            value: tanzeem
                                        }));
                                })(),
                                onFilter: (value, record) => record.member.tanzeem === value,
                                render: (tanzeem) => (
                                    <Tag color="blue">{getTanzeemDisplayName(tanzeem)}</Tag>
                                )
                            },
                            {
                                title: 'Promise',
                                key: 'promise',
                                sorter: (a, b) => a.promise - b.promise,
                                render: (_, record) => (
                                    <Text strong style={{ fontSize: '14px' }}>
                                        Rs. {record.promise.toLocaleString()}
                                    </Text>
                                ),
                                align: 'right'
                            },
                            {
                                title: 'Paid',
                                key: 'paid',
                                sorter: (a, b) => a.paid - b.paid,
                                render: (_, record) => (
                                    <Text 
                                        strong 
                                        style={{ 
                                            fontSize: '14px',
                                            color: record.paid >= record.promise && record.promise > 0 ? '#52c41a' : undefined
                                        }}
                                    >
                                        Rs. {record.paid.toLocaleString()}
                                    </Text>
                                ),
                                align: 'right'
                            },
                            {
                                title: 'Progress',
                                key: 'progress',
                                sorter: (a, b) => {
                                    const aPercent = a.promise > 0 ? (a.paid / a.promise) * 100 : 0;
                                    const bPercent = b.promise > 0 ? (b.paid / b.promise) * 100 : 0;
                                    return aPercent - bPercent;
                                },
                                render: (_, record) => {
                                    const percent = record.promise > 0 ? Math.min(100, Math.round((record.paid / record.promise) * 100)) : 0;
                                    return (
                                        <div>
                                            <Progress
                                                percent={percent}
                                                size="small"
                                                strokeColor={record.paid >= record.promise && record.promise > 0 ? '#52c41a' : '#1890ff'}
                                                format={() => `${percent}%`}
                                            />
                                        </div>
                                    );
                                },
                                width: 150
                            },
                            {
                                title: 'Actions',
                                key: 'actions',
                                width: 100,
                                fixed: 'right',
                                render: (_, record) => (
                                    <Button
                                        type="link"
                                        icon={<EditOutlined />}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleEdit(record.member);
                                        }}
                                    >
                                        Edit
                                    </Button>
                                ),
                                sorter: false
                            }
                        ]}
                    />
                </Card>
            ) : activeTab === 'families' ? (
                <div className="family-list">
                    {loading ? <p>Loading...</p> : (
                        <Collapse defaultActiveKey={[]} ghost>
                            {filteredFamilyData.map(family => {
                                // Filter out deceased members from family members list
                                const familyMembersCtx = family.memberIds
                                    .map(mid => getMemberData(mid))
                                    .filter((item): item is NonNullable<MemberData> => {
                                        if (!item) return false;
                                        // Exclude if member is marked as deceased
                                        return !item.member.isDeceased;
                                    });
                                const familySpecialRecords = specialRecords.filter(r => r.familyId === family.id);

                                const membersPromise = familyMembersCtx.reduce((sum, m) => sum + (m?.promise || 0), 0);
                                const specialPromise = familySpecialRecords.reduce((sum, r) => sum + (r.promiseAmount || 0) + (r.nagarparAmount || 0), 0);
                                const familyTotalPromise = membersPromise + specialPromise;

                                const membersPaid = familyMembersCtx.reduce((sum, m) => sum + (m?.paid || 0), 0);
                                const specialPaid = familySpecialRecords.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
                                const familyTotalPaid = membersPaid + specialPaid;

                                const familyPercent = familyTotalPromise > 0 ? Math.round((familyTotalPaid / familyTotalPromise) * 100) : 0;

                                return (
                                    <Panel
                                        key={family.id}
                                        header={
                                            <Row justify="space-between" align="middle" style={{ width: '100%' }} gutter={[8, 8]}>
                                                <Col xs={24} sm={16} md={16}>
                                                    <Text strong style={{ fontSize: 'clamp(14px, 3.5vw, 16px)' }}>{family.familyName}</Text>
                                                    <br />
                                                    <Text type="secondary" style={{ fontSize: 'clamp(11px, 2.5vw, 12px)' }}>
                                                        {family.familyNumber ? <span>#{family.familyNumber} • </span> : ''}
                                                        Head: {getMemberData(family.headId)?.member.name || 'Unknown'} • {familyMembersCtx.length + familySpecialRecords.length} Cards
                                                    </Text>
                                                </Col>
                                                <Col xs={24} sm={8} md={6} style={{ textAlign: 'right' }}>
                                                    <Text type="secondary" style={{ fontSize: 'clamp(11px, 2.5vw, 12px)' }}>Paid / Promise</Text>
                                                    <div style={{ fontWeight: 500, fontSize: 'clamp(12px, 3vw, 14px)' }}>
                                                        {familyTotalPaid.toLocaleString()} / {familyTotalPromise.toLocaleString()}
                                                    </div>
                                                    <Progress percent={familyPercent} steps={5} size="small" strokeColor="#52c41a" />
                                                </Col>
                                                <Col xs={24} sm={24} md={2} style={{ textAlign: 'right' }}>
                                                    <Button
                                                        type="text"
                                                        icon={<FilePdfOutlined />}
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleExportFamilyPDF(
                                                                family,
                                                                familyMembersCtx,
                                                                familySpecialRecords,
                                                                familyTotalPromise,
                                                                familyTotalPaid
                                                            );
                                                        }}
                                                        title="Export to PDF"
                                                    />
                                                </Col>
                                            </Row>
                                        }
                                    >
                                        {/* Table for Family Members */}
                                        <Table
                                            size="small"
                                            dataSource={familyMembersCtx.filter(item => item !== null)}
                                            rowKey={(item) => item.member.id}
                                            pagination={{
                                                pageSize: 10,
                                                showSizeChanger: true,
                                                showQuickJumper: true,
                                                pageSizeOptions: ['5', '10', '20', '50'],
                                                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
                                                onChange: (page: number, pageSize: number) => {
                                                    setFamilyMembersCurrentPage(prev => ({
                                                        ...prev,
                                                        [family.id]: page || 1
                                                    }));
                                                    setFamilyMembersPageSize(prev => ({
                                                        ...prev,
                                                        [family.id]: pageSize || 10
                                                    }));
                                                }
                                            }}
                                            scroll={{ x: 'max-content' }}
                                            columns={[{
                                                title: '#',
                                                key: 'serial',
                                                width: 50,
                                                render: (_, __, index) => {
                                                    // Calculate serial number based on current page and page size
                                                    const currentFamilyPage = familyMembersCurrentPage[family.id] || 1;
                                                    const currentPageSize = familyMembersPageSize[family.id] || 10;
                                                    return ((currentFamilyPage - 1) * currentPageSize + index + 1);
                                                },
                                            },
                                            {
                                                title: 'Name',
                                                    dataIndex: ['member', 'name'],
                                                    key: 'name',
                                                    width: 150,
                                                    render: (name, record) => (
                                                        <a onClick={() => handleEdit(record.member)} style={{ cursor: 'pointer' }}>
                                                            {name}
                                                        </a>
                                                    ),
                                                },
                                                {
                                                    title: 'Promise',
                                                    key: 'promise',
                                                    width: 100,
                                                    render: (_, record) => record?.promise?.toLocaleString() || '0',
                                                },
                                                {
                                                    title: 'Paid',
                                                    key: 'paid',
                                                    width: 100,
                                                    render: (_, record) => (
                                                        <span style={{ color: record?.paid >= record?.promise && record?.promise > 0 ? 'green' : 'inherit' }}>
                                                            {(record?.paid || 0).toLocaleString()}
                                                        </span>
                                                    ),
                                                },
                                                {
                                                    title: 'Progress',
                                                    key: 'progress',
                                                    width: 120,
                                                    render: (_, record) => (
                                                        <div style={{ width: '100px' }}>
                                                            <Progress
                                                                percent={record?.promise > 0 ? Math.min(100, Math.round(((record?.paid || 0) / record?.promise) * 100)) : 0}
                                                                size="small"
                                                                showInfo={false}
                                                                strokeColor={record?.paid >= record?.promise ? '#52c41a' : '#1890ff'}
                                                            />
                                                        </div>
                                                    ),
                                                },
                                                {
                                                    title: 'Actions',
                                                    key: 'actions',
                                                    width: 80,
                                                    render: (_, record) => (
                                                        <Space size="small">
                                                            <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record.member)} />
                                                        </Space>
                                                    ),
                                                },
                                            ]}
                                        />

                                        {/* Special Members Section */}
                                        <div style={{ marginTop: 16, borderTop: '1px dashed #d9d9d9', paddingTop: 16 }}>
                                            <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
                                                <Text type="secondary"><strong style={{ color: '#1890ff' }}>Special / Deceased Pledges</strong></Text>
                                                <Button
                                                    size="small"
                                                    type="dashed"
                                                    icon={<PlusOutlined />}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveFamilyId(family.id);
                                                        specialForm.resetFields();
                                                        setSpecialModalVisible(true);
                                                    }}
                                                >
                                                    Add Special
                                                </Button>
                                            </Row>
                                            <Table
                                                size="small"
                                                dataSource={familySpecialRecords}
                                                rowKey="id"
                                                pagination={{
                                                    pageSize: 10,
                                                    showSizeChanger: true,
                                                    showQuickJumper: true,
                                                    pageSizeOptions: ['5', '10', '20', '50'],
                                                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
                                                    onChange: (page: number, pageSize: number) => {
                                                        setFamilySpecialCurrentPage(prev => ({
                                                            ...prev,
                                                            [family.id]: page || 1
                                                        }));
                                                        setFamilySpecialPageSize(prev => ({
                                                            ...prev,
                                                            [family.id]: pageSize || 10
                                                        }));
                                                    }
                                                }}
                                                scroll={{ x: 'max-content' }}
                                                columns={[{
                                                    title: '#',
                                                    key: 'serial',
                                                    width: 50,
                                                    render: (_, __, index) => {
                                                        // Calculate serial number based on current page and page size
                                                        const currentSpecialPage = familySpecialCurrentPage[family.id] || 1;
                                                        const currentSpecialPageSize = familySpecialPageSize[family.id] || 10;
                                                        return ((currentSpecialPage - 1) * currentSpecialPageSize + index + 1);
                                                    },
                                                },
                                                {
                                                    title: 'Name',
                                                        dataIndex: 'name',
                                                        key: 'name',
                                                        width: 150,
                                                        render: (name, record) => {
                                                            const deceasedText = record?.isDeceased 
                                                                ? (record.gender === 'female' ? ' (مرحومہ)' : ' (مرحوم)')
                                                                : '';
                                                            return (
                                                                <>
                                                                    <span style={{ direction: 'rtl', unicodeBidi: 'embed' }}>{getUrduName(name || '')}{deceasedText}</span>
                                                                </>
                                                            );
                                                        },
                                                    },
                                                    {
                                                        title: 'Promise',
                                                        key: 'promise',
                                                        width: 100,
                                                        render: (_, record) => ((record?.promiseAmount || 0) + (record?.nagarparAmount || 0)).toLocaleString(),
                                                    },
                                                    {
                                                        title: 'Paid',
                                                        key: 'paid',
                                                        width: 100,
                                                        render: (_, record) => record?.paidAmount?.toLocaleString() || '0',
                                                    },
                                                    {
                                                        title: 'Progress',
                                                        key: 'progress',
                                                        width: 120,
                                                        render: (_, record) => {
                                                            const totalPromise = (record?.promiseAmount || 0) + (record?.nagarparAmount || 0);
                                                            const percent = totalPromise > 0 ? Math.round((record?.paidAmount || 0) / totalPromise * 100) : 0;
                                                            return (
                                                                <div style={{ width: '100px' }}>
                                                                    <Progress
                                                                        percent={percent}
                                                                        size="small"
                                                                        showInfo={false}
                                                                        strokeColor={(record?.paidAmount || 0) >= totalPromise ? '#52c41a' : '#1890ff'}
                                                                    />
                                                                </div>
                                                            );
                                                        },
                                                    },
                                                    {
                                                        title: 'Actions',
                                                        key: 'actions',
                                                        width: 100,
                                                        render: (_, record) => (
                                                            <Space size="small">
                                                                <Button size="small" icon={<EditOutlined />} onClick={() => handleEditSpecial(record)} />
                                                                <Button size="small" icon={<DeleteOutlined />} danger onClick={() => handleDeleteSpecial(record.id)} />
                                                            </Space>
                                                        ),
                                                    },
                                                ]}
                                            />
                                        </div>
                                    </Panel>
                                );
                            })}
                        </Collapse>
                    )}
                </div>
            ) : activeTab === 'tanzeem' ? (
                <div className="tanzeem-list">
                    {loading ? <p>Loading...</p> : (
                        <Collapse defaultActiveKey={[]} ghost>
                            {tanzeemGroupedData.map(group => {
                                return (
                                    <Panel
                                        key={group.tanzeem}
                                        header={
                                            <Row justify="space-between" align="middle" style={{ width: '100%' }} gutter={[8, 8]}>
                                                <Col xs={24} sm={16} md={16}>
                                                    <Text strong style={{ fontSize: 'clamp(14px, 3.5vw, 16px)' }}>
                                                        {getTanzeemDisplayName(group.tanzeem as any)}
                                                    </Text>
                                                    <br />
                                                    <Text type="secondary" style={{ fontSize: 'clamp(11px, 2.5vw, 12px)' }}>
                                                        {group.count} Members
                                                    </Text>
                                                </Col>
                                                <Col xs={24} sm={8} md={6} style={{ textAlign: 'right' }}>
                                                    <Text type="secondary" style={{ fontSize: 'clamp(11px, 2.5vw, 12px)' }}>Paid / Promise</Text>
                                                    <div style={{ fontWeight: 500, fontSize: 'clamp(12px, 3vw, 14px)' }}>
                                                        {group.totalPaid.toLocaleString()} / {group.totalPromise.toLocaleString()}
                                                    </div>
                                                    <Progress percent={group.percent} steps={5} size="small" strokeColor="#52c41a" />
                                                </Col>
                                            </Row>
                                        }
                                    >
                                        {/* Table for Tanzeem Members */}
                                        <Table
                                            size="small"
                                            dataSource={group.members.filter(item => item !== null)}
                                            rowKey={(item) => item.member.id}
                                            pagination={{
                                                pageSize: 10,
                                                showSizeChanger: true,
                                                showQuickJumper: true,
                                                pageSizeOptions: ['5', '10', '20', '50'],
                                                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
                                                onChange: (page: number, pageSize: number) => {
                                                    setTanzeemMembersCurrentPage(prev => ({
                                                        ...prev,
                                                        [group.tanzeem]: page || 1
                                                    }));
                                                    setTanzeemMembersPageSize(prev => ({
                                                        ...prev,
                                                        [group.tanzeem]: pageSize || 10
                                                    }));
                                                }
                                            }}
                                            scroll={{ x: 'max-content' }}
                                            columns={[{
                                                title: '#',
                                                key: 'serial',
                                                width: 50,
                                                render: (_, __, index) => {
                                                    const currentPage = tanzeemMembersCurrentPage[group.tanzeem] || 1;
                                                    const currentPageSize = tanzeemMembersPageSize[group.tanzeem] || 10;
                                                    return ((currentPage - 1) * currentPageSize + index + 1);
                                                },
                                            },
                                            {
                                                title: 'Name',
                                                dataIndex: ['member', 'name'],
                                                key: 'name',
                                                width: 150,
                                                render: (name, record) => (
                                                    <a onClick={() => handleEdit(record.member)} style={{ cursor: 'pointer' }}>
                                                        {name}
                                                    </a>
                                                ),
                                            },
                                            {
                                                title: 'Halqa',
                                                key: 'halqa',
                                                dataIndex: ['member', 'halqa'],
                                                width: 120,
                                                render: (halqa) => halqa || <Text type="secondary">No Halqa</Text>
                                            },
                                            {
                                                title: 'Promise',
                                                key: 'promise',
                                                width: 100,
                                                render: (_, record) => record?.promise?.toLocaleString() || '0',
                                            },
                                            {
                                                title: 'Paid',
                                                key: 'paid',
                                                width: 100,
                                                render: (_, record) => (
                                                    <span style={{ color: record?.paid >= record?.promise && record?.promise > 0 ? 'green' : 'inherit' }}>
                                                        {(record?.paid || 0).toLocaleString()}
                                                    </span>
                                                ),
                                            },
                                            {
                                                title: 'Progress',
                                                key: 'progress',
                                                width: 120,
                                                render: (_, record) => (
                                                    <div style={{ width: '100px' }}>
                                                        <Progress
                                                            percent={record?.promise > 0 ? Math.min(100, Math.round(((record?.paid || 0) / record?.promise) * 100)) : 0}
                                                            size="small"
                                                            showInfo={false}
                                                            strokeColor={record?.paid >= record?.promise ? '#52c41a' : '#1890ff'}
                                                        />
                                                    </div>
                                                ),
                                            },
                                            {
                                                title: 'Actions',
                                                key: 'actions',
                                                width: 80,
                                                render: (_, record) => (
                                                    <Space size="small">
                                                        <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record.member)} />
                                                    </Space>
                                                ),
                                            },
                                            ]}
                                        />
                                    </Panel>
                                );
                            })}
                        </Collapse>
                    )}
                </div>
            ) : (
                // Dashboard Tab (Tanzeem Wise)
                <div className="dashboard-view">
                    {/* Deceased Stats Cards with Amounts */}
                    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                        <Col xs={24} sm={24} md={8}>
                            <Card hoverable>
                                <Statistic
                                    title={<span style={{ fontSize: 'clamp(12px, 3vw, 14px)' }}>{`Deceased Males (${deceasedStats.deceasedMales})`}</span>}
                                    value={deceasedStats.malePaidAmount || 0}
                                    prefix="Rs."
                                    precision={0}
                                    valueStyle={{ fontSize: 'clamp(18px, 4.5vw, 28px)' }}
                                />
                                <Progress
                                    percent={deceasedStats.deceasedMales > 0 ? Math.round((deceasedStats.malePaidAmount || 0) / (deceasedStats.malePromiseAmount || 1) * 100) : 0}
                                    status={deceasedStats.malePaidAmount >= deceasedStats.malePromiseAmount && deceasedStats.malePromiseAmount > 0 ? 'success' : 'active'}
                                    strokeColor={deceasedStats.malePaidAmount >= deceasedStats.malePromiseAmount && deceasedStats.malePromiseAmount > 0 ? '#52c41a' : '#1890ff'}
                                />
                                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                                    <Text type="secondary" style={{ fontSize: 'clamp(11px, 2.5vw, 12px)' }}>Promise: Rs. {(deceasedStats.malePromiseAmount || 0).toLocaleString()}</Text>
                                    <Text type="secondary" style={{ fontSize: 'clamp(11px, 2.5vw, 12px)' }}>{deceasedStats.malePromiseAmount ? Math.round((deceasedStats.malePaidAmount || 0) / deceasedStats.malePromiseAmount * 100).toFixed(1) + '%' : '0%'}</Text>
                                </div>
                            </Card>
                        </Col>
                        <Col xs={24} sm={24} md={8}>
                            <Card hoverable>
                                <Statistic
                                    title={<span style={{ fontSize: 'clamp(12px, 3vw, 14px)' }}>{`Deceased Females (${deceasedStats.deceasedFemales})`}</span>}
                                    value={deceasedStats.femalePaidAmount || 0}
                                    prefix="Rs."
                                    precision={0}
                                    valueStyle={{ fontSize: 'clamp(18px, 4.5vw, 28px)' }}
                                />
                                <Progress
                                    percent={deceasedStats.deceasedFemales > 0 ? Math.round((deceasedStats.femalePaidAmount || 0) / (deceasedStats.femalePromiseAmount || 1) * 100) : 0}
                                    status={deceasedStats.femalePaidAmount >= deceasedStats.femalePromiseAmount && deceasedStats.femalePromiseAmount > 0 ? 'success' : 'active'}
                                    strokeColor={deceasedStats.femalePaidAmount >= deceasedStats.femalePromiseAmount && deceasedStats.femalePromiseAmount > 0 ? '#52c41a' : '#1890ff'}
                                />
                                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                                    <Text type="secondary" style={{ fontSize: 'clamp(11px, 2.5vw, 12px)' }}>Promise: Rs. {(deceasedStats.femalePromiseAmount || 0).toLocaleString()}</Text>
                                    <Text type="secondary" style={{ fontSize: 'clamp(11px, 2.5vw, 12px)' }}>{deceasedStats.femalePromiseAmount ? Math.round((deceasedStats.femalePaidAmount || 0) / deceasedStats.femalePromiseAmount * 100).toFixed(1) + '%' : '0%'}</Text>
                                </div>
                            </Card>
                        </Col>
                        <Col xs={24} sm={24} md={8}>
                            <Card hoverable>
                                <Statistic
                                    title={<span style={{ fontSize: 'clamp(12px, 3vw, 14px)' }}>{`Total Deceased (${deceasedStats.deceasedMales + deceasedStats.deceasedFemales})`}</span>}
                                    value={deceasedStats.totalDeceasedPaid || 0}
                                    prefix="Rs."
                                    precision={0}
                                    valueStyle={{ fontSize: 'clamp(18px, 4.5vw, 28px)' }}
                                />
                                <Progress
                                    percent={deceasedStats.totalDeceasedPromise > 0 ? Math.round(deceasedStats.totalDeceasedPaid / deceasedStats.totalDeceasedPromise * 100) : 0}
                                    status={deceasedStats.totalDeceasedPaid >= deceasedStats.totalDeceasedPromise && deceasedStats.totalDeceasedPromise > 0 ? 'success' : 'active'}
                                    strokeColor={deceasedStats.totalDeceasedPaid >= deceasedStats.totalDeceasedPromise && deceasedStats.totalDeceasedPromise > 0 ? '#52c41a' : '#1890ff'}
                                />
                                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                                    <Text type="secondary" style={{ fontSize: 'clamp(11px, 2.5vw, 12px)' }}>Promise: Rs. {(deceasedStats.totalDeceasedPromise || 0).toLocaleString()}</Text>
                                    <Text type="secondary" style={{ fontSize: 'clamp(11px, 2.5vw, 12px)' }}>{deceasedStats.totalDeceasedPromise ? Math.round(deceasedStats.totalDeceasedPaid / deceasedStats.totalDeceasedPromise * 100).toFixed(1) + '%' : '0%'}</Text>
                                </div>
                            </Card>
                        </Col>
                    </Row>

                    {/* اضافی (Additional) Stats Card */}
                    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                        <Col xs={24} sm={24} md={24}>
                            <Card hoverable>
                                <Statistic
                                    title={`اضافی (${azafiStats.count})`}
                                    value={azafiStats.paidAmount || 0}
                                    prefix="Rs."
                                    precision={0}
                                    valueStyle={{ fontSize: 'clamp(18px, 4.5vw, 28px)' }}
                                />
                                <Progress
                                    percent={Math.round(azafiStats.percent)}
                                    status={azafiStats.paidAmount >= azafiStats.promiseAmount && azafiStats.promiseAmount > 0 ? 'success' : 'active'}
                                    strokeColor={azafiStats.paidAmount >= azafiStats.promiseAmount && azafiStats.promiseAmount > 0 ? '#52c41a' : '#1890ff'}
                                />
                                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                                    <Text type="secondary" style={{ fontSize: 'clamp(11px, 2.5vw, 12px)' }}>Promise: Rs. {(azafiStats.promiseAmount || 0).toLocaleString()}</Text>
                                    <Text type="secondary" style={{ fontSize: 'clamp(11px, 2.5vw, 12px)' }}>{azafiStats.promiseAmount ? Math.round(azafiStats.percent).toFixed(1) + '%' : '0%'}</Text>
                                </div>
                            </Card>
                        </Col>
                    </Row>
                    
                    <List
                        grid={{ gutter: [16, 16], xs: 1, sm: 2, md: 2, lg: 3, xl: 4 }}
                        dataSource={tanzeemStats}
                        renderItem={(item) => (
                            <List.Item>
                                <Card hoverable>
                                    <Statistic
                                        title={<span style={{ fontSize: 'clamp(12px, 3vw, 14px)' }}>{`${item.name} (${item.count})`}</span>}
                                        value={item.paid}
                                        prefix="Rs."
                                        precision={0}
                                        valueStyle={{ fontSize: 'clamp(18px, 4.5vw, 28px)' }}
                                    />
                                    <Progress
                                        percent={Math.round(item.percent)}
                                        status={item.percent >= 100 ? 'success' : 'active'}
                                        strokeColor={item.percent >= 100 ? '#52c41a' : '#1890ff'}
                                    />
                                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                                        <Text type="secondary" style={{ fontSize: 'clamp(11px, 2.5vw, 12px)' }}>Promise: Rs. {item.promise.toLocaleString()}</Text>
                                        <Text type="secondary" style={{ fontSize: 'clamp(11px, 2.5vw, 12px)' }}>{item.percent.toFixed(1)}%</Text>
                                    </div>
                                </Card>
                            </List.Item>
                        )}
                    />
                </div>
            )}

            {/* Edit Drawer */}
            <Drawer
                title={`Edit: ${editingMember ? editingMember.name : editingSpecial ? editingSpecial.name : ''}`}
                placement="bottom"
                height="70vh"
                onClose={() => setDrawerVisible(false)}
                open={drawerVisible}
                extra={
                    <Button type="primary" onClick={handleSave} loading={submitting} size="small">
                        Save
                    </Button>
                }
            >
                <Form form={form} layout="vertical">
                    <Row gutter={[16, 16]}>
                        <Col xs={24} sm={12} md={12} lg={6}>
                            <Form.Item label="Promise">
                                {isEditingPromise ? (
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <Form.Item name="promiseAmount" noStyle>
                                            <InputNumber
                                                style={{ width: '100%' }}
                                                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                                parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                                                size="large"
                                                autoFocus
                                            />
                                        </Form.Item>
                                        <Button
                                            type="primary"
                                            onClick={handleSave}
                                            icon={<CheckCircleOutlined />}
                                            loading={submitting}
                                        />
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Title level={4} style={{ margin: 0 }}>
                                            {(editingMember
                                                ? (records.find(r => r.memberId === editingMember.id)?.promiseAmount || 0)
                                                : (editingSpecial?.promiseAmount || 0)
                                            ).toLocaleString()}
                                        </Title>
                                        <Button
                                            size="small"
                                            icon={<EditOutlined />}
                                            onClick={() => setIsEditingPromise(true)}
                                        />
                                    </div>
                                )}
                                {/* PREVIOUS YEAR PROMISE DISPLAY */}
                                <div style={{ marginTop: 4 }}>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        {selectedYear - 1} Promise: {' '}
                                        <Text strong>
                                            {editingMember
                                                ? (prevRecords.find(r => r.memberId === editingMember.id)?.promiseAmount || 0).toLocaleString()
                                                : (prevSpecialRecords.find(r => r.id === editingSpecial?.id)?.promiseAmount || 0).toLocaleString()
                                            }
                                        </Text>
                                    </Text>
                                </div>
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12} md={12} lg={6}>
                            <Form.Item label="Nagarpar">
                                {isEditingPromise ? (
                                    <Form.Item name="nagarparAmount" noStyle>
                                        <InputNumber
                                            style={{ width: '100%' }}
                                            formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                            parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                                            size="large"
                                        />
                                    </Form.Item>
                                ) : (
                                    <Title level={4} style={{ margin: 0 }}>
                                        {(editingMember
                                            ? (records.find(r => r.memberId === editingMember.id)?.nagarparAmount || 0)
                                            : (editingSpecial?.nagarparAmount || 0)
                                        ).toLocaleString()}
                                    </Title>
                                )}
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12} md={12} lg={6}>
                            <Form.Item label="Total Promise">
                                <Title level={4} style={{ margin: 0, marginTop: 4 }}>
                                    {((editingMember
                                        ? ((records.find(r => r.memberId === editingMember.id)?.promiseAmount || 0) + (records.find(r => r.memberId === editingMember.id)?.nagarparAmount || 0))
                                        : ((editingSpecial?.promiseAmount || 0) + (editingSpecial?.nagarparAmount || 0))
                                    ).toLocaleString())}
                                </Title>
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12} md={12} lg={6}>
                            <Form.Item label="Total Paid">
                                <Title level={4} style={{ margin: 0, marginTop: 4 }}>
                                    {editingMember
                                        ? (records.find(r => r.memberId === editingMember.id)?.paidAmount?.toLocaleString() || 0)
                                        : (editingSpecial?.paidAmount?.toLocaleString() || 0)
                                    }
                                </Title>
                            </Form.Item>
                        </Col>
                    </Row>
                    {/* Notes field removed as per request */}
                </Form>

                <div style={{ marginTop: 24, padding: '16px 0', borderTop: '1px solid #f0f0f0' }}>
                    <Title level={5} style={{ fontSize: 'clamp(14px, 3.5vw, 16px)' }}>Add Payment</Title>
                    <Form form={paymentForm} layout="vertical" onFinish={handleAddPayment}>
                        <Row gutter={[8, 8]}>
                            <Col xs={24} sm={12} md={8}>
                                <Form.Item name="amount" rules={[{ required: true, message: 'Required' }]} style={{ margin: 0 }}>
                                <InputNumber placeholder="Amount" style={{ width: '100%' }} />
                            </Form.Item>
                            </Col>
                            <Col xs={24} sm={12} md={10}>
                                <Form.Item name="notes" style={{ margin: 0 }}>
                                <Input placeholder="Ref/Receipt #" />
                            </Form.Item>
                            </Col>
                            <Col xs={24} sm={24} md={6}>
                                <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={submitting} block>Add</Button>
                            </Col>
                        </Row>
                    </Form>
                </div>

                <div style={{ marginTop: 24 }}>
                    <Title level={5}>Payment History</Title>
                    <List
                        size="small"
                        dataSource={editingMember
                            ? (records.find(r => r.memberId === editingMember.id)?.payments || [])
                            : (editingSpecial?.payments || [])
                        }
                        renderItem={(item: Payment) => (
                            <List.Item>
                                <List.Item.Meta
                                    title={`Rs. ${item.amount.toLocaleString()}`}
                                    description={
                                        <Space>
                                            <Text type="secondary">{dayjs(item.date).format('DD MMM YYYY')}</Text>
                                            {item.notes && <Text type="secondary">• {item.notes}</Text>}
                                        </Space>
                                    }
                                />
                                <Space>
                                    <Button
                                        type="text"
                                        icon={<PrinterOutlined />}
                                        onClick={() => {
                                            setPrintingPayment({
                                                payment: item,
                                                recordName: editingMember ? editingMember.name : (editingSpecial?.name || 'Unknown'),
                                                // memberCode: editingMember ? editingMember.memberCode : undefined // Property does not exist
                                                memberCode: undefined // Or use another field if available, but for now undefined to fix build
                                            });
                                        }}
                                    />
                                    <Button
                                        type="text"
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={() => handleDeletePayment(item.id)}
                                    />
                                </Space>
                            </List.Item>
                        )}
                    />
                </div>

                {/* Payment Plans Section */}
                {editingMember && (
                    <div style={{ marginTop: 24 }}>
                        <PaymentPlanManager
                            memberId={editingMember.id}
                            year={selectedYear}
                            totalAmount={
                                (records.find(r => r.memberId === editingMember.id)?.promiseAmount || 0) +
                                (records.find(r => r.memberId === editingMember.id)?.nagarparAmount || 0)
                            }
                            onUpdate={loadData}
                        />
                    </div>
                )}

                <div style={{ marginTop: 20, textAlign: 'center' }}>
                    <Text type="secondary">Year: {selectedYear}</Text>
                </div>
            </Drawer>

            {/* Receipt Modal */}
            <Modal
                title="Print Receipt"
                open={!!printingPayment}
                onCancel={() => setPrintingPayment(null)}
                footer={[
                    <Button key="close" onClick={() => setPrintingPayment(null)}>Close</Button>,
                    <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>Print</Button>
                ]}
                width="90%"
                style={{ maxWidth: 800 }}
                styles={{ body: { padding: 0 } }}
            >
                {printingPayment && (
                    <div style={{ padding: 20, background: '#f0f2f5', maxHeight: '70vh', overflow: 'auto' }}>
                        <ReceiptTemplate
                            ref={receiptRef}
                            data={{
                                receiptNo: printingPayment.payment.id.slice(0, 8).toUpperCase(),
                                date: printingPayment.payment.date,
                                name: printingPayment.recordName,
                                memberCode: printingPayment.memberCode || '',
                                amount: printingPayment.payment.amount,
                                year: selectedYear,
                                type: printingPayment.memberCode ? 'Waqf-e-Jadeed' : 'Waqf-e-Jadeed (Special)'
                            }}
                        />
                    </div>
                )}
            </Modal>

            {/* Special Member Modal */}
            <Modal
                title="Add/Edit Special Pledge"
                open={specialModalVisible}
                onOk={handleSaveSpecial}
                onCancel={() => setSpecialModalVisible(false)}
                okText="Save"
                confirmLoading={submitting}
            >
                <Form form={specialForm} layout="vertical">
                    <Form.Item name="id" hidden><Input /></Form.Item>

                    <Form.Item label="Quick Select">
                        <Radio.Group
                            buttonStyle="solid"
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val) specialForm.setFieldsValue({ name: val });
                            }}
                            style={{ width: '100%' }}
                        >
                            <Radio.Button value="Hazrat Muhammad (pbuh)" style={{ width: '33.33%', textAlign: 'center', fontSize: 'clamp(11px, 2.5vw, 12px)', direction: 'rtl' }}>حضرت محمد ﷺ</Radio.Button>
                            <Radio.Button value="Hazrat Messiah Maoud (as)" style={{ width: '33.33%', textAlign: 'center', fontSize: 'clamp(11px, 2.5vw, 12px)', direction: 'rtl' }}>حضرت مسیح موعودؑ</Radio.Button>
                            <Radio.Button value="اضافی" style={{ width: '33.33%', textAlign: 'center', fontSize: 'clamp(11px, 2.5vw, 12px)', direction: 'rtl' }}>اضافی</Radio.Button>
                        </Radio.Group>
                    </Form.Item>

                    <Form.Item name="name" label="Name / Title" rules={[{ required: true, message: 'Please enter name' }]}>
                        <Input placeholder="Enter Name" />
                    </Form.Item>

                    <Row gutter={16}>
                        <Col xs={24} sm={12}>
                            <Form.Item name="gender" label="Gender" initialValue="male">
                                <Radio.Group>
                                    <Radio value="male">Male</Radio>
                                    <Radio value="female">Female</Radio>
                                </Radio.Group>
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item name="isDeceased" valuePropName="checked" initialValue={false}>
                                <Checkbox>Is Deceased?</Checkbox>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col xs={24} sm={12}>
                            <Form.Item name="promiseAmount" label="Promised Amount" initialValue={0}>
                                <InputNumber
                                    style={{ width: '100%' }}
                                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item name="nagarparAmount" label="Nagarpar Amount" initialValue={0}>
                                <InputNumber
                                    style={{ width: '100%' }}
                                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Modal>
        </div>
    );
};

export default WaqfJadeed;
