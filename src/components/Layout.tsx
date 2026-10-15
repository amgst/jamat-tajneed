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
  MenuOutlined,
  SolutionOutlined
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';
import { Search, Users, House, Wallet, Menu as MenuIcon } from 'lucide-react';
import InstallApp from './InstallApp';

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
      label: 'Home',
    },
    {
      key: '/families',
      icon: <TeamOutlined />,
      label: 'Families',
    },
    {
      key: '/people',
      icon: <UserOutlined />,
      label: 'Members',
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
      key: '/reports/waqfe-nau',
      icon: <SolutionOutlined />,
      label: 'Waqf-e-Nau',
    },
    {
      key: '/reports/mossi',
      icon: <SolutionOutlined />,
      label: 'Mossi',
    },
    {
      key: '/grave-record',
      icon: <BookOutlined />,
      label: 'Grave Record',
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: 'Settings',
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
    navigate(key);
    if (isMobile) setDrawerVisible(false);
  };

  return (
    <Layout className="tajneed-layout" style={{ minHeight: '100dvh' }}>
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
            Tajneed
          </div>

          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[location.pathname.startsWith('/members/') ? '/people' : location.pathname.startsWith('/families/') ? '/families' : location.pathname]}
            items={menuItems}
            onClick={handleMenuClick}
            style={{ height: 'calc(100vh - 64px)', borderRight: 0, overflowY: 'auto' }}
          />
        </Sider>
      )}

      {/* Mobile Drawer */}
      <Drawer
        title="Tajneed"
        placement="left"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        styles={{ body: { padding: 0 } }}
        width={250}
      >
        <Menu
          mode="inline"
          selectedKeys={[location.pathname.startsWith('/members/') ? '/people' : location.pathname.startsWith('/families/') ? '/families' : location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ height: '100%', borderRight: 0 }}
        />
      </Drawer>

      <Layout>
        <Header className="tajneed-header" style={{
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
                aria-label="Open navigation menu"
                aria-expanded={drawerVisible}
                onClick={() => setDrawerVisible(true)}
                style={{ fontSize: '16px', width: 64, height: 64 }}
              />
            ) : (
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
                onClick={() => setCollapsed(!collapsed)}
                style={{ fontSize: '16px', width: 64, height: 64 }}
              />
            )}
            <div>
              <Text strong style={{ fontSize: '16px' }}>
                Tajneed
              </Text>
            </div>
          </Space>

          <Space>
            <InstallApp />
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
              <button className="account-menu-trigger" aria-label="Open account menu">
                <Avatar size="small" icon={<UserOutlined />} />
                {!isMobile && <Text>{user?.email}</Text>}
              </button>
            </Dropdown>
          </Space>
        </Header>

        <Content className="tajneed-content" style={{
          margin: isMobile ? '8px 8px 90px' : '24px 16px',
          padding: isMobile ? 12 : 24,
          minHeight: 280,
          background: ['/', '/people'].includes(location.pathname) || location.pathname.startsWith('/members/') ? '#f9fafc' : '#fff',
          borderRadius: 6
        }}>
          <Outlet />
        </Content>
        {isMobile && <nav className="mobile-bottom-nav" aria-label="Main navigation">
          <button className={location.pathname === '/' ? 'active' : ''} onClick={() => navigate('/')}><Search /><span>Home</span></button>
          <button className={location.pathname === '/families' || location.pathname.startsWith('/families/') ? 'active' : ''} onClick={() => navigate('/families')}><House /><span>Families</span></button>
          <button className={location.pathname.startsWith('/people') || location.pathname.startsWith('/members/') ? 'active' : ''} onClick={() => navigate('/people')}><Users /><span>Members</span></button>
          <button className={location.pathname === '/waqf-jadeed' ? 'active' : ''} onClick={() => navigate('/waqf-jadeed')}><Wallet /><span>Waqf</span></button>
          <button onClick={() => setDrawerVisible(true)}><MenuIcon /><span>More</span></button>
        </nav>}
      </Layout>
    </Layout >
  );
};

export default AppLayout;
