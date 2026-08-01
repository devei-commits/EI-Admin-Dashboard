import { useState } from 'react';
import { PISRecord, UserRole } from '../types/pis';
import { getRolePermissions, getStageLabel } from '../utils/permissions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { 
 Eye, 
 Edit, 
 Download,
 Search,
 ArrowUpDown,
 ChevronLeft,
 ChevronRight,
 RefreshCw,
 Pause,
 Play
} from 'lucide-react';
import { cn } from './ui/utils';
import { toast } from 'sonner';
import { usePIS } from '../context/PISContext';
import { EmptyState } from '../../ui/EmptyState';

interface EnhancedPISTableProps {
 data: PISRecord[];
 currentRole: UserRole;
 onViewDetails: (pis: PISRecord) => void;
 onEditPIS?: (pis: PISRecord) => void;
}

type SortField = 'pisCode' | 'customer' | 'stage' | 'status' | 'updatedAt';
type SortOrder = 'asc' | 'desc';

export function EnhancedPISTable({ data, currentRole, onViewDetails, onEditPIS }: EnhancedPISTableProps) {
 const { slaDaysByStage, isAutoRefreshEnabled, setAutoRefreshEnabled, refreshData } = usePIS();
 const [searchTerm, setSearchTerm] = useState('');
 const [sortField, setSortField] = useState<SortField>('updatedAt');
 const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
 const [currentPage, setCurrentPage] = useState(1);
 const [pageSize] = useState(10);
 const [isRefreshing, setIsRefreshing] = useState(false);
 
 // Get permissions for future use (currently used for role-based UI decisions)
 const _permissions = getRolePermissions(currentRole);
 // Log permissions to verify role-based access
 const handleManualRefresh = async () => {
  setIsRefreshing(true);
  try {
   await refreshData();
   toast.success('Data refreshed successfully');
  } catch {
   toast.error('Failed to refresh data');
  } finally {
   setIsRefreshing(false);
  }
 };

 // Filter data
 const filteredData = data.filter(pis => {
  const matchesSearch = 
   pis.pisCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
   // CLIENT users don't search by customer (customers belong to admin/super admin)
   (currentRole !== 'CLIENT' && pis.customer.toLowerCase().includes(searchTerm.toLowerCase())) ||
   pis.formulation.toLowerCase().includes(searchTerm.toLowerCase()) ||
   pis.rdStaff.toLowerCase().includes(searchTerm.toLowerCase());
  
  return matchesSearch;
 });

 // Sort data
 const sortedData = [...filteredData].sort((a, b) => {
  let comparison = 0;
  
  switch (sortField) {
   case 'pisCode':
    comparison = a.pisCode.localeCompare(b.pisCode);
    break;
   case 'customer':
    // CLIENT users don't sort by customer (customers belong to admin/super admin)
    if (currentRole === 'CLIENT') {
     comparison = 0; // No sorting for CLIENT users
    } else {
     comparison = a.customer.localeCompare(b.customer);
    }
    break;
   case 'stage':
    comparison = a.stage.localeCompare(b.stage);
    break;
   case 'status':
    comparison = a.status.localeCompare(b.status);
    break;
   case 'updatedAt':
    comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
    break;
  }
  
  return sortOrder === 'asc' ? comparison : -comparison;
 });

 // Paginate data
 const totalPages = Math.ceil(sortedData.length / pageSize);
 const paginatedData = sortedData.slice(
  (currentPage - 1) * pageSize,
  currentPage * pageSize
 );

 const handleSort = (field: SortField) => {
  if (sortField === field) {
   setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  } else {
   setSortField(field);
   setSortOrder('asc');
  }
 };

 const exportToCSV = () => {
  const headers = [
   'PIS Code',
   'Formulation',
   'Customer',
   'Stage',
   'Status',
   'BD Team',
   'R&D Lead',
   'R&D Staff',
   'QA Team',
   'Created Date',
   'Updated Date'
  ];

  const rows = filteredData.map(pis => [
   pis.pisCode,
   pis.formulation,
   pis.customer,
   getStageLabel(pis.stage),
   pis.status,
   pis.bdTeam || 'N/A',
   pis.rndLeadAssignment || 'N/A',
   pis.rndStaffAssignment || 'N/A',
   pis.qaAssignment || 'N/A',
   pis.createdAt.toLocaleDateString(),
   pis.updatedAt.toLocaleDateString()
  ]);

  const csvContent = [
   headers.join(','),
   ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `PIS_Export_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  toast.success(`Exported ${filteredData.length} records to CSV`);
 };

 const getStatusBadge = (status: string) => {
  const variants: Record<string, string> = {
   // Yellow - In Progress / Undergoing
   IN_PROGRESS: 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500 border border-yellow-500',
   PENDING: 'bg-yellow-400 text-yellow-900 hover:bg-yellow-500 border border-yellow-500',
   ON_HOLD: 'bg-amber-400 text-amber-900 hover:bg-slate-800 border border-slate-800',
   // Green - Done / Approved
   APPROVED: 'bg-green-500 text-white hover:bg-green-600 border border-green-600',
   COMPLETED: 'bg-green-500 text-white hover:bg-green-600 border border-green-600',
   // Red - Rejected / Not Approved
   REJECTED: 'bg-red-500 text-white hover:bg-red-600 border border-red-600',
   TERMINATED: 'bg-red-500 text-white hover:bg-red-600 border border-red-600',
  };
  
  return (
   <Badge className={cn('font-medium shadow-sm', variants[status] || 'bg-gray-100 text-gray-800')}>
    {status.replace('_', ' ')}
   </Badge>
  );
 };

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
    <Badge className="bg-red-100 text-red-700 border-0">
     Overdue {Math.abs(daysToDue)}d
    </Badge>
   );
  }

  if (daysToDue === 0) {
   return (
    <Badge className="bg-gray-100 text-slate-900 border-0">
     Due today
    </Badge>
   );
  }

  if (daysToDue <= 2) {
   return (
    <Badge className="bg-gray-100 text-slate-900 border-0">
     Due {daysToDue}d
    </Badge>
   );
  }

  return (
   <Badge className="bg-gray-100 text-gray-700 border-0">
    Due {daysToDue}d
   </Badge>
  );
 };

 return (
  <div className="space-y-4">
   {/* Search and Export */}
   <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center sm:justify-between">
    <div className="relative flex-1 w-full sm:max-w-md">
     <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
     <Input
      placeholder={currentRole === 'CLIENT' 
       ? "Quick search PIS Code, Formulation..." 
       : "Quick search PIS Code, Customer, Formulation..."}
      value={searchTerm}
      onChange={(e) => {
       setSearchTerm(e.target.value);
       setCurrentPage(1);
      }}
      className="pl-10"
     />
    </div>
    
    <div className="flex gap-2 w-full sm:w-auto">
     <Button 
      variant="outline" 
      size="icon"
      onClick={handleManualRefresh}
      disabled={isRefreshing}
      className={cn(isRefreshing && "animate-spin")}
      title="Refresh data"
     >
      <RefreshCw className="h-4 w-4" />
     </Button>
     
     <Button 
      variant="outline" 
      size="icon"
      onClick={() => setAutoRefreshEnabled(!isAutoRefreshEnabled)}
      className={cn(!isAutoRefreshEnabled && "bg-yellow-50 border-yellow-300")}
      title={isAutoRefreshEnabled ? "Pause auto-refresh" : "Resume auto-refresh"}
     >
      {isAutoRefreshEnabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
     </Button>

     <Button variant="outline" onClick={exportToCSV} className="gap-2 flex-1 sm:flex-initial">
      <Download className="h-4 w-4" />
      Export CSV
     </Button>
    </div>
   </div>

   {/* Table */}
   <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
    <div className="overflow-x-auto">
     <Table>
      <TableHeader>
       <TableRow className="bg-[#2C3E50] hover:bg-[#2C3E50]">
        <TableHead className="text-white w-12">#</TableHead>
        <TableHead className="text-white min-w-[200px]">
         <button
          onClick={() => handleSort('pisCode')}
          className="flex items-center gap-1 hover:text-gray-200"
         >
          PIS CODE <ArrowUpDown className="h-3 w-3" />
         </button>
        </TableHead>
        <TableHead className="text-white min-w-[150px]">Formulation CODE</TableHead>
        <TableHead className="text-white min-w-[150px]">
         {/* Customer column - CLIENT users can't sort (customers belong to admin/super admin) */}
         {currentRole === 'CLIENT' ? (
          'Customer'
         ) : (
          <button
           onClick={() => handleSort('customer')}
           className="flex items-center gap-1 hover:text-gray-200"
          >
           Customer <ArrowUpDown className="h-3 w-3" />
          </button>
         )}
        </TableHead>
        <TableHead className="text-white min-w-[100px]">R&D Staff</TableHead>
        <TableHead className="text-white text-center w-16">M1</TableHead>
        <TableHead className="text-white text-center w-16">V1</TableHead>
        <TableHead className="text-white text-center w-16">R&D1</TableHead>
        <TableHead className="text-white text-center w-16">Reg</TableHead>
        <TableHead className="text-white text-center w-16">Inv</TableHead>
        <TableHead className="text-white min-w-[120px]">Form Label</TableHead>
        <TableHead className="text-white text-center w-16">SOP</TableHead>
        <TableHead className="text-white text-center w-16">AC</TableHead>
        <TableHead className="text-white text-center w-16">OC</TableHead>
        <TableHead className="text-white text-center w-16">MOP</TableHead>
        <TableHead className="text-white text-center w-16">COA</TableHead>
        <TableHead className="text-white text-center w-16">PRE</TableHead>
        <TableHead className="text-white text-center w-20">Stability</TableHead>
        <TableHead className="text-white text-center w-16">PRS</TableHead>
        <TableHead className="text-white text-center w-20">Sensory</TableHead>
        <TableHead className="text-white min-w-[150px]">BD Team</TableHead>
        <TableHead className="text-white min-w-[150px]">
         <button
          onClick={() => handleSort('stage')}
          className="flex items-center gap-1 hover:text-gray-200"
         >
          Stage <ArrowUpDown className="h-3 w-3" />
         </button>
        </TableHead>
        <TableHead className="text-white min-w-[120px]">
         <button
          onClick={() => handleSort('status')}
          className="flex items-center gap-1 hover:text-gray-200"
         >
          Status <ArrowUpDown className="h-3 w-3" />
         </button>
        </TableHead>
        <TableHead className="text-white min-w-[120px]">Actions</TableHead>
       </TableRow>
      </TableHeader>
      <TableBody>
       {paginatedData.length === 0 ? (
        <TableRow>
         <TableCell colSpan={23} className="text-center">
          <EmptyState
           icon={<Search />}
           title="No PIS records found"
           description="Try adjusting your search or filters"
          />
         </TableCell>
        </TableRow>
       ) : (
        paginatedData.map((pis, index) => {
         // Row background colors based on status
         const rowBgColor = 
          pis.status === 'COMPLETED' || pis.status === 'APPROVED'
           ? 'bg-green-50 hover:bg-green-100 border-l-4 border-l-green-500'
           : pis.status === 'REJECTED' || pis.status === 'TERMINATED'
            ? 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500'
            : pis.status === 'IN_PROGRESS' || pis.status === 'PENDING'
             ? 'bg-yellow-50 hover:bg-yellow-100 border-l-4 border-l-yellow-500'
             : pis.status === 'ON_HOLD'
              ? 'bg-gray-50 hover:bg-gray-100 border-l-4 border-l-amber-500'
              : 'hover:bg-gray-50';
         
         return (
          <TableRow key={pis.id} className={cn(rowBgColor, 'transition-colors')}>
           <TableCell className="font-medium">{(currentPage - 1) * pageSize + index + 1}</TableCell>
           <TableCell className="font-medium">
            <button
             onClick={() => onViewDetails(pis)}
             className="text-blue-600 hover:text-blue-800 hover:underline text-left transition-colors"
            >
             {pis.pisCode}
            </button>
           </TableCell>
           <TableCell className="text-sm">{pis.formulation}</TableCell>
           <TableCell className="font-medium">{pis.customer}</TableCell>
           <TableCell className="text-sm">{pis.rdStaff}</TableCell>
           <TableCell className="text-center">
            <div className={cn(
             "inline-flex items-center justify-center w-10 h-8 rounded",
             pis.m1 ? "bg-green-500" : "bg-gray-100"
            )}>
             {pis.m1 && <span className="text-white text-sm font-bold">Yes</span>}
            </div>
           </TableCell>
           <TableCell className="text-center">
            <div className={cn(
             "inline-flex items-center justify-center w-10 h-8 rounded",
             pis.v1 ? "bg-green-500" : "bg-gray-100"
            )}>
             {pis.v1 && <span className="text-white text-sm font-bold">Yes</span>}
            </div>
           </TableCell>
           <TableCell className="text-center">
            <div className={cn(
             "inline-flex items-center justify-center w-10 h-8 rounded",
             pis.rdO1 ? "bg-green-500" : "bg-gray-100"
            )}>
             {pis.rdO1 && <span className="text-white text-sm font-bold">Yes</span>}
            </div>
           </TableCell>
           <TableCell className="text-center">
            <div className={cn(
             "inline-flex items-center justify-center w-10 h-8 rounded",
             pis.regulatory ? "bg-green-500" : "bg-gray-100"
            )}>
             {pis.regulatory && <span className="text-white text-sm font-bold">Yes</span>}
            </div>
           </TableCell>
           <TableCell className="text-center">
            <div className={cn(
             "inline-flex items-center justify-center w-10 h-8 rounded",
             pis.inventory ? "bg-green-500" : "bg-gray-100"
            )}>
             {pis.inventory && <span className="text-white text-sm font-bold">Yes</span>}
            </div>
           </TableCell>
           <TableCell className="text-sm">{pis.formLabel}</TableCell>
           <TableCell className="text-center">
            <div className={cn(
             "inline-flex items-center justify-center w-10 h-8 rounded",
             pis.sop ? "bg-green-500" : "bg-gray-100"
            )}>
             {pis.sop && <span className="text-white text-sm font-bold">Yes</span>}
            </div>
           </TableCell>
           <TableCell className="text-center">
            <div className={cn(
            "inline-flex items-center justify-center w-10 h-8 rounded",
            pis.ac ? "bg-green-500" : "bg-gray-100"
           )}>
            {pis.ac && <span className="text-white text-sm font-bold">Yes</span>}
           </div>
          </TableCell>
          <TableCell className="text-center">
           <div className={cn(
            "inline-flex items-center justify-center w-10 h-8 rounded",
            pis.oc ? "bg-green-500" : "bg-gray-100"
           )}>
            {pis.oc && <span className="text-white text-sm font-bold">Yes</span>}
           </div>
          </TableCell>
          <TableCell className="text-center">
           <div className={cn(
            "inline-flex items-center justify-center w-10 h-8 rounded",
            pis.mop ? "bg-green-500" : "bg-gray-100"
           )}>
            {pis.mop && <span className="text-white text-sm font-bold">Yes</span>}
           </div>
          </TableCell>
          <TableCell className="text-center">
           <div className={cn(
            "inline-flex items-center justify-center w-10 h-8 rounded",
            pis.coa ? "bg-green-500" : "bg-gray-100"
           )}>
            {pis.coa && <span className="text-white text-sm font-bold">Yes</span>}
           </div>
          </TableCell>
          <TableCell className="text-center">
           <div className={cn(
            "inline-flex items-center justify-center w-10 h-8 rounded",
            pis.pre ? "bg-green-500" : "bg-gray-100"
           )}>
            {pis.pre && <span className="text-white text-sm font-bold">Yes</span>}
           </div>
          </TableCell>
          <TableCell className="text-center">
           <div className={cn(
            "inline-flex items-center justify-center w-10 h-8 rounded",
            pis.stabilityMatch ? "bg-green-500" : "bg-gray-100"
           )}>
            {pis.stabilityMatch && <span className="text-white text-sm font-bold">Yes</span>}
           </div>
          </TableCell>
          <TableCell className="text-center">
           <div className={cn(
            "inline-flex items-center justify-center w-10 h-8 rounded",
            pis.prs ? "bg-green-500" : "bg-gray-100"
           )}>
            {pis.prs && <span className="text-white text-sm font-bold">Yes</span>}
           </div>
          </TableCell>
          <TableCell className="text-center">
           <div className={cn(
            "inline-flex items-center justify-center w-10 h-8 rounded",
            pis.sensory ? "bg-green-500" : "bg-gray-100"
           )}>
            {pis.sensory && <span className="text-white text-sm font-bold">Yes</span>}
           </div>
          </TableCell>
          <TableCell className="text-sm">{pis.bdTeam}</TableCell>
          <TableCell>
           <Badge variant="outline" className="whitespace-nowrap">
            {getStageLabel(pis.stage)}
           </Badge>
          </TableCell>
          <TableCell>
           <div className="flex flex-col gap-1">
            {getStatusBadge(pis.status)}
            {getSlaBadge(pis)}
           </div>
          </TableCell>
          <TableCell>
           <div className="flex gap-1">
            <Button
             size="sm"
             variant="ghost"
             onClick={() => onViewDetails(pis)}
             className="h-8 w-8 p-0"
             title="View Details"
            >
             <Eye className="h-4 w-4" />
            </Button>
            {onEditPIS && (
             <Button
              size="sm"
              variant="ghost"
              onClick={() => onEditPIS(pis)}
              className="h-8 w-8 p-0"
              title="Edit PIS"
             >
              <Edit className="h-4 w-4" />
             </Button>
            )}
           </div>
          </TableCell>
         </TableRow>
         );
        })
       )}
      </TableBody>
     </Table>
    </div>
   </div>

   {/* Pagination */}
   <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-2">
    <div className="text-sm text-gray-600 sm:whitespace-nowrap">
     Showing {paginatedData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
     {Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} entries
     {searchTerm && ` (filtered from ${data.length} total)`}
    </div>
    <div className="flex flex-wrap gap-2 items-center justify-start sm:justify-end">
     <Button
      variant="outline"
      size="sm"
      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
      disabled={currentPage === 1}
     >
      <ChevronLeft className="h-4 w-4" />
      <span className="hidden sm:inline">Previous</span>
     </Button>
     <div className="flex flex-wrap gap-1">
      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
       let pageNum;
       if (totalPages <= 5) {
        pageNum = i + 1;
       } else if (currentPage <= 3) {
        pageNum = i + 1;
       } else if (currentPage >= totalPages - 2) {
        pageNum = totalPages - 4 + i;
       } else {
        pageNum = currentPage - 2 + i;
       }
       
       return (
        <Button
         key={pageNum}
         variant={currentPage === pageNum ? 'default' : 'outline'}
         size="sm"
         onClick={() => setCurrentPage(pageNum)}
         className="w-10"
        >
         {pageNum}
        </Button>
       );
      })}
     </div>
     <Button
      variant="outline"
      size="sm"
      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
      disabled={currentPage === totalPages}
     >
      <span className="hidden sm:inline">Next</span>
      <ChevronRight className="h-4 w-4" />
     </Button>
    </div>
   </div>
  </div>
 );
}
