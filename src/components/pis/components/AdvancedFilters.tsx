import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { X, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { PISStage, PISStatus, UserRole } from '../types/pis';
import { getStageLabel } from '../utils/permissions';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';

export interface FilterState {
  searchTerm: string;
  stage: string;
  status: string;
  customer: string;
  dateFrom: string;
  dateTo: string;
  bdTeam: string;
  rndTeam: string;
  showCompleted: boolean;
}

interface AdvancedFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  customers: string[];
  currentRole?: UserRole;
}

export function AdvancedFilters({ filters, onFilterChange, customers, currentRole }: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const stages: PISStage[] = [
    'BD_INTAKE',
    'ALIGNMENT',
    'AGREEMENT',
    'RND_LEAD_REVIEW',
    'RND_DEVELOPMENT',
    'QUALITY_REVIEW',
    'PACKAGING',
    'WAY_FORWARD',
    'COMPLETED',
    'TERMINATED',
    'ON_HOLD',
  ];

  const statuses: PISStatus[] = ['PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'ON_HOLD', 'COMPLETED', 'TERMINATED'];

  const updateFilter = (key: keyof FilterState, value: any) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFilterChange({
      searchTerm: '',
      stage: 'all',
      status: 'all',
      customer: 'all',
      dateFrom: '',
      dateTo: '',
      bdTeam: 'all',
      rndTeam: 'all',
      showCompleted: true,
    });
  };

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'showCompleted') return false;
    if (key === 'searchTerm') return value !== '';
    return value !== 'all' && value !== '';
  }).length;

  return (
    <Card className="p-3 sm:p-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
            <h3 className="font-medium text-sm sm:text-base">Advanced Filters</h3>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="text-xs">{activeFilterCount} active</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 justify-between sm:justify-end">
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs sm:text-sm h-8">
                <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                Clear
              </Button>
            )}
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label>Stage</Label>
              <Select value={filters.stage} onValueChange={(value) => updateFilter('stage', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {stages.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {getStageLabel(stage)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={filters.status} onValueChange={(value) => updateFilter('status', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Customer filter - only shown for ADMIN and SUPER_ADMIN (customers belong to them) */}
            {currentRole !== 'CLIENT' && (
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select value={filters.customer} onValueChange={(value) => updateFilter('customer', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Customers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Customers</SelectItem>
                    {customers.map((customer) => (
                      <SelectItem key={customer} value={customer}>
                        {customer}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>BD Team</Label>
              <Select value={filters.bdTeam} onValueChange={(value) => updateFilter('bdTeam', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Team Members" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Team Members</SelectItem>
                  <SelectItem value="Sameer Khan">Sameer Khan</SelectItem>
                  <SelectItem value="Priya Sharma">Priya Sharma</SelectItem>
                  <SelectItem value="Rahul Verma">Rahul Verma</SelectItem>
                  <SelectItem value="Anjali Singh">Anjali Singh</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date From</Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => updateFilter('dateFrom', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Date To</Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => updateFilter('dateTo', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>R&D Team</Label>
              <Select value={filters.rndTeam} onValueChange={(value) => updateFilter('rndTeam', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All R&D Members" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All R&D Members</SelectItem>
                  <SelectItem value="Sanjay Kumar">Sanjay Kumar</SelectItem>
                  <SelectItem value="Dr. Meera Patel">Dr. Meera Patel</SelectItem>
                  <SelectItem value="Vikram Singh">Vikram Singh</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="showCompleted"
              checked={filters.showCompleted}
              onChange={(e) => updateFilter('showCompleted', e.target.checked)}
              className="rounded border-gray-300"
            />
            <Label htmlFor="showCompleted" className="cursor-pointer">
              Include Completed/Terminated PIS
            </Label>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
