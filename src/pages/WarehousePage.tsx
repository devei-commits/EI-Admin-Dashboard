import { useState } from 'react';
import WarehouseSidebar from '../components/WarehouseSidebar';
import WarehouseOverview from './warehouse/Overview';
import WarehouseLocations from './warehouse/Locations';
import WarehouseInventory from './warehouse/Inventory';
import WarehouseInbound from './warehouse/Inbound';
import WarehouseOutbound from './warehouse/Outbound';

const WarehousePage = () => {
  const [activeSection, setActiveSection] = useState('overview');

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
      <WarehouseSidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      {renderContent()}
    </div>
  );
};

export default WarehousePage;
