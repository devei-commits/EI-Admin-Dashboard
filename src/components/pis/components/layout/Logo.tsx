import React from 'react';
import eilogofull from '../../../../assets/logo/eilogofull.svg';

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className }) => {
  return (
    <img
      src={eilogofull}
      alt="Esthetic Insights"
      className={className || 'h-9 sm:h-10 w-auto object-contain'}
    />
  );
};
