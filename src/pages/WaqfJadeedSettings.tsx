import { Button, Card, InputNumber } from 'antd';
import { BookOutlined, PlusOutlined } from '@ant-design/icons';

export default function WaqfJadeedSettings({ onAddMember, onManageBooks, targetAmount, selectedYear, onTargetChange }: { onAddMember: () => void; onManageBooks: () => void; targetAmount: number; selectedYear: number; onTargetChange: (value: number | null) => void }) {
  return <div className="waqf-settings-grid">
    <Card title={`Baligan target · ${selectedYear}`}>
      <p>Set the annual target for Daftar Baligan. Changes save automatically.</p>
      <label htmlFor="waqf-baligan-target" style={{ display: 'block', marginBottom: 8 }}>Target amount</label>
      <InputNumber id="waqf-baligan-target" value={targetAmount} onChange={onTargetChange} addonBefore="Rs." min={0} precision={0} size="large" style={{ width: '100%' }} formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={value => Number(value?.replace(/,/g, '') || 0)} />
    </Card>
    <Card title="Members"><p>Add a member to the contribution records.</p><Button type="primary" icon={<PlusOutlined />} onClick={onAddMember}>Add member</Button></Card>
    <Card title="Receipt books"><p>Manage books, default selection, and collected totals.</p><Button icon={<BookOutlined />} onClick={onManageBooks}>Manage books</Button></Card>
  </div>;
}
