import React, { useState, useEffect } from 'react';
import {
    Form,
    Input,
    Select,
    DatePicker,
    Upload,
    Row,
    Col,
    Checkbox,
    Button,
    Space
} from 'antd';
import {
    UploadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Member } from '../types';
import { validateCNIC } from '../utils/helpers';
import { processImageFile } from '../utils/imageUtils';

const { Option } = Select;

interface MemberFormProps {
    initialValues?: Partial<Member>;
    onFinish: (values: any) => Promise<void>;
    isSaving: boolean;
    familyHalqa?: string;
    submitText?: string;
    showCancel?: boolean;
    onCancel?: () => void;
}

const MemberForm: React.FC<MemberFormProps> = ({
    initialValues,
    onFinish,
    isSaving,
    familyHalqa,
    submitText = 'Save',
    showCancel = false,
    onCancel
}) => {
    const [form] = Form.useForm();
    const [uploadedImage, setUploadedImage] = useState<string>(initialValues?.profilePhoto || '');
    const [imageUploading, setImageUploading] = useState<boolean>(false);

    // Update form and image when initialValues change
    useEffect(() => {
        if (initialValues) {
            const formattedValues = {
                ...initialValues,
                dateOfBirth: initialValues.dateOfBirth ? dayjs(initialValues.dateOfBirth) : undefined,
                dateOfDeath: initialValues.dateOfDeath ? dayjs(initialValues.dateOfDeath) : undefined,
                // Ensure isBaitByBirth has a default if not provided
                isBaitByBirth: initialValues.isBaitByBirth !== undefined ? initialValues.isBaitByBirth : true,
            };
            form.setFieldsValue(formattedValues);
            setUploadedImage(initialValues.profilePhoto || '');
        } else {
            form.resetFields();
            setUploadedImage('');
        }
    }, [initialValues, form]);

    const handleImageUpload = async (file: File) => {
        setImageUploading(true);
        const result = await processImageFile(file);
        if (result.success && result.data) {
            setUploadedImage(result.data);
            form.setFieldValue('profilePhoto', result.data);
        }
        setImageUploading(false);
        return false; // Prevent default upload behavior
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            // Ensure profilePhoto is included from state if not in form values
            await onFinish({ ...values, profilePhoto: uploadedImage });
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    return (
        <Form
            form={form}
            layout="vertical"
            requiredMark={true}
            onValuesChange={(changedValues, allValues) => {
                if (changedValues.isBaitByBirth !== undefined || changedValues.gender !== undefined || changedValues.isMarried !== undefined) {
                    // Force update to re-render when flags change
                    form.setFieldsValue({ ...allValues });
                }
            }}
            initialValues={{ isBaitByBirth: true }}
        >
            <Row gutter={16}>
                <Col xs={24} md={12}>
                    <Form.Item
                        name="name"
                        label="Name"
                        rules={[
                            { required: true, message: 'Please enter name' },
                            { min: 2, message: 'Name must be at least 2 characters' }
                        ]}
                    >
                        <Input placeholder="Enter name" />
                    </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                    <Form.Item
                        name="fatherName"
                        label="Father Name"
                    >
                        <Input placeholder="Enter father name" />
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={16}>
                <Col xs={24} md={12}>
                    <Form.Item
                        name="gender"
                        label="Gender"
                        rules={[
                            { required: true, message: 'Please select gender' }
                        ]}
                    >
                        <Select placeholder="Select gender">
                            <Option value="male">Male</Option>
                            <Option value="female">Female</Option>
                        </Select>
                    </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                    <Form.Item
                        label="Married"
                        style={{ marginBottom: 0 }}
                    >
                        <Form.Item
                            name="isMarried"
                            valuePropName="checked"
                            noStyle
                        >
                            <Checkbox
                                onChange={(e) => {
                                    if (!e.target.checked) {
                                        form.setFieldValue('husbandName', '');
                                    }
                                }}
                            >
                                Married
                            </Checkbox>
                        </Form.Item>
                    </Form.Item>
                    <Form.Item
                        noStyle
                        shouldUpdate={(prev, current) => prev.isMarried !== current.isMarried || prev.gender !== current.gender}
                    >
                        {({ getFieldValue }) => {
                            const isMarried = getFieldValue('isMarried');
                            const gender = getFieldValue('gender');

                            if (isMarried && gender === 'female') {
                                return (
                                    <Form.Item
                                        name="husbandName"
                                        label="Husband Name"
                                        style={{ marginTop: 8 }}
                                    >
                                        <Input placeholder="Enter husband name" />
                                    </Form.Item>
                                )
                            }
                            return null;
                        }}
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={16}>
                <Col xs={24} md={12}>
                    <Form.Item
                        name="dateOfBirth"
                        label="Date of Birth"
                        rules={[
                            { required: true, message: 'Please select date of birth' }
                        ]}
                    >
                        <DatePicker
                            style={{ width: '100%' }}
                            placeholder="Select date of birth"
                            disabledDate={(current) => current && current > dayjs().endOf('day')}
                        />
                    </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                    <Row gutter={8}>
                        <Col span={12}>
                            <Form.Item
                                name="isBaitByBirth"
                                label="Year of Bait"
                                initialValue={true}
                            >
                                <Select
                                    onChange={(value) => {
                                        if (value) {
                                            form.setFieldValue('baitYear', undefined);
                                        }
                                    }}
                                >
                                    <Option value={true}>By Birth</Option>
                                    <Option value={false}>Custom Year</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                noStyle
                                shouldUpdate={(prev, current) => prev.isBaitByBirth !== current.isBaitByBirth}
                            >
                                {({ getFieldValue }) => {
                                    const isBaitByBirth = getFieldValue('isBaitByBirth');
                                    return !isBaitByBirth ? (
                                        <Form.Item
                                            name="baitYear"
                                            label=" "
                                            rules={[{ required: true, message: 'Enter year' }]}
                                        >
                                            <Input
                                                type="number"
                                                placeholder="Year"
                                                min={1900}
                                                max={new Date().getFullYear()}
                                            />
                                        </Form.Item>
                                    ) : null;
                                }}
                            </Form.Item>
                        </Col>
                    </Row>
                </Col>
            </Row>

            <Row gutter={16}>
                <Col xs={24} md={12}>
                    <Form.Item
                        name="phone"
                        label="Contact No"
                    >
                        <Input placeholder="Enter phone number" />
                    </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                    <Form.Item
                        name="cnic"
                        label="ID Card No"
                        rules={[
                            {
                                validator: (_, value) => {
                                    if (!value || validateCNIC(value)) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error('Please enter a valid CNIC (13 digits)'));
                                }
                            }
                        ]}
                    >
                        <Input
                            placeholder="Enter CNIC"
                            maxLength={15}
                        />
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={16}>
                <Col xs={24} md={12}>
                    <Form.Item
                        name="wasitNo"
                        label="Wasit No"
                    >
                        <Input placeholder="Enter wasit no" />
                    </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                    <Form.Item
                        name="education"
                        label="Education"
                    >
                        <Select placeholder="Select education">
                            <Option value="None">None</Option>
                            <Option value="Primary">Primary</Option>
                            <Option value="Middle">Middle</Option>
                            <Option value="Matric">Matric</Option>
                            <Option value="Intermediate">Intermediate</Option>
                            <Option value="Graduate">Graduate</Option>
                            <Option value="Postgraduate">Postgraduate</Option>
                            <Option value="Doctorate">Doctorate</Option>
                            <Option value="Other">Other</Option>
                        </Select>
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={16}>
                <Col xs={24} md={12}>
                    <Form.Item
                        name="bloodGroup"
                        label="Blood Group"
                    >
                        <Select placeholder="Select blood group">
                            <Option value="A+">A+</Option>
                            <Option value="A-">A-</Option>
                            <Option value="B+">B+</Option>
                            <Option value="B-">B-</Option>
                            <Option value="AB+">AB+</Option>
                            <Option value="AB-">AB-</Option>
                            <Option value="O+">O+</Option>
                            <Option value="O-">O-</Option>
                        </Select>
                    </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                    <Form.Item
                        name="waqfeNauNumber"
                        label="Waqfe-Neu No"
                    >
                        <Input placeholder="Enter Waqfe-Neu No" />
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={16}>
                <Col xs={24} md={12}>
                    <Form.Item
                        label="Halqa"
                    >
                        <Input
                            disabled
                            value={familyHalqa || (initialValues ? initialValues.halqa : '') || 'Managed at family level'}
                            placeholder="Halqa is managed at family level"
                        />
                    </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                    <Form.Item
                        name="profilePhoto"
                        label="Profile Photo (Optional)"
                    >
                        <Upload
                            listType="picture-card"
                            maxCount={1}
                            beforeUpload={(file) => handleImageUpload(file as File)}
                            fileList={uploadedImage ? [{
                                uid: '-1',
                                name: 'profile.jpg',
                                status: 'done',
                                url: uploadedImage,
                            }] : []}
                            onRemove={() => {
                                setUploadedImage('');
                                form.setFieldValue('profilePhoto', '');
                                return true;
                            }}
                            disabled={imageUploading}
                        >
                            {!uploadedImage && (
                                <div>
                                    <UploadOutlined />
                                    <div style={{ marginTop: 8 }}>
                                        {imageUploading ? 'Uploading...' : 'Upload'}
                                    </div>
                                </div>
                            )}
                        </Upload>
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={16}>
                <Col xs={24} md={12}>
                    <Form.Item
                        name="isDeceased"
                        valuePropName="checked"
                    >
                        <Checkbox>Deceased</Checkbox>
                    </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                    <Form.Item
                        noStyle
                        shouldUpdate={(prev, current) => prev.isDeceased !== current.isDeceased}
                    >
                        {({ getFieldValue }) => {
                            return getFieldValue('isDeceased') ? (
                                <Form.Item
                                    name="dateOfDeath"
                                    label="Date of Death"
                                    rules={[{ required: true, message: 'Please select date of death' }]}
                                >
                                    <DatePicker
                                        style={{ width: '100%' }}
                                        placeholder="Select date of death"
                                        disabledDate={(current) => current && current > dayjs().endOf('day')}
                                    />
                                </Form.Item>
                            ) : null;
                        }}
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={16}>
                <Col xs={24} md={12}>
                    <Form.Item
                        name="isMoved"
                        valuePropName="checked"
                    >
                        <Checkbox>Moved</Checkbox>
                    </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                    <Form.Item
                        noStyle
                        shouldUpdate={(prev, current) => prev.isMoved !== current.isMoved}
                    >
                        {({ getFieldValue }) => {
                            return getFieldValue('isMoved') ? (
                                <Form.Item
                                    name="movedTo"
                                    label="Moved To"
                                    rules={[{ required: true, message: 'Please enter where member moved to' }]}
                                >
                                    <Input placeholder="Enter new location" />
                                </Form.Item>
                            ) : null;
                        }}
                    </Form.Item>
                </Col>
            </Row>

            <Row>
                <Col xs={24}>
                    <Form.Item
                        name="address"
                        label="Address"
                        rules={[
                            { required: true, message: 'Please enter address' }
                        ]}
                    >
                        <Input.TextArea
                            rows={3}
                            placeholder="Enter complete address"
                        />
                    </Form.Item>
                </Col>
            </Row>

            <Row justify="end" style={{ marginTop: 24 }}>
                <Col>
                    <Space>
                        {showCancel && (
                            <Button onClick={onCancel}>
                                Cancel
                            </Button>
                        )}
                        <Button
                            type="primary"
                            onClick={handleSubmit}
                            loading={isSaving}
                            size="large"
                        >
                            {submitText}
                        </Button>
                    </Space>
                </Col>
            </Row>
        </Form>
    );
};

export default MemberForm;
