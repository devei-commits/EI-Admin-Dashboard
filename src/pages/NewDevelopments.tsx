import React from 'react';
import { PISProvider } from '../components/pis/context/PISContext';
import { NewPISView } from '../components/pis/components/NewPISView';
import { Toaster } from '../components/pis/components/ui/sonner';

const NewDevelopments: React.FC = () => {
 return (
  <PISProvider>
   <div className="w-full min-h-screen bg-surface-2/50">
    <NewPISView />
    <Toaster position="top-right" richColors />
   </div>
  </PISProvider>
 );
};

export default NewDevelopments;
