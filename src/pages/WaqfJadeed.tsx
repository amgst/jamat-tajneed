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
    Tag,
    Divider,
    Tooltip,
    Popconfirm
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
    SaveOutlined,
    ShareAltOutlined,
    BookOutlined
} from '@ant-design/icons';
import WaqfReports from '../components/WaqfReports';
import dayjs from 'dayjs';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { ApiService } from '../services/apiService';
import type { Member, WaqfJadeedRecord, Family, Payment, WaqfJadeedSpecialRecord, ReceiptBook } from '../types';
import { ReceiptTemplate } from '../components/ReceiptTemplate';
import PaymentPlanManager from '../components/PaymentPlanManager';
import { getTanzeemDisplayName, calculateAge, determineTanzeem, getTanzeemUrduName, formatCNIC } from '../utils/helpers';
import MemberForm from '../components/MemberForm';
import { generateAvatarFromName } from '../utils/imageUtils';
import { validateMemberData, sanitizeMemberData } from '../utils/validation';

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

    // Target amount state (stored per year in localStorage)
    const [targetAmount, setTargetAmount] = useState<number>(0);

    const [familySort, setFamilySort] = useState<'default' | 'zero_promise_first'>('default');

    // Drawer & Edit State
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [editingSpecial, setEditingSpecial] = useState<WaqfJadeedSpecialRecord | null>(null);
    const [isEditingPromise, setIsEditingPromise] = useState(false);

    const [form] = Form.useForm();
    const [paymentForm] = Form.useForm(); // New form for adding payments
    const [specialForm] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);

    // Payment Editing State
    const [paymentEditingId, setPaymentEditingId] = useState<string | null>(null);

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

    const [books, setBooks] = useState<ReceiptBook[]>([]);
    const [addBookModalVisible, setAddBookModalVisible] = useState(false);
    const [manageBooksModalVisible, setManageBooksModalVisible] = useState(false);
    const [editingBookId, setEditingBookId] = useState<string | null>(null);
    const [editingBookName, setEditingBookName] = useState('');
    const [newBookForm] = Form.useForm();

    useEffect(() => {
        loadData();
        loadBooks();
    }, [selectedYear]);


    const loadBooks = async () => {
        try {
            const data = await ApiService.getReceiptBooks();
            // Sort active first, then by createdAt desc
            const sorted = data.sort((a, b) => {
                if (a.status === 'active' && b.status !== 'active') return -1;
                if (a.status !== 'active' && b.status === 'active') return 1;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
            setBooks(sorted);
        } catch (error) {
            console.error('Failed to load books:', error);
        }
    };

    useEffect(() => {
        const loadTarget = async () => {
            try {
                const target = await ApiService.getTargetAmount(selectedYear);
                setTargetAmount(target);
            } catch (error) {
                console.error('Failed to load target:', error);
            }
        };
        loadTarget();
    }, [selectedYear]);


    // Handler to save target amount
    // Handler to save target amount with debounce
    const saveTargetRef = React.useRef<NodeJS.Timeout | null>(null);

    const handleTargetChange = (value: number | null) => {
        const target = value || 0;
        setTargetAmount(target);

        if (saveTargetRef.current) {
            clearTimeout(saveTargetRef.current);
        }

        saveTargetRef.current = setTimeout(async () => {
            try {
                await ApiService.saveTargetAmount(selectedYear, target);
                message.success({ content: 'Target saved', key: 'target-save', duration: 2 });
            } catch (error) {
                console.error('Failed to save target:', error);
            }
        }, 1000);
    };

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
            // Filter out moved members
            setMembers(membersData.filter(m => !m.isMoved && !m.isDeceased));
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

    const handleExportDashboard = async () => {
        const dashboardElement = document.querySelector('.dashboard-view') as HTMLElement;
        if (!dashboardElement) return;

        setLoading(true);
        try {
            const canvas = await html2canvas(dashboardElement, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const imgWidth = 297; // A4 landscape width
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`Waqf_Jadeed_Dashboard_${selectedYear}.pdf`);
            message.success('Dashboard exported successfully');
        } catch (error) {
            console.error('Export failed:', error);
            message.error('Failed to export dashboard');
        } finally {
            setLoading(false);
        }
    };

    // End of loadData


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

    const updateLocalSpecialRecord = (savedRecord: WaqfJadeedSpecialRecord) => {
        setSpecialRecords(prev => {
            const idx = prev.findIndex(r => r.id === savedRecord.id);
            if (idx >= 0) {
                const newRecords = [...prev];
                newRecords[idx] = savedRecord;
                return newRecords;
            } else {
                return [...prev, savedRecord];
            }
        });
    };

    const updateLocalMember = (updatedMember: Member) => {
        setMembers(prev => prev.map(m => m.id === updatedMember.id ? updatedMember : m));
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
                if (saved) {
                    // Preserving payments as saveWaqfJadeedSpecialRecord doesn't return them if just saving core data
                    // Actually, the API returns the snap, but we usually want to keep payments in state
                    updateLocalSpecialRecord({ ...saved, payments: editingSpecial.payments } as WaqfJadeedSpecialRecord);
                    setEditingSpecial({ ...saved, payments: editingSpecial.payments } as WaqfJadeedSpecialRecord);
                }
            }

            message.success('Promise updated');
            setIsEditingPromise(false);
        } catch (error) {
            message.error('Failed to save promise');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddBook = async (values: any) => {
        try {
            setSubmitting(true);
            await ApiService.createReceiptBook(values.bookNo);
            message.success('Book created successfully');
            setAddBookModalVisible(false);
            newBookForm.resetFields();
            loadBooks();
        } catch (error: any) {
            message.error(error.message || 'Failed to create book');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteBook = async (id: string) => {
        try {
            await ApiService.deleteReceiptBook(id);
            message.success('Book deleted');
            loadBooks();
        } catch (error) {
            message.error('Failed to delete book');
        }
    };

    const handleUpdateBook = async (id: string) => {
        try {
            await ApiService.updateReceiptBook(id, { bookNo: editingBookName });
            message.success('Book updated');
            setEditingBookId(null);
            setEditingBookName('');
            loadBooks();
        } catch (error) {
            message.error('Failed to update book');
        }
    };

    const handleAddPayment = async (values: any) => {
        try {
            if (!editingMember && !editingSpecial) return;
            setSubmitting(true);

            const paymentData = {
                id: paymentEditingId || undefined,
                waqfJadeedId: editingMember ? records.find(r => r.memberId === editingMember.id)?.id : editingSpecial?.id,
                specialId: editingSpecial ? editingSpecial.id : undefined,
                memberId: editingMember ? editingMember.id : undefined,
                year: selectedYear,
                amount: values.amount,
                date: paymentEditingId
                    ? (editingMember
                        ? (records.find(r => r.memberId === editingMember?.id)?.payments?.find(p => p.id === paymentEditingId)?.date || new Date().toISOString())
                        : (editingSpecial?.payments?.find(p => p.id === paymentEditingId)?.date || new Date().toISOString())
                    )
                    : new Date().toISOString(),
                notes: values.notes,
                bookId: values.bookId,
                bookNo: books.find(b => b.id === values.bookId)?.bookNo,
                receiptNo: values.receiptNo
            };

            console.log('Submitting Payment Data:', paymentData);
            console.log('Editing Mode:', paymentEditingId ? 'UPDATE' : 'CREATE');

            if (paymentEditingId) {
                if (editingMember) {
                    console.log('Updating Member Payment');
                    const updatedRecord = await ApiService.updateWaqfJadeedPayment(paymentData as any);
                    if (updatedRecord) updateLocalRecord(updatedRecord);
                    message.success('Payment updated');
                } else if (editingSpecial) {
                    console.log('Updating Special Payment');
                    const updatedRecord = await ApiService.updateWaqfJadeedSpecialPayment(paymentData as any);
                    if (updatedRecord) {
                        updateLocalSpecialRecord(updatedRecord as WaqfJadeedSpecialRecord);
                        setEditingSpecial(updatedRecord as WaqfJadeedSpecialRecord);
                    }
                    message.success('Payment updated');
                }
                setPaymentEditingId(null);
            } else {
                if (editingMember) {
                    console.log('Adding Member Payment');
                    const updatedRecord = await ApiService.addWaqfJadeedPayment(paymentData as any);
                    if (updatedRecord) updateLocalRecord(updatedRecord);
                    message.success('Payment added');
                } else if (editingSpecial) {
                    console.log('Adding Special Payment');
                    const updatedRecord = await ApiService.addWaqfJadeedSpecialPayment(paymentData as any);
                    if (updatedRecord) {
                        updateLocalSpecialRecord(updatedRecord as WaqfJadeedSpecialRecord);
                        setEditingSpecial(updatedRecord as WaqfJadeedSpecialRecord);
                    }
                    message.success('Payment added');
                }
            }
            paymentForm.resetFields();
        } catch (error) {
            console.error('Payment Operation Failed:', error);
            message.error(paymentEditingId ? 'Failed to update payment' : 'Failed to add payment');
        } finally {
            setSubmitting(false);
        }
    };

    const handlePersonalDetailsSave = async (values: any) => {
        if (!editingMember) return;
        try {
            setSubmitting(true);
            const formData = values;

            const age = calculateAge(formData.dateOfBirth.format('YYYY-MM-DD'));
            const tanzeem = determineTanzeem(age, formData.gender);

            const memberDataRaw: any = {
                ...editingMember,
                name: formData.name,
                fatherName: formData.fatherName || '',
                husbandName: formData.husbandName || '',
                gender: formData.gender,
                cnic: formData.cnic ? formatCNIC(formData.cnic) : '',
                dateOfBirth: formData.dateOfBirth.format('YYYY-MM-DD'),
                age,
                phone: formData.phone || '',
                address: formData.address,
                tanzeem,
                profilePhoto: formData.profilePhoto || generateAvatarFromName(formData.name),
                isDeceased: formData.isDeceased || false,
                isMoved: formData.isMoved || false,
                movedTo: formData.movedTo || '',
                isBaitByBirth: formData.isBaitByBirth,
                baitYear: formData.isBaitByBirth ? undefined : formData.baitYear,
                wasitNo: formData.wasitNo || '',
                education: formData.education || '',
                bloodGroup: formData.bloodGroup || '',
                waqfeNauNumber: formData.waqfeNauNumber || '',
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
            await ApiService.updateMember(editingMember.id, memberData);

            const updatedMember = { ...editingMember, ...memberData };
            updateLocalMember(updatedMember);
            setEditingMember(updatedMember);
            message.success('Personal details updated successfully');
        } catch (error) {
            message.error('Failed to update personal details');
            console.error(error);
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
        // First filter members: exclude if member is moved OR their family is moved
        const movedFamilyIds = new Set(families.filter(f => f.isMoved).map(f => f.id));

        let data = members
            .filter(m => !m.isMoved && !movedFamilyIds.has(m.familyId || ''))
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
    }, [members, records, families, searchTerm]);



    const filteredFamilyData = useMemo(() => {
        // Only include active families (not moved)
        let data = families.filter(f => !f.isMoved);

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            data = data.filter(f =>
                f.familyName.toLowerCase().includes(lower) ||
                (f.halqa || '').toLowerCase().includes(lower)
            );
        }

        // Calculate promises for sorting if needed
        const dataWithPromise = data.map(family => {
            const familyMembers = members.filter(m => m.familyId === family.id && !m.isDeceased && !m.isMoved);
            const famSpecialRecords = specialRecords.filter(r => r.familyId === family.id);

            const membersPromise = familyMembers.reduce((sum, m) => {
                const record = records.find(r => r.memberId === m.id);
                return sum + ((record?.promiseAmount || 0) + (record?.nagarparAmount || 0));
            }, 0);

            const specialPromise = famSpecialRecords.reduce((sum, r) => sum + ((r.promiseAmount || 0) + (r.nagarparAmount || 0)), 0);

            return {
                ...family,
                totalPromise: membersPromise + specialPromise
            };
        });

        return dataWithPromise.sort((a, b) => {
            if (familySort === 'zero_promise_first') {
                // If one has 0 promise and other doesn't, put 0 promise first
                if (a.totalPromise === 0 && b.totalPromise > 0) return -1;
                if (a.totalPromise > 0 && b.totalPromise === 0) return 1;
            }

            // Default numeric sort by familyNumber
            const numA = a.familyNumber || 999999;
            const numB = b.familyNumber || 999999;
            return numA - numB;
        });
    }, [families, searchTerm, familySort, members, records, specialRecords]);

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
        const totalNagarParkar = records.reduce((sum, r) => sum + (r.nagarparAmount || 0), 0) +
            specialRecords.reduce((sum, r) => sum + (r.nagarparAmount || 0), 0);
        const percent = totalPromise > 0 ? (totalPaid / totalPromise) * 100 : 0;
        return { totalPromise, totalPaid, totalNagarParkar, percent };
    }, [records, specialRecords]);

    const allPayments = useMemo(() => {
        const payments: Payment[] = [];
        records.forEach(r => {
            if (r.payments) payments.push(...r.payments);
        });
        specialRecords.forEach(sr => {
            if (sr.payments) payments.push(...sr.payments);
        });
        return payments;
    }, [records, specialRecords]);

    // Tanzeem Stats Aggregation
    const tanzeemStats = useMemo(() => {
        const statsMap: Record<string, { promise: number; promiseBase: number; nagarpar: number; paid: number; count: number }> = {};

        members.forEach(member => {
            const tanzeem = member.tanzeem || 'Unknown';
            if (!statsMap[tanzeem]) {
                statsMap[tanzeem] = { promise: 0, promiseBase: 0, nagarpar: 0, paid: 0, count: 0 };
            }
            const record = records.find(r => r.memberId === member.id);
            if (record) {
                const base = record.promiseAmount || 0;
                const nagar = record.nagarparAmount || 0;
                statsMap[tanzeem].promiseBase += base;
                statsMap[tanzeem].nagarpar += nagar;
                statsMap[tanzeem].promise += base + nagar;
                statsMap[tanzeem].paid += record.paidAmount || 0;
            }
            statsMap[tanzeem].count += 1;

            // Also aggregate into Daftar Atfal if applicable
            if (['atfal', 'saf-e-awal', 'saf-e-awal-girls', 'nasirat'].includes(tanzeem)) {
                if (!statsMap['dafar-atfal']) {
                    statsMap['dafar-atfal'] = { promise: 0, promiseBase: 0, nagarpar: 0, paid: 0, count: 0 };
                }
                const record = records.find(r => r.memberId === member.id);
                if (record) {
                    const base = record.promiseAmount || 0;
                    const nagar = record.nagarparAmount || 0;
                    statsMap['dafar-atfal'].promiseBase += base;
                    statsMap['dafar-atfal'].nagarpar += nagar;
                    statsMap['dafar-atfal'].promise += base + nagar;
                    statsMap['dafar-atfal'].paid += record.paidAmount || 0;
                }
                statsMap['dafar-atfal'].count += 1;
            }
        });

        return Object.entries(statsMap)
            .filter(([name]) => name !== 'dafar-atfal') // Exclude grouping from the list itself
            .map(([name, data]) => ({
                name,
                ...data,
                percent: data.promise > 0 ? (data.paid / data.promise) * 100 : 0
            })).sort((a, b) => b.promise - a.promise); // Sort by highest promise
    }, [members, records]);

    // Export grouping specifically for targetSection
    const dafarAtfalStats = useMemo(() => {
        const stats = { promise: 0, promiseBase: 0, nagarpar: 0, paid: 0, count: 0 };
        members.forEach(member => {
            if (['atfal', 'saf-e-awal', 'saf-e-awal-girls', 'nasirat'].includes(member.tanzeem || '')) {
                const record = records.find(r => r.memberId === member.id);
                if (record) {
                    stats.promiseBase += record.promiseAmount || 0;
                    stats.nagarpar += record.nagarparAmount || 0;
                    stats.promise += (record.promiseAmount || 0) + (record.nagarparAmount || 0);
                    stats.paid += record.paidAmount || 0;
                }
                stats.count += 1;
            }
        });
        return stats;
    }, [members, records]);

    // Deceased Stats
    const deceasedStats = useMemo(() => {
        const deceasedMaleRecords = specialRecords.filter(r => r.isDeceased && r.gender === 'male');
        const deceasedFemaleRecords = specialRecords.filter(r => r.isDeceased && r.gender === 'female');

        const malePromiseBase = deceasedMaleRecords.reduce((sum, r) => sum + (r.promiseAmount || 0), 0);
        const maleNagarpar = deceasedMaleRecords.reduce((sum, r) => sum + (r.nagarparAmount || 0), 0);
        const malePromiseAmount = malePromiseBase + maleNagarpar;
        const malePaidAmount = deceasedMaleRecords.reduce((sum, r) => sum + (r.paidAmount || 0), 0);

        const femalePromiseBase = deceasedFemaleRecords.reduce((sum, r) => sum + (r.promiseAmount || 0), 0);
        const femaleNagarpar = deceasedFemaleRecords.reduce((sum, r) => sum + (r.nagarparAmount || 0), 0);
        const femalePromiseAmount = femalePromiseBase + femaleNagarpar;
        const femalePaidAmount = deceasedFemaleRecords.reduce((sum, r) => sum + (r.paidAmount || 0), 0);

        const totalDeceasedPromiseBase = malePromiseBase + femalePromiseBase;
        const totalDeceasedNagarpar = maleNagarpar + femaleNagarpar;
        const totalDeceasedPromise = malePromiseAmount + femalePromiseAmount;
        const totalDeceasedPaid = malePaidAmount + femalePaidAmount;

        return {
            deceasedMales: deceasedMaleRecords.length,
            deceasedFemales: deceasedFemaleRecords.length,
            malePromiseBase,
            maleNagarpar,
            malePromiseAmount,
            malePaidAmount,
            femalePromiseBase,
            femaleNagarpar,
            femalePromiseAmount,
            femalePaidAmount,
            totalDeceasedPromiseBase,
            totalDeceasedNagarpar,
            totalDeceasedPromise,
            totalDeceasedPaid
        };
    }, [specialRecords]);

    // اضافی (Additional) Stats
    const azafiStats = useMemo(() => {
        const azafiRecords = specialRecords.filter(r => r.name === 'اضافی');

        const azafiPromiseBase = azafiRecords.reduce((sum, r) => sum + (r.promiseAmount || 0), 0);
        const azafiNagarpar = azafiRecords.reduce((sum, r) => sum + (r.nagarparAmount || 0), 0);
        const azafiPromiseAmount = azafiPromiseBase + azafiNagarpar;
        const azafiPaidAmount = azafiRecords.reduce((sum, r) => sum + (r.paidAmount || 0), 0);

        return {
            count: azafiRecords.length,
            promiseBase: azafiPromiseBase,
            promiseAmount: azafiPromiseAmount,
            paidAmount: azafiPaidAmount,
            percent: azafiPromiseAmount > 0 ? (azafiPaidAmount / azafiPromiseAmount) * 100 : 0
        };
    }, [specialRecords]);

    // Daftar Baligan Stats (Ansar, Khuddam, Lajna, special member, decesed, additional)
    const baliganStats = useMemo(() => {
        const ansar = tanzeemStats.find(t => t.name === 'ansar') || { promiseBase: 0, paid: 0, count: 0 };
        const khuddam = tanzeemStats.find(t => t.name === 'khuddam') || { promiseBase: 0, paid: 0, count: 0 };
        const lajna = tanzeemStats.find(t => t.name === 'lajna') || { promiseBase: 0, paid: 0, count: 0 };

        const specialMembers = specialRecords.filter(r => !r.isDeceased && r.name !== 'اضافی');
        const specialPaid = specialMembers.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
        const specialPromiseBase = specialMembers.reduce((sum, r) => sum + (r.promiseAmount || 0), 0);

        const totalPromised = ansar.promiseBase + khuddam.promiseBase + lajna.promiseBase +
            deceasedStats.totalDeceasedPromiseBase + azafiStats.promiseBase + specialPromiseBase;

        const totalPaid = ansar.paid + khuddam.paid + lajna.paid +
            deceasedStats.totalDeceasedPaid + azafiStats.paidAmount + specialPaid;

        return {
            ansar,
            khuddam,
            lajna,
            deceased: deceasedStats,
            additional: azafiStats,
            special: {
                paid: specialPaid,
                promiseBase: specialPromiseBase,
                count: specialMembers.length
            },
            totalPromised,
            totalPaid
        };
    }, [tanzeemStats, deceasedStats, azafiStats, specialRecords]);

    const targetSectionStats = useMemo(() => {
        // Calculate Total Received for target tracking (Baligan Paid)
        const totalReceived = baliganStats.totalPaid;

        // Calculate Total Promised for target tracking (Baligan Promised)
        const totalPromised = baliganStats.totalPromised;

        return {
            totalReceived,
            totalPromised,
            remainingFromTarget: targetAmount > 0 ? Math.max(0, targetAmount - totalPromised) : 0,
            receivedPercent: targetAmount > 0 ? (totalReceived / targetAmount) * 100 : 0
        };
    }, [baliganStats, targetAmount]);

    const dashboardMetrics = useMemo(() => {
        const currentTotalPaid = stats.totalPaid;
        const currentTotalPromise = stats.totalPromise;
        const prevTotalPaid = prevRecords.reduce((sum, r) => sum + (r.paidAmount || 0), 0) +
            prevSpecialRecords.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
        const prevTotalPromise = prevRecords.reduce((sum, r) => sum + (r.promiseAmount || 0) + (r.nagarparAmount || 0), 0) +
            prevSpecialRecords.reduce((sum, r) => sum + (r.promiseAmount || 0) + (r.nagarparAmount || 0), 0);

        const activeMemberIds = new Set(members.map(m => m.id));
        const membersWithPromise = records.filter(r => activeMemberIds.has(r.memberId) && ((r.promiseAmount || 0) + (r.nagarparAmount || 0) > 0)).length;
        const totalActiveMembers = members.length;
        const participationRate = totalActiveMembers > 0 ? (membersWithPromise / totalActiveMembers) * 100 : 0;

        const allActiveRecords = [
            ...records.map(r => ({ paid: r.paidAmount || 0, promise: (r.promiseAmount || 0) + (r.nagarparAmount || 0) })),
            ...specialRecords.map(r => ({ paid: r.paidAmount || 0, promise: (r.promiseAmount || 0) + (r.nagarparAmount || 0) }))
        ].filter(r => r.promise > 0);

        const fullyPaidCount = allActiveRecords.filter(r => r.paid >= r.promise).length;
        const partiallyPaidCount = allActiveRecords.filter(r => r.paid > 0 && r.paid < r.promise).length;
        const noPaymentCount = allActiveRecords.filter(r => r.paid === 0).length;

        const avgPromise = allActiveRecords.length > 0 ? currentTotalPromise / allActiveRecords.length : 0;
        const avgPaid = allActiveRecords.length > 0 ? currentTotalPaid / allActiveRecords.length : 0;

        const yoyGrowth = prevTotalPaid > 0 ? ((currentTotalPaid - prevTotalPaid) / prevTotalPaid) * 100 : 0;

        return {
            prevTotalPaid,
            prevTotalPromise,
            participationRate,
            fullyPaidCount,
            partiallyPaidCount,
            noPaymentCount,
            avgPromise,
            avgPaid,
            totalCards: allActiveRecords.length,
            yoyGrowth
        };
    }, [stats, records, specialRecords, prevRecords, prevSpecialRecords, members]);

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
                const tanzeemDisplay = item.member.tanzeem ? getTanzeemUrduName(item.member.tanzeem as any) || item.member.tanzeem : '';
                htmlContent += `
                    <tr style="background-color: ${rowColor};">
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${index + 1}</td>
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: right; direction: rtl; unicode-bidi: embed;">${item.member.name}</td>
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: right; direction: rtl; unicode-bidi: embed;">${tanzeemDisplay}</td>
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

    const handleExportMemberCard = async (memberData: any, isSpecial: boolean = false) => {
        try {
            message.loading({ content: 'Generating shareable card...', key: 'card-export' });

            const cardDiv = document.createElement('div');
            cardDiv.style.width = '360px';
            cardDiv.style.height = '640px';
            cardDiv.style.position = 'fixed';
            cardDiv.style.left = '-9999px';
            cardDiv.style.background = 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';
            cardDiv.style.color = 'white';
            cardDiv.style.fontFamily = '"Noto Sans Arabic", Arial, sans-serif';
            cardDiv.style.padding = '30px';
            cardDiv.style.boxSizing = 'border-box';
            cardDiv.style.display = 'flex';
            cardDiv.style.flexDirection = 'column';
            cardDiv.style.justifyContent = 'space-between';
            cardDiv.style.borderRadius = '12px';

            const name = isSpecial ? memberData.name : memberData.member.name;
            const promised = isSpecial ? (memberData.promiseAmount || 0) + (memberData.nagarparAmount || 0) : memberData.promise;
            const paid = isSpecial ? memberData.paidAmount : memberData.paid;
            const balance = promised - paid;
            const percent = promised > 0 ? Math.min(100, Math.round((paid / promised) * 100)) : 0;

            cardDiv.innerHTML = `
                <div style="text-align: center;">
                    <h2 style="margin: 0; font-size: 24px; color: #fbbf24;">Waqf-e-Jadeed ${selectedYear}</h2>
                    <p style="margin: 5px 0 20px 0; opacity: 0.8; font-size: 14px;">Personal Collection Card</p>
                    <div style="width: 80px; height: 80px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center; font-size: 32px;">👤</div>
                    <h1 style="margin: 0; font-size: 28px; direction: rtl;">${getUrduName(name)}</h1>
                    <p style="margin: 5px 0 0 0; font-size: 16px; opacity: 0.9;">${name}</p>
                </div>

                <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 12px; backdrop-filter: blur(5px);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                        <span style="opacity: 0.8;">Promised (وعدہ)</span>
                        <span style="font-weight: bold;">Rs. ${promised.toLocaleString()}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                        <span style="opacity: 0.8;">Paid (ادا شدہ)</span>
                        <span style="font-weight: bold; color: #34d399;">Rs. ${paid.toLocaleString()}</span>
                    </div>
                    <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.2); margin: 15px 0;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="font-weight: bold;">Balance (بقیہ)</span>
                        <span style="font-weight: bold; color: #f87171;">Rs. ${balance.toLocaleString()}</span>
                    </div>
                </div>

                <div style="text-align: center;">
                    <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.2); border-radius: 4px; margin-bottom: 8px; overflow: hidden;">
                        <div style="width: ${percent}%; height: 100%; background: #34d399;"></div>
                    </div>
                    <p style="margin: 0; font-size: 14px; font-weight: bold;">${percent}% Completed</p>
                    <p style="margin: 20px 0 0 0; font-size: 10px; opacity: 0.6;">Generated on ${new Date().toLocaleDateString()} • Jamat Tajneed System</p>
                </div>
            `;

            document.body.appendChild(cardDiv);
            const canvas = await html2canvas(cardDiv, {
                scale: 2,
                backgroundColor: null,
                useCORS: true
            });
            document.body.removeChild(cardDiv);

            const link = document.createElement('a');
            link.download = `${name.replace(/\s+/g, '_')}_WJ_${selectedYear}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

            message.success({ content: 'Card generated successfully!', key: 'card-export' });
        } catch (error) {
            console.error('Error generating card:', error);
            message.error({ content: 'Failed to generate card', key: 'card-export' });
        }
    };
    const handleExportFamilyCard = async (family: Family, totalPromised: number, totalPaid: number) => {
        try {
            message.loading({ content: 'Generating card...', key: 'family-card', duration: 0 });

            const balance = totalPromised - totalPaid;
            const percent = totalPromised > 0 ? Math.round((totalPaid / totalPromised) * 100) : 0;
            const head = members.find(m => m.id === family.headId);

            const cardDiv = document.createElement('div');
            cardDiv.style.width = '400px';
            cardDiv.style.padding = '30px';
            cardDiv.style.background = 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)';
            cardDiv.style.color = '#ffffff';
            cardDiv.style.fontFamily = "'Inter', system-ui, -apple-system, sans-serif";
            cardDiv.style.borderRadius = '20px';
            cardDiv.style.position = 'fixed';
            cardDiv.style.left = '-9999px';
            cardDiv.style.top = '0';
            cardDiv.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.5)';

            cardDiv.innerHTML = `
                <div style="text-align: center; margin-bottom: 30px;">
                    <h2 style="margin: 0; color: #34d399; font-size: 24px; letter-spacing: 1px;">WAQF-E-JADEED</h2>
                    <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.7;">Family Collection Summary ${selectedYear}</p>
                </div>

                <div style="margin-bottom: 30px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 20px;">
                    <p style="margin: 0; font-size: 14px; opacity: 0.7; text-transform: uppercase;">Family Name / سر براہ</p>
                    <h1 style="margin: 10px 0 0 0; font-size: 28px; font-weight: 800;">${family.familyName}</h1>
                    <p style="margin: 5px 0 0 0; font-size: 16px; opacity: 0.9;">Head: ${head?.name || 'N/A'}</p>
                </div>

                <div style="background: rgba(255,255,255,0.1); padding: 25px; border-radius: 12px; backdrop-filter: blur(5px); margin-bottom: 30px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                        <span style="opacity: 0.8;">Total Promised (کل وعدہ)</span>
                        <span style="font-weight: bold;">Rs. ${totalPromised.toLocaleString()}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                        <span style="opacity: 0.8;">Total Paid (کل ادا شدہ)</span>
                        <span style="font-weight: bold; color: #34d399;">Rs. ${totalPaid.toLocaleString()}</span>
                    </div>
                    <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.2); margin: 15px 0;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="font-weight: bold;">Total Balance (بقیہ)</span>
                        <span style="font-weight: bold; color: #f87171;">Rs. ${balance.toLocaleString()}</span>
                    </div>
                </div>

                <div style="text-align: center;">
                    <div style="width: 100%; height: 10px; background: rgba(255,255,255,0.2); border-radius: 5px; margin-bottom: 10px; overflow: hidden;">
                        <div style="width: ${percent}%; height: 100%; background: #34d399;"></div>
                    </div>
                    <p style="margin: 0; font-size: 16px; font-weight: bold;">${percent}% Completed</p>
                    <p style="margin: 30px 0 0 0; font-size: 11px; opacity: 0.5;">Generated on ${new Date().toLocaleDateString()} • Jamat Tajneed System</p>
                </div>
            `;

            document.body.appendChild(cardDiv);
            const canvas = await html2canvas(cardDiv, {
                scale: 2,
                backgroundColor: null,
                useCORS: true
            });
            document.body.removeChild(cardDiv);

            const link = document.createElement('a');
            link.download = `Family_${family.familyName.replace(/\s+/g, '_')}_${selectedYear}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

            message.success({ content: 'Family card generated!', key: 'family-card' });
        } catch (error) {
            console.error('Error generating family card:', error);
            message.error({ content: 'Failed to generate card', key: 'family-card' });
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
                    <Col xs={24} sm={24} md={8} style={{ textAlign: 'right' }}>
                        <Space>
                            {activeTab === 'dashboard' && (
                                <Button
                                    icon={<FilePdfOutlined />}
                                    onClick={handleExportDashboard}
                                    loading={loading}
                                >
                                    Export PDF
                                </Button>
                            )}
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => {
                                    setEditingMember(null);
                                    form.resetFields();
                                    setDrawerVisible(true);
                                }}
                            >
                                Add Member
                            </Button>
                            <Button
                                icon={<BookOutlined />}
                                onClick={() => setManageBooksModalVisible(true)}
                            >
                                Manage Books
                            </Button>
                        </Space>
                    </Col>
                </Row>
                <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ marginTop: 12 }} type="card">
                    <Tabs.TabPane tab="Members" key="members" />
                    <Tabs.TabPane tab="Family Wise" key="families" />
                    <Tabs.TabPane tab="Tanzeem Wise" key="tanzeem" />
                    <Tabs.TabPane tab="Reports" key="reports" />
                    <Tabs.TabPane tab="Dashboard" key="dashboard" />
                    <Tabs.TabPane tab="About" key="about" />
                </Tabs>
            </Card>

            {/* Stats Cards */}
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12} md={8}>
                    <Tooltip title="Total promising amount including all members, special records, and Nagar Parkar">
                        <Card bodyStyle={{ padding: 16 }}>
                            <Statistic
                                title="Total Promise"
                                value={stats.totalPromise}
                                prefix={<DollarOutlined />}
                                precision={0}
                                valueStyle={{ fontSize: 'clamp(20px, 5vw, 32px)' }}
                            />
                        </Card>
                    </Tooltip>
                </Col>
                <Col xs={24} sm={12} md={8}>
                    <Tooltip title="Total collection received so far from all categories">
                        <Card bodyStyle={{ padding: 16 }}>
                            <Statistic
                                title="Total Paid"
                                value={stats.totalPaid}
                                prefix={<CheckCircleOutlined />}
                                suffix={<span style={{ fontSize: '16px', color: '#888', marginLeft: 8 }}>({Math.round(stats.percent)}%)</span>}
                                valueStyle={{ color: '#3f8600', fontSize: 'clamp(20px, 5vw, 32px)' }}
                                precision={0}
                            />
                        </Card>
                    </Tooltip>
                </Col>
                <Col xs={24} sm={24} md={8}>
                    <Tooltip title="Overall collection status against total promise">
                        <Card bodyStyle={{ padding: 16 }}>
                            <Text type="secondary" style={{ fontSize: 'clamp(12px, 3vw, 14px)' }}>Collection Progress</Text>
                            <Progress percent={Math.round(stats.percent)} status="active" />
                        </Card>
                    </Tooltip>
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
                                    <Space size="small">
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
                                        <Button
                                            type="link"
                                            icon={<ShareAltOutlined />}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleExportMemberCard(record);
                                            }}
                                            title="Share Card"
                                        />
                                    </Space>
                                ),
                                sorter: false
                            }
                        ]}
                    />
                </Card>
            ) : activeTab === 'families' ? (
                <div className="family-list">
                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text strong>Active Families ({families.filter(f => !f.isMoved).length})</Text>
                        <Select
                            value={familySort}
                            onChange={setFamilySort}
                            style={{ width: 200 }}
                            options={[
                                { value: 'default', label: 'Default (By Family #)' },
                                { value: 'zero_promise_first', label: 'Zero Promises First' },
                            ]}
                        />
                    </div>
                    {loading ? <p>Loading...</p> : (
                        <Collapse defaultActiveKey={[]} ghost>
                            {filteredFamilyData.map(family => {
                                // Filter out deceased and moved members from family members list
                                const familyMembersCtx = family.memberIds
                                    .map(mid => getMemberData(mid))
                                    .filter((item): item is NonNullable<MemberData> => {
                                        if (!item) return false;
                                        // Exclude if member is marked as deceased or moved
                                        return !item.member.isDeceased && !item.member.isMoved;
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
                                                <Col xs={24} sm={16} md={14}>
                                                    <Text strong style={{ fontSize: 'clamp(14px, 3.5vw, 16px)' }}>{family.familyName}</Text>
                                                    {family.isMoved && family.movedTo && (
                                                        <Tag color="orange" style={{ marginLeft: 8 }}>Moved to {family.movedTo}</Tag>
                                                    )}
                                                    <br />
                                                    <Text type="secondary" style={{ fontSize: 'clamp(11px, 2.5vw, 12px)' }}>
                                                        {family.familyNumber ? <span>#{family.familyNumber} • </span> : ''}
                                                        Head: {getMemberData(family.headId)?.member.name || 'Unknown'} • {familyMembersCtx.length + familySpecialRecords.length} Cards
                                                    </Text>
                                                </Col>
                                                <Col xs={18} sm={6} md={6} style={{ textAlign: 'right' }}>
                                                    <Text type="secondary" style={{ fontSize: 'clamp(11px, 2.5vw, 12px)' }}>Paid / Promise</Text>
                                                    <div style={{ fontWeight: 500, fontSize: 'clamp(12px, 3vw, 14px)' }}>
                                                        {familyTotalPaid.toLocaleString()} / {familyTotalPromise.toLocaleString()}
                                                    </div>
                                                    <Progress percent={familyPercent} steps={5} size="small" strokeColor="#52c41a" />
                                                </Col>
                                                <Col xs={6} sm={2} md={4} style={{ textAlign: 'right' }}>
                                                    <Space>
                                                        <Button
                                                            type="text"
                                                            icon={<DeleteOutlined style={{ color: '#faad14' }} />}
                                                            size="small"
                                                            disabled={true}
                                                            title="Move Family feature is now in Families page"
                                                        />
                                                        <Button
                                                            type="text"
                                                            icon={<ShareAltOutlined />}
                                                            size="small"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleExportFamilyCard(family, familyTotalPromise, familyTotalPaid);
                                                            }}
                                                            title="Share Family Card"
                                                        />
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
                                                            title="Download PDF"
                                                        />
                                                    </Space>
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
                                                        <Button size="small" icon={<ShareAltOutlined />} onClick={() => handleExportMemberCard(record)} title="Share Card" />
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
                                                            <Button size="small" icon={<ShareAltOutlined />} onClick={() => handleExportMemberCard(record, true)} title="Share Card" />
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
                                                        <Button size="small" icon={<ShareAltOutlined />} onClick={() => handleExportMemberCard(record)} title="Share Card" />
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
            ) : activeTab === 'reports' ? (
                <WaqfReports
                    members={members}
                    records={filteredMemberData}
                    specialRecords={specialRecords}
                    allPayments={allPayments}
                    prevRecords={prevRecords}
                    prevSpecialRecords={prevSpecialRecords}
                    selectedYear={selectedYear}
                />
            ) : activeTab === 'dashboard' ? (
                <div className="dashboard-view">
                    {/* Target Tracking Section */}
                    <div style={{ background: '#f0f2f5', padding: '20px', borderRadius: '8px', marginBottom: '24px' }}>
                        <Title level={4} style={{ marginBottom: 20 }}>Target Tracking (Daftar Baligan)</Title>
                        <Row gutter={[16, 16]} align="top">
                            <Col xs={24} sm={12} md={6}>
                                <div style={{ marginBottom: 16 }}>
                                    <Text type="secondary" style={{ fontSize: 'clamp(12px, 2.5vw, 14px)', display: 'block', marginBottom: 8 }}>Target Amount</Text>
                                    <InputNumber
                                        value={targetAmount}
                                        onChange={handleTargetChange}
                                        addonBefore="Rs."
                                        style={{ width: '100%' }}
                                        formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                        parser={(value) => value!.replace(/\$\s?|(,*)/g, '') as any}
                                        min={0}
                                        precision={0}
                                        size="large"
                                    />
                                </div>
                                <div style={{ marginTop: 8 }}>
                                    <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginBottom: 4 }}>
                                        Progress: {targetSectionStats.receivedPercent.toFixed(1)}%
                                    </Text>
                                    <Progress
                                        percent={Math.round(targetSectionStats.receivedPercent)}
                                        size="small"
                                        status={targetSectionStats.receivedPercent >= 100 ? "success" : "active"}
                                        strokeColor={targetSectionStats.receivedPercent >= 100 ? "#52c41a" : "#1890ff"}
                                    />
                                </div>
                            </Col>
                            <Col xs={24} sm={12} md={6}>
                                <Card bodyStyle={{ padding: 16 }} hoverable>
                                    <Tooltip title="Total promise from Daftar Baligan (Ansar, Khuddam, Lajna, Special, Deceased, Additional)">
                                        <Statistic
                                            title={<span style={{ fontSize: '12px' }}>Total Promised (Baligan)</span>}
                                            value={targetSectionStats.totalPromised}
                                            prefix="Rs."
                                            precision={0}
                                            valueStyle={{ fontSize: 'clamp(18px, 4vw, 24px)' }}
                                        />
                                        <div style={{ marginTop: 4 }}>
                                            <Text type="secondary" style={{ fontSize: '11px' }}>
                                                Received: Rs. {targetSectionStats.totalReceived.toLocaleString()}
                                            </Text>
                                        </div>
                                    </Tooltip>
                                </Card>
                            </Col>
                            <Col xs={24} sm={12} md={6}>
                                <Card bodyStyle={{ padding: 16 }} hoverable>
                                    <Tooltip title="Remaining collection needed reach the Target Amount from Baligan promises">
                                        <Statistic
                                            title={<span style={{ fontSize: '12px' }}>Remaining Gap</span>}
                                            value={targetSectionStats.remainingFromTarget}
                                            prefix="Rs."
                                            precision={0}
                                            valueStyle={{
                                                fontSize: 'clamp(18px, 4vw, 24px)',
                                                color: targetSectionStats.remainingFromTarget <= 0 ? '#3f8600' : '#cf1322'
                                            }}
                                        />
                                        <Text type="secondary" style={{ fontSize: '11px' }}>
                                            (Target - Baligan Promise)
                                        </Text>
                                    </Tooltip>
                                </Card>
                            </Col>
                        </Row>
                    </div>

                    {/* Daftar Baligan Section */}
                    <div style={{ marginBottom: '24px' }}>
                        <Divider orientation="left">Daftar Baligan Breakdown</Divider>
                        <Row gutter={[16, 16]}>
                            {[
                                {
                                    label: 'Ansar',
                                    paid: baliganStats.ansar.paid,
                                    promise: baliganStats.ansar.promiseBase,
                                    count: baliganStats.ansar.count,
                                    color: '#0050b3',
                                    tooltip: 'Majlis Ansarullah collections'
                                },
                                {
                                    label: 'Khuddam',
                                    paid: baliganStats.khuddam.paid,
                                    promise: baliganStats.khuddam.promiseBase,
                                    count: baliganStats.khuddam.count,
                                    color: '#1890ff',
                                    tooltip: 'Majlis Khuddamul Ahmadiyya collections'
                                },
                                {
                                    label: 'Lajna',
                                    paid: baliganStats.lajna.paid,
                                    promise: baliganStats.lajna.promiseBase,
                                    count: baliganStats.lajna.count,
                                    color: '#eb2f96',
                                    tooltip: 'Lajna Imaillah collections'
                                },
                                {
                                    label: 'Special Members',
                                    paid: baliganStats.special.paid,
                                    promise: baliganStats.special.promiseBase,
                                    count: baliganStats.special.count,
                                    color: '#722ed1',
                                    tooltip: 'Special pledges (other than additional/deceased)'
                                },
                                {
                                    label: 'Deceased (M)',
                                    paid: baliganStats.deceased.malePaidAmount,
                                    promise: baliganStats.deceased.malePromiseBase,
                                    count: baliganStats.deceased.deceasedMales,
                                    color: '#595959',
                                    tooltip: 'Collections for deceased male members'
                                },
                                {
                                    label: 'Deceased (F)',
                                    paid: baliganStats.deceased.femalePaidAmount,
                                    promise: baliganStats.deceased.femalePromiseBase,
                                    count: baliganStats.deceased.deceasedFemales,
                                    color: '#8c8c8c',
                                    tooltip: 'Collections for deceased female members'

                                },
                                {
                                    label: 'Additional (اضافی)',
                                    paid: baliganStats.additional.paidAmount,
                                    promise: baliganStats.additional.promiseBase,
                                    count: baliganStats.additional.count,
                                    color: '#faad14',
                                    tooltip: 'Additional pledges (Azafi)'
                                }
                            ].map((card, idx) => (
                                <Col xs={24} sm={12} md={8} lg={4} key={idx}>
                                    <Tooltip title={card.tooltip}>
                                        <Card hoverable bodyStyle={{ padding: 12 }}>
                                            <Statistic
                                                title={
                                                    <span style={{ fontSize: '11px', fontWeight: 600 }}>
                                                        {card.label} ({card.count})
                                                    </span>
                                                }
                                                value={card.paid}
                                                prefix="Rs."
                                                precision={0}
                                                valueStyle={{ fontSize: '16px', color: card.color }}
                                            />
                                            <div style={{ marginTop: 4, fontSize: '12px', fontWeight: 500, color: '#595959' }}>
                                                P: {card.promise.toLocaleString()}
                                            </div>
                                            <Progress
                                                percent={card.promise > 0 ? Math.round((card.paid / card.promise) * 100) : 0}
                                                size="small"
                                                showInfo={false}
                                                strokeColor={card.color}
                                            />
                                        </Card>
                                    </Tooltip>
                                </Col>
                            ))}
                        </Row>
                    </div>

                    {/* Daftar Atfal Section */}
                    <div style={{ marginBottom: '24px' }}>
                        <Divider orientation="left">Daftar Atfal Section</Divider>
                        <Row gutter={[16, 16]}>
                            <Col xs={24} md={8}>
                                <Tooltip title="Combined total for all children's tanzeems">
                                    <Card hoverable bodyStyle={{ padding: 16, background: '#f6ffed' }}>
                                        <Statistic
                                            title={<span style={{ fontWeight: 600, color: '#389e0d' }}>Daftar Atfal (Total)</span>}
                                            value={dafarAtfalStats.paid}
                                            prefix="Rs."
                                            precision={0}
                                            valueStyle={{ fontSize: '24px', color: '#389e0d' }}
                                        />
                                        <div style={{ marginTop: 8 }}>
                                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                                Total Promise: Rs. {dafarAtfalStats.promise.toLocaleString()}
                                            </Text>
                                        </div>
                                        <Progress
                                            percent={dafarAtfalStats.promise > 0 ? Math.round((dafarAtfalStats.paid / dafarAtfalStats.promise) * 100) : 0}
                                            strokeColor="#52c41a"
                                        />
                                    </Card>
                                </Tooltip>
                            </Col>
                            <Col xs={24} md={16}>
                                <Row gutter={[8, 8]}>
                                    {[
                                        { name: 'atfal', label: 'Atfal' },
                                        { name: 'nasirat', label: 'Nasirat' },
                                        { name: 'saf-e-awal', label: 'Saf-e-Awal' },
                                        { name: 'saf-e-awal-girls', label: 'Saf-e-Awal (G)' }
                                    ].map(t => {
                                        const s = members.reduce((acc, m) => {
                                            if (m.tanzeem === t.name) {
                                                const r = records.find(rec => rec.memberId === m.id);
                                                if (r) {
                                                    acc.paid += r.paidAmount || 0;
                                                    acc.promise += (r.promiseAmount || 0) + (r.nagarparAmount || 0);
                                                }
                                                acc.count++;
                                            }
                                            return acc;
                                        }, { paid: 0, promise: 0, count: 0 });

                                        return (
                                            <Col span={6} key={t.name}>
                                                <Card bodyStyle={{ padding: 12 }}>
                                                    <Statistic
                                                        title={<span style={{ fontSize: '10px' }}>{t.label} ({s.count})</span>}
                                                        value={s.paid}
                                                        precision={0}
                                                        valueStyle={{ fontSize: '14px' }}
                                                    />
                                                    <div style={{ fontSize: '12px', fontWeight: 500, color: '#595959' }}>
                                                        P: {s.promise.toLocaleString()}
                                                    </div>
                                                </Card>
                                            </Col>
                                        );
                                    })}
                                </Row>
                            </Col>
                        </Row>
                    </div>

                    {/* Nagar Parkar Section */}
                    <div style={{ marginBottom: '24px' }}>
                        <Divider orientation="left">Nagar Parkar Section</Divider>
                        <Row gutter={[16, 16]}>
                            <Col xs={24} sm={12} md={8}>
                                <Tooltip title="Total promises and collections for Nagar Parkar fund">
                                    <Card hoverable bodyStyle={{ padding: 16, borderLeft: '4px solid #fa8c16' }}>
                                        <Statistic
                                            title={<span style={{ fontWeight: 600 }}>Total Nagar Parkar</span>}
                                            value={stats.totalNagarParkar}
                                            prefix="Rs."
                                            precision={0}
                                            valueStyle={{ fontSize: '24px', color: '#d46b08' }}
                                        />
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                            Pledges & Payments
                                        </Text>
                                    </Card>
                                </Tooltip>
                            </Col>
                        </Row>
                    </div>

                    <Divider orientation="left" style={{ margin: '32px 0 16px' }}>Additional Performance Metrics</Divider>
                    <Row gutter={[16, 16]}>
                        <Col xs={24} sm={12} md={6}>
                            <Tooltip title="Year-on-year growth in collections compared to the previous year's actual receipts">
                                <Card hoverable bodyStyle={{ padding: 16 }}>
                                    <Statistic
                                        title={<span style={{ fontWeight: 600 }}>YoY Growth</span>}
                                        value={dashboardMetrics.yoyGrowth}
                                        suffix="%"
                                        precision={1}
                                        valueStyle={{
                                            fontSize: 'clamp(18px, 4vw, 24px)',
                                            color: dashboardMetrics.yoyGrowth >= 0 ? '#3f8600' : '#cf1322'
                                        }}
                                    />
                                    <Text type="secondary" style={{ fontSize: '11px' }}>
                                        vs Prev Year (Rs. {dashboardMetrics.prevTotalPaid.toLocaleString()})
                                    </Text>
                                </Card>
                            </Tooltip>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Tooltip title="Percentage of active members who have registered a promise for the current year">
                                <Card hoverable bodyStyle={{ padding: 16 }}>
                                    <Statistic
                                        title={<span style={{ fontWeight: 600 }}>Participation Rate</span>}
                                        value={dashboardMetrics.participationRate}
                                        suffix="%"
                                        precision={1}
                                        valueStyle={{ fontSize: 'clamp(18px, 4vw, 24px)', color: '#1890ff' }}
                                    />
                                    <Progress
                                        percent={dashboardMetrics.participationRate}
                                        size="small"
                                        showInfo={false}
                                        strokeColor="#1890ff"
                                    />
                                    <div style={{ marginTop: 8 }}>
                                        <Text type="secondary" style={{ fontSize: '11px' }}>
                                            {records.filter(r => (r.promiseAmount || 0) + (r.nagarparAmount || 0) > 0).length} of {members.length} members
                                        </Text>
                                    </div>
                                </Card>
                            </Tooltip>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Tooltip title="Breakdown of member cards by their payment completion status">
                                <Card hoverable bodyStyle={{ padding: 16 }}>
                                    <Text type="secondary" style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 8 }}>Member Status</Text>
                                    <Space direction="vertical" style={{ width: '100%' }} size={4}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: '12px' }}>Fully Paid:</Text>
                                            <Tag color="success">{dashboardMetrics.fullyPaidCount}</Tag>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: '12px' }}>Partial:</Text>
                                            <Tag color="warning">{dashboardMetrics.partiallyPaidCount}</Tag>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Text style={{ fontSize: '12px' }}>No Payment:</Text>
                                            <Tag color="error">{dashboardMetrics.noPaymentCount}</Tag>
                                        </div>
                                    </Space>
                                </Card>
                            </Tooltip>
                        </Col>
                        <Col xs={24} sm={12} md={6}>
                            <Tooltip title="Average promise and payment calculated across all active cards">
                                <Card hoverable bodyStyle={{ padding: 16 }}>
                                    <Statistic
                                        title={<span style={{ fontWeight: 600 }}>Avg. Contribution</span>}
                                        value={dashboardMetrics.avgPaid}
                                        prefix="Rs."
                                        precision={0}
                                        valueStyle={{ fontSize: 'clamp(18px, 4vw, 24px)', color: '#722ed1' }}
                                    />
                                    <Text type="secondary" style={{ fontSize: '11px' }}>
                                        Avg. Promise: Rs. {dashboardMetrics.avgPromise.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </Text>
                                    <div style={{ marginTop: 4 }}>
                                        <Text type="secondary" style={{ fontSize: '10px', opacity: 0.6 }}>
                                            Per Active Card ({dashboardMetrics.totalCards})
                                        </Text>
                                    </div>
                                </Card>
                            </Tooltip>
                        </Col>
                    </Row>
                </div>
            ) : activeTab === 'about' ? (
                <div className="about-view">
                    <Card>
                        <Title level={2} style={{ marginBottom: 24 }}>About Waqf-e-Jadeed System</Title>

                        <div style={{ marginBottom: 32 }}>
                            <Title level={3} style={{ marginBottom: 16 }}>تنظیم کی تقسیم (Tanzeem Division)</Title>
                            <Card style={{ marginBottom: 16 }}>
                                <Title level={4} style={{ marginBottom: 12 }}>How Tanzeems are Divided:</Title>
                                <div style={{ lineHeight: 1.8, fontSize: '14px' }}>
                                    <p><strong>Members are automatically assigned to tanzeems based on their age and gender:</strong></p>
                                    <ul style={{ paddingLeft: 20 }}>
                                        <li><strong>Boys:</strong>
                                            <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                                                <li>Under 7 years → <strong>اطفال- صف اول</strong> (Saf-e-Awal)</li>
                                                <li>7 to 15 years → <strong>اطفال</strong> (Atfal)</li>
                                                <li>15 to 40 years → <strong>خدام الحمدیہ</strong> (Khuddam)</li>
                                                <li>40+ years → <strong>انصار اللہ</strong> (Ansar)</li>
                                            </ul>
                                        </li>
                                        <li style={{ marginTop: 12 }}><strong>Girls:</strong>
                                            <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                                                <li>Under 7 years → <strong>اطفال- صف اول (Girls)</strong> (Saf-e-Awal Girls)</li>
                                                <li>7 to 15 years → <strong>ناصرات</strong> (Nasirat)</li>
                                                <li>15+ years → <strong>لجنہ</strong> (Lajna)</li>
                                            </ul>
                                        </li>
                                    </ul>
                                    <p style={{ marginTop: 16, fontStyle: 'italic', color: '#666' }}>
                                        Note: Age is calculated from the member's date of birth. The system automatically updates tanzeem assignments when members reach age thresholds.
                                    </p>
                                </div>
                            </Card>
                        </div>

                        <div style={{ marginBottom: 32 }}>
                            <Title level={3} style={{ marginBottom: 16 }}>کل جمع (Total Calculations)</Title>

                            <Card style={{ marginBottom: 16 }}>
                                <Title level={4} style={{ marginBottom: 12 }}>Total Promise Calculation:</Title>
                                <div style={{ lineHeight: 1.8, fontSize: '14px' }}>
                                    <p>The <strong>Total Promise</strong> includes:</p>
                                    <ul style={{ paddingLeft: 20 }}>
                                        <li>Promise Amount (وعدہ شدہ رقم) from all members</li>
                                        <li>Nagar Parkar Amount (نگرپارکر) from all members</li>
                                        <li>Special records (خصوصی ریکارڈ) including deceased members</li>
                                    </ul>
                                    <p style={{ marginTop: 12, fontFamily: 'monospace', backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
                                        Total Promise = Σ(Promise Amount + Nagar Parkar Amount) for all members + Special records
                                    </p>
                                </div>
                            </Card>

                            <Card style={{ marginBottom: 16 }}>
                                <Title level={4} style={{ marginBottom: 12 }}>Total Paid Calculation:</Title>
                                <div style={{ lineHeight: 1.8, fontSize: '14px' }}>
                                    <p>The <strong>Total Paid</strong> includes:</p>
                                    <ul style={{ paddingLeft: 20 }}>
                                        <li>All payment amounts (ادا شدہ رقم) recorded for members</li>
                                        <li>Payments from special records</li>
                                        <li>Multiple payments per member are summed together</li>
                                    </ul>
                                    <p style={{ marginTop: 12, fontFamily: 'monospace', backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
                                        Total Paid = Σ(All Payment Amounts) for all members + Special records
                                    </p>
                                </div>
                            </Card>

                            <Card style={{ marginBottom: 16 }}>
                                <Title level={4} style={{ marginBottom: 12 }}>Collection Progress:</Title>
                                <div style={{ lineHeight: 1.8, fontSize: '14px' }}>
                                    <p>The progress percentage is calculated as:</p>
                                    <p style={{ marginTop: 12, fontFamily: 'monospace', backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
                                        Progress % = (Total Paid / Total Promise) × 100
                                    </p>
                                    <p style={{ marginTop: 12 }}>This shows what percentage of the total promise has been collected.</p>
                                </div>
                            </Card>
                        </div>

                        <div style={{ marginBottom: 32 }}>
                            <Title level={3} style={{ marginBottom: 16 }}>Target Section Calculations</Title>

                            <Card style={{ marginBottom: 16 }}>
                                <Title level={4} style={{ marginBottom: 12 }}>Total Received:</Title>
                                <div style={{ lineHeight: 1.8, fontSize: '14px' }}>
                                    <p>The <strong>Total Received</strong> in the Target section includes paid amounts from:</p>
                                    <ul style={{ paddingLeft: 20 }}>
                                        <li><strong>انصار اللہ</strong> (Ansar) - Men 40+ years</li>
                                        <li><strong>لجنہ</strong> (Lajna) - Women 15+ years</li>
                                        <li><strong>خدام الحمدیہ</strong> (Khuddam) - Men 15-40 years</li>
                                        <li><strong>All Deceased Members</strong> (متوفی اراکین) - Both male and female</li>
                                    </ul>
                                    <p style={{ marginTop: 12, fontFamily: 'monospace', backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
                                        Total Received = Ansar Paid + Lajna Paid + Khuddam Paid + Total Deceased Paid
                                    </p>
                                </div>
                            </Card>

                            <Card style={{ marginBottom: 16 }}>
                                <Title level={4} style={{ marginBottom: 12 }}>دفتر اطفال (Dafar Atfal):</Title>
                                <div style={{ lineHeight: 1.8, fontSize: '14px' }}>
                                    <p>The <strong>دفتر اطفال</strong> total includes paid amounts from:</p>
                                    <ul style={{ paddingLeft: 20 }}>
                                        <li><strong>اطفال</strong> (Atfal) - Boys 7-15 years</li>
                                        <li><strong>اطفال- صف اول</strong> (Saf-e-Awal) - Boys under 7 years</li>
                                        <li><strong>اطفال- صف اول (Girls)</strong> (Saf-e-Awal Girls) - Girls under 7 years</li>
                                        <li><strong>ناصرات</strong> (Nasirat) - Girls 7-15 years</li>
                                    </ul>
                                    <p style={{ marginTop: 12, fontFamily: 'monospace', backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
                                        Dafar Atfal Total = Atfal Paid + Saf-e-Awal Paid + Saf-e-Awal Girls Paid + Nasirat Paid
                                    </p>
                                </div>
                            </Card>

                            <Card style={{ marginBottom: 16 }}>
                                <Title level={4} style={{ marginBottom: 12 }}>Remaining from Target:</Title>
                                <div style={{ lineHeight: 1.8, fontSize: '14px' }}>
                                    <p>This shows how much remains to be collected to reach the target:</p>
                                    <p style={{ marginTop: 12, fontFamily: 'monospace', backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
                                        Remaining = Target Amount - Total Received
                                    </p>
                                    <p style={{ marginTop: 12 }}>
                                        <strong>Note:</strong> The remaining amount is displayed in green if positive (target not yet reached)
                                        or red if negative (target exceeded).
                                    </p>
                                </div>
                            </Card>
                        </div>

                        <div style={{ marginBottom: 32 }}>
                            <Title level={3} style={{ marginBottom: 16 }}>Special Records</Title>

                            <Card style={{ marginBottom: 16 }}>
                                <Title level={4} style={{ marginBottom: 12 }}>Deceased Members (متوفی اراکین):</Title>
                                <div style={{ lineHeight: 1.8, fontSize: '14px' }}>
                                    <p>Deceased members are tracked separately and included in:</p>
                                    <ul style={{ paddingLeft: 20 }}>
                                        <li>Total Promise calculations</li>
                                        <li>Total Paid calculations</li>
                                        <li>Total Received in Target section</li>
                                    </ul>
                                    <p style={{ marginTop: 12 }}>They are displayed separately in the Dashboard with male and female breakdowns.</p>
                                </div>
                            </Card>

                            <Card style={{ marginBottom: 16 }}>
                                <Title level={4} style={{ marginBottom: 12 }}>اضافی (Additional Records):</Title>
                                <div style={{ lineHeight: 1.8, fontSize: '14px' }}>
                                    <p>Special records marked as "اضافی" (Additional) are included in:</p>
                                    <ul style={{ paddingLeft: 20 }}>
                                        <li>Total Promise calculations</li>
                                        <li>Total Paid calculations</li>
                                    </ul>
                                    <p style={{ marginTop: 12 }}>These are displayed separately in the Dashboard.</p>
                                </div>
                            </Card>
                        </div>

                        <div style={{ marginBottom: 32 }}>
                            <Title level={3} style={{ marginBottom: 16 }}>Tanzeem Wise Statistics</Title>

                            <Card style={{ marginBottom: 16 }}>
                                <Title level={4} style={{ marginBottom: 12 }}>How Tanzeem Stats are Calculated:</Title>
                                <div style={{ lineHeight: 1.8, fontSize: '14px' }}>
                                    <p>For each tanzeem, the system calculates:</p>
                                    <ul style={{ paddingLeft: 20 }}>
                                        <li><strong>Promise:</strong> Sum of (Promise Amount + Nagar Parkar Amount) for all members in that tanzeem</li>
                                        <li><strong>Paid:</strong> Sum of all payment amounts for members in that tanzeem</li>
                                        <li><strong>Count:</strong> Total number of members in that tanzeem</li>
                                        <li><strong>Percent:</strong> (Paid / Promise) × 100</li>
                                    </ul>
                                    <p style={{ marginTop: 12 }}>Tanzeem statistics are displayed in both the "Tanzeem Wise" tab and the "Dashboard" tab.</p>
                                </div>
                            </Card>
                        </div>

                        <div style={{ marginBottom: 32 }}>
                            <Title level={3} style={{ marginBottom: 16 }}>Family Wise Calculations</Title>

                            <Card style={{ marginBottom: 16 }}>
                                <Title level={4} style={{ marginBottom: 12 }}>Family Totals:</Title>
                                <div style={{ lineHeight: 1.8, fontSize: '14px' }}>
                                    <p>Each family's totals include:</p>
                                    <ul style={{ paddingLeft: 20 }}>
                                        <li>Promise amounts from all family members (excluding deceased)</li>
                                        <li>Promise amounts from special records linked to the family</li>
                                        <li>Paid amounts from all family members</li>
                                        <li>Paid amounts from special records</li>
                                    </ul>
                                    <p style={{ marginTop: 12, fontFamily: 'monospace', backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
                                        Family Total Promise = Σ(Member Promises) + Σ(Special Record Promises)
                                    </p>
                                    <p style={{ marginTop: 8, fontFamily: 'monospace', backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
                                        Family Total Paid = Σ(Member Payments) + Σ(Special Record Payments)
                                    </p>
                                </div>
                            </Card>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <Card>
                                <Title level={4} style={{ marginBottom: 12 }}>Important Notes:</Title>
                                <div style={{ lineHeight: 1.8, fontSize: '14px' }}>
                                    <ul style={{ paddingLeft: 20 }}>
                                        <li>All amounts are displayed in Pakistani Rupees (Rs.)</li>
                                        <li>Percentages are rounded to the nearest whole number</li>
                                        <li>Target amounts are saved per year and persist across sessions</li>
                                        <li>Deceased members are excluded from family member lists but included in totals</li>
                                        <li>The system automatically updates tanzeem assignments based on current age</li>
                                    </ul>
                                </div>
                            </Card>
                        </div>
                    </Card>
                </div>
            ) : null
            }

            {/* Edit Drawer */}
            <Drawer
                title={`Edit: ${editingMember ? editingMember.name : editingSpecial ? editingSpecial.name : ''}`}
                placement="bottom"
                height="70vh"
                onClose={() => setDrawerVisible(false)}
                open={drawerVisible}
                extra={
                    <Space>
                        <Button type="primary" onClick={handleSave} loading={submitting} size="small">
                            Save Financial
                        </Button>
                        <Button onClick={() => setDrawerVisible(false)} size="small">
                            Close
                        </Button>
                    </Space>
                }
            >
                <Tabs defaultActiveKey="financial">
                    <Tabs.TabPane tab="Financial Records" key="financial">
                        <Form form={form} layout="vertical" requiredMark={true}>
                            <Row gutter={[16, 16]}>
                                <Col xs={24} sm={12} md={12} lg={6}>
                                    <Form.Item label="Promise">
                                        {isEditingPromise ? (
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <Form.Item name="promiseAmount" noStyle>
                                                    <InputNumber
                                                        style={{ width: '100%' }}
                                                        formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                                        parser={value => value!.replace(/\$\s?|(,*)/g, '') as any}
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
                                                    parser={value => value!.replace(/\$\s?|(,*)/g, '') as any}
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

                        <div id="payment-form-container" style={{ marginTop: 24, padding: 16, border: paymentEditingId ? '2px solid #1890ff' : '1px solid #f0f0f0', borderRadius: 8, background: '#fafafa' }}>
                            <Title level={5} style={{ fontSize: 'clamp(14px, 3.5vw, 16px)' }}>{paymentEditingId ? 'Edit Payment' : 'Add New Payment'}</Title>
                            <Form form={paymentForm} layout="vertical" onFinish={handleAddPayment} requiredMark={true}>
                                <Row gutter={[8, 8]}>
                                    <Col xs={24} sm={12} md={6}>
                                        <Form.Item name="bookId" label="Book" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 8 }}>
                                            <Select
                                                placeholder="Select Book"
                                                dropdownRender={menu => (
                                                    <>
                                                        {menu}
                                                        <Button type="text" block icon={<PlusOutlined />} onClick={() => setAddBookModalVisible(true)}>
                                                            Add New Book
                                                        </Button>
                                                    </>
                                                )}
                                            >
                                                {books.map(book => (
                                                    <Option key={book.id} value={book.id}>{book.bookNo} ({book.status})</Option>
                                                ))}
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                    <Col xs={12} sm={6} md={4}>
                                        <Form.Item name="receiptNo" label="Receipt #" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 8 }}>
                                            <InputNumber placeholder="No." style={{ width: '100%' }} />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={12} sm={6} md={6}>
                                        <Form.Item name="amount" label="Amount" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 8 }}>
                                            <InputNumber placeholder="Amount" style={{ width: '100%' }}
                                                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                                parser={value => value!.replace(/\$\s?|(,*)/g, '') as any}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} sm={24} md={8}>
                                        <Form.Item name="notes" label="Notes" style={{ marginBottom: 8 }}>
                                            <Input placeholder="Optional notes" />
                                        </Form.Item>
                                    </Col>
                                    <Col xs={24} sm={24} md={24} style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                        <Button onClick={() => {
                                            setEditingMember(null);
                                            setEditingSpecial(null);
                                            setPaymentEditingId(null);
                                        }}>
                                            Close
                                        </Button>
                                        {paymentEditingId && (
                                            <Button onClick={() => {
                                                setPaymentEditingId(null);
                                                paymentForm.resetFields();
                                            }}>
                                                Cancel Edit
                                            </Button>
                                        )}
                                        <Button type="primary" htmlType="submit" icon={paymentEditingId ? <SaveOutlined /> : <PlusOutlined />} loading={submitting}>
                                            {paymentEditingId ? 'Update Payment' : 'Add Payment'}
                                        </Button>
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
                                                <Space direction="vertical" size={0}>
                                                    <Text type="secondary">{dayjs(item.date).format('DD MMM YYYY')}</Text>
                                                    <Space split={<Text type="secondary">|</Text>}>
                                                        {item.bookNo && <Text strong>Book: {item.bookNo}</Text>}
                                                        {item.receiptNo && <Text strong>Rcpt: {item.receiptNo}</Text>}
                                                    </Space>
                                                    {item.notes && <Text type="secondary">{item.notes}</Text>}
                                                </Space>
                                            }
                                        />
                                        <Space>
                                            <Button
                                                type="text"
                                                icon={<EditOutlined />}
                                                onClick={() => {
                                                    setPaymentEditingId(item.id);
                                                    paymentForm.setFieldsValue({
                                                        amount: item.amount,
                                                        bookId: item.bookId,
                                                        receiptNo: item.receiptNo,
                                                        notes: item.notes
                                                    });
                                                    // Scroll form into view
                                                    const formElement = document.getElementById('payment-form-container');
                                                    if (formElement) {
                                                        formElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                    }
                                                }}
                                            />
                                            <Button
                                                type="text"
                                                icon={<PrinterOutlined />}
                                                onClick={() => {
                                                    setPrintingPayment({
                                                        payment: item,
                                                        recordName: editingMember ? editingMember.name : (editingSpecial?.name || 'Unknown'),
                                                        memberCode: undefined
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
                    </Tabs.TabPane>
                    <Tabs.TabPane tab="Personal Details" key="personal">
                        {editingMember ? (
                            <div style={{ padding: '0 16px 24px' }}>
                                <MemberForm
                                    initialValues={editingMember}
                                    onFinish={handlePersonalDetailsSave}
                                    isSaving={submitting}
                                    familyHalqa={families.find(f => f.memberIds.includes(editingMember.id))?.halqa}
                                    submitText="Update Personal Details"
                                />
                            </div>
                        ) : (
                            <div style={{ padding: 40, textAlign: 'center' }}>
                                <Text type="secondary">Personal details can only be edited for regular members.</Text>
                            </div>
                        )}
                    </Tabs.TabPane>
                </Tabs>
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
                                bookNo: printingPayment.payment.bookNo,
                                receiptNoDisplay: printingPayment.payment.receiptNo,
                                date: printingPayment.payment.date,
                                name: printingPayment.recordName,
                                memberCode: printingPayment.memberCode || '',
                                amount: printingPayment.payment.amount,
                                year: selectedYear,
                                type: printingPayment.memberCode ? 'Waqf-e-Jadeed' : 'Waqf-e-Jadeed (Special)',
                                tanzeem: printingPayment.memberCode && editingMember ? getTanzeemUrduName(determineTanzeem(calculateAge(editingMember.dateOfBirth), editingMember.gender)) : undefined,
                                gender: editingMember ? editingMember.gender : editingSpecial?.gender
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
                <Form form={specialForm} layout="vertical" requiredMark={true}>
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
                                    parser={value => value!.replace(/\$\s?|(,*)/g, '') as any}
                                />
                            </Form.Item>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item name="nagarparAmount" label="Nagarpar Amount" initialValue={0}>
                                <InputNumber
                                    style={{ width: '100%' }}
                                    formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                                    parser={value => value!.replace(/\$\s?|(,*)/g, '') as any}
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Modal>

            {/* Add Book Modal */}
            <Modal
                title="Add New Receipt Book"
                open={addBookModalVisible}
                onCancel={() => setAddBookModalVisible(false)}
                footer={null}
            >
                <Form form={newBookForm} layout="vertical" onFinish={handleAddBook} requiredMark={true}>
                    <Form.Item name="bookNo" label="Book Number" rules={[{ required: true, message: 'Required' }]}>
                        <Input placeholder="e.g. A-1, B-2" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={submitting} block>
                            Create Book
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Manage Receipt Books"
                open={manageBooksModalVisible}
                onCancel={() => setManageBooksModalVisible(false)}
                footer={null}
            >
                <List
                    dataSource={books}
                    renderItem={item => (
                        <List.Item
                            actions={[
                                editingBookId === item.id ? (
                                    <Button type="link" onClick={() => handleUpdateBook(item.id)}>Save</Button>
                                ) : (
                                    <Button type="link" icon={<EditOutlined />} onClick={() => {
                                        setEditingBookId(item.id);
                                        setEditingBookName(item.bookNo);
                                    }} />
                                ),
                                <Popconfirm title="Delete book?" onConfirm={() => handleDeleteBook(item.id)} okText="Yes" cancelText="No">
                                    <Button type="link" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                            ]}
                        >
                            {editingBookId === item.id ? (
                                <Input value={editingBookName} onChange={e => setEditingBookName(e.target.value)} />
                            ) : (
                                item.bookNo
                            )}
                        </List.Item>
                    )}
                />
                <Button block type="dashed" onClick={() => {
                    setManageBooksModalVisible(false);
                    setAddBookModalVisible(true);
                }} icon={<PlusOutlined />}>
                    Add New Book
                </Button>
            </Modal>

        </div >
    );
};

export default WaqfJadeed;
