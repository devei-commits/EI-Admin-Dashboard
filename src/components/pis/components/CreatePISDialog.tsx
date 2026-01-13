import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { PISRecord, Customer, Product } from '../types/pis';
import { toast } from 'sonner';
import { usePIS } from '../context/PISContext';

interface CreatePISDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pis: PISRecord) => void;
}

export function CreatePISDialog({ isOpen, onClose, onSubmit }: CreatePISDialogProps) {
  const { customers, products } = usePIS();

  const [formData, setFormData] = useState({
    customerId: '',
    productCode: '',
    description: '',
    bdTeam: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const selectedCustomer = customers.find((c: Customer) => c.id === formData.customerId);
    const selectedProduct = products.find((p: Product) => p.code === formData.productCode);

    if (!selectedCustomer || !selectedProduct) {
      toast.error('Please fill in all required fields');
      return;
    }

    const newPIS: PISRecord = {
      id: `PIS-${Date.now()}`,
      pisCode: `EI/PIS/${new Date().toLocaleString('default', { month: 'short' }).toUpperCase()}/${new Date().getFullYear().toString().slice(-2)}/${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      formulation: selectedProduct.code,
      customer: selectedCustomer.company,
      customerId: selectedCustomer.id,
      costName: selectedProduct.code,
      productCode: selectedProduct.code,
      rdStaff: 'Pending Assignment',
      stage: 'BD_INTAKE',
      status: 'PENDING',
      m1: false,
      v1: false,
      rdO1: false,
      regulatory: false,
      inventory: false,
      formLabel: 'Initial Intake',
      sop: false,
      ac: false,
      oc: false,
      mop: false,
      coa: false,
      pre: false,
      stabilityMatch: false,
      prs: false,
      sensory: false,
      bdTeam: formData.bdTeam || 'Pending Assignment',
      rndLeadAssignment: 'Not Assigned',
      rndStaffAssignment: 'Not Assigned',
      qaAssignment: 'Not Assigned',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    onSubmit(newPIS);
    toast.success('PIS created successfully');
    setFormData({ customerId: '', productCode: '', description: '', bdTeam: '' });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New PIS</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer">Customer *</Label>
              <Select
                value={formData.customerId}
                onValueChange={(value) => setFormData({ ...formData, customerId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer: Customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product">Product / Formulation *</Label>
              <Select
                value={formData.productCode}
                onValueChange={(value) => setFormData({ ...formData, productCode: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product: Product) => (
                    <SelectItem key={product.id} value={product.code}>
                      {product.code} - {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bdTeam">BD Team Assignment</Label>
            <Select value={formData.bdTeam} onValueChange={(value) => setFormData({ ...formData, bdTeam: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select BD team member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Sameer Khan">Sameer Khan</SelectItem>
                <SelectItem value="Priya Sharma">Priya Sharma</SelectItem>
                <SelectItem value="Rahul Verma">Rahul Verma</SelectItem>
                <SelectItem value="Anjali Singh">Anjali Singh</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description / Notes</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter any additional notes or requirements"
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Create PIS</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
