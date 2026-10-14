import React, { useState, useEffect, useMemo } from 'react';
import {
    Card,
    List,
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
    Popconfirm,
    DatePicker,
    Segmented,
    Pagination,
    Empty,
    Spin
} from 'antd';

const { Text, Title } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

import {
    UserOutlined,
    SearchOutlined,
    CheckCircleOutlined,
    DeleteOutlined,
    PlusOutlined,
    EditOutlined,
    PrinterOutlined,
    FilePdfOutlined,
    SaveOutlined,
    ShareAltOutlined,
    BookOutlined,
    DownloadOutlined,
    WarningOutlined
} from '@ant-design/icons';
import WaqfReports from '../components/WaqfReports';
import dayjs from 'dayjs';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { ApiService } from '../services/apiService';
import type { Member, WaqfJadeedRecord, Family, Payment, WaqfJadeedSpecialRecord, ReceiptBook, WaqfJadeedMarkazPayment } from '../types';
import { ReceiptTemplate } from '../components/ReceiptTemplate';
import PaymentPlanManager from '../components/PaymentPlanManager';
import { getTanzeemDisplayName, calculateAge, determineTanzeem, getTanzeemUrduName, exportToPDF } from '../utils/helpers';
import MemberForm from '../components/MemberForm';
import { generateAvatarFromName } from '../utils/imageUtils';
import { validateMemberData, sanitizeMemberData } from '../utils/validation';
import { printFamilyReceiptBluetooth } from '../utils/bluetoothPrinter';
import { LayoutGrid, List as ListIcon, ArrowRight } from 'lucide-react';
import './Families.css';
import './WaqfJadeed.css';

const WaqfJadeed: React.FC = () => {
    const { message } = App.useApp();
    const [loading, setLoading] = useState(false);
    const [allMembers, setAllMembers] = useState<Member[]>([]);
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
    const [memberView, setMemberView] = useState<'cards' | 'list'>('cards');
    const [familyView, setFamilyView] = useState<'cards' | 'list'>('cards');
    useEffect(() => { setMembersCurrentPage(1); }, [searchTerm, selectedYear]);

    // Target amount state (stored per year in localStorage)
    const [targetAmount, setTargetAmount] = useState<number>(0);

    const [familySort, setFamilySort] = useState<'default' | 'zero_promise_first' | 'pending_first'>('pending_first');

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
    const [membersCurrentPage, setMembersCurrentPage] = useState(1);
    const [membersPageSize, setMembersPageSize] = useState(20);

    const [books, setBooks] = useState<ReceiptBook[]>([]);
    const [addBookModalVisible, setAddBookModalVisible] = useState(false);
    const [manageBooksModalVisible, setManageBooksModalVisible] = useState(false);
    const [editingBookId, setEditingBookId] = useState<string | null>(null);
    const [editingBookName, setEditingBookName] = useState('');
    const [savingDefaultBook, setSavingDefaultBook] = useState<string | null>(null);
    const selectedPaymentBookId = Form.useWatch('bookId', paymentForm);
    useEffect(() => {
        const defaultBook = books.find(book => book.isDefault && book.status === 'active');
        if (drawerVisible && !paymentEditingId && !selectedPaymentBookId && defaultBook) paymentForm.setFieldsValue({ bookId: defaultBook.id });
    }, [books, drawerVisible, paymentEditingId, selectedPaymentBookId, paymentForm]);
    const [newBookForm] = Form.useForm();

    // Markaz Payment State
    const [markazPayments, setMarkazPayments] = useState<WaqfJadeedMarkazPayment[]>([]);
    const [markazModalVisible, setMarkazModalVisible] = useState(false);
    const [netBalanceBreakdownVisible, setNetBalanceBreakdownVisible] = useState(false);
    const [markazForm] = Form.useForm();

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
            const [membersData, familiesData, recordsData, specialData, prevRecordsData, prevSpecialData, markazData] = await Promise.all([
                ApiService.getAllMembers(),
                ApiService.getAllFamilies(),
                ApiService.getWaqfJadeedRecords(selectedYear),
                ApiService.getWaqfJadeedSpecialRecords(selectedYear),
                ApiService.getWaqfJadeedRecords(selectedYear - 1),
                ApiService.getWaqfJadeedSpecialRecords(selectedYear - 1),
                ApiService.getWaqfJadeedMarkazPayments(selectedYear)
            ]);

            setAllMembers(membersData);

            const memberIdsWithRecords = Array.isArray(recordsData)
                ? new Set(recordsData.map((r: any) => r.memberId))
                : new Set<string>();

            const filteredMembers = membersData.filter(m => {
                const hasRecord = memberIdsWithRecords.has(m.id);
                if (hasRecord) return true;
                return !m.isMoved && !m.isDeceased && !m.isBList;
            });

            const activeMemberIds = new Set(filteredMembers.map(m => m.id));
            setMembers(filteredMembers);

            // Filter families to exclude B List and moved
            setFamilies(familiesData.filter(f => !f.isMoved && !f.isBList));

            // Filter records to ensure they match the selected year AND are for active members
            const filteredRecords = Array.isArray(recordsData)
                ? recordsData.filter(r => {
                    if (r.year !== selectedYear) return false;
                    return activeMemberIds.has(r.memberId);
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

            setPrevSpecialRecords(Array.isArray(prevSpecialData) ? prevSpecialData : []);

            // Migration logic for legacy 'amount' field
            const migratedMarkaz = (Array.isArray(markazData) ? markazData : []).map((p: any) => ({
                ...p,
                amountWJ: p.amountWJ ?? p.amount ?? 0,
                amountAtfal: p.amountAtfal ?? 0,
                amountNagarParkar: p.amountNagarParkar ?? 0
            }));
            setMarkazPayments(migratedMarkaz);

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
        setLoading(true);
        try {
            message.loading({ content: 'Generating Dashboard Report...', key: 'dashboard-export', duration: 0 });

            // Create a temporary HTML element for the report
            const printDiv = document.createElement('div');
            printDiv.style.position = 'absolute';
            printDiv.style.left = '-9999px';
            printDiv.style.width = '210mm'; // A4 width
            printDiv.style.minHeight = '297mm'; // A4 height
            printDiv.style.padding = '20px';
            printDiv.style.fontFamily = 'Arial, "Noto Sans Arabic", sans-serif';
            printDiv.style.backgroundColor = 'white';
            printDiv.style.color = 'black';

            // Helper for currency formatting
            const formatCurrency = (val: number) => `Rs. ${val.toLocaleString()}`;
            const formatPercent = (val: number) => `${val.toFixed(1)}%`;

            // Build HTML content
            let htmlContent = `
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="font-size: 24px; margin: 0; font-weight: bold;">Jamat Tajneed - Waqf-e-Jadeed Dashboard ${selectedYear}</h1>
                    <p style="margin: 5px 0 0 0; color: #666;">Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
                </div>

                <!-- Overall Performance Section -->
                <div style="margin-bottom: 25px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 16px; border-bottom: 2px solid #722ed1; padding-bottom: 5px; display: inline-block;">Overall Performance</h3>
                    <div style="display: flex; gap: 15px;">
                        <div style="flex: 1; border: 1px solid #d9d9d9; border-radius: 8px; padding: 15px; background: #fafafa;">
                            <div style="font-size: 12px; color: #666; margin-bottom: 5px;">Total Promise</div>
                            <div style="font-size: 20px; font-weight: bold; color: #000;">${formatCurrency(stats.totalPromise)}</div>
                            <div style="font-size: 10px; color: #888; margin-top: 5px;">Including all categories</div>
                        </div>
                        <div style="flex: 1; border: 1px solid #d9d9d9; border-radius: 8px; padding: 15px; background: #f6ffed;">
                            <div style="font-size: 12px; color: #666; margin-bottom: 5px;">Total Paid</div>
                            <div style="font-size: 20px; font-weight: bold; color: #3f8600;">${formatCurrency(stats.totalPaid)}</div>
                            <div style="font-size: 10px; color: #888; margin-top: 5px;">${formatPercent(stats.percent)} Collected</div>
                        </div>
                        <div style="flex: 1; border: 1px solid #d9d9d9; border-radius: 8px; padding: 15px; background: #fff;">
                            <div style="font-size: 12px; color: #666; margin-bottom: 5px;">Collection Progress</div>
                            <div style="margin-bottom: 5px; font-weight: bold; font-size: 16px;">${formatPercent(stats.percent)}</div>
                             <div style="width: 100%; height: 8px; background-color: #f5f5f5; border-radius: 4px; overflow: hidden;">
                                <div style="width: ${stats.percent}%; height: 100%; background-color: #52c41a;"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Target Section -->
                <div style="margin-bottom: 30px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #f0f2f5; padding: 10px 15px; border-bottom: 1px solid #ddd;">
                        <h3 style="margin: 0; font-size: 16px;">Target Tracking (Daftar Baligan)</h3>
                    </div>
                    <div style="display: flex; padding: 15px;">
                        <div style="flex: 1; text-align: center; border-right: 1px solid #eee;">
                            <div style="font-size: 12px; color: #666;">Target Amount</div>
                            <div style="font-size: 18px; font-weight: bold;">${formatCurrency(targetAmount)}</div>
                        </div>
                        <div style="flex: 1; text-align: center; border-right: 1px solid #eee;">
                            <div style="font-size: 12px; color: #666;">Total Promised</div>
                            <div style="font-size: 18px; font-weight: bold;">${formatCurrency(targetSectionStats.totalPromised)}</div>
                        </div>
                        <div style="flex: 1; text-align: center; border-right: 1px solid #eee;">
                            <div style="font-size: 12px; color: #666;">Total Received</div>
                            <div style="font-size: 18px; font-weight: bold; color: #3f8600;">${formatCurrency(targetSectionStats.totalReceived)}</div>
                        </div>
                        <div style="flex: 1; text-align: center;">
                            <div style="font-size: 12px; color: #666;">Gap</div>
                            <div style="font-size: 18px; font-weight: bold; color: ${targetSectionStats.remainingFromTarget > 0 ? '#cf1322' : '#3f8600'};">
                                ${formatCurrency(targetSectionStats.remainingFromTarget)}
                            </div>
                        </div>
                    </div>
                </div>

                 <!-- Baligan Breakdown Table -->
                <div style="margin-bottom: 30px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 16px; border-bottom: 2px solid #1890ff; padding-bottom: 5px; display: inline-block;">Daftar Baligan Breakdown</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                        <thead>
                            <tr style="background-color: #fafafa; border-bottom: 2px solid #ddd;">
                                <th style="padding: 8px; text-align: left;">Category</th>
                                <th style="padding: 8px; text-align: center;">Count</th>
                                <th style="padding: 8px; text-align: right;">Promised</th>
                                <th style="padding: 8px; text-align: right;">Paid</th>
                                <th style="padding: 8px; text-align: center;">Progress</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${[
                    { label: 'Ansar', ...baliganStats.ansar, promise: baliganStats.ansar.promiseBase },
                    { label: 'Khuddam', ...baliganStats.khuddam, promise: baliganStats.khuddam.promiseBase },
                    { label: 'Lajna', ...baliganStats.lajna, promise: baliganStats.lajna.promiseBase },
                    { label: 'Special Members', ...baliganStats.special, promise: baliganStats.special.promiseBase },
                    { label: 'Deceased (Male)', count: baliganStats.deceased.deceasedMales, promise: baliganStats.deceased.malePromiseBase, paid: baliganStats.deceased.malePaidAmount },
                    { label: 'Deceased (Female)', count: baliganStats.deceased.deceasedFemales, promise: baliganStats.deceased.femalePromiseBase, paid: baliganStats.deceased.femalePaidAmount },
                    { label: 'Additional', ...baliganStats.additional, paid: baliganStats.additional.paidAmount, promise: baliganStats.additional.promiseBase }
                ].map((row, idx) => {
                    const pct = row.promise > 0 ? (row.paid / row.promise) * 100 : 0;
                    return `
                                    <tr style="border-bottom: 1px solid #eee; background-color: ${idx % 2 === 0 ? 'white' : '#f9f9f9'};">
                                        <td style="padding: 8px;">${row.label}</td>
                                        <td style="padding: 8px; text-align: center;">${row.count}</td>
                                        <td style="padding: 8px; text-align: right;">${formatCurrency(row.promise)}</td>
                                        <td style="padding: 8px; text-align: right;">${formatCurrency(row.paid)}</td>
                                        <td style="padding: 8px; text-align: center;">${formatPercent(pct)}</td>
                                    </tr>
                                `;
                }).join('')}
                             <tr style="background-color: #e6f7ff; font-weight: bold; border-top: 2px solid #1890ff;">
                                <td style="padding: 8px;">Total Baligan</td>
                                <td style="padding: 8px; text-align: center;">-</td>
                                <td style="padding: 8px; text-align: right;">${formatCurrency(targetSectionStats.totalPromised)}</td>
                                <td style="padding: 8px; text-align: right;">${formatCurrency(targetSectionStats.totalReceived)}</td>
                                <td style="padding: 8px; text-align: center;">${formatPercent(targetSectionStats.promisePercent)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Atfal Section -->
                <div style="margin-bottom: 30px;">
                     <h3 style="margin: 0 0 10px 0; font-size: 16px; border-bottom: 2px solid #52c41a; padding-bottom: 5px; display: inline-block;">Daftar Atfal Breakdown</h3>
                     <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                        <thead>
                            <tr style="background-color: #fafafa; border-bottom: 2px solid #ddd;">
                                <th style="padding: 8px; text-align: left;">Category</th>
                                <th style="padding: 8px; text-align: center;">Count</th>
                                <th style="padding: 8px; text-align: right;">Promised</th>
                                <th style="padding: 8px; text-align: right;">Paid</th>
                                <th style="padding: 8px; text-align: center;">Progress</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${[
                    { name: 'atfal', label: 'Atfal' },
                    { name: 'nasirat', label: 'Nasirat' },
                    { name: 'saf-e-awal', label: 'Saf-e-Awal' },
                    { name: 'saf-e-awal-girls', label: 'Saf-e-Awal (Girls)' }
                ].map((t, idx) => {
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
                    const pct = s.promise > 0 ? (s.paid / s.promise) * 100 : 0;
                    return `
                                    <tr style="border-bottom: 1px solid #eee; background-color: ${idx % 2 === 0 ? 'white' : '#f9f9f9'};">
                                        <td style="padding: 8px;">${t.label}</td>
                                        <td style="padding: 8px; text-align: center;">${s.count}</td>
                                        <td style="padding: 8px; text-align: right;">${formatCurrency(s.promise)}</td>
                                        <td style="padding: 8px; text-align: right;">${formatCurrency(s.paid)}</td>
                                        <td style="padding: 8px; text-align: center;">${formatPercent(pct)}</td>
                                    </tr>
                                `;
                }).join('')}
                            <tr style="background-color: #f6ffed; font-weight: bold; border-top: 2px solid #52c41a;">
                                <td style="padding: 8px;">Total Atfal (Male)</td>
                                <td style="padding: 8px; text-align: center;">${dafarAtfalStats.male.count}</td>
                                <td style="padding: 8px; text-align: right;">${formatCurrency(dafarAtfalStats.male.promise)}</td>
                                <td style="padding: 8px; text-align: right;">${formatCurrency(dafarAtfalStats.male.paid)}</td>
                                <td style="padding: 8px; text-align: center;">${formatPercent(dafarAtfalStats.male.promise > 0 ? (dafarAtfalStats.male.paid / dafarAtfalStats.male.promise) * 100 : 0)}</td>
                            </tr>
                            <tr style="background-color: #fff0f6; font-weight: bold; border-top: 1px solid #eb2f96;">
                                <td style="padding: 8px;">Total Atfal (Female)</td>
                                <td style="padding: 8px; text-align: center;">${dafarAtfalStats.female.count}</td>
                                <td style="padding: 8px; text-align: right;">${formatCurrency(dafarAtfalStats.female.promise)}</td>
                                <td style="padding: 8px; text-align: right;">${formatCurrency(dafarAtfalStats.female.paid)}</td>
                                <td style="padding: 8px; text-align: center;">${formatPercent(dafarAtfalStats.female.promise > 0 ? (dafarAtfalStats.female.paid / dafarAtfalStats.female.promise) * 100 : 0)}</td>
                            </tr>
                            <tr style="background-color: #f9f9f9; font-weight: bold; border-top: 2px solid #333;">
                                <td style="padding: 8px;">Grand Total Atfal</td>
                                <td style="padding: 8px; text-align: center;">${dafarAtfalStats.total.count}</td>
                                <td style="padding: 8px; text-align: right;">${formatCurrency(dafarAtfalStats.total.promise)}</td>
                                <td style="padding: 8px; text-align: right;">${formatCurrency(dafarAtfalStats.total.paid)}</td>
                                <td style="padding: 8px; text-align: center;">${formatPercent(dafarAtfalStats.total.promise > 0 ? (dafarAtfalStats.total.paid / dafarAtfalStats.total.promise) * 100 : 0)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                 <!-- Summary Grid -->
                 <div style="display: flex; gap: 20px; margin-bottom: 25px;">
                    <div style="flex: 1; border: 1px solid #fa8c16; border-radius: 8px; padding: 15px;">
                        <h4 style="margin: 0 0 10px 0; color: #d46b08;">Nagar Parkar</h4>
                        <div style="font-size: 20px; font-weight: bold;">${formatCurrency(stats.totalNagarParkar)}</div>
                        <div style="font-size: 12px; color: #666;">Total Collected</div>
                    </div>
                     <div style="flex: 1; border: 1px solid #1890ff; border-radius: 8px; padding: 15px;">
                        <h4 style="margin: 0 0 10px 0; color: #096dd9;">Participation</h4>
                        <div style="font-size: 20px; font-weight: bold;">${formatPercent(dashboardMetrics.participationRate)}</div>
                        <div style="font-size: 12px; color: #666;">Member Participation</div>
                    </div>
                     <div style="flex: 1; border: 1px solid #722ed1; border-radius: 8px; padding: 15px;">
                        <h4 style="margin: 0 0 10px 0; color: #531dab;">Grand Total</h4>
                        <div style="font-size: 20px; font-weight: bold;">${formatCurrency(stats.totalPaid)}</div>
                        <div style="font-size: 12px; color: #666;">Total of All Funds</div>
                    </div>
                 </div>

                 <!-- Markaz Payments Section -->
                 <div style="margin-top: 30px; border: 1px solid #000; padding: 20px; border-radius: 8px; background-color: #fafafa;">
                     <h3 style="margin: 0 0 20px 0; border-bottom: 2px solid #000; padding-bottom: 5px; font-size: 18px;">Markaz Payments & Net Balance (مرکز کو ادائیگی اور نیٹ بیلنس)</h3>
                     
                     <!-- Markaz Summary Stats -->
                     <div style="display: flex; gap: 15px; margin-bottom: 25px;">
                         <div style="flex: 1; border: 1px solid #adc6ff; border-radius: 8px; padding: 12px; background: #f0f5ff;">
                             <div style="font-size: 12px; color: #666; margin-bottom: 5px;">Total Collected</div>
                             <div style="font-size: 18px; font-weight: bold; color: #000;">${formatCurrency(stats.totalPaid)}</div>
                         </div>
                         <div style="flex: 1; border: 1px solid #adc6ff; border-radius: 8px; padding: 12px; background: #f0f5ff;">
                             <div style="font-size: 12px; color: #666; margin-bottom: 5px;">Paid to Markaz</div>
                             <div style="font-size: 18px; font-weight: bold; color: #cf1322;">${formatCurrency(markazPayments.reduce((sum, p) => sum + (p.amountWJ || 0) + (p.amountAtfal || 0) + (p.amountNagarParkar || 0), 0))}</div>
                         </div>
                         <div style="flex: 1; border: 1px solid #adc6ff; border-radius: 8px; padding: 12px; background: #f0f5ff;">
                             <div style="font-size: 12px; color: #666; margin-bottom: 5px;">Net Balance in Hand</div>
                             <div style="font-size: 18px; font-weight: bold; color: #3f8600;">${formatCurrency(stats.totalPaid - markazPayments.reduce((sum, p) => sum + (p.amountWJ || 0) + (p.amountAtfal || 0) + (p.amountNagarParkar || 0), 0))}</div>
                         </div>
                     </div>

                      <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                         <thead>
                             <tr style="background: #e8e8e8;">
                                 <th style="padding: 10px 8px; text-align: left; border: 1px solid #ddd;">Date</th>
                                 <th style="padding: 10px 8px; text-align: left; border: 1px solid #ddd;">Coupon No</th>
                                 <th style="padding: 10px 8px; text-align: right; border: 1px solid #ddd;">WJ (Alif)</th>
                                 <th style="padding: 10px 8px; text-align: right; border: 1px solid #ddd;">WJ (Atfal)</th>
                                 <th style="padding: 10px 8px; text-align: right; border: 1px solid #ddd;">Nagar Parkar</th>
                                 <th style="padding: 10px 8px; text-align: left; border: 1px solid #ddd;">Notes</th>
                                 <th style="padding: 10px 8px; text-align: right; border: 1px solid #ddd;">Total</th>
                             </tr>
                         </thead>
                         <tbody>
                             ${markazPayments.map(p => {
                    const total = (p.amountWJ || 0) + (p.amountAtfal || 0) + (p.amountNagarParkar || 0);
                    return `
                                 <tr>
                                     <td style="padding: 8px; border: 1px solid #ddd;">${new Date(p.paymentDate).toLocaleDateString()}</td>
                                     <td style="padding: 8px; border: 1px solid #ddd;">${p.couponNo}</td>
                                     <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${formatCurrency(p.amountWJ || 0)}</td>
                                     <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${formatCurrency(p.amountAtfal || 0)}</td>
                                     <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${formatCurrency(p.amountNagarParkar || 0)}</td>
                                     <td style="padding: 8px; border: 1px solid #ddd; font-size: 9px;">${p.notes || ''}</td>
                                     <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${formatCurrency(total)}</td>
                                 </tr>
                             `;
                }).join('')}
                             <tr style="background: #e6f7ff; font-weight: bold;">
                                 <td colspan="2" style="padding: 10px 8px; text-align: right; border: 1px solid #ddd;">Total Paid to Markaz</td>
                                 <td style="padding: 10px 8px; text-align: right; border: 1px solid #ddd;">${formatCurrency(markazPayments.reduce((sum, p) => sum + (p.amountWJ || 0), 0))}</td>
                                 <td style="padding: 10px 8px; text-align: right; border: 1px solid #ddd;">${formatCurrency(markazPayments.reduce((sum, p) => sum + (p.amountAtfal || 0), 0))}</td>
                                 <td style="padding: 10px 8px; text-align: right; border: 1px solid #ddd;">${formatCurrency(markazPayments.reduce((sum, p) => sum + (p.amountNagarParkar || 0), 0))}</td>
                                 <td style="padding: 10px 8px; border: 1px solid #ddd;"></td>
                                 <td style="padding: 10px 8px; text-align: right; border: 1px solid #ddd;">${formatCurrency(markazPayments.reduce((sum, p) => sum + (p.amountWJ || 0) + (p.amountAtfal || 0) + (p.amountNagarParkar || 0), 0))}</td>
                             </tr>
                         </tbody>
                     </table>
                 </div>
            `;

            printDiv.innerHTML = htmlContent;
            document.body.appendChild(printDiv);

            // Convert to PDF
            const canvas = await html2canvas(printDiv, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const imgWidth = 210;
            const pageHeight = 297;
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
            pdf.save(`Waqf_Jadeed_Dashboard_Report_${selectedYear}.pdf`);

            document.body.removeChild(printDiv);
            message.success({ content: 'Dashboard Report exported successfully', key: 'dashboard-export' });

        } catch (error) {
            console.error('Export failed:', error);
            message.error({ content: 'Failed to export dashboard', key: 'dashboard-export' });
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
        setPaymentEditingId(null);
        paymentForm.resetFields();
        setEditingMember(member);
        setEditingSpecial(null);
        const record = records.find(r => r.memberId === member.id);
        form.setFieldsValue({
            promiseAmount: record?.promiseAmount || 0,
            nagarparAmount: record?.nagarparAmount || 0,
        });
        setIsEditingPromise(!record?.promiseAmount);
        setDrawerVisible(true);
    };

    const handleEditSpecial = (record: WaqfJadeedSpecialRecord) => {
        setPaymentEditingId(null);
        paymentForm.resetFields();
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
                // Payments live in their own collection; don't write a stale copy back into the record
                const { payments: _payments, ...specialFields } = editingSpecial;
                const payload = {
                    ...specialFields,
                    promiseAmount: values.promiseAmount,
                    nagarparAmount: values.nagarparAmount,
                };
                const saved = await ApiService.saveWaqfJadeedSpecialRecord(payload);
                if (saved) {
                    const fresh = await ApiService.getWaqfJadeedSpecialRecordById(saved.id);
                    const merged = (fresh || { ...saved, payments: editingSpecial.payments }) as WaqfJadeedSpecialRecord;
                    updateLocalSpecialRecord(merged);
                    setEditingSpecial(merged);
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

    const handleDefaultBook = async (id: string) => {
        setSavingDefaultBook(id);
        try { await ApiService.setDefaultReceiptBook(id); await loadBooks(); message.success('Default receipt book updated'); }
        catch { message.error('Unable to set default book'); }
        finally { setSavingDefaultBook(null); }
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
                dateOfBirth: formData.dateOfBirth.format('YYYY-MM-DD'),
                age,
                phone: formData.phone && String(formData.phone).trim() ? String(formData.phone).trim() : '',
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
                message.error(`Validation failed: ${validation.errors.join(', ')} `);
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
            setDrawerVisible(false); // Reuse drawer state or add separate? Special usually has its own
            // Actually checking usage, special form is usually in modal or drawer.
        } catch (error) {
            message.error('Failed to save special record');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveMarkazPayment = async (values: any) => {
        setSubmitting(true);
        try {
            const payload = {
                ...values,
                amountWJ: values.amountWJ || 0,
                amountAtfal: values.amountAtfal || 0,
                amountNagarParkar: values.amountNagarParkar || 0,
                notes: values.notes || '', // Ensure notes is not undefined
                year: selectedYear,
                paymentDate: values.paymentDate ? values.paymentDate.toISOString() : new Date().toISOString()
            };

            await ApiService.saveWaqfJadeedMarkazPayment(payload);
            message.success('Markaz payment recorded');
            setMarkazModalVisible(false);
            markazForm.resetFields();
            loadData(); // Reload to see updates
        } catch (error: any) {
            console.error('Save Markaz Payment Error:', error);
            message.error(`Failed to save payment: ${error.message || 'Unknown error'} `);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteMarkazPayment = async (id: string) => {
        try {
            await ApiService.deleteWaqfJadeedMarkazPayment(id);
            message.success('Payment deleted');
            loadData();
        } catch (error) {
            message.error('Failed to delete');
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

            const membersPaid = familyMembers.reduce((sum, m) => {
                const record = records.find(r => r.memberId === m.id);
                return sum + (record?.paidAmount || 0);
            }, 0);

            const specialPromise = famSpecialRecords.reduce((sum, r) => sum + ((r.promiseAmount || 0) + (r.nagarparAmount || 0)), 0);
            const specialPaid = famSpecialRecords.reduce((sum, r) => sum + (r.paidAmount || 0), 0);

            return {
                ...family,
                totalPromise: membersPromise + specialPromise,
                totalPaid: membersPaid + specialPaid
            };
        });

        return dataWithPromise.sort((a, b) => {
            if (familySort === 'zero_promise_first') {
                // If one has 0 promise and other doesn't, put 0 promise first
                if (a.totalPromise === 0 && b.totalPromise > 0) return -1;
                if (a.totalPromise > 0 && b.totalPromise === 0) return 1;
            } else if (familySort === 'pending_first') {
                // Pending (promised but not fully paid) at top, no promise in middle, 100% paid at bottom
                const rank = (f: { totalPromise: number; totalPaid: number }) =>
                    f.totalPromise === 0 ? 1 : f.totalPaid >= f.totalPromise ? 2 : 0;
                const diff = rank(a) - rank(b);
                if (diff !== 0) return diff;
            }

            // Default numeric sort by familyNumber
            const numA = a.familyNumber || 999999;
            const numB = b.familyNumber || 999999;
            return numA - numB;
        });
    }, [families, searchTerm, familySort, members, records, specialRecords]);

    const handleExportFamilyFitranaEid = async () => {
        const rows: { col1: string; col2: string; col3: string; col4: string }[] = [];
        let buffer: string[] = [];

        filteredFamilyData.forEach(family => {
            const familyMembers = members.filter(m => m.familyId === family.id && !m.isDeceased && !m.isMoved);
            const memberCount = familyMembers.length;
            const baseName = family.familyName.replace(/family/gi, '').trim();
            const label = `${baseName} - ${memberCount}`;

            buffer.push(label);
            if (buffer.length === 4) {
                rows.push({
                    col1: buffer[0],
                    col2: buffer[1],
                    col3: buffer[2],
                    col4: buffer[3]
                });
                buffer = [];
            }
        });

        if (buffer.length > 0) {
            rows.push({
                col1: buffer[0] || '',
                col2: buffer[1] || '',
                col3: buffer[2] || '',
                col4: buffer[3] || ''
            });
        }

        await exportToPDF(
            rows,
            ['col1', 'col2', 'col3', 'col4'],
            `family_fitrana_eid_${selectedYear}`,
            '',
            { fontSize: 11, showHeader: false, showTitle: false, showGeneratedOn: false }
        );
        message.success('Family Fitrana/Eid PDF generated');
    };

    const handleExportFamilySummaryPDF = async () => {
        const rows = filteredFamilyData.map((family, index) => {
            const totalPromise = family.totalPromise || 0;
            const totalPaid = family.totalPaid || 0;
            const balance = totalPromise - totalPaid;
            return {
                no: index + 1,
                familyName: family.familyName,
                promise: totalPromise,
                paid: totalPaid,
                balance
            };
        });

        await exportToPDF(
            rows,
            ['no', 'familyName', 'promise', 'paid', 'balance'],
            `family_summary_${selectedYear}`,
            `Waqf-e-Jadeed - Family Summary - ${selectedYear}`
        );
        message.success('Family summary PDF generated');
    };

    // Same per-family totals as the Family Wise list, keeping only families with balance
    const handleExportFamiliesBalancePDF = async () => {
        const pending = filteredFamilyData
            .map(family => {
                const familyMembersCtx = family.memberIds
                    .map(mid => getMemberData(mid))
                    .filter((item): item is NonNullable<MemberData> =>
                        !!item && !item.member.isDeceased && !item.member.isMoved);
                const familySpecialRecords = specialRecords.filter(r => r.familyId === family.id);
                const promise = familyMembersCtx.reduce((sum, m) => sum + m.promise, 0) +
                    familySpecialRecords.reduce((sum, r) => sum + (r.promiseAmount || 0) + (r.nagarparAmount || 0), 0);
                const paid = familyMembersCtx.reduce((sum, m) => sum + m.paid, 0) +
                    familySpecialRecords.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
                return { family, promise, paid, balance: promise - paid };
            })
            .filter(f => f.balance > 0)
            .sort((a, b) => (a.family.familyNumber || 999999) - (b.family.familyNumber || 999999));

        if (pending.length === 0) {
            message.info('No families with remaining balance');
            return;
        }

        const rows: Array<Record<string, unknown>> = pending.map((f, index) => ({
            no: index + 1,
            familyNo: f.family.familyNumber ?? '-',
            familyName: f.family.familyName,
            halqa: f.family.halqa || '-',
            promise: f.promise,
            paid: f.paid,
            balance: f.balance
        }));
        rows.push({
            no: '',
            familyNo: '',
            familyName: 'Total',
            halqa: '',
            promise: pending.reduce((sum, f) => sum + f.promise, 0),
            paid: pending.reduce((sum, f) => sum + f.paid, 0),
            balance: pending.reduce((sum, f) => sum + f.balance, 0)
        });

        await exportToPDF(
            rows,
            ['no', 'familyNo', 'familyName', 'halqa', 'promise', 'paid', 'balance'],
            `families_balance_${selectedYear}`,
            `Waqf-e-Jadeed - Families with Remaining Balance - ${selectedYear}`,
            {
                headerLabels: {
                    no: '#',
                    familyNo: 'Family #',
                    familyName: 'Family',
                    halqa: 'Halqa',
                    promise: 'Promise',
                    paid: 'Paid',
                    balance: 'Balance'
                }
            }
        );
        message.success(`Exported ${pending.length} families with remaining balance`);
    };

    const handleExportMembersPDF = async () => {
        const rows = filteredMemberData.map((item, index) => ({
            no: index + 1,
            name: item.member.name,
            fatherName: item.member.fatherName || '-',
            halqa: item.member.halqa || '-',
            tanzeem: getTanzeemDisplayName(item.member.tanzeem),
            promise: item.promise,
            paid: item.paid,
            balance: item.promise - item.paid
        }));

        await exportToPDF(
            rows,
            ['no', 'name', 'fatherName', 'halqa', 'tanzeem', 'promise', 'paid', 'balance'],
            `members_waqf_jadeed_${selectedYear}`,
            `Waqf-e-Jadeed - Members Report - ${selectedYear}`
        );
        message.success('Members PDF generated');
    };

    const handleExportTanzeemWisePDF = async () => {
        const rows: any[] = [];
        tanzeemGroupedData.forEach(group => {
            // Group header
            rows.push({
                name: `--- ${getTanzeemDisplayName(group.tanzeem).toUpperCase()} ---`,
                halqa: `${group.count} Members`,
                promise: group.totalPromise,
                paid: group.totalPaid,
                progress: `${group.percent}%`
            });

            // Member rows for this group
            group.members.forEach((item, idx) => {
                rows.push({
                    name: `  ${idx + 1}. ${item.member.name}`,
                    halqa: item.member.halqa || '-',
                    promise: item.promise,
                    paid: item.paid,
                    progress: item.promise > 0 ? `${Math.round((item.paid / item.promise) * 100)}%` : '0%'
                });
            });
            // Empty row for spacing
            rows.push({ name: '', halqa: '', promise: '', paid: '', progress: '' });
        });

        await exportToPDF(
            rows,
            ['name', 'halqa', 'promise', 'paid', 'progress'],
            `tanzeem_wise_waqf_jadeed_${selectedYear}`,
            `Waqf-e-Jadeed - Tanzeem Wise Report - ${selectedYear}`
        );
        message.success('Tanzeem Wise PDF generated');
    };

    const handleExportUnpaidMembersPDF = async () => {
        const rows: any[] = [];
        let totalUnpaidCount = 0;
        let totalOutstanding = 0;

        tanzeemGroupedData.forEach(group => {
            const nonPayers = group.members
                .filter(item => item.promise > 0 && item.paid < item.promise)
                .sort((a, b) => (b.promise - b.paid) - (a.promise - a.paid));

            if (nonPayers.length === 0) return;

            rows.push({
                name: `--- ${getTanzeemDisplayName(group.tanzeem).toUpperCase()} (${nonPayers.length} Unpaid) ---`,
                halqa: '',
                promise: '',
                paid: '',
                balance: ''
            });

            nonPayers.forEach((item, idx) => {
                const balance = item.promise - item.paid;
                totalUnpaidCount += 1;
                totalOutstanding += balance;
                rows.push({
                    name: `  ${idx + 1}. ${item.member.name}`,
                    halqa: item.member.halqa || '-',
                    promise: item.promise,
                    paid: item.paid,
                    balance
                });
            });

            rows.push({ name: '', halqa: '', promise: '', paid: '', balance: '' });
        });

        if (totalUnpaidCount === 0) {
            message.info('All members have paid their full promise amount');
            return;
        }

        await exportToPDF(
            rows,
            ['name', 'halqa', 'promise', 'paid', 'balance'],
            `unpaid_members_waqf_jadeed_${selectedYear}`,
            `Waqf-e-Jadeed - Unpaid / Outstanding Members Report - ${selectedYear}\nTotal Unpaid: ${totalUnpaidCount}  |  Total Outstanding: Rs. ${totalOutstanding.toLocaleString()}`,
            {
                headerLabels: {
                    name: 'Name',
                    halqa: 'Halqa',
                    promise: 'Promise',
                    paid: 'Paid',
                    balance: 'Balance'
                },
                titleAlign: 'center'
            }
        );
        message.success('Unpaid Members PDF generated');
    };

    const handleExportDaftarAtfalPDF = async () => {
        const maleGroup = tanzeemGroupedData.find(g => g.tanzeem === 'dafar-atfal-male');
        const femaleGroup = tanzeemGroupedData.find(g => g.tanzeem === 'dafar-atfal-female');

        const combinedMembers = [
            ...(maleGroup?.members || []),
            ...(femaleGroup?.members || [])
        ];

        if (combinedMembers.length === 0) {
            message.warning('No Daftar Atfal members found to export');
            return;
        }

        const rows = combinedMembers.map((item, index) => ({
            sNo: index + 1,
            name: item.member.name,
            fatherName: item.member.fatherName || '-',
            age: item.member.age,
            gender: item.member.gender === 'female' ? 'Female' : 'Male',
            halqa: item.member.halqa || '-',
            promise: item.promise,
            paid: item.paid,
            progress: item.promise > 0 ? `${Math.round((item.paid / item.promise) * 100)}%` : '0%'
        }));

        const maleCount = maleGroup?.count || 0;
        const femaleCount = femaleGroup?.count || 0;

        await exportToPDF(
            rows,
            ['sNo', 'name', 'fatherName', 'age', 'gender', 'halqa', 'promise', 'paid', 'progress'],
            `daftar_atfal_report_${selectedYear}`,
            `Waqf-e-Jadeed - Daftar Atfal Report - ${selectedYear}\nMale: ${maleCount}  |  Female: ${femaleCount}  |  Total: ${maleCount + femaleCount}`,
            {
                headerLabels: {
                    sNo: 'S.No',
                    name: 'Name',
                    fatherName: 'Father Name',
                    age: 'Age',
                    gender: 'Gender',
                    halqa: 'Halqa',
                    promise: 'Promise',
                    paid: 'Paid',
                    progress: 'Progress'
                },
                titleAlign: 'center'
            }
        );
        message.success('Daftar Atfal PDF generated');
    };

    const handleExport100PercentPaidPDF = async () => {
        const urduTanzeemNames: Record<string, string> = {
            'ansar': 'انصار',
            'lajna': 'لجنہ',
            'khuddam': 'خدام',
            'dafar-atfal-male': 'دفتر اطفال لڑکے',
            'dafar-atfal-female': 'دفتر اطفال لڑکیاں',
            'marhumeen': 'مرحومین'
        };

        const fullyPaidGroups = tanzeemGroupedData.map(group => {
            return {
                ...group,
                members: group.members.filter(m => m.promise > 0 && m.paid >= m.promise)
            };
        }).filter(group => group.members.length > 0);

        const totalMembersInList = fullyPaidGroups.reduce((acc, group) => acc + group.members.length, 0);

        const sections = fullyPaidGroups.map(group => {
            const rows: any[] = [];
            let buffer: string[] = [];

            group.members.forEach((item) => {
                buffer.push(item.member.name);
                if (buffer.length === 3) {
                    rows.push({
                        col1: buffer[0],
                        col2: buffer[1],
                        col3: buffer[2]
                    });
                    buffer = [];
                }
            });

            if (buffer.length > 0) {
                rows.push({
                    col1: buffer[0] || '',
                    col2: buffer[1] || '',
                    col3: buffer[2] || ''
                });
            }

            return {
                title: urduTanzeemNames[group.tanzeem] || group.tanzeem.toUpperCase(),
                data: rows,
                headers: ['col1', 'col2', 'col3'],
                options: {
                    showHeader: false,
                    fontSize: 14
                }
            };
        });

        await exportToPDF(
            [], // Main data is empty because we use sections
            ['col1', 'col2', 'col3'],
            `100_percent_paid_members_${selectedYear}`,
            `دعائیہ فہرست\n چندہ وقف جدید 100 فیصد ادا کرنے والے \nجماعت مریدکے ضلع شیخوپورہ ${selectedYear}\n(کل ممبران: ${totalMembersInList})`,
            {
                showHeader: false,
                renderMode: 'autoTable',
                fontSize: 14,
                rtl: true,
                titleAlign: 'center',
                sections: sections
            }
        );
        message.success('100% Paid Members PDF generated');
    };

    // Group members by tanzeem for Tanzeem Wise view, including Marhumeen/Others
    const tanzeemGroupedData = useMemo(() => {
        const tanzeemOrder = ['ansar', 'lajna', 'khuddam', 'dafar-atfal-male', 'dafar-atfal-female', 'marhumeen'];
        const grouped: Record<string, typeof filteredMemberData> = {};

        // Group standard members
        filteredMemberData.forEach(item => {
            let tanzeem = item.member.tanzeem || 'Unknown';
            // Group Atfal, Nasirat, Saf-e-Awal into Daftar Atfal (Male/Female)
            if (['atfal', 'nasirat', 'saf-e-awal', 'saf-e-awal-girls'].includes(tanzeem)) {
                const gender = item.member.gender?.toLowerCase() || 'male';
                tanzeem = (gender === 'female' ? 'dafar-atfal-female' : 'dafar-atfal-male') as any;
            }

            if (!grouped[tanzeem]) {
                grouped[tanzeem] = [];
            }
            grouped[tanzeem].push(item);
        });

        // Group special records
        specialRecords.forEach(record => {
            const type = (record as any).type || (record.isDeceased ? 'marhumeen' : 'other');
            if (type === 'other') return; // Skip "other" category

            if (!grouped[type]) {
                grouped[type] = [];
            }
            // Mock a standard member format to be seamlessly consumed by the export
            grouped[type].push({
                member: {
                    id: record.id,
                    name: record.name,
                    tanzeem: type as any,
                    familyId: '',
                    safEAwal: false,
                    gender: record.gender || 'male',
                    isDeceased: record.isDeceased
                } as any,
                promise: record.promiseAmount,
                paid: record.paidAmount,
                family: null as any
            } as any);
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

    const totalMarkazPaid = useMemo(() => markazPayments.reduce(
        (sum, payment) => sum + (payment.amountWJ || 0) + (payment.amountAtfal || 0) + (payment.amountNagarParkar || 0),
        0
    ), [markazPayments]);

    const netBalanceInHand = useMemo(() => stats.totalPaid - totalMarkazPaid, [stats.totalPaid, totalMarkazPaid]);

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

            // Also aggregate into Daftar Atfal (Male/Female) if applicable
            if (['atfal', 'saf-e-awal', 'saf-e-awal-girls', 'nasirat'].includes(tanzeem)) {
                const gender = member.gender?.toLowerCase() || 'male';
                const groupKey = gender === 'female' ? 'dafar-atfal-female' : 'dafar-atfal-male';

                if (!statsMap[groupKey]) {
                    statsMap[groupKey] = { promise: 0, promiseBase: 0, nagarpar: 0, paid: 0, count: 0 };
                }
                const record = records.find(r => r.memberId === member.id);
                if (record) {
                    const base = record.promiseAmount || 0;
                    const nagar = record.nagarparAmount || 0;
                    statsMap[groupKey].promiseBase += base;
                    statsMap[groupKey].nagarpar += nagar;
                    statsMap[groupKey].promise += base + nagar;
                    statsMap[groupKey].paid += record.paidAmount || 0;
                }
                statsMap[groupKey].count += 1;
            }
        });

        return Object.entries(statsMap)
            .filter(([name]) => !['dafar-atfal-male', 'dafar-atfal-female'].includes(name)) // Exclude grouping from the list itself
            .map(([name, data]) => ({
                name,
                ...data,
                percent: data.promise > 0 ? (data.paid / data.promise) * 100 : 0
            })).sort((a, b) => b.promise - a.promise); // Sort by highest promise
    }, [members, records]);

    // Export grouping specifically for targetSection
    const dafarAtfalStats = useMemo(() => {
        const maleStats = { promise: 0, promiseBase: 0, nagarpar: 0, paid: 0, count: 0 };
        const femaleStats = { promise: 0, promiseBase: 0, nagarpar: 0, paid: 0, count: 0 };

        members.forEach(member => {
            if (['atfal', 'saf-e-awal', 'saf-e-awal-girls', 'nasirat'].includes(member.tanzeem || '')) {
                const gender = member.gender?.toLowerCase() || 'male';
                const stats = gender === 'female' ? femaleStats : maleStats;

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
        return {
            male: maleStats, female: femaleStats, total: {
                promise: maleStats.promise + femaleStats.promise,
                paid: maleStats.paid + femaleStats.paid,
                count: maleStats.count + femaleStats.count
            }
        };
    }, [members, records]);

    // Under-7 (Saf-e-Awal / Saf-e-Awal Girls) members whose promise (incl. Nagar Parkar) is >= Rs. 1000
    const under7MinPromiseStats = useMemo(() => {
        const summarize = (items: typeof filteredMemberData) => ({
            count: items.length,
            promise: items.reduce((sum, m) => sum + m.promise, 0),
            paid: items.reduce((sum, m) => sum + m.paid, 0)
        });
        const boys = filteredMemberData.filter(item => item.member.tanzeem === 'saf-e-awal' && item.promise >= 1000);
        const girls = filteredMemberData.filter(item => item.member.tanzeem === 'saf-e-awal-girls' && item.promise >= 1000);
        const male = summarize(boys);
        const female = summarize(girls);
        return {
            male,
            female,
            total: { count: male.count + female.count, promise: male.promise + female.promise, paid: male.paid + female.paid }
        };
    }, [filteredMemberData]);

    // 7-15 years (Atfal / Nasirat) members whose promise (incl. Nagar Parkar) is >= Rs. 1000
    const age7to15MinPromiseStats = useMemo(() => {
        const summarize = (items: typeof filteredMemberData) => ({
            count: items.length,
            promise: items.reduce((sum, m) => sum + m.promise, 0),
            paid: items.reduce((sum, m) => sum + m.paid, 0)
        });
        const boys = filteredMemberData.filter(item => item.member.tanzeem === 'atfal' && item.promise >= 1000);
        const girls = filteredMemberData.filter(item => item.member.tanzeem === 'nasirat' && item.promise >= 1000);
        const male = summarize(boys);
        const female = summarize(girls);
        return {
            male,
            female,
            total: { count: male.count + female.count, promise: male.promise + female.promise, paid: male.paid + female.paid }
        };
    }, [filteredMemberData]);

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

    const netBalanceBreakdown = useMemo(() => {
        const childTanzeems = new Set(['atfal', 'nasirat', 'saf-e-awal', 'saf-e-awal-girls']);
        const adultRows = tanzeemStats
            .filter(row => !childTanzeems.has(row.name))
            .map(row => ({
                key: row.name,
                label: getTanzeemDisplayName(row.name),
                collected: row.paid,
                memberCount: row.count,
                baseBasis: row.promiseBase,
                nagarBasis: row.nagarpar,
                bucket: 'adult'
            }));

        const childRows = tanzeemStats
            .filter(row => childTanzeems.has(row.name))
            .map(row => ({
                key: row.name,
                label: getTanzeemDisplayName(row.name),
                collected: row.paid,
                memberCount: row.count,
                baseBasis: row.promiseBase,
                nagarBasis: row.nagarpar,
                bucket: 'child'
            }));

        const specialMembers = specialRecords.filter(record => !record.isDeceased && record.name !== 'اضافی');
        const specialMembersRow = {
            key: 'special-members',
            label: 'Special Members',
            collected: specialMembers.reduce((sum, record) => sum + (record.paidAmount || 0), 0),
            memberCount: specialMembers.length,
            baseBasis: specialMembers.reduce((sum, record) => sum + (record.promiseAmount || 0), 0),
            nagarBasis: specialMembers.reduce((sum, record) => sum + (record.nagarparAmount || 0), 0),
            bucket: 'adult'
        };

        const deceasedRow = {
            key: 'deceased',
            label: 'Deceased',
            collected: deceasedStats.totalDeceasedPaid,
            memberCount: deceasedStats.deceasedMales + deceasedStats.deceasedFemales,
            baseBasis: deceasedStats.totalDeceasedPromiseBase,
            nagarBasis: deceasedStats.totalDeceasedNagarpar,
            bucket: 'adult'
        };

        const additionalRow = {
            key: 'additional',
            label: 'Azafi / Additional',
            collected: azafiStats.paidAmount,
            memberCount: azafiStats.count,
            baseBasis: azafiStats.promiseBase,
            nagarBasis: azafiStats.promiseAmount - azafiStats.promiseBase,
            bucket: 'adult'
        };

        const allRows = [
            ...adultRows,
            ...childRows,
            specialMembersRow,
            deceasedRow,
            additionalRow
        ].filter(row => row.collected > 0 || row.baseBasis > 0 || row.nagarBasis > 0);

        const adultBaseTotal = allRows
            .filter(row => row.bucket === 'adult')
            .reduce((sum, row) => sum + row.baseBasis, 0);
        const childBaseTotal = allRows
            .filter(row => row.bucket === 'child')
            .reduce((sum, row) => sum + row.baseBasis, 0);
        const nagarTotal = allRows.reduce((sum, row) => sum + row.nagarBasis, 0);

        const adultMarkazPaid = markazPayments.reduce((sum, payment) => sum + (payment.amountWJ || 0), 0);
        const childMarkazPaid = markazPayments.reduce((sum, payment) => sum + (payment.amountAtfal || 0), 0);
        const nagarMarkazPaid = markazPayments.reduce((sum, payment) => sum + (payment.amountNagarParkar || 0), 0);

        const rowsWithRawNet = allRows.map(row => {
            const bucketAllocation = row.bucket === 'adult'
                ? (adultBaseTotal > 0 ? (row.baseBasis / adultBaseTotal) * adultMarkazPaid : 0)
                : (childBaseTotal > 0 ? (row.baseBasis / childBaseTotal) * childMarkazPaid : 0);
            const nagarAllocation = nagarTotal > 0 ? (row.nagarBasis / nagarTotal) * nagarMarkazPaid : 0;
            const allocatedToMarkaz = bucketAllocation + nagarAllocation;
            const rawNetBalance = Math.max(0, row.collected - allocatedToMarkaz);

            return {
                ...row,
                allocatedToMarkaz,
                rawNetBalance
            };
        });

        const rawNetTotal = rowsWithRawNet.reduce((sum, row) => sum + row.rawNetBalance, 0);

        return rowsWithRawNet
            .map(row => ({
                ...row,
                netBalance: rawNetTotal > 0 ? (row.rawNetBalance / rawNetTotal) * netBalanceInHand : 0
            }))
            .sort((a, b) => b.netBalance - a.netBalance);
    }, [tanzeemStats, specialRecords, deceasedStats, azafiStats, markazPayments, netBalanceInHand]);

    const currentCashDivision = useMemo(() => {
        let baligan = 0;
        let daftarAtfal = 0;
        let nagarParkar = 0;

        netBalanceBreakdown.forEach(row => {
            const basisTotal = row.baseBasis + row.nagarBasis;
            if (basisTotal <= 0) return;

            const nagarShare = row.netBalance * (row.nagarBasis / basisTotal);
            const baseShare = row.netBalance - nagarShare;

            if (row.bucket === 'adult') {
                baligan += baseShare;
            } else {
                daftarAtfal += baseShare;
            }

            nagarParkar += nagarShare;
        });

        const total = baligan + daftarAtfal + nagarParkar;
        if (total <= 0) {
            return { baligan: 0, daftarAtfal: 0, nagarParkar: 0 };
        }

        return {
            baligan: (baligan / total) * netBalanceInHand,
            daftarAtfal: (daftarAtfal / total) * netBalanceInHand,
            nagarParkar: (nagarParkar / total) * netBalanceInHand
        };
    }, [netBalanceBreakdown, netBalanceInHand]);

    const targetSectionStats = useMemo(() => {
        // Calculate Total Received for target tracking (Baligan Paid)
        const totalReceived = baliganStats.totalPaid;

        // Calculate Total Promised for target tracking (Baligan Promised)
        const totalPromised = baliganStats.totalPromised;

        return {
            totalReceived,
            totalPromised,
            gapFromPromise: Math.max(0, totalPromised - totalReceived),
            remainingFromTarget: targetAmount > 0 ? Math.max(0, targetAmount - totalPromised) : 0,
            receivedPercent: targetAmount > 0 ? (totalReceived / targetAmount) * 100 : 0,
            promisePercent: targetAmount > 0 ? (totalPromised / targetAmount) * 100 : 0
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
                </div>

                <div style="margin-bottom: 20px; font-size: 12px; direction: rtl; text-align: right; background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; padding: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #dee2e6; padding-bottom: 10px; margin-bottom: 10px;">
                        <span style="font-weight: bold; font-size: 14px;">خاندان کی تفصیلات</span>
                    </div>
                    <div style="display: flex; gap: 20px; justify-content: flex-end; flex-wrap: wrap;">
                         <div><strong>خاندان نمبر:</strong> ${family.familyNumber || 'N/A'}</div>
                         <div><strong>سربراہ:</strong> ${familyHead?.member.name || 'نامعلوم'}</div>
                         <div><strong>رابطہ نمبرِ سربراہ:</strong> ${headPhone}</div>
                    </div>
                </div>

                <!--Totals Summary Box-->
                <div style="margin-bottom: 25px; direction: rtl;">
                    <div style="display: flex; border: 1px solid #1890ff; border-radius: 8px; overflow: hidden;">
                        <div style="flex: 1; text-align: center; padding: 15px; border-left: 1px solid #e8e8e8; background-color: #e6f7ff;">
                            <div style="font-size: 12px; color: #595959; margin-bottom: 5px;">کل وعدہ شدہ رقم</div>
                            <div style="font-size: 18px; font-weight: bold; color: #1890ff;">روپے ${familyTotalPromise.toLocaleString()}</div>
                        </div>
                        <div style="flex: 1; text-align: center; padding: 15px; background-color: #f6ffed;">
                            <div style="font-size: 12px; color: #595959; margin-bottom: 5px;">کل ادا شدہ رقم</div>
                            <div style="font-size: 18px; font-weight: bold; color: #52c41a;">روپے ${familyTotalPaid.toLocaleString()}</div>
                        </div>
                        <div style="flex: 1; text-align: center; padding: 15px; border-right: 1px solid #e8e8e8; background-color: #fff7e6;">
                            <div style="font-size: 12px; color: #595959; margin-bottom: 5px;">بقیہ رقم</div>
                            <div style="font-size: 18px; font-weight: bold; color: #fa8c16;">روپے ${(familyTotalPromise - familyTotalPaid).toLocaleString()}</div>
                        </div>
                    </div>
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
<div style="margin-top: 15px; padding: 10px; background-color: #fafafa; border: 1px solid #ddd; border-radius: 5px; font-size: 10px; direction: rtl; text-align: right;">
    <div style="display: flex; flex-wrap: wrap; justify-content: flex-start; gap: 10px; align-items: center; direction: rtl;">
        <strong>اطفال/ناصرات:</strong>
        <span style="display: inline-flex; align-items: center; gap: 4px;"><div style="width: 12px; height: 12px; background-color: #e6f7ff; border: 1px solid #91d5ff;"></div> ≥ 1,000</span>
        <span style="display: inline-flex; align-items: center; gap: 4px;"><div style="width: 12px; height: 12px; background-color: #fff7e6; border: 1px solid #ffd591;"></div> < 1,000</span>
                                
        <strong style="margin-right: 15px;">دیگر:</strong>
        <span style="display: inline-flex; align-items: center; gap: 4px;"><div style="width: 12px; height: 12px; background-color: #f6ffed; border: 1px solid #b7eb8f;"></div> ≥ 5,000</span>
        <span style="display: inline-flex; align-items: center; gap: 4px;"><div style="width: 12px; height: 12px; background-color: #fff1f0; border: 1px solid #ffccc7;"></div> ≥ 2,500</span>
        <span style="display: inline-flex; align-items: center; gap: 4px;"><div style="width: 12px; height: 12px; background-color: #ffffff; border: 1px solid #d9d9d9;"></div> < 2,500</span>
    </div>
</div>

<h3 style="font-size: 14px; margin-top: 20px; margin-bottom: 10px; direction: rtl; text-align: right;">تفصیلاتِ ادائیگی</h3>
<table style="width: 100%; border-collapse: collapse; margin-bottom: 5px; font-size: 10px;" dir="rtl">
    <thead>
        <tr style="background-color: #3f8600; color: white;">
            <th style="border: 1px solid #ddd; padding: 6px; text-align: right; direction: rtl;">نام</th>
            <th style="border: 1px solid #ddd; padding: 6px; text-align: right; direction: rtl;">تاریخ</th>
            <th style="border: 1px solid #ddd; padding: 6px; text-align: center; direction: rtl;">رسید نمبر</th>
            <th style="border: 1px solid #ddd; padding: 6px; text-align: center; direction: rtl;">رقم</th>
            <th style="border: 1px solid #ddd; padding: 6px; text-align: right; direction: rtl;">نوٹ</th>
        </tr>
    </thead>
    <tbody>
        `;

            // Extract all payments for the family
            const allFamilyPayments: any[] = [];
            familyMembersCtx.forEach(item => {
                if (item.record && item.record.payments) {
                    item.record.payments.forEach(p => {
                        allFamilyPayments.push({
                            ...p,
                            memberName: item.member.name,
                            isSpecial: false
                        });
                    });
                }
            });

            familySpecialRecords.forEach(record => {
                if (record.payments) {
                    record.payments.forEach(p => {
                        allFamilyPayments.push({
                            ...p,
                            memberName: getUrduName(record.name) + (record.isDeceased ? (record.gender === 'female' ? ' (مرحومہ)' : ' (مرحوم)') : ''),
                            isSpecial: true
                        });
                    });
                }
            });

            // Sort payments by date descending
            allFamilyPayments.sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());

            if (allFamilyPayments.length > 0) {
                allFamilyPayments.forEach((payment, index) => {
                    const rowColor = index % 2 === 0 ? '#ffffff' : '#f9f9f9';
                    htmlContent += `
                    <tr style="background-color: ${rowColor};">
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: right; direction: rtl; unicode-bidi: embed;">${payment.memberName}</td>
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: right; direction: rtl;">${payment.date ? new Date(payment.date).toLocaleDateString() : 'N/A'}</td>
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${payment.receiptNo || '-'}</td>
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">Rs. ${(payment.amount || 0).toLocaleString()}</td>
                        <td style="border: 1px solid #ddd; padding: 6px; text-align: right; direction: rtl; unicode-bidi: embed; font-size: 9px;">${payment.notes || ''}</td>
                    </tr>
                `;
                });
            } else {
                htmlContent += `
                <tr>
                    <td colspan="5" style="border: 1px solid #ddd; padding: 10px; text-align: center; direction: rtl;">کوئی رسید موجود نہیں</td>
                </tr>
            `;
            }

            htmlContent += `
    </tbody>
</table>

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

    const handlePrintFamilyBluetooth = async (
        family: Family,
        familyTotalPromise: number,
        familyTotalPaid: number
    ) => {
        try {
            const headMember = allMembers.find(m => m.id === family.headId);
            const familyCandidates = allMembers.filter(m => m.familyId === family.id || family.memberIds?.includes(m.id));
            const fallbackHead = familyCandidates.sort((a, b) => (b.age || 0) - (a.age || 0))[0];
            const familyHead = headMember
                ? { member: headMember }
                : fallbackHead
                    ? { member: fallbackHead }
                    : getMemberData(family.headId);

            await printFamilyReceiptBluetooth({
                familyName: family.familyName || 'Unknown',
                familyNumber: family.familyNumber,
                headName: familyHead?.member.name,
                headPhone: familyHead?.member.phone,
                totalPromise: familyTotalPromise,
                totalPaid: familyTotalPaid,
                totalBalance: familyTotalPromise - familyTotalPaid
            });
        } catch (error) {
            console.error('Bluetooth print failed', error);
            message.error('Bluetooth print failed. Please pair printer and try again.');
        }
    };

    const handleExportMemberCard = async (memberData: any, isSpecial: boolean = false) => {
        try {
            message.loading({ content: 'Generating shareable card...', key: 'card-export' });

            const cardDiv = document.createElement('div');
            cardDiv.style.width = '340px';
            cardDiv.style.height = '520px';
            cardDiv.style.position = 'fixed';
            cardDiv.style.left = '-9999px';
            cardDiv.style.background = '#ffffff';
            cardDiv.style.color = '#0f172a';
            cardDiv.style.fontFamily = '"Noto Sans Arabic", Arial, sans-serif';
            cardDiv.style.padding = '24px';
            cardDiv.style.boxSizing = 'border-box';
            cardDiv.style.display = 'flex';
            cardDiv.style.flexDirection = 'column';
            cardDiv.style.justifyContent = 'flex-start';
            cardDiv.style.borderRadius = '20px';
            cardDiv.style.boxShadow = '0 18px 45px rgba(15,23,42,0.15)';

            const name = isSpecial ? memberData.name : memberData.member.name;
            const gender = isSpecial ? memberData.gender : memberData.member.gender;
            const honorific = gender === 'female' ? 'محترمہ' : 'محترم';
            const promised = isSpecial ? (memberData.promiseAmount || 0) + (memberData.nagarparAmount || 0) : memberData.promise;
            const paid = isSpecial ? memberData.paidAmount : memberData.paid;
            const balance = promised - paid;
            const percent = promised > 0 ? Math.min(100, Math.round((paid / promised) * 100)) : 0;

            cardDiv.innerHTML = `
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="margin: 0; font-size: 24px; color: #1d4ed8;">Waqf-e-Jadeed ${selectedYear}</h2>
                    <p style="margin: 6px 0 18px 0; color: #6b7280; font-size: 13px; letter-spacing: 0.06em;">Personal Collection Card</p>
                    <h1 style="margin: 0; font-size: 30px; direction: rtl; line-height: 1.3; color: #111827;">${honorific} ${getUrduName(name)}</h1>
                </div>

                <div style="background: #f9fafb; padding: 16px 16px 14px 16px; border-radius: 14px; box-shadow: 0 8px 22px rgba(15,23,42,0.06); border: 1px solid #e5e7eb; margin-bottom: 20px; color: #111827;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span style="color: #6b7280; font-size: 13px;">Promised (وعدہ)</span>
                        <span style="font-weight: 600; font-size: 15px;">Rs. ${promised.toLocaleString()}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <span style="color: #6b7280; font-size: 13px;">Paid (ادا شدہ)</span>
                        <span style="font-weight: 600; font-size: 15px; color: #16a34a;">Rs. ${paid.toLocaleString()}</span>
                    </div>
                    <div style="border-top: 1px solid #e5e7eb; margin: 10px 0 10px 0;"></div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 600; font-size: 14px;">Balance (بقیہ)</span>
                        <span style="font-weight: 700; font-size: 16px; color: ${balance > 0 ? '#dc2626' : '#16a34a'};">Rs. ${balance.toLocaleString()}</span>
                    </div>
                </div>

                <div style="text-align: center;">
                    <div style="width: 100%; height: 7px; background: #e5e7eb; border-radius: 999px; margin: 0 0 6px 0; overflow: hidden;">
                        <div style="width: ${percent}%; height: 100%; background: #16a34a;"></div>
                    </div>
                    <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: 600; color: #111827;">${percent}% Completed</p>
                    <p style="margin: 0; font-size: 10px; color: #6b7280; letter-spacing: 0.06em;">Generated on ${new Date().toLocaleDateString()} • Jamat Tajneed System</p>
                </div>
            `;

            document.body.appendChild(cardDiv);
            const canvas = await html2canvas(cardDiv, {
                scale: 3,
                backgroundColor: null,
                useCORS: true
            });
            document.body.removeChild(cardDiv);

            const link = document.createElement('a');
            link.download = `${name.replace(/\s+/g, '_')}_WJ_${selectedYear}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 0.95);
            link.click();

            message.success({ content: 'JPG card generated successfully!', key: 'card-export' });
        } catch (error) {
            console.error('Error generating card:', error);
            message.error({ content: 'Failed to generate JPG card', key: 'card-export' });
        }
    };
    const handleExportFamilyCard = async (family: Family, totalPromised: number, totalPaid: number) => {
        try {
            message.loading({ content: 'Generating card...', key: 'family-card', duration: 0 });

            const balance = totalPromised - totalPaid;
            const percent = totalPromised > 0 ? Math.round((totalPaid / totalPromised) * 100) : 0;

            const cardDiv = document.createElement('div');
            cardDiv.style.width = '400px';
            cardDiv.style.padding = '30px';
            cardDiv.style.background = 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)';
            cardDiv.style.color = '#ffffff';
            cardDiv.style.fontFamily = '"Noto Sans Arabic", Arial, sans-serif';
            cardDiv.style.borderRadius = '20px';
            cardDiv.style.position = 'fixed';
            cardDiv.style.left = '-9999px';
            cardDiv.style.top = '0';
            cardDiv.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.5)';

            cardDiv.innerHTML = `
                <div style="text-align: center; margin-bottom: 30px;">
                    <h2 style="margin: 0; color: #34d399; font-size: 24px; direction: rtl;">وقف جدید</h2>
                    <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.7;">Family Collection Summary ${selectedYear}</p>
                </div>

                <div style="margin-bottom: 30px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 20px;">
                    <p style="margin: 0; font-size: 14px; opacity: 0.7; text-transform: uppercase;">Family Name / سر براہ</p>
                    <h1 style="margin: 10px 0 0 0; font-size: 28px; font-weight: 800;">${family.familyName}</h1>
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
            <header className="families-header"><span className="section-eyebrow">COMMUNITY CONTRIBUTIONS</span><h1>Waqf-e-Jadeed</h1></header>
            {/* Search Header */}
            <Card className="waqf-toolbar" style={{ marginBottom: 16 }}>
                <Row gutter={[8, 8]} align="middle">
                    <Col xs={24} sm={12} md={8}>
                        <Text type="secondary">Contribution year & records</Text>
                    </Col>
                    <Col xs={12} sm={6} md={4}>
                        <Select
                            value={selectedYear}
                            onChange={setSelectedYear}
                            style={{ width: '100%' }}
                        >
                            {Array.from({ length: Math.max(4, new Date().getFullYear() - 2023 + 1) }, (_, index) => 2023 + index).map(y => (
                                <Option key={y} value={y}>{y}</Option>
                            ))}
                        </Select>
                    </Col>
                    <Col xs={12} sm={6} md={4}>
                        <Input
                            prefix={<SearchOutlined />}
                            placeholder="Search members or families"
                            aria-label="Search Waqf-e-Jadeed records"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            allowClear
                        />
                    </Col>
                    <Col xs={24} sm={24} md={8} style={{ textAlign: 'right' }}>
                        <Space wrap>
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
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    style={{ marginTop: 12 }}
                    type="line"
                    items={[
                        { key: 'dashboard', label: 'Dashboard' },
                        { key: 'families', label: 'Family Wise' },
                        { key: 'members', label: 'Members' },
                        { key: 'tanzeem', label: 'Tanzeem Wise' },
                        { key: 'reports', label: 'Reports' },
                        { key: 'about', label: 'About' }
                    ]}
                />

                <Modal rootClassName="waqf-finance-overlay"
                    title="Record Payment to Markaz"
                    open={markazModalVisible}
                    onCancel={() => setMarkazModalVisible(false)}
                    footer={null}
                >
                    <Form
                        form={markazForm}
                        layout="vertical"
                        onFinish={handleSaveMarkazPayment}
                        initialValues={{ paymentDate: dayjs() }}
                    >
                        <Form.Item name="amountWJ" label="Waqf-e-Jadeed (Alif)">
                            <InputNumber style={{ width: '100%' }} formatter={value => `Rs. ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={value => value!.replace(/Rs\.\s?|(,*)/g, '') as any} />
                        </Form.Item>
                        <Form.Item name="amountAtfal" label="Waqf-e-Jadeed (Atfal)">
                            <InputNumber style={{ width: '100%' }} formatter={value => `Rs. ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={value => value!.replace(/Rs\.\s?|(,*)/g, '') as any} />
                        </Form.Item>
                        <Form.Item name="amountNagarParkar" label="Imdad-e-Marakaz Nagar Parkar">
                            <InputNumber style={{ width: '100%' }} formatter={value => `Rs. ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={value => value!.replace(/Rs\.\s?|(,*)/g, '') as any} />
                        </Form.Item>
                        <Form.Item name="couponNo" label="Coupon Number" rules={[{ required: true, message: 'Please enter coupon number' }]}>
                            <Input placeholder="Enter coupon number" />
                        </Form.Item>
                        <Form.Item name="paymentDate" label="Date Sent" rules={[{ required: true, message: 'Please select date' }]}>
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name="notes" label="Notes (Optional)">
                            <Input.TextArea />
                        </Form.Item>
                        <Button type="primary" htmlType="submit" loading={submitting} block>
                            Save Record
                        </Button>
                    </Form>
                </Modal>
            </Card>



            {activeTab === 'members' ? (
                <Card className="waqf-members-panel">
                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text strong>Member Records ({filteredMemberData.length})</Text>
                        <Button
                            icon={<DownloadOutlined />}
                            onClick={handleExportMembersPDF}
                        >
                            Export Members PDF
                        </Button>
                    </div>
                    <div className="families-view-toolbar"><span className="families-view-label">Choose your view</span><Segmented value={memberView} onChange={value => setMemberView(value as 'cards' | 'list')} options={[{ value: 'cards', label: <span className="families-view-option"><LayoutGrid size={16} />Cards</span> }, { value: 'list', label: <span className="families-view-option"><ListIcon size={16} />List</span> }]} /></div>
                    {memberView === 'cards' ? <Spin spinning={loading}>
                        {!loading && filteredMemberData.length === 0 ? <Empty description="No member records found" /> : <div className="waqf-member-grid">{filteredMemberData.slice((membersCurrentPage - 1) * membersPageSize, membersCurrentPage * membersPageSize).map(item => <article className="waqf-member-card" key={item.member.id}>
                            <button className="waqf-member-open" onClick={() => handleEdit(item.member)}>
                                <div className="waqf-member-name"><strong dir="auto">{item.member.name}</strong><small>{item.member.age} yrs</small><ArrowRight size={17} /></div>
                                {item.member.fatherName && <span className="waqf-member-guardian">Father: {item.member.fatherName}</span>}
                                <span className="waqf-member-tanzeem">{getTanzeemDisplayName(item.member.tanzeem)}</span>
                                <div className="waqf-card-amounts"><div><span>Promised</span><strong>Rs. {item.promise.toLocaleString()}</strong></div><div><span>Paid</span><strong>Rs. {item.paid.toLocaleString()}</strong></div><div><span>{item.paid > item.promise ? 'Overpaid' : 'Remaining'}</span><strong>Rs. {Math.abs(item.promise - item.paid).toLocaleString()}</strong></div></div>
                                <Progress percent={item.promise > 0 ? Math.min(100, Math.round(item.paid / item.promise * 100)) : 0} size="small" strokeColor="#70a58a" />
                            </button>
                            <div className="waqf-card-footer"><span>{item.promise > 0 && item.paid >= item.promise ? 'Fully paid' : item.promise > 0 ? 'Payment pending' : 'No promise recorded'}</span><Button icon={<ShareAltOutlined />} title="Export member card" aria-label={`Export card for ${item.member.name}`} onClick={() => handleExportMemberCard(item)} /></div>
                        </article>)}</div>}
                        {filteredMemberData.length > 0 && <Pagination className="families-pagination" current={membersCurrentPage} pageSize={membersPageSize} total={filteredMemberData.length} responsive showSizeChanger pageSizeOptions={[10, 20, 50, 100]} showTotal={(total, range) => `${range[0]}–${range[1]} of ${total} members`} onChange={(page, size) => { setMembersCurrentPage(size !== membersPageSize ? 1 : page); setMembersPageSize(size); }} />}
                    </Spin> : <Table
                        size="small"
                        dataSource={filteredMemberData}
                        loading={loading}
                        rowKey={(record) => record.member.id}
                        pagination={{
                            current: membersCurrentPage,
                            pageSize: membersPageSize,
                            showSizeChanger: true,
                            pageSizeOptions: ['10', '20', '50', '100'],
                            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} members`,
                            onChange: (page, pageSize) => {
                                setMembersCurrentPage(page);
                                setMembersPageSize(pageSize);
                            }
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
                                title: 'Name',
                                key: 'name',
                                dataIndex: ['member', 'name'],
                                sorter: (a, b) => a.member.name.localeCompare(b.member.name),
                                render: (_, record) => (
                                    <div>
                                        <Text
                                            strong
                                            style={{
                                                fontSize: '14px',
                                                color: record.paid >= record.promise && record.promise > 0 ? '#52c41a' : undefined
                                            }}
                                        >
                                            {record.member.name}
                                        </Text>
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
                                    <Space>
                                        <Text strong style={{ fontSize: '14px' }}>
                                            Rs. {record.promise.toLocaleString()}
                                        </Text>
                                        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record.member)} />
                                    </Space>
                                ),
                                align: 'right'
                            },
                            {
                                title: 'NagarParker',
                                key: 'nagarpar',
                                sorter: (a, b) => (a.record?.nagarparAmount || 0) - (b.record?.nagarparAmount || 0),
                                render: (_, record) => (
                                    <Space>
                                        <Text strong style={{ fontSize: '14px' }}>
                                            Rs. {(record.record?.nagarparAmount || 0).toLocaleString()}
                                        </Text>
                                        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record.member)} />
                                    </Space>
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
                    />}
                </Card>
            ) : activeTab === 'families' ? (
                <div className={`family-list waqf-family-${familyView}`}>
                    <div className="families-view-toolbar"><span className="families-view-label">Family records</span><Segmented value={familyView} onChange={value => setFamilyView(value as 'cards' | 'list')} options={[{ value: 'cards', label: <span className="families-view-option"><LayoutGrid size={16} />Cards</span> }, { value: 'list', label: <span className="families-view-option"><ListIcon size={16} />List</span> }]} /></div>
                    <Card style={{ marginBottom: 16, background: '#fafafa', border: '1px solid #d9d9d9' }} styles={{ body: { padding: '12px 24px' } }}>
                        <Row gutter={[48, 16]} align="middle">
                            <Col>
                                <Statistic
                                    title={<Text type="secondary">Total Promised (Filtered)</Text>}
                                    value={filteredFamilyData.reduce((acc, curr) => acc + curr.totalPromise, 0)}
                                    prefix="Rs."
                                    precision={0}
                                    valueStyle={{ color: '#1890ff', fontWeight: 'bold', fontSize: '20px' }}
                                />
                            </Col>
                            <Col>
                                <Divider type="vertical" style={{ height: '40px', backgroundColor: '#d9d9d9' }} />
                            </Col>
                            <Col>
                                <Statistic
                                    title={<Text type="secondary">Total Paid (Filtered)</Text>}
                                    value={filteredFamilyData.reduce((acc, curr) => acc + (curr.totalPaid || 0), 0)}
                                    prefix="Rs."
                                    precision={0}
                                    valueStyle={{ color: '#52c41a', fontWeight: 'bold', fontSize: '20px' }}
                                />
                            </Col>
                            <Col>
                                <Divider type="vertical" style={{ height: '40px', backgroundColor: '#d9d9d9' }} />
                            </Col>
                            <Col>
                                <Statistic
                                    title={<Text type="secondary">Family Count</Text>}
                                    value={filteredFamilyData.length}
                                    prefix={<UserOutlined />}
                                    valueStyle={{ color: '#595959', fontWeight: 'bold', fontSize: '20px' }}
                                />
                            </Col>
                        </Row>
                    </Card>

                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                        <Space size="middle">
                            <Text strong>Active Families ({families.filter(f => !f.isMoved).length})</Text>
                            <Select
                                value={familySort}
                                onChange={setFamilySort}
                                style={{ width: 220 }}
                                options={[
                                    { value: 'default', label: 'Default (By Family #)' },
                                    { value: 'zero_promise_first', label: 'Zero Promises First' },
                                    { value: 'pending_first', label: 'Pending First, 100% Last' },
                                ]}
                            />
                        </Space>
                        <Space>
                            <Button
                                icon={<DownloadOutlined />}
                                onClick={handleExportFamilySummaryPDF}
                            >
                                Families Summary PDF
                            </Button>
                            <Button
                                icon={<DownloadOutlined />}
                                onClick={handleExportFamiliesBalancePDF}
                            >
                                Families with Balance
                            </Button>
                            <Button
                                icon={<DownloadOutlined />}
                                onClick={handleExportFamilyFitranaEid}
                            >
                                Family Fitrana/Eid Export
                            </Button>
                        </Space>
                    </div>
                    {loading ? <p>Loading...</p> : (
                        <Collapse
                            expandIcon={() => null}
                            defaultActiveKey={[]}
                            ghost
                            items={filteredFamilyData.map(family => {
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

                                return {
                                    key: family.id,
                                    label: (
                                        <div className="waqf-family-summary">
                                            <div className="waqf-family-identity">
                                                <span className="waqf-family-number">{family.familyNumber ? `Family #${family.familyNumber}` : 'Family record'}</span>
                                                <Text
                                                    strong
                                                    style={{
                                                        fontSize: 'clamp(14px, 3.5vw, 16px)',
                                                        color: '#26334a'
                                                    }}
                                                >
                                                    {family.familyName}
                                                </Text>
                                                {family.isMoved && family.movedTo && (
                                                    <Tag color="orange" style={{ marginLeft: 8 }}>Moved to {family.movedTo}</Tag>
                                                )}
                                                <Text type="secondary" style={{ fontSize: 'clamp(11px, 2.5vw, 12px)' }}>
                                                    Head: {getMemberData(family.headId)?.member.name || 'Not recorded'}
                                                </Text>
                                            </div>
                                            <div className="waqf-card-amounts"><div><span>Promised</span><strong>Rs. {familyTotalPromise.toLocaleString()}</strong></div><div><span>Paid</span><strong>Rs. {familyTotalPaid.toLocaleString()}</strong></div><div><span>{familyTotalPaid > familyTotalPromise ? 'Overpaid' : 'Remaining'}</span><strong>Rs. {Math.abs(familyTotalPromise - familyTotalPaid).toLocaleString()}</strong></div></div>
                                            <Progress percent={Math.min(100, familyPercent)} size="small" strokeColor="#70a58a" />
                                            <div className="waqf-family-card-footer">
                                                <span>{familyMembersCtx.length + familySpecialRecords.length} members</span>
                                                <Space>
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
                                                        icon={<PrinterOutlined />}
                                                        size="small"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handlePrintFamilyBluetooth(
                                                                family,
                                                                familyTotalPromise,
                                                                familyTotalPaid
                                                            );
                                                        }}
                                                        title="Print via Bluetooth"
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
                                            </div>
                                        </div>
                                    ),
                                    children: (
                                        <>
                                            <Table
                                                size="small"
                                                dataSource={familyMembersCtx.filter(item => item !== null)}
                                                rowKey={(item) => item.member.id}
                                                pagination={{
                                                    current: familyMembersCurrentPage[family.id] || 1,
                                                    pageSize: familyMembersPageSize[family.id] || 10,
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
                                                columns={[
                                                    { title: '#', key: 'index', width: 50, render: (_, __, i) => i + 1 },
                                                    {
                                                        title: 'Name',
                                                        dataIndex: ['member', 'name'],
                                                        key: 'name',
                                                        render: (text, record) => (
                                                            <span style={{ color: record.paid >= record.promise && record.promise > 0 ? '#52c41a' : undefined }}>
                                                                {text} ({record.member.gender === 'female' ? 'F' : 'M'})
                                                                {record.member.tanzeem && <Tag color="blue" style={{ marginLeft: 5 }}>{record.member.tanzeem}</Tag>}
                                                            </span>
                                                        )
                                                    },
                                                    {
                                                        title: 'Promise',
                                                        dataIndex: 'originalPromise',
                                                        key: 'originalPromise',
                                                        render: (val, record) => (
                                                            <Space>
                                                                {`Rs. ${val.toLocaleString()}`}
                                                                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record.member)} />
                                                            </Space>
                                                        )
                                                    },
                                                    {
                                                        title: 'NagarParker',
                                                        dataIndex: 'nagarpar',
                                                        key: 'nagarpar',
                                                        render: (val, record) => (
                                                            <Space>
                                                                {`Rs. ${val.toLocaleString()}`}
                                                                <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record.member)} />
                                                            </Space>
                                                        )
                                                    },
                                                    { title: 'Paid', dataIndex: 'paid', key: 'paid', render: (val, record) => <span style={{ color: val >= record.promise && record.promise > 0 ? 'green' : undefined }}>Rs. {val.toLocaleString()}</span> },
                                                    { title: 'Progress', key: 'progress', render: (_, record) => <Progress percent={record.promise > 0 ? Math.round((record.paid / record.promise) * 100) : 0} size="small" steps={5} strokeColor={record.paid >= record.promise ? '#52c41a' : '#1890ff'} /> },
                                                    {
                                                        title: 'Actions',
                                                        key: 'actions',
                                                        width: 120,
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
                                                        )
                                                    }
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
                                                        current: familySpecialCurrentPage[family.id] || 1,
                                                        pageSize: familySpecialPageSize[family.id] || 10,
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
                                                        render: (_, record) => (record?.promiseAmount || 0).toLocaleString(),
                                                    },
                                                    {
                                                        title: 'NagarParker',
                                                        key: 'nagarpar',
                                                        width: 100,
                                                        render: (_, record) => (record?.nagarparAmount || 0).toLocaleString(),
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
                                        </>
                                    )
                                };
                            })}
                        />

                    )}
                </div >
            ) : activeTab === 'tanzeem' ? (
                <div className="tanzeem-list">
                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <Text strong>Tanzeem Wise Breakdown ({tanzeemGroupedData.length} Groups)</Text>
                        <Space wrap>
                            <Button
                                icon={<DownloadOutlined />}
                                onClick={handleExport100PercentPaidPDF}
                            >
                                Export 100% Paid
                            </Button>
                            <Button
                                icon={<DownloadOutlined />}
                                onClick={handleExportTanzeemWisePDF}
                            >
                                Export Tanzeem PDF
                            </Button>
                            <Button
                                icon={<WarningOutlined />}
                                danger
                                onClick={handleExportUnpaidMembersPDF}
                            >
                                Export Unpaid List
                            </Button>
                            <Button
                                icon={<FilePdfOutlined />}
                                onClick={handleExportDaftarAtfalPDF}
                            >
                                Export Daftar Atfal PDF
                            </Button>
                        </Space>
                    </div>
                    {loading ? <p>Loading...</p> : (
                        <Collapse className="waqf-tanzeem-grid" expandIcon={() => null} defaultActiveKey={[]} ghost>
                            {tanzeemGroupedData.map(group => {
                                return (
                                    <Panel
                                        key={group.tanzeem}
                                        header={
                                            <div className="waqf-tanzeem-summary">
                                                <div className="waqf-tanzeem-title"><strong>{getTanzeemDisplayName(group.tanzeem as any)}</strong><span>{group.count} members</span></div>
                                                <div className="waqf-card-amounts"><div><span>Promised</span><strong>Rs. {group.totalPromise.toLocaleString()}</strong></div><div><span>Paid</span><strong>Rs. {group.totalPaid.toLocaleString()}</strong></div><div><span>{group.totalPaid > group.totalPromise ? 'Overpaid' : 'Remaining'}</span><strong>Rs. {Math.abs(group.totalPromise - group.totalPaid).toLocaleString()}</strong></div></div>
                                                <Progress percent={Math.min(100, group.percent)} size="small" strokeColor="#70a58a" />
                                            </div>
                                        }
                                    >
                                        {/* Table for Tanzeem Members */}
                                        <Table
                                            size="small"
                                            dataSource={group.members.filter(item => item !== null)}
                                            rowKey={(item) => item.member.id}
                                            pagination={{
                                                current: tanzeemMembersCurrentPage[group.tanzeem] || 1,
                                                pageSize: tanzeemMembersPageSize[group.tanzeem] || 10,
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
                    allRecords={records}
                    families={families}
                />
            ) : activeTab === 'dashboard' ? (
                <div className="dashboard-view">
                    <div className="waqf-dashboard-heading"><div><span className="section-eyebrow">COLLECTION OVERVIEW</span><h2>{selectedYear} Dashboard</h2></div><Space wrap><Button icon={<FilePdfOutlined />} onClick={handleExportDashboard} loading={loading}>Export summary</Button><Button onClick={() => setActiveTab('families')}>View families</Button></Space></div>
                    <div className="waqf-dashboard-summary">
                        <Card><Statistic title="Total promised" value={stats.totalPromise} prefix="Rs." precision={0} /><span className="waqf-dashboard-caption">All categories including Nagar Parkar</span></Card>
                        <Card><Statistic title="Total collected" value={stats.totalPaid} prefix="Rs." precision={0} valueStyle={{ color: '#508b73' }} /><span className="waqf-dashboard-caption">{stats.percent.toFixed(1)}% of promises received</span></Card>
                        <Card><Statistic title={stats.totalPaid > stats.totalPromise ? 'Above promise' : 'Outstanding promises'} value={Math.abs(stats.totalPromise - stats.totalPaid)} prefix="Rs." precision={0} /><span className="waqf-dashboard-caption">Difference between promised and collected</span></Card>
                        <Card className="waqf-dashboard-balance"><button onClick={() => setNetBalanceBreakdownVisible(true)}><Statistic title="Balance in hand" value={netBalanceInHand} prefix="Rs." precision={0} valueStyle={{ color: '#345eae' }} /><span className="waqf-dashboard-caption">After Rs. {totalMarkazPaid.toLocaleString()} paid to Markaz · View split →</span></button></Card>
                    </div>
                    <div className="waqf-dashboard-progress"><div><strong>Collection progress</strong><span>{stats.percent.toFixed(1)}% received</span></div><Progress percent={Math.min(100, Math.max(0, stats.percent))} showInfo={false} strokeColor="#70a58a" /><p>{stats.totalPromise > 0 ? stats.totalPaid >= stats.totalPromise ? 'Overall promises have been collected.' : `Rs. ${(stats.totalPromise - stats.totalPaid).toLocaleString()} remains to collect.` : 'No promises recorded for this year yet.'}</p></div>
                    {/* Target Tracking Section */}
                    <div className="waqf-target-section">
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
                                        Progress (Promises): {targetSectionStats.promisePercent.toFixed(1)}%
                                    </Text>
                                    <Progress
                                        percent={Math.round(targetSectionStats.promisePercent)}
                                        size="small"
                                        status={targetSectionStats.promisePercent >= 100 ? "success" : "active"}
                                        strokeColor={targetSectionStats.promisePercent >= 100 ? "#52c41a" : "#1890ff"}
                                    />
                                </div>
                            </Col>
                            <Col xs={24} sm={12} md={6}>
                                <Card styles={{ body: { padding: 16 } }} hoverable>
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
                                <Card styles={{ body: { padding: 16 } }} hoverable>
                                    <Tooltip title="Total amount actually received (paid) from Daftar Baligan promises">
                                        <Statistic
                                            title={<span style={{ fontSize: '12px' }}>Total Received (Baligan)</span>}
                                            value={targetSectionStats.totalReceived}
                                            prefix="Rs."
                                            precision={0}
                                            valueStyle={{ fontSize: 'clamp(18px, 4vw, 24px)', color: '#3f8600' }}
                                        />
                                    </Tooltip>
                                </Card>
                            </Col>
                            <Col xs={24} sm={12} md={6}>
                                <Card styles={{ body: { padding: 16 } }} hoverable>
                                    <Tooltip title="Outstanding amount yet to be collected from Baligan promises already made">
                                        <Statistic
                                            title={<span style={{ fontSize: '12px' }}>Gap (Promised - Received)</span>}
                                            value={targetSectionStats.gapFromPromise}
                                            prefix="Rs."
                                            precision={0}
                                            valueStyle={{
                                                fontSize: 'clamp(18px, 4vw, 24px)',
                                                color: targetSectionStats.gapFromPromise <= 0 ? '#3f8600' : '#cf1322'
                                            }}
                                        />
                                    </Tooltip>
                                </Card>
                            </Col>
                            <Col xs={24} sm={12} md={6}>
                                <Card styles={{ body: { padding: 16 } }} hoverable>
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
                                        <Card hoverable styles={{ body: { padding: 12 } }}>
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
                            <Col xs={24} md={12}>
                                <Row gutter={[16, 16]}>
                                    <Col span={12}>
                                        <Tooltip title="Total for Atfal and Saf-e-Awal (Boys)">
                                            <Card hoverable styles={{ body: { padding: 16, background: '#f6ffed' } }}>
                                                <Statistic
                                                    title={<span style={{ fontWeight: 600, color: '#389e0d' }}>Daftar Atfal (Male)</span>}
                                                    value={dafarAtfalStats.male.paid}
                                                    prefix="Rs."
                                                    precision={0}
                                                    valueStyle={{ fontSize: '18px', color: '#389e0d' }}
                                                />
                                                <div style={{ marginTop: 8 }}>
                                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                                        Promise: Rs. {dafarAtfalStats.male.promise.toLocaleString()}
                                                    </Text>
                                                </div>
                                                <Progress
                                                    percent={dafarAtfalStats.male.promise > 0 ? Math.round((dafarAtfalStats.male.paid / dafarAtfalStats.male.promise) * 100) : 0}
                                                    strokeColor="#52c41a"
                                                    size="small"
                                                />
                                            </Card>
                                        </Tooltip>
                                    </Col>
                                    <Col span={12}>
                                        <Tooltip title="Total for Nasirat and Saf-e-Awal Girls">
                                            <Card hoverable styles={{ body: { padding: 16, background: '#fff0f6' } }}>
                                                <Statistic
                                                    title={<span style={{ fontWeight: 600, color: '#c41d7f' }}>Daftar Atfal (Female)</span>}
                                                    value={dafarAtfalStats.female.paid}
                                                    prefix="Rs."
                                                    precision={0}
                                                    valueStyle={{ fontSize: '18px', color: '#c41d7f' }}
                                                />
                                                <div style={{ marginTop: 8 }}>
                                                    <Text type="secondary" style={{ fontSize: '12px' }}>
                                                        Promise: Rs. {dafarAtfalStats.female.promise.toLocaleString()}
                                                    </Text>
                                                </div>
                                                <Progress
                                                    percent={dafarAtfalStats.female.promise > 0 ? Math.round((dafarAtfalStats.female.paid / dafarAtfalStats.female.promise) * 100) : 0}
                                                    strokeColor="#eb2f96"
                                                    size="small"
                                                />
                                            </Card>
                                        </Tooltip>
                                    </Col>
                                </Row>
                            </Col>
                            <Col xs={24} md={12}>
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
                                                <Card styles={{ body: { padding: 12 } }}>
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
                        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                            <Col xs={24} sm={12} md={8}>
                                <Tooltip title="Boys under 7 (Saf-e-Awal) whose promise + Nagar Parkar is Rs. 1000 or more">
                                    <Card hoverable styles={{ body: { padding: 16, background: '#e6f7ff' } }}>
                                        <Statistic
                                            title={<span style={{ fontWeight: 600, color: '#0958d9' }}>Under 7 Boys ≥ Rs. 1000</span>}
                                            value={under7MinPromiseStats.male.count}
                                            valueStyle={{ fontSize: '20px', color: '#0958d9' }}
                                        />
                                        <div style={{ marginTop: 8 }}>
                                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                                Promise: Rs. {under7MinPromiseStats.male.promise.toLocaleString()} | Paid: Rs. {under7MinPromiseStats.male.paid.toLocaleString()}
                                            </Text>
                                        </div>
                                    </Card>
                                </Tooltip>
                            </Col>
                            <Col xs={24} sm={12} md={8}>
                                <Tooltip title="Girls under 7 (Saf-e-Awal Girls) whose promise + Nagar Parkar is Rs. 1000 or more">
                                    <Card hoverable styles={{ body: { padding: 16, background: '#fff0f6' } }}>
                                        <Statistic
                                            title={<span style={{ fontWeight: 600, color: '#c41d7f' }}>Under 7 Girls ≥ Rs. 1000</span>}
                                            value={under7MinPromiseStats.female.count}
                                            valueStyle={{ fontSize: '20px', color: '#c41d7f' }}
                                        />
                                        <div style={{ marginTop: 8 }}>
                                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                                Promise: Rs. {under7MinPromiseStats.female.promise.toLocaleString()} | Paid: Rs. {under7MinPromiseStats.female.paid.toLocaleString()}
                                            </Text>
                                        </div>
                                    </Card>
                                </Tooltip>
                            </Col>
                            <Col xs={24} md={8}>
                                <Tooltip title="Total under-7 members (both boys and girls) whose promise + Nagar Parkar is Rs. 1000 or more">
                                    <Card hoverable styles={{ body: { padding: 16, background: '#f6ffed' } }}>
                                        <Statistic
                                            title={<span style={{ fontWeight: 600, color: '#389e0d' }}>Under 7 Total ≥ Rs. 1000</span>}
                                            value={under7MinPromiseStats.total.count}
                                            valueStyle={{ fontSize: '20px', color: '#389e0d' }}
                                        />
                                        <div style={{ marginTop: 8 }}>
                                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                                Promise: Rs. {under7MinPromiseStats.total.promise.toLocaleString()} | Paid: Rs. {under7MinPromiseStats.total.paid.toLocaleString()}
                                            </Text>
                                        </div>
                                    </Card>
                                </Tooltip>
                            </Col>
                        </Row>
                        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                            <Col xs={24} sm={12} md={8}>
                                <Tooltip title="Boys 7-15 (Atfal) whose promise + Nagar Parkar is Rs. 1000 or more">
                                    <Card hoverable styles={{ body: { padding: 16, background: '#e6f7ff' } }}>
                                        <Statistic
                                            title={<span style={{ fontWeight: 600, color: '#0958d9' }}>7-15 Boys ≥ Rs. 1000</span>}
                                            value={age7to15MinPromiseStats.male.count}
                                            valueStyle={{ fontSize: '20px', color: '#0958d9' }}
                                        />
                                        <div style={{ marginTop: 8 }}>
                                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                                Promise: Rs. {age7to15MinPromiseStats.male.promise.toLocaleString()} | Paid: Rs. {age7to15MinPromiseStats.male.paid.toLocaleString()}
                                            </Text>
                                        </div>
                                    </Card>
                                </Tooltip>
                            </Col>
                            <Col xs={24} sm={12} md={8}>
                                <Tooltip title="Girls 7-15 (Nasirat) whose promise + Nagar Parkar is Rs. 1000 or more">
                                    <Card hoverable styles={{ body: { padding: 16, background: '#fff0f6' } }}>
                                        <Statistic
                                            title={<span style={{ fontWeight: 600, color: '#c41d7f' }}>7-15 Girls ≥ Rs. 1000</span>}
                                            value={age7to15MinPromiseStats.female.count}
                                            valueStyle={{ fontSize: '20px', color: '#c41d7f' }}
                                        />
                                        <div style={{ marginTop: 8 }}>
                                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                                Promise: Rs. {age7to15MinPromiseStats.female.promise.toLocaleString()} | Paid: Rs. {age7to15MinPromiseStats.female.paid.toLocaleString()}
                                            </Text>
                                        </div>
                                    </Card>
                                </Tooltip>
                            </Col>
                            <Col xs={24} md={8}>
                                <Tooltip title="Total 7-15 year old members (both boys and girls) whose promise + Nagar Parkar is Rs. 1000 or more">
                                    <Card hoverable styles={{ body: { padding: 16, background: '#f6ffed' } }}>
                                        <Statistic
                                            title={<span style={{ fontWeight: 600, color: '#389e0d' }}>7-15 Total ≥ Rs. 1000</span>}
                                            value={age7to15MinPromiseStats.total.count}
                                            valueStyle={{ fontSize: '20px', color: '#389e0d' }}
                                        />
                                        <div style={{ marginTop: 8 }}>
                                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                                Promise: Rs. {age7to15MinPromiseStats.total.promise.toLocaleString()} | Paid: Rs. {age7to15MinPromiseStats.total.paid.toLocaleString()}
                                            </Text>
                                        </div>
                                    </Card>
                                </Tooltip>
                            </Col>
                        </Row>
                    </div>

                    {/* Nagar Parkar Section */}
                    <div style={{ marginBottom: '24px' }}>
                        <Divider orientation="left">Nagar Parkar Section</Divider>
                        <Row gutter={[16, 16]}>
                            <Col xs={24} sm={12} md={8}>
                                <Tooltip title="Total promises and collections for Nagar Parkar fund">
                                    <Card hoverable styles={{ body: { padding: 16, borderLeft: '4px solid #fa8c16' } }}>
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
                                <Card hoverable styles={{ body: { padding: 16 } }}>
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
                                <Card hoverable styles={{ body: { padding: 16 } }}>
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
                                <Card hoverable styles={{ body: { padding: 16 } }}>
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
                                <Card hoverable styles={{ body: { padding: 16 } }}>
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

                    {/* Markaz Payments Section */}
                    <Divider orientation="left" style={{ margin: '32px 0 16px' }}>Markaz Payments & Net Balance</Divider>
                    <div style={{ background: '#f0f5ff', padding: '24px', borderRadius: '8px', marginBottom: '24px', border: '1px solid #adc6ff' }}>
                        <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 24 }}>
                            <Col xs={24} sm={12}>
                                <Title level={4} style={{ margin: 0 }}>Markaz Payment Records</Title>
                            </Col>
                            <Col xs={24} sm={12} style={{ textAlign: 'right' }}>
                                <Button type="primary" onClick={() => setMarkazModalVisible(true)} icon={<PlusOutlined />}>
                                    Record Markaz Payment
                                </Button>
                            </Col>
                        </Row>

                        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                            <Col xs={24} sm={8}>
                                <Statistic title="Total Collected" value={stats.totalPaid} prefix="Rs." />
                            </Col>
                            <Col xs={24} sm={8}>
                                <Statistic
                                    title="Paid to Markaz"
                                    value={totalMarkazPaid}
                                    prefix="Rs."
                                    valueStyle={{ color: '#cf1322' }}
                                />
                            </Col>
                            <Col xs={24} sm={8}>
                                <div
                                    onClick={() => setNetBalanceBreakdownVisible(true)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            setNetBalanceBreakdownVisible(true);
                                        }
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    style={{ cursor: 'pointer', borderRadius: 8, padding: '8px 12px', border: '1px dashed #95de64', background: '#f6ffed', height: '100%' }}
                                >
                                    <Statistic
                                        title="Net Balance in Hand"
                                        value={netBalanceInHand}
                                        prefix="Rs."
                                        valueStyle={{ color: '#3f8600', fontWeight: 'bold' }}
                                    />
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        Click to view tanzeem-wise split
                                    </Text>
                                </div>
                            </Col>
                        </Row>

                        <Table
                            dataSource={markazPayments}
                            rowKey="id"
                            size="small"
                            pagination={{ pageSize: 5 }}
                            style={{ background: '#fff' }}
                            columns={[
                                { title: 'Date', dataIndex: 'paymentDate', render: (d: string) => new Date(d).toLocaleDateString() },
                                { title: 'Coupon No', dataIndex: 'couponNo' },
                                { title: 'WJ (Alif)', dataIndex: 'amountWJ', render: (v: number) => `Rs. ${(v || 0).toLocaleString()}` },
                                { title: 'WJ (Atfal)', dataIndex: 'amountAtfal', render: (v: number) => `Rs. ${(v || 0).toLocaleString()}` },
                                { title: 'N. Parkar', dataIndex: 'amountNagarParkar', render: (v: number) => `Rs. ${(v || 0).toLocaleString()}` },
                                { title: 'Total', key: 'total', render: (_, r) => `Rs. ${((r.amountWJ || 0) + (r.amountAtfal || 0) + (r.amountNagarParkar || 0)).toLocaleString()}` },
                                { title: 'Notes', dataIndex: 'notes' },
                                {
                                    title: 'Action',
                                    key: 'action',
                                    render: (_, r) => (
                                        <Popconfirm title="Delete?" onConfirm={() => handleDeleteMarkazPayment(r.id)}>
                                            <Button type="text" danger icon={<DeleteOutlined />} />
                                        </Popconfirm>
                                    )
                                }
                            ]}
                        />
                    </div>
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
            <Drawer rootClassName="waqf-finance-overlay"
                title={`Edit: ${editingMember ? editingMember.name : editingSpecial ? editingSpecial.name : ''}`}
                placement="bottom"
                height="70vh"
                onClose={() => setDrawerVisible(false)}
                open={drawerVisible}
                extra={
                    <Space>
                        <Button
                            icon={<FilePdfOutlined />}
                            onClick={() => {
                                if (editingMember) {
                                    const data = filteredMemberData.find(m => m.member.id === editingMember.id);
                                    if (data) handleExportMemberCard(data);
                                } else if (editingSpecial) {
                                    handleExportMemberCard(editingSpecial, true);
                                }
                            }}
                            size="small"
                        >
                            Export Card
                        </Button>
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
                                                    <Option key={book.id} value={book.id}>{book.bookNo} ({book.isDefault ? 'Default · ' : ''}{book.status})</Option>
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
                                    existingMembers={members}
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
            <Modal rootClassName="waqf-finance-overlay"
                title="Net Balance in Hand Breakdown"
                open={netBalanceBreakdownVisible}
                onCancel={() => setNetBalanceBreakdownVisible(false)}
                footer={null}
                width={820}
            >
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col xs={24} md={8}>
                        <Card size="small" bordered style={{ background: '#fafafa' }}>
                            <Statistic
                                title="Baligan"
                                value={currentCashDivision.baligan}
                                prefix="Rs."
                                precision={0}
                                valueStyle={{ color: '#1f1f1f' }}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} md={8}>
                        <Card size="small" bordered style={{ background: '#fafafa' }}>
                            <Statistic
                                title="Daftar Atfal"
                                value={currentCashDivision.daftarAtfal}
                                prefix="Rs."
                                precision={0}
                                valueStyle={{ color: '#1f1f1f' }}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} md={8}>
                        <Card size="small" bordered style={{ background: '#fafafa' }}>
                            <Statistic
                                title="Nagar Parkar"
                                value={currentCashDivision.nagarParkar}
                                prefix="Rs."
                                precision={0}
                                valueStyle={{ color: '#1f1f1f' }}
                            />
                        </Card>
                    </Col>
                </Row>
                <Table
                    dataSource={netBalanceBreakdown}
                    rowKey="key"
                    pagination={false}
                    size="small"
                    columns={[
                        { title: 'Tanzeem / Group', dataIndex: 'label', key: 'label' },
                        { title: 'Members', dataIndex: 'memberCount', key: 'memberCount', width: 100 },
                        { title: 'Allocated to Markaz', dataIndex: 'allocatedToMarkaz', key: 'allocatedToMarkaz', align: 'right' as const, render: (value: number) => `Rs. ${Math.round(value).toLocaleString()}` },
                        { title: 'Net in Hand', dataIndex: 'netBalance', key: 'netBalance', align: 'right' as const, render: (value: number) => <Text strong style={{ color: '#237804' }}>Rs. {Math.round(value).toLocaleString()}</Text> }
                    ]}
                    summary={(pageData) => {
                        const totalAllocated = pageData.reduce((sum, row) => sum + row.allocatedToMarkaz, 0);
                        const totalNet = pageData.reduce((sum, row) => sum + row.netBalance, 0);

                        return (
                            <Table.Summary.Row>
                                <Table.Summary.Cell index={0}><Text strong>Total</Text></Table.Summary.Cell>
                                <Table.Summary.Cell index={1}>{pageData.reduce((sum, row) => sum + row.memberCount, 0)}</Table.Summary.Cell>
                                <Table.Summary.Cell index={2} align="right"><Text strong>Rs. {Math.round(totalAllocated).toLocaleString()}</Text></Table.Summary.Cell>
                                <Table.Summary.Cell index={3} align="right"><Text strong style={{ color: '#237804' }}>Rs. {Math.round(totalNet).toLocaleString()}</Text></Table.Summary.Cell>
                            </Table.Summary.Row>
                        );
                    }}
                />
                <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
                    The summary above shows the current cash in hand split into Baligan, Daftar Atfal, and Nagar Parkar. The table below shows how that same in-hand amount is distributed tanzeem-wise.
                </Text>
            </Modal>
            <Modal rootClassName="waqf-finance-overlay"
                title="Print Receipt"
                open={!!printingPayment}
                onCancel={() => setPrintingPayment(null)}
                footer={
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
                        <Button onClick={() => setPrintingPayment(null)}>Close</Button>
                        <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Print A4</Button>
                    </div>
                }
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
            <Modal rootClassName="waqf-finance-overlay"
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
            <Modal rootClassName="waqf-finance-overlay"
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

            <Modal rootClassName="waqf-finance-overlay"
                title="Manage Receipt Books" width={720}
                open={manageBooksModalVisible}
                onCancel={() => setManageBooksModalVisible(false)}
                footer={null}
            >
                <div className="receipt-books-summary"><span><strong>{books.length}</strong> books</span><span>Totals for <strong>{selectedYear}</strong></span></div>
                <div className="receipt-book-grid">{books.map(book => {
                    const payments = Array.from(new Map(allPayments.filter(payment => payment.bookId === book.id || (!payment.bookId && payment.bookNo === book.bookNo)).map(payment => [payment.id, payment])).values());
                    const total = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
                    const receipts = new Set(payments.map(payment => payment.receiptNo != null ? String(payment.receiptNo) : payment.id)).size;
                    return <div className={`receipt-book-card ${book.isDefault ? 'default-book' : ''}`} key={book.id}>
                        <div className="receipt-book-heading"><strong>{book.bookNo}</strong><Space size={4}>{book.isDefault && <Tag color="blue">Default</Tag>}<Tag>{book.status === 'active' ? 'Active' : 'Completed'}</Tag></Space></div>
                        <div className="receipt-book-total"><span>Total collected</span><strong>{loading ? 'Loading…' : `Rs. ${total.toLocaleString()}`}</strong><small>{receipts} receipts · {payments.length} payments · {selectedYear}</small></div>
                        {editingBookId === book.id && <Input aria-label="Edit book number" value={editingBookName} onChange={event => setEditingBookName(event.target.value)} />}
                        <div className="receipt-book-actions">
                            <Button disabled={book.isDefault || book.status !== 'active' || savingDefaultBook !== null} loading={savingDefaultBook === book.id} onClick={() => handleDefaultBook(book.id)}>{book.isDefault ? 'Default book' : 'Set default'}</Button>
                            {editingBookId === book.id ? <><Button onClick={() => handleUpdateBook(book.id)}>Save</Button><Button onClick={() => setEditingBookId(null)}>Cancel</Button></> : <Button icon={<EditOutlined />} title="Edit book number" aria-label={`Edit book ${book.bookNo}`} onClick={() => { setEditingBookId(book.id); setEditingBookName(book.bookNo); }} />}
                            <Popconfirm title="Delete book?" onConfirm={() => handleDeleteBook(book.id)} okText="Delete" cancelText="Cancel"><Button danger icon={<DeleteOutlined />} aria-label={`Delete book ${book.bookNo}`} /></Popconfirm>
                        </div>
                    </div>;
                })}</div>
                {!books.length && <Empty description="No receipt books yet" />}
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
