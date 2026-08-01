import { useLocation, useNavigate } from 'react-router-dom';
import QualitySidebar from '../components/QualitySidebar';
import QualityOverview from './quality/Overview';
import InboundQcQueue from './quality/InboundQcQueue';
import OrderManagementQueue from './quality/OrderManagementQueue';
import QcHistory from './quality/QcHistory';
import ThirdPartyTestTracking from './quality/ThirdPartyTestTracking';
import QualityDevelopmentsSection from './quality/QualityDevelopmentsSection';
import { qualityDevelopmentSectionByRouteId } from '../constants/qualityDevelopmentsStatic';

const OPERATIONS_SECTIONS = ['overview', 'order-management', 'inbound-qc', 'quarantine', 'qc-history', 'third-party-tracking'] as const;
const DEVELOPMENT_ROUTE_IDS = ['rm-developments', 'pm-developments', 'pis-developments'] as const;

type OperationsSection = (typeof OPERATIONS_SECTIONS)[number];
type QualitySection = OperationsSection | (typeof DEVELOPMENT_ROUTE_IDS)[number];

function sectionFromPathname(pathname: string): QualitySection {
  const segment = pathname.replace(/^\/quality\/?/, '').toLowerCase().split('/')[0] || '';
  if (segment === 'quarantine') return 'order-management';
  if (DEVELOPMENT_ROUTE_IDS.includes(segment as (typeof DEVELOPMENT_ROUTE_IDS)[number])) {
    return segment as (typeof DEVELOPMENT_ROUTE_IDS)[number];
  }
  return OPERATIONS_SECTIONS.includes(segment as OperationsSection)
    ? (segment as OperationsSection)
    : 'overview';
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
    const developmentSection = qualityDevelopmentSectionByRouteId(activeSection);
    if (developmentSection) {
      return <QualityDevelopmentsSection config={developmentSection} />;
    }

    switch (activeSection) {
      case 'order-management':
      case 'quarantine':
        return <OrderManagementQueue />;
      case 'inbound-qc':
        return <InboundQcQueue />;
      case 'qc-history':
        return <QcHistory />;
      case 'third-party-tracking':
        return <ThirdPartyTestTracking />;
      case 'overview':
      default:
        return <QualityOverview />;
    }
  };

  return (
    <div className="flex h-screen bg-surface">
      <QualitySidebar activeSection={activeSection} onSectionChange={handleSectionChange} />
      {renderContent()}
    </div>
  );
};

export default QualityPage;
