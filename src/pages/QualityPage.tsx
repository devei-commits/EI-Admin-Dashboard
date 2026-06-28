import { useLocation, useNavigate } from 'react-router-dom';
import QualitySidebar from '../components/QualitySidebar';
import QualityOverview from './quality/Overview';
import InboundQcQueue from './quality/InboundQcQueue';
import OrderManagementQueue from './quality/OrderManagementQueue';
import QcHistory from './quality/QcHistory';

const VALID_SECTIONS = ['overview', 'order-management', 'inbound-qc', 'quarantine', 'qc-history'] as const;

type QualitySection = (typeof VALID_SECTIONS)[number];

function sectionFromPathname(pathname: string): QualitySection {
  const segment = pathname.replace(/^\/quality\/?/, '').toLowerCase().split('/')[0] || '';
  if (segment === 'quarantine') return 'order-management';
  return VALID_SECTIONS.includes(segment as QualitySection) ? (segment as QualitySection) : 'overview';
}

const QualityPage = (): JSX.Element => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const activeSection = sectionFromPathname(pathname);

  const handleSectionChange = (sectionId: string): void => {
    if (sectionId === 'overview') navigate('/quality');
    else navigate(`/quality/${sectionId}`);
  };

  const renderContent = (): JSX.Element => {
    switch (activeSection) {
      case 'order-management':
      case 'quarantine':
        return <OrderManagementQueue />;
      case 'inbound-qc':
        return <InboundQcQueue />;
      case 'qc-history':
        return <QcHistory />;
      case 'overview':
      default:
        return <QualityOverview />;
    }
  };

  return (
    <div className="flex h-screen bg-white">
      <QualitySidebar activeSection={activeSection} onSectionChange={handleSectionChange} />
      {renderContent()}
    </div>
  );
};

export default QualityPage;
