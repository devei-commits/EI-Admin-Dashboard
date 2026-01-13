import React from 'react';

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className }) => {
  return (
    <img
      src="/logo.svg"
      alt="Esthetic Insights"
      className={className || 'h-8 sm:h-10 w-auto object-contain'}
    />
  );
};
