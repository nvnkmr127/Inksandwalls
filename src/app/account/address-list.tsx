"use client";

import { useState } from "react";
import { AddressForm } from "@/components/checkout/address-form";
import { 
  createAddressAction, 
  updateAddressAction, 
  deleteAddressAction, 
  setDefaultShippingAction 
} from "@/app/actions/address";
import type { AddressRecord } from "@/lib/address/address-service";
import type { AddressInput } from "@/lib/address/address-schema";
import { Button } from "@/components/ui/button";
import { MapPin, Plus, Trash2, Edit2, Star, Loader2 } from "lucide-react";

export default function AddressList({ initialAddresses }: { initialAddresses: AddressRecord[] }) {
  const [addresses, setAddresses] = useState<AddressRecord[]>(initialAddresses);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = async (data: AddressInput) => {
    setFormError(null);
    const res = await createAddressAction(data);
    if (res.success && res.address) {
      setAddresses(prev => [res.address!, ...prev].sort((a, b) => Number(b.isDefaultShipping) - Number(a.isDefaultShipping)));
      setIsAdding(false);
    } else {
      throw new Error(res.error || "Failed to create address");
    }
  };

  const handleUpdate = async (id: string, data: AddressInput) => {
    setFormError(null);
    const res = await updateAddressAction(id, data);
    if (res.success && res.address) {
      setAddresses(prev => prev.map(a => a.id === id ? res.address! : (res.address!.isDefaultShipping ? { ...a, isDefaultShipping: false } : a)).sort((a, b) => Number(b.isDefaultShipping) - Number(a.isDefaultShipping)));
      setEditingId(null);
    } else {
      throw new Error(res.error || "Failed to update address");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this address?")) return;
    setLoadingId(id);
    setFormError(null);
    const res = await deleteAddressAction(id);
    if (res.success) {
      setAddresses(prev => prev.filter(a => a.id !== id));
    } else {
      setFormError(res.error || "Failed to delete address");
    }
    setLoadingId(null);
  };

  const handleSetDefault = async (id: string) => {
    setLoadingId(id);
    setFormError(null);
    const res = await setDefaultShippingAction(id);
    if (res.success && res.address) {
      setAddresses(prev => prev.map(a => a.id === id ? res.address! : { ...a, isDefaultShipping: false }).sort((a, b) => Number(b.isDefaultShipping) - Number(a.isDefaultShipping)));
    } else {
      setFormError(res.error || "Failed to set default address");
    }
    setLoadingId(null);
  };

  if (isAdding) {
    return (
      <div className="max-w-2xl">
        <h3 className="text-lg font-medium mb-4">Add New Address</h3>
        <AddressForm 
          onSubmit={handleCreate} 
          onCancel={() => setIsAdding(false)} 
          submitLabel="Save Address"
        />
      </div>
    );
  }

  if (editingId) {
    const addressToEdit = addresses.find(a => a.id === editingId);
    if (addressToEdit) {
      return (
        <div className="max-w-2xl">
          <h3 className="text-lg font-medium mb-4">Edit Address</h3>
          <AddressForm 
            initialValues={addressToEdit}
            onSubmit={(data) => handleUpdate(editingId, data)} 
            onCancel={() => setEditingId(null)} 
            submitLabel="Update Address"
          />
        </div>
      );
    }
  }

  return (
    <div className="space-y-4">
      {formError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm max-w-2xl">
          {formError}
        </div>
      )}
      
      {addresses.length === 0 ? (
        <div className="bg-neutral-50 border border-dashed border-neutral-300 rounded-xl p-8 text-center max-w-2xl">
          <div className="mx-auto w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center mb-3">
            <MapPin className="w-6 h-6 text-neutral-400" />
          </div>
          <p className="text-neutral-600 mb-4">You haven't saved any addresses yet.</p>
          <Button onClick={() => setIsAdding(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add New Address
          </Button>
        </div>
      ) : (
        <>
          <Button onClick={() => setIsAdding(true)} variant="outline" className="mb-4">
            <Plus className="w-4 h-4 mr-2" />
            Add New Address
          </Button>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
            {addresses.map((address) => (
              <div 
                key={address.id} 
                className={`p-5 rounded-xl border relative transition-colors ${
                  address.isDefaultShipping 
                    ? "border-neutral-900 bg-neutral-50 shadow-xs" 
                    : "border-neutral-200 bg-white hover:border-neutral-300"
                }`}
              >
                {address.isDefaultShipping && (
                  <div className="absolute top-4 right-4 bg-neutral-900 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" />
                    Default
                  </div>
                )}
                
                <h3 className="font-semibold text-neutral-900 mb-1 pr-16">
                  {address.firstName} {address.lastName}
                </h3>
                
                <div className="text-sm text-neutral-600 space-y-1 mb-4">
                  <p>{address.addressLine1}</p>
                  {address.addressLine2 && <p>{address.addressLine2}</p>}
                  <p>{address.city}, {address.state} {address.postalCode}</p>
                  <p>{address.country}</p>
                  {address.phone && <p className="pt-1 text-neutral-500">Phone: {address.phone}</p>}
                </div>
                
                <div className="flex items-center gap-2 pt-4 border-t border-neutral-100">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 px-2 text-neutral-600"
                    onClick={() => setEditingId(address.id)}
                    disabled={loadingId === address.id}
                  >
                    <Edit2 className="w-4 h-4 mr-1.5" />
                    Edit
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    onClick={() => handleDelete(address.id)}
                    disabled={loadingId === address.id}
                  >
                    {loadingId === address.id ? (
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-1.5" />
                    )}
                    Delete
                  </Button>
                  
                  {!address.isDefaultShipping && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 px-2 ml-auto text-neutral-600"
                      onClick={() => handleSetDefault(address.id)}
                      disabled={loadingId === address.id}
                    >
                      {loadingId === address.id ? (
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      ) : (
                        "Set as Default"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
