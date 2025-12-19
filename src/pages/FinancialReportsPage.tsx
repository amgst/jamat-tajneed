import React from 'react';
import { Tabs } from 'antd';
import FinancialReports from '../components/FinancialReports';
import MultiYearComparison from '../components/MultiYearComparison';
import AutomatedReminders from '../components/AutomatedReminders';

const FinancialReportsPage: React.FC = () => {
  return (
    <div style={{ padding: 24 }}>
      <Tabs 
        defaultActiveKey="reports" 
        items={[
          {
            key: 'reports',
            label: 'Financial Reports',
            children: <FinancialReports />
          },
          {
            key: 'comparison',
            label: 'Multi-Year Comparison',
            children: <MultiYearComparison />
          },
          {
            key: 'reminders',
            label: 'Automated Reminders',
            children: <AutomatedReminders />
          }
        ]}
      />
    </div>
  );
};

export default FinancialReportsPage;