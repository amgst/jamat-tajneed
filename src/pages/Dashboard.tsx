import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Button,
  Tooltip
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  ManOutlined,
  WomanOutlined,
  ReloadOutlined,
  BookOutlined,
  HomeOutlined,
  PlusOutlined,
  StarOutlined,
  HeartOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { Column, Pie, Bar } from '@ant-design/charts';
import { ApiService } from '../services/apiService';
import type { DashboardStats, Tanzeem } from '../types';
import { getTanzeemDisplayName } from '../utils/helpers';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const dashboardStats = await ApiService.getDashboardStats();
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



  const tanzeemData = stats?.tanzeemStats ? Object.entries(stats.tanzeemStats).map(([key, value]) => ({
    tanzeem: getTanzeemDisplayName(key as Tanzeem),
    count: value,
  })) : []; return (
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
              title={
                <Tooltip title="Total active members currently in the database">
                  <span>Total Members <InfoCircleOutlined style={{ fontSize: '12px', marginLeft: '4px' }} /></span>
                </Tooltip>
              }
              value={stats?.totalMembers || 0}
              prefix={<UserOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={
                <Tooltip title="Total number of registered families">
                  <span>Total Families <InfoCircleOutlined style={{ fontSize: '12px', marginLeft: '4px' }} /></span>
                </Tooltip>
              }
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

      {/* Additional Stats Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={
                <Tooltip title="Members who have submitted religious education data">
                  <span>Religious Data <InfoCircleOutlined style={{ fontSize: '12px', marginLeft: '4px' }} /></span>
                </Tooltip>
              }
              value={stats?.membersWithReligiousData || 0}
              prefix={<BookOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
              suffix={`/ ${stats?.totalMembers || 0}`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={
                <Tooltip title="New members added in the last 30 days">
                  <span>Recent Members <InfoCircleOutlined style={{ fontSize: '12px', marginLeft: '4px' }} /></span>
                </Tooltip>
              }
              value={stats?.recentMembers || 0}
              prefix={<PlusOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
              suffix="(30 days)"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Halqas"
              value={stats?.halqaStats ? Object.keys(stats.halqaStats).length : 0}
              prefix={<HomeOutlined style={{ color: '#13c2c2' }} />}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={
                <Tooltip title="Average number of members per family">
                  <span>Avg Family Size <InfoCircleOutlined style={{ fontSize: '12px', marginLeft: '4px' }} /></span>
                </Tooltip>
              }
              value={stats?.totalFamilies ? Math.round((stats.totalMembers / stats.totalFamilies) * 10) / 10 : 0}
              prefix={<TeamOutlined style={{ color: '#eb2f96' }} />}
              valueStyle={{ color: '#eb2f96' }}
              suffix="members"
            />
          </Card>
        </Col>
      </Row>

      {/* Deceased & Special Stats Row */}
      {stats?.waqfJadeedStats && (
        <>
          <Title level={4} style={{ marginBottom: 16 }}>Special & Deceased Records</Title>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={8} md={8}>
              <Card>
                <Statistic
                  title="Deceased (Total)"
                  value={stats.waqfJadeedStats.deceasedTotal}
                  prefix={<UserOutlined style={{ color: '#595959' }} />}
                  valueStyle={{ color: '#595959' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8} md={8}>
              <Card>
                <Statistic
                  title="Deceased (Male)"
                  value={stats.waqfJadeedStats.deceasedMale}
                  prefix={<ManOutlined style={{ color: '#595959' }} />}
                  valueStyle={{ color: '#595959' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8} md={8}>
              <Card>
                <Statistic
                  title="Deceased (Female)"
                  value={stats.waqfJadeedStats.deceasedFemale}
                  prefix={<WomanOutlined style={{ color: '#595959' }} />}
                  valueStyle={{ color: '#595959' }}
                />
              </Card>
            </Col>
          </Row>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={12}>
              <Card>
                <Statistic
                  title="Hazrat Muhammad (pbuh)"
                  value={stats.waqfJadeedStats.hazratMuhammadCount}
                  prefix={<StarOutlined style={{ color: '#faad14' }} />}
                  valueStyle={{ color: '#faad14' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={12}>
              <Card>
                <Statistic
                  title="Hazrat Messiah Maoud (as)"
                  value={stats.waqfJadeedStats.hazratMessiahCount}
                  prefix={<HeartOutlined style={{ color: '#eb2f96' }} />}
                  valueStyle={{ color: '#eb2f96' }}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* Charts Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {/* Tanzeem Distribution */}
        <Col xs={24} lg={12}>
          <Card title="Members by Tanzeem">
            {tanzeemData.length > 0 ? (
              <Column
                data={tanzeemData}
                xField="tanzeem"
                yField="count"
                color="#1890ff"
                columnStyle={{
                  fill: '#1890ff',
                  fillOpacity: 0.6,
                }}
                label={{
                  position: 'top',
                  style: {
                    fill: '#000',
                    fontSize: 12,
                    fontWeight: 'bold',
                  },
                }}
                height={300}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '50px' }}>No data available</div>
            )}
          </Card>
        </Col>

        {/* Age Groups */}
        <Col xs={24} lg={12}>
          <Card title="Age Distribution">
            {stats?.ageGroups ? (
              <Pie
                data={Object.entries(stats.ageGroups).map(([key, value]) => ({
                  type: key,
                  value: value,
                }))}
                angleField="value"
                colorField="type"
                radius={0.8}
                label={{
                  content: (data: any) => `${data.type}: ${data.value}`,
                }}
                height={300}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '50px' }}>No data available</div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Halqa Distribution */}
      {stats?.halqaStats && Object.keys(stats.halqaStats).length > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Card title="Members by Halqa">
              <Bar
                data={Object.entries(stats.halqaStats).map(([key, value]) => ({
                  halqa: key,
                  count: value,
                }))}
                xField="count"
                yField="halqa"
                color="#52c41a"
                height={Math.max(300, Object.keys(stats.halqaStats).length * 40)}
              />
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default Dashboard;
