import { AlertTriangle } from 'lucide-react';
import { FeasibilityCardIcon } from './FeasibilityCardIcon';

interface FeasibilityCardProps {
  type: 'rm' | 'pm' | 'combined';
  title: string;
  possibleUnits: number;
  limitingFactor: string;
  isShortfall: boolean;
  needed?: number;
  canDo?: number;
}

export const FeasibilityCard = ({
  type,
  title,
  possibleUnits,
  limitingFactor,
  isShortfall,
  needed,
  canDo,
}: FeasibilityCardProps) => {
  const baseClasses = 'border-2 rounded-lg p-4';
  const colorClasses = {
    rm: 'border-cyan-200 bg-cyan-50 text-cyan-800',
    pm: 'border-purple-200 bg-purple-50 text-purple-800',
    combined: 'border-yellow-200 bg-yellow-50 text-yellow-800',
  };
  const shortfallClasses = 'border-red-300 bg-red-50 text-red-800';

  return (
    <div className={`${baseClasses} ${isShortfall ? shortfallClasses : colorClasses[type]}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className={`text-sm font-bold flex items-center gap-2 ${isShortfall ? 'text-red-700' : ''}`}>
          <FeasibilityCardIcon type={type} />
          {title}
        </h3>
      </div>
      <p className={`text-3xl font-bold mb-1 ${isShortfall ? 'text-red-600' : ''}`}>
        {isShortfall ? canDo : Math.floor(possibleUnits / (30000/5))}
      </p>
      <p className="text-xs mb-2">{possibleUnits.toLocaleString()} units possible</p>
      <p className="text-xs">Limiting: {limitingFactor}</p>
      {isShortfall && needed !== undefined && canDo !== undefined && (
        <p className="text-xs font-semibold text-red-600 flex items-center gap-1 mt-2">
          <AlertTriangle className="w-3 h-3" />
          Need {needed}, can do {canDo}
        </p>
      )}
       {!isShortfall && type === 'combined' && (
         <p className="text-xs font-semibold text-green-600 flex items-center gap-1 mt-2">
           No Shortfall
         </p>
       )}
       {isShortfall && type === 'combined' && (
        <p className="text-xs font-semibold text-red-700 flex items-center gap-1 mt-2">
          <AlertTriangle className="w-4 h-4" /> Shortfall — Raise PR
        </p>
       )}
    </div>
  );
};
