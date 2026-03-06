import { useLocation, useNavigate } from 'react-router-dom';
import WarehouseSidebar from '../components/WarehouseSidebar';
import WarehouseOverview from './warehouse/Overview';
import WarehouseLocations from './warehouse/Locations';
import WarehouseInventory from './warehouse/Inventory';
import WarehouseInbound from './warehouse/Inbound';
import WarehouseOutbound from './warehouse/Outbound';

const VALID_SECTIONS = ['overview', 'locations', 'inventory', 'inbound', 'outbound'] as const;

function sectionFromPathname(pathname: string): string {
  const segment = pathname.replace(/^\/warehouse\/?/, '').toLowerCase().split('/')[0] || '';
  return VALID_SECTIONS.includes(segment as any) ? segment : 'overview';
}

const WarehousePage = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const activeSection = sectionFromPathname(pathname);

  const handleSectionChange = (sectionId: string) => {
    if (sectionId === 'overview') navigate('/warehouse');
    else navigate(`/warehouse/${sectionId}`);
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return <WarehouseOverview />;
      case 'locations':
        return <WarehouseLocations />;
      case 'inventory':
        return <WarehouseInventory />;
      case 'inbound':
        return <WarehouseInbound />;
      case 'outbound':
        return <WarehouseOutbound />;
      default:
        return <WarehouseOverview />;
    }
  };

  return (
    <div className="flex h-screen bg-white">
      <WarehouseSidebar activeSection={activeSection} onSectionChange={handleSectionChange} />
      {renderContent()}
    </div>
  );
};

export default WarehousePage;
