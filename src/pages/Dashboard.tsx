import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Button
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  ManOutlined,
  WomanOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { Column } from '@ant-design/charts';
import { getAllMembers, getAllFamilies } from '../services/firebase'; // Changed import
import type { Member, Family, DashboardStats, Tanzeem } from '../types';
import { getTanzeemDisplayName } from '../utils/helpers';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [membersData, familiesData] = await Promise.all([
        getAllMembers(),
        getAllFamilies()
      ]);

      // Calculate statistics
      const dashboardStats = calculateStats(membersData, familiesData);
      setStats(dashboardStats);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const calculateStats = (members: Member[], families: Family[]): DashboardStats => {
    const totalMembers = members.length;
    const maleMembers = members.filter(m => m.gender === 'male').length;
    const femaleMembers = members.filter(m => m.gender === 'female').length;

    const tanzeemStats = members.reduce((acc, member) => {
      acc[member.tanzeem] = (acc[member.tanzeem] || 0) + 1;
      return acc;
    }, {} as Record<Tanzeem, number>);

    return {
      totalMembers,
      maleMembers,
      femaleMembers,
      totalFamilies: families.length,
      tanzeemStats,
    };
    };

  const tanzeemData = stats ? Object.entries(stats.tanzeemStats).map(([key, value]) => ({
    tanzeem: getTanzeemDisplayName(key as Tanzeem),
    count: value,
  })) : [];  return (
    <div>
      {/* Header Section */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            Tajneed Admin Dashboard
          </Title>
          <Text type="secondary">
            Jamaat Ahmadiyya Muridke - Family & Membership Management System
          </Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Last updated: {new Date().toLocaleString()} • {stats?.totalMembers || 0} total members
          </Text>
        </div>
        <Button
          type="default"
          icon={<ReloadOutlined />}
          onClick={loadData}
          loading={loading}
        >
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Members"
              value={stats?.totalMembers || 0}
              prefix={<UserOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Families"
              value={stats?.totalFamilies || 0}
              prefix={<TeamOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Male Members"
              value={stats?.maleMembers || 0}
              prefix={<ManOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Female Members"
              value={stats?.femaleMembers || 0}
              prefix={<WomanOutlined style={{ color: '#f759ab' }} />}
              valueStyle={{ color: '#f759ab' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tanzeem Distribution Chart */}
      {tanzeemData.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Card title="Members by Tanzeem">
              <Column
                data={tanzeemData}
                xField="tanzeem"
                yField="count"
                color="#1890ff"
                columnStyle={{
                  fill: '#1890ff',
                  fillOpacity: 0.6,
                }}
                height={300}
              />
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default Dashboard;
