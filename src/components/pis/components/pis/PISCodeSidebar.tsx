import { useState, useMemo } from 'react';
import { PISRecord } from '../../types/pis';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { 
 Search, 
 ChevronLeft, 
 ChevronRight,
 FileText,
 CheckCircle,
 Clock,
 AlertCircle,
 XCircle
} from 'lucide-react';
import { getStageLabel } from '../../utils/permissions';
import { usePIS } from '../../context/PISContext';

interface PISCodeSidebarProps {
 pisRecords: PISRecord[];
 selectedPISId: string | null;
 onSelectPIS: (id: string) => void;
 onClose: () => void;
 isCollapsed?: boolean;
 onToggleCollapse?: () => void;
}

export function PISCodeSidebar({
 pisRecords,
 selectedPISId,
 onSelectPIS,
 onClose,
 isCollapsed = false,
 onToggleCollapse,
}: PISCodeSidebarProps) {
 const { slaDaysByStage } = usePIS();
 const [searchTerm, setSearchTerm] = useState('');
 const [statusFilter, setStatusFilter] = useState<string>('all');

 const getSlaBadge = (pis: PISRecord) => {
  if (!slaDaysByStage) return null;
  if (pis.status === 'COMPLETED' || pis.status === 'TERMINATED') return null;

  const slaDays = slaDaysByStage[pis.stage];
  if (typeof slaDays !== 'number') return null;

  const stageEnteredAt = pis.updatedAt || pis.createdAt;
  const dueAt = new Date(stageEnteredAt);
  dueAt.setDate(dueAt.getDate() + Math.max(0, Math.floor(slaDays)));

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysToDue = Math.ceil((dueAt.getTime() - Date.now()) / msPerDay);

  if (daysToDue < 0) {
   return (
    <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-0">
     Overdue
    </Badge>
   );
  }

  if (daysToDue <= 2) {
   return (
    <Badge className="text-[10px] px-1.5 py-0 bg-gray-100 text-slate-900 border-0">
     Due
    </Badge>
   );
  }

  return null;
 };

 const formatDate = (value: unknown) => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString();
 };

 const filteredRecords = useMemo(() => {
  return pisRecords.filter((pis) => {
   const matchesSearch = 
    pis.pisCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pis.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pis.formulation.toLowerCase().includes(searchTerm.toLowerCase());
   
   const matchesStatus = statusFilter === 'all' || pis.status === statusFilter;
   
   return matchesSearch && matchesStatus;
  });
 }, [pisRecords, searchTerm, statusFilter]);

 const getStatusIcon = (status: string) => {
  switch (status) {
   case 'COMPLETED':
    return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
   case 'IN_PROGRESS':
    return <Clock className="h-3.5 w-3.5 text-blue-500" />;
   case 'PENDING':
    return <Clock className="h-3.5 w-3.5 text-yellow-500" />;
   case 'REJECTED':
   case 'TERMINATED':
    return <XCircle className="h-3.5 w-3.5 text-red-500" />;
   case 'ON_HOLD':
    return <AlertCircle className="h-3.5 w-3.5 text-slate-700" />;
   default:
    return <FileText className="h-3.5 w-3.5 text-gray-400" />;
  }
 };

 const getStatusBadgeColor = (status: string) => {
  const colors: Record<string, string> = {
   COMPLETED: 'bg-green-100 text-green-700',
   IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
   PENDING: 'bg-yellow-100 text-yellow-700',
   APPROVED: 'bg-green-100 text-green-700',
   REJECTED: 'bg-red-100 text-red-700',
   TERMINATED: 'bg-red-100 text-red-700',
   ON_HOLD: 'bg-gray-100 text-slate-900',
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
 };

 // Summary counts
 const statusCounts = useMemo(() => {
  const counts: Record<string, number> = { all: pisRecords.length };
  pisRecords.forEach((pis) => {
   counts[pis.status] = (counts[pis.status] || 0) + 1;
  });
  return counts;
 }, [pisRecords]);

 if (isCollapsed) {
  return (
   <div className="w-12 bg-white border-r flex flex-col items-center py-4 shadow-sm">
    <Button
     variant="ghost"
     size="sm"
     onClick={onToggleCollapse}
     className="mb-4"
     title="Expand PIS List"
    >
     <ChevronRight className="h-5 w-5" />
    </Button>
    <div className="space-y-2">
     {filteredRecords.slice(0, 10).map((pis) => (
      <button
       key={pis.id}
       onClick={() => onSelectPIS(pis.id)}
       className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
        pis.id === selectedPISId
         ? 'bg-blue-600 text-white shadow-lg'
         : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
       )}
       title={pis.pisCode}
      >
       {pis.pisCode.slice(-2)}
      </button>
     ))}
     {filteredRecords.length > 10 && (
      <div className="text-xs text-gray-400 text-center">
       +{filteredRecords.length - 10}
      </div>
     )}
    </div>
   </div>
  );
 }

 return (
  <div className="w-72 bg-white border-r flex flex-col h-full shadow-sm animate-in slide-in-from-left-2 fade-in-0 duration-300">
   {/* Header */}
   <div className="p-3 border-b bg-[#2C3E50]">
    <div className="flex items-center justify-between mb-2">
     <h3 className="font-semibold text-white flex items-center gap-2">
      <FileText className="h-4 w-4" />
      PIS Records
     </h3>
     <div className="flex items-center gap-1">
      {onToggleCollapse && (
       <Button
        variant="ghost"
        size="sm"
        onClick={onToggleCollapse}
        className="h-7 w-7 p-0 text-white hover:bg-white/20"
       >
        <ChevronLeft className="h-4 w-4" />
       </Button>
      )}
      <Button
       variant="ghost"
       size="sm"
       onClick={onClose}
       className="h-7 w-7 p-0 text-white hover:bg-white/20"
      >
       <XCircle className="h-4 w-4" />
      </Button>
     </div>
    </div>
    <Badge variant="secondary" className="text-xs bg-white/20 text-white border-0">
     {filteredRecords.length} records
    </Badge>
   </div>

   {/* Search */}
   <div className="p-3 border-b">
    <div className="relative">
     <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
     <Input
      placeholder="Search PIS..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="pl-8 h-9 text-sm"
     />
    </div>
   </div>

   {/* Status Filter Tabs */}
   <div className="flex flex-wrap gap-1 p-2 border-b bg-gray-50">
    {['all', 'IN_PROGRESS', 'PENDING', 'COMPLETED'].map((status) => (
     <button
      key={status}
      onClick={() => setStatusFilter(status)}
      className={cn(
       'px-2 py-1 rounded text-xs font-medium transition-colors',
       statusFilter === status
        ? 'bg-blue-600 text-white'
        : 'bg-white text-gray-600 hover:bg-gray-100 border'
      )}
     >
      {status === 'all' ? 'All' : status.replace('_', ' ')}
      <span className="ml-1 opacity-70">({statusCounts[status] || 0})</span>
     </button>
    ))}
   </div>

   {/* PIS List */}
   <div className="flex-1 overflow-y-auto">
    {filteredRecords.length === 0 ? (
     <div className="p-4 text-center text-gray-500">
      <FileText className="h-10 w-10 mx-auto mb-2 text-gray-300" />
      <p className="text-sm">No PIS records found</p>
     </div>
    ) : (
     <div className="divide-y">
      {filteredRecords.map((pis, index) => (
       <button
        key={pis.id}
        onClick={() => onSelectPIS(pis.id)}
        className={cn(
         'w-full text-left p-3 transition-all hover:bg-gray-50',
         pis.id === selectedPISId && 'bg-blue-50 border-l-4 border-l-blue-600'
        )}
       >
        <div className="flex items-start justify-between gap-2">
         <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
           <span className="text-xs text-gray-400 font-mono">
            {index + 1}.
           </span>
           <span
            className={cn(
             'font-semibold text-sm truncate',
             pis.id === selectedPISId ? 'text-blue-700' : 'text-gray-900'
            )}
           >
            {pis.pisCode}
           </span>
          </div>
          <p className="text-xs text-gray-500 truncate mt-0.5">
           {pis.customer}
          </p>
          <p className="text-xs text-gray-400 truncate">
           {pis.formulation}
          </p>
         </div>
         <div className="flex flex-col items-end gap-1">
          {getStatusIcon(pis.status)}
          <Badge className={cn('text-[10px] px-1.5 py-0', getStatusBadgeColor(pis.status))}>
           {pis.status.replace('_', ' ')}
          </Badge>
          {getSlaBadge(pis)}
         </div>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-gray-400">
         <span>{getStageLabel(pis.stage)}</span>
         <span>{formatDate(pis.updatedAt)}</span>
        </div>
       </button>
      ))}
     </div>
    )}
   </div>

   {/* Footer */}
   <div className="p-2 border-t bg-gray-50 text-center">
    <p className="text-xs text-gray-500">
     Click on a PIS code to view details
    </p>
   </div>
  </div>
 );
}
