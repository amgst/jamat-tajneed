import React, { useState } from 'react';
import { Layout, Menu, Button, Avatar, Dropdown, Space, Typography, Drawer, Grid } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  TeamOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BankOutlined,
  BookOutlined,
  HeartOutlined,
  FileTextOutlined,

  DatabaseOutlined,
  MenuOutlined,
  ToolOutlined,
  SolutionOutlined
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
// import { logout } from '../services/storage'; // Using mock logout
import { useAuth } from '../contexts/useAuth';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;
const { useBreakpoint } = Grid;

const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const screens = useBreakpoint();

  // If screens.xs is undefined (initial render), assume desktop or wait. 
  // Ideally, use a default, but AntD handles this well.
  // We consider 'mobile' if screens.md is false (meaning xs or sm).
  const isMobile = !screens.md;

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/members',
      icon: <UserOutlined />,
      label: 'Members',
    },
    {
      key: '/families',
      icon: <TeamOutlined />,
      label: 'Families',
    },
    {
      key: '/tanzeem',
      icon: <BankOutlined />,
      label: 'Tanzeem View',
    },
    {
      key: '/religious-activities',
      icon: <BookOutlined />,
      label: 'Religious Activities',
    },
    {
      key: '/waqf-jadeed',
      icon: <BankOutlined />,
      label: 'Waqf-e-Jadeed',
    },
    {
      key: '/ansar-uallah',
      icon: <BankOutlined />,
      label: 'Ansar uallah',
    },
    {
      key: '/graveyard',
      icon: <HeartOutlined />,
      label: 'Graveyard',
    },
    {
      key: '/financial-reports',
      icon: <FileTextOutlined />,
      label: 'Financial Reports',
    },
    {
      key: 'reports-menu',
      icon: <SolutionOutlined />,
      label: 'Reports',
      children: [
        {
          key: '/reports/waqfe-nau',
          label: 'Waqf-e-Nau',
        },
        {
          key: '/reports/mossi',
          label: 'Mossi',
        }
      ]
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: 'Settings',
    },
    {
      key: '/members-json',
      icon: <DatabaseOutlined />,
      label: 'Members (JSON)',
    },
    {
      key: 'tools-menu',
      icon: <ToolOutlined />,
      label: 'Tools',
      children: [
        {
          key: 'tools-overview',
          label: 'Overview',
        },
        {
          key: '/tools/zakat-calculator',
          label: 'Zakat Calculator',
        }
      ]
    },
  ];

  const handleUserMenuClick = ({ key }: { key: string }) => {
    if (key === 'profile') {
      navigate('/profile');
    } else if (key === 'logout') {
      handleLogout();
    }
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === 'tools-overview') {
      navigate('/tools');
    } else {
      navigate(key);
    }
    if (isMobile) setDrawerVisible(false);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!isMobile && (
        <Sider trigger={null} collapsible collapsed={collapsed}>
          <div style={{
            height: 32,
            margin: 16,
            background: 'rgba(255, 255, 255, 0.3)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: collapsed ? '12px' : '14px'
          }}>
            {collapsed ? 'Tajneed' : 'Tajneed Dashboard'}
          </div>

          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={handleMenuClick}
            style={{ height: 'calc(100vh - 64px)', borderRight: 0, overflowY: 'auto' }}
          />
        </Sider>
      )}

      {/* Mobile Drawer */}
      <Drawer
        title="Tajneed Dashboard"
        placement="left"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        styles={{ body: { padding: 0 } }}
        width={250}
      >
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ height: '100%', borderRight: 0 }}
        />
      </Drawer>

      <Layout>
        <Header style={{
          padding: '0 16px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <Space>
            {isMobile ? (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setDrawerVisible(true)}
                style={{ fontSize: '16px', width: 64, height: 64 }}
              />
            ) : (
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                style={{ fontSize: '16px', width: 64, height: 64 }}
              />
            )}
            <div>
              <Text strong style={{ fontSize: '16px' }}>
                Jamaat
              </Text>
            </div>
          </Space>

          <Space>
            {!isMobile && (
              <Text type="secondary">
                Welcome back!
              </Text>
            )}
            <Dropdown
              menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
              placement="bottomRight"
              trigger={['click']}
            >
              <Space style={{ cursor: 'pointer' }}>
                <Avatar size="small" icon={<UserOutlined />} />
                {!isMobile && <Text>{user?.email}</Text>}
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{
          margin: isMobile ? '8px' : '24px 16px',
          padding: isMobile ? 12 : 24,
          minHeight: 280,
          background: '#fff',
          borderRadius: 6
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout >
  );
};

export default AppLayout;
