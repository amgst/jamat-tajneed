import { Button, Card } from 'antd';
import { BookOutlined, PlusOutlined } from '@ant-design/icons';

export default function WaqfJadeedSettings({ onAddMember, onManageBooks }: { onAddMember: () => void; onManageBooks: () => void }) {
  return <div className="waqf-settings-grid">
    <Card title="Members"><p>Add a member to the contribution records.</p><Button type="primary" icon={<PlusOutlined />} onClick={onAddMember}>Add member</Button></Card>
    <Card title="Receipt books"><p>Manage books, default selection, and collected totals.</p><Button icon={<BookOutlined />} onClick={onManageBooks}>Manage books</Button></Card>
  </div>;
}
