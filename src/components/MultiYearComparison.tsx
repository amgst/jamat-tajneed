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
import { Column } from '@ant-design/plots';
import dayjs from 'dayjs';
import { ApiService } from '../services/apiService';
import type { ColumnsType } from 'antd/es/table';

const { Option } = Select;

interface ComparisonData {
  key: number;
  year: number;
  waqfPromised: number;
  waqfReceived: number;
  waqfMembers: number;
  tahreqPromised: number;
  tahreqReceived: number;
  tahreqMembers: number;
  totalPromised: number;
  totalReceived: number;
  totalMembers: number;
}

const MultiYearComparison: React.FC = () => {
  const { message } = App.useApp();
  const [comparisonData, setComparisonData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [years, setYears] = useState<number[]>([
    dayjs().year() - 2,
    dayjs().year() - 1,
    dayjs().year()
  ]);

  useEffect(() => {
    loadComparisonData();
  }, [years]);

  const loadComparisonData = async () => {
    setLoading(true);
    try {
      const data = await ApiService.getMultiYearComparisonData(years);
      setComparisonData(data);
    } catch (error) {
      message.error('Failed to load comparison data');
    } finally {
      setLoading(false);
    }
  };

  const addYear = () => {
    const newYear = years.length > 0 ? Math.max(...years) + 1 : dayjs().year();
    setYears([...years, newYear]);
  };

  const removeYear = (year: number) => {
    if (years.length > 1) {
      setYears(years.filter(y => y !== year));
    }
  };

  const getChartData = () => {
    const chartData: any[] = [];
    
    years.forEach(year => {
      chartData.push(
        { year: year.toString(), type: 'Waqf-e-Jadeed Promised', value: comparisonData[year]?.waqf.promised || 0 },
        { year: year.toString(), type: 'Waqf-e-Jadeed Received', value: comparisonData[year]?.waqf.received || 0 },
        { year: year.toString(), type: 'Tahreq Jadeed Promised', value: comparisonData[year]?.tahreq.promised || 0 },
        { year: year.toString(), type: 'Tahreq Jadeed Received', value: comparisonData[year]?.tahreq.received || 0 }
      );
    });
    
    return chartData;
  };

  const getTableData = (): ComparisonData[] => {
    return years.map(year => ({
      key: year,
      year,
      waqfPromised: comparisonData[year]?.waqf.promised || 0,
      waqfReceived: comparisonData[year]?.waqf.received || 0,
      waqfMembers: comparisonData[year]?.waqf.members || 0,
      tahreqPromised: comparisonData[year]?.tahreq.promised || 0,
      tahreqReceived: comparisonData[year]?.tahreq.received || 0,
      tahreqMembers: comparisonData[year]?.tahreq.members || 0,
      totalPromised: comparisonData[year]?.total.promised || 0,
      totalReceived: comparisonData[year]?.total.received || 0,
      totalMembers: comparisonData[year]?.total.members || 0
    }));
  };

  const formatCurrency = (amount: number) => {
    return `Rs. ${amount.toLocaleString()}`;
  };

  const columns: ColumnsType<ComparisonData> = [
    {
      title: 'Year',
      dataIndex: 'year',
      key: 'year',
      fixed: 'left' as const
    },
    {
      title: 'Waqf-e-Jadeed',
      children: [
        {
          title: 'Promised',
          dataIndex: 'waqfPromised',
          key: 'waqfPromised',
          render: (amount: number) => formatCurrency(amount)
        },
        {
          title: 'Received',
          dataIndex: 'waqfReceived',
          key: 'waqfReceived',
          render: (amount: number) => formatCurrency(amount)
        },
        {
          title: 'Members',
          dataIndex: 'waqfMembers',
          key: 'waqfMembers'
        }
      ]
    },
    {
      title: 'Tahreq Jadeed',
      children: [
        {
          title: 'Promised',
          dataIndex: 'tahreqPromised',
          key: 'tahreqPromised',
          render: (amount: number) => formatCurrency(amount)
        },
        {
          title: 'Received',
          dataIndex: 'tahreqReceived',
          key: 'tahreqReceived',
          render: (amount: number) => formatCurrency(amount)
        },
        {
          title: 'Members',
          dataIndex: 'tahreqMembers',
          key: 'tahreqMembers'
        }
      ]
    },
    {
      title: 'Total',
      children: [
        {
          title: 'Promised',
          dataIndex: 'totalPromised',
          key: 'totalPromised',
          render: (amount: number) => formatCurrency(amount)
        },
        {
          title: 'Received',
          dataIndex: 'totalReceived',
          key: 'totalReceived',
          render: (amount: number) => formatCurrency(amount)
        },
        {
          title: 'Members',
          dataIndex: 'totalMembers',
          key: 'totalMembers'
        }
      ]
    }
  ];

  // Chart configuration
  const chartConfig = {
    data: getChartData(),
    xField: 'year',
    yField: 'value',
    seriesField: 'type',
    isGroup: true,
    color: ['#1890ff', '#52c41a', '#722ed1', '#faad14'],
  };

  return (
    <Card 
      title="Multi-Year Comparison" 
      extra={
        <Space>
          <Button onClick={addYear}>Add Year</Button>
          <Button type="primary" onClick={loadComparisonData} loading={loading}>
            Refresh Data
          </Button>
        </Space>
      }
    >
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Space>
            {years.map(year => (
              <Tag 
                key={year} 
                closable 
                onClose={() => removeYear(year)}
                color="blue"
              >
                {year}
              </Tag>
            ))}
          </Space>
        </Col>
      </Row>

      {Object.keys(comparisonData).length > 0 && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col span={24}>
              <Card title="Financial Comparison Chart">
                <div style={{ height: 400 }}>
                  <Column {...chartConfig} />
                </div>
              </Card>
            </Col>
          </Row>

          <Table
            loading={loading}
            dataSource={getTableData()}
            columns={columns}
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
        </>
      )}
    </Card>
  );
};

export default MultiYearComparison;