import { Beaker, Box, Zap } from 'lucide-react';

export const FeasibilityCardIcon = ({ type }: { type: 'rm' | 'pm' | 'combined' }) => {
  switch (type) {
    case 'rm':
      return <Beaker className="w-4 h-4 text-cyan-600" />;
    case 'pm':
      return <Box className="w-4 h-4 text-purple-600" />;
    case 'combined':
      return <Zap className="w-4 h-4 text-yellow-600" />;
    default:
      return null;
  }
};
