import React, { useState } from 'react';
import { Card, Avatar, Descriptions, Typography, Space, Button, Form, Input, message } from 'antd';
import { UserOutlined, EditOutlined, SaveOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/useAuth';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const { Title } = Typography;

const Profile: React.FC = () => {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form] = Form.useForm();
  const [profileData, setProfileData] = useState({
    name: user?.displayName || '',
    email: user?.email || '',
    phone: '',
    organization: 'Jamaat Ahmadiyya Muridke'
  });

  React.useEffect(() => {
    if (!user) return;
    let active = true;
    void getDoc(doc(db, 'profiles', user.uid)).then(snapshot => {
      if (!active) return;
      const data = { name: user.displayName || '', email: user.email, phone: '', organization: 'Jamaat Ahmadiyya Muridke', ...snapshot.data() };
      setProfileData(data);
      form.setFieldsValue(data);
    }).catch(() => message.error('Unable to load profile from Firebase.'));
    return () => { active = false; };
  }, [form, user]);

  const handleSave = async (values: any) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'profiles', user.uid), values, { merge: true });
      setProfileData(values);
      setEditing(false);
      message.success('Profile updated successfully!');
    } catch { message.error('Unable to save profile to Firebase.'); }
  };

  const handleCancel = () => {
    form.setFieldsValue(profileData);
    setEditing(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          User Profile
        </Title>
        {!editing && (
          <Button type="primary" icon={<EditOutlined />} onClick={() => setEditing(true)}>
            Edit Profile
          </Button>
        )}
      </div>

      <Card style={{ maxWidth: 600 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <Avatar size={80} icon={<UserOutlined />} />
            <Title level={4} style={{ marginTop: 16, marginBottom: 0 }}>
              {profileData.name}
            </Title>
          </div>

          {editing ? (
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSave}
              style={{ width: '100%' }}
            >
              <Form.Item
                name="name"
                label="Full Name"
                rules={[{ required: true, message: 'Please enter your name' }]}
              >
                <Input />
              </Form.Item>
              
              <Form.Item
                name="email"
                label="Email"
                rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}
              >
                <Input />
              </Form.Item>
              
              <Form.Item
                name="phone"
                label="Phone Number"
              >
                <Input />
              </Form.Item>
              
              <Form.Item
                name="organization"
                label="Organization"
              >
                <Input />
              </Form.Item>
              
              <Space>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
                  Save Changes
                </Button>
                <Button onClick={handleCancel}>
                  Cancel
                </Button>
              </Space>
            </Form>
          ) : (
            <Descriptions bordered column={1}>
              <Descriptions.Item label="Email">
                {profileData.email}
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                {profileData.phone}
              </Descriptions.Item>
              <Descriptions.Item label="Role">
                Administrator
              </Descriptions.Item>
              <Descriptions.Item label="Organization">
                {profileData.organization}
              </Descriptions.Item>
              <Descriptions.Item label="Access Level">
                Full Access
              </Descriptions.Item>
              <Descriptions.Item label="Last Login">
                {new Date().toLocaleString()}
              </Descriptions.Item>
            </Descriptions>
          )}
        </Space>
      </Card>
    </div>
  );
};

export default Profile;
