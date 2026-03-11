import React, { useState, useEffect } from 'react';
import {
  Card,
  Select,
  Button,
  Table,
  Space,
  Tag,
  Statistic,
  Row,
  Col,
  App
} from 'antd';
import { DownloadOutlined, BarChartOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ApiService } from '../services/apiService';
import type { FinancialReport } from '../types';
import { exportToCSV } from '../utils/helpers';

const { Option } = Select;

const FinancialReports: React.FC = () => {
  const { message } = App.useApp();
  const [reports, setReports] = useState<FinancialReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState<'monthly' | 'annual' | 'comparison'>('annual');
  const [selectedYear, setSelectedYear] = useState<number>(dayjs().year());
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    loadReports();
  }, [reportType, selectedYear]);

  const tablePagination = React.useMemo(
    () => ({
      pageSize,
      showSizeChanger: true,
      pageSizeOptions: [10, 20, 50, 100],
      onShowSizeChange: (_current: number, size: number) => setPageSize(size),
      showTotal: (total: number, range: [number, number]) => `${range[0]}-${range[1]} of ${total} records`,
    }),
    [pageSize]
  );

  const loadReports = async () => {
    setLoading(true);
    try {
      const filters: any = { reportType };
      if (reportType !== 'comparison') {
        filters.year = selectedYear;
      }
      const data = await ApiService.getFinancialReports(filters);
      setReports(data);
    } catch (error) {
      message.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const generateAnnualReport = async () => {
    try {
      setLoading(true);

      // Get all members
      const members = await ApiService.getAllMembers();

      // Get financial data for the year
      const waqfRecords = await ApiService.getWaqfJadeedRecords(selectedYear);
      const tahreqRecords = await ApiService.getTahreqJadeedRecords(selectedYear);

      // Calculate totals
      const waqfPromised = waqfRecords.reduce((sum, record) => sum + (record.promiseAmount || 0), 0);
      const waqfReceived = waqfRecords.reduce((sum, record) => sum + (record.paidAmount || 0), 0);

      const tahreqPromised = tahreqRecords.reduce((sum, record) => sum + (record.promiseAmount || 0), 0);
      const tahreqReceived = tahreqRecords.reduce((sum, record) => sum + (record.paidAmount || 0), 0);

      // Group by tanzeem
      const tanzeemBreakdown: any = {};

      members.forEach(member => {
        if (!tanzeemBreakdown[member.tanzeem]) {
          tanzeemBreakdown[member.tanzeem] = {
            promised: 0,
            received: 0,
            members: 0
          };
        }
        tanzeemBreakdown[member.tanzeem].members += 1;
      });

      waqfRecords.forEach(record => {
        const member = members.find(m => m.id === record.memberId);
        if (member && tanzeemBreakdown[member.tanzeem]) {
          tanzeemBreakdown[member.tanzeem].promised += (record.promiseAmount || 0);
          tanzeemBreakdown[member.tanzeem].received += (record.paidAmount || 0);
        }
      });

      tahreqRecords.forEach(record => {
        const member = members.find(m => m.id === record.memberId);
        if (member && tanzeemBreakdown[member.tanzeem]) {
          tanzeemBreakdown[member.tanzeem].promised += (record.promiseAmount || 0);
          tanzeemBreakdown[member.tanzeem].received += (record.paidAmount || 0);
        }
      });

      // Create report
      const reportData = {
        year: selectedYear,
        reportType: 'annual',
        totalPromised: waqfPromised + tahreqPromised,
        totalReceived: waqfReceived + tahreqReceived,
        totalMembers: members.length,
        tanzeemBreakdown
      };

      await ApiService.createFinancialReport(reportData);
      message.success('Annual report generated successfully');
      loadReports();
    } catch (error) {
      message.error('Failed to generate annual report');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = (report: FinancialReport) => {
    const data = [
      {
        'Report Type': report.reportType,
        'Year': report.year,
        'Total Promised': report.totalPromised,
        'Total Received': report.totalReceived,
        'Collection Rate': `${Math.round((report.totalReceived / report.totalPromised) * 100)}%`,
        'Members': report.totalMembers
      }
    ];

    exportToCSV(data, `financial_report_${report.year}_${report.reportType}.csv`);
  };

  const columns = [
    {
      title: 'Report Type',
      dataIndex: 'reportType',
      key: 'reportType',
      render: (type: string) => {
        const typeLabels: Record<string, string> = {
          'monthly': 'Monthly',
          'annual': 'Annual',
          'comparison': 'Comparison'
        };
        return typeLabels[type] || type;
      }
    },
    {
      title: 'Period',
      key: 'period',
      render: (_: any, record: FinancialReport) => {
        if (record.reportType === 'monthly' && record.month) {
          return `${dayjs().month(record.month - 1).format('MMMM')} ${record.year}`;
        }
        return record.year?.toString() || 'N/A';
      }
    },
    {
      title: 'Total Promised',
      dataIndex: 'totalPromised',
      key: 'totalPromised',
      render: (amount: number) => `Rs. ${amount.toLocaleString()}`
    },
    {
      title: 'Total Received',
      dataIndex: 'totalReceived',
      key: 'totalReceived',
      render: (amount: number) => `Rs. ${amount.toLocaleString()}`
    },
    {
      title: 'Collection Rate',
      key: 'collectionRate',
      render: (_: any, record: FinancialReport) => {
        const rate = record.totalPromised > 0
          ? Math.round((record.totalReceived / record.totalPromised) * 100)
          : 0;
        return (
          <Tag color={rate >= 80 ? 'green' : rate >= 50 ? 'orange' : 'red'}>
            {rate}%
          </Tag>
        );
      }
    },
    {
      title: 'Members',
      dataIndex: 'totalMembers',
      key: 'totalMembers'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: FinancialReport) => (
        <Space>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => exportReport(record)}
          >
            Export
          </Button>
        </Space>
      )
    }
  ];

  return (
    <Card
      title="Financial Reports"
      extra={
        <Space>
          <Select
            value={reportType}
            onChange={setReportType}
            style={{ width: 120 }}
          >
            <Option value="monthly">Monthly</Option>
            <Option value="annual">Annual</Option>
            <Option value="comparison">Comparison</Option>
          </Select>

          {reportType !== 'comparison' && (
            <Select
              value={selectedYear}
              onChange={setSelectedYear}
              style={{ width: 100 }}
            >
              {Array.from({ length: 5 }, (_, i) => selectedYear - 2 + i).map(year => (
                <Option key={year} value={year}>{year}</Option>
              ))}
            </Select>
          )}

          <Button
            type="primary"
            icon={<BarChartOutlined />}
            onClick={generateAnnualReport}
            loading={loading}
          >
            Generate Report
          </Button>
        </Space>
      }
    >
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Reports"
              value={reports.length}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Promised"
              value={reports.reduce((sum, r) => sum + r.totalPromised, 0).toLocaleString()}
              prefix="Rs."
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Received"
              value={reports.reduce((sum, r) => sum + r.totalReceived, 0).toLocaleString()}
              prefix="Rs."
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Avg Collection Rate"
              value={
                reports.length > 0
                  ? Math.round(reports.reduce((sum, r) =>
                    r.totalPromised > 0 ? sum + (r.totalReceived / r.totalPromised) * 100 : sum, 0) / reports.length)
                  : 0
              }
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      <Table
        loading={loading}
        dataSource={reports}
        columns={columns}
        rowKey="id"
        pagination={tablePagination as any}
      />
    </Card>
  );
};

export default FinancialReports;
