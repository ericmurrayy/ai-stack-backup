// Murray's FSM - Add Customer Button (Client Component)
// =======================================================

'use client';

import { useState, type ReactNode } from 'react';
import { AddCustomerModal } from './AddCustomerModal';

interface AddCustomerButtonProps {
  children: ReactNode;
}

export function AddCustomerButton({ children }: AddCustomerButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <span onClick={() => setOpen(true)} className="cursor-pointer">
        {children}
      </span>
      <AddCustomerModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
