"use client";

import React, { useState } from "react";
import type { CustomerAddress } from "./types";
import { useToast } from "@/components/ui/toast";

interface AddressBookViewProps {
  initialAddresses: CustomerAddress[];
}

export function AddressBookView({ initialAddresses }: AddressBookViewProps) {
  const [addresses, setAddresses] = useState<CustomerAddress[]>(initialAddresses);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);

  // Form State
  const [label, setLabel] = useState<"HOME" | "OFFICE" | "OTHER">("HOME");
  const [consigneeName, setConsigneeName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [division, setDivision] = useState("Dhaka");
  const [district, setDistrict] = useState("Dhaka");
  const [thana, setThana] = useState("Kotwali (Nawabpur)");
  const [addressLine, setAddressLine] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { addToast } = useToast();

  const openAddModal = () => {
    setEditingAddress(null);
    setLabel("HOME");
    setConsigneeName("");
    setContactPhone("+88017");
    setDivision("Dhaka");
    setDistrict("Dhaka");
    setThana("Kotwali (Nawabpur)");
    setAddressLine("");
    setIsDefault(addresses.length === 0);
    setIsModalOpen(true);
  };

  const openEditModal = (addr: CustomerAddress) => {
    setEditingAddress(addr);
    setLabel(addr.label);
    setConsigneeName(addr.consigneeName);
    setContactPhone(addr.contactPhone);
    setDivision(addr.divisionId || "Dhaka");
    setDistrict(addr.districtName);
    setThana(addr.thanaName);
    setAddressLine(addr.addressLine);
    setIsDefault(addr.isDefault);
    setIsModalOpen(true);
  };

  const handleSetDefault = (id: string) => {
    setAddresses((prev) =>
      prev.map((a) => ({
        ...a,
        isDefault: a.id === id,
      }))
    );
    addToast({
      title: "Default Address Updated",
      description: "This address will be pre-selected during checkout.",
      variant: "success",
    });
  };

  const handleDelete = (id: string) => {
    setAddresses((prev) => prev.filter((a) => a.id !== id));
    addToast({
      title: "Address Removed",
      description: "Address has been removed from your saved address book.",
      variant: "info",
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    setTimeout(() => {
      if (editingAddress) {
        // Edit existing
        setAddresses((prev) =>
          prev.map((a) => {
            if (a.id === editingAddress.id) {
              return {
                ...a,
                label,
                consigneeName,
                contactPhone,
                divisionId: division,
                districtName: district,
                thanaName: thana,
                addressLine,
                isDefault: isDefault || (a.isDefault && prev.length === 1),
              };
            }
            return isDefault ? { ...a, isDefault: false } : a;
          })
        );
        addToast({
          title: "Address Saved",
          description: "Your delivery address details have been updated.",
          variant: "success",
        });
      } else {
        // Add new
        const newAddr: CustomerAddress = {
          id: `addr_${Date.now()}`,
          label,
          consigneeName,
          contactPhone,
          divisionId: division,
          districtId: "dist_dhaka",
          districtName: district,
          thanaId: "thana_nawabpur",
          thanaName: thana,
          addressLine,
          isDefault: isDefault || addresses.length === 0,
        };

        setAddresses((prev) => {
          const list = isDefault ? prev.map((a) => ({ ...a, isDefault: false })) : [...prev];
          return [...list, newAddr];
        });

        addToast({
          title: "Address Added",
          description: "New shipping address added to your account.",
          variant: "success",
        });
      }

      setIsSaving(false);
      setIsModalOpen(false);
    }, 400);
  };

  return (
    <div className="address-book-container" role="region" aria-label="Saved Addresses">
      <header className="address-header">
        <div>
          <h1>Saved Delivery Addresses</h1>
          <p>Manage your home, office, and godown dispatch addresses across Bangladesh.</p>
        </div>
        <button
          type="button"
          className="btn btn-add"
          onClick={openAddModal}
          data-testid="add-address-button"
        >
          ➕ Add New Address
        </button>
      </header>

      {addresses.length === 0 ? (
        <div className="zero-state-card">
          <span className="zero-icon">📍</span>
          <h3>No Addresses Saved</h3>
          <p>Add your primary shipping address for fast, 1-click checkout.</p>
          <button type="button" className="btn btn-primary" onClick={openAddModal}>
            Add First Address
          </button>
        </div>
      ) : (
        <div className="addresses-grid">
          {addresses.map((addr) => (
            <article
              key={addr.id}
              className={`address-card ${addr.isDefault ? "is-default" : ""}`}
              data-testid="address-card"
            >
              <div className="card-top">
                <span className={`label-badge label-${addr.label.toLowerCase()}`}>
                  {addr.label === "HOME" ? "🏠 Home" : addr.label === "OFFICE" ? "🏢 Office" : "📦 Godown / Other"}
                </span>
                {addr.isDefault && (
                  <span className="default-pill" data-testid="default-badge">
                    ✓ Default Shipping Address
                  </span>
                )}
              </div>

              <div className="card-body">
                <h3 className="consignee-name">{addr.consigneeName}</h3>
                <span className="contact-phone">{addr.contactPhone}</span>
                <p className="address-street">{addr.addressLine}</p>
                <p className="address-geo">
                  {addr.thanaName}, {addr.districtName}
                </p>
              </div>

              <div className="card-actions">
                <button
                  type="button"
                  className="action-btn"
                  onClick={() => openEditModal(addr)}
                >
                  ✏️ Edit
                </button>
                {!addr.isDefault && (
                  <button
                    type="button"
                    className="action-btn"
                    onClick={() => handleSetDefault(addr.id)}
                  >
                    ⭐ Set Default
                  </button>
                )}
                <button
                  type="button"
                  className="action-btn text-danger"
                  onClick={() => handleDelete(addr.id)}
                >
                  🗑️ Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* ADD / EDIT ADDRESS MODAL */}
      {isModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="address-modal-title">
          <div className="modal-content">
            <div className="modal-header">
              <h3 id="address-modal-title">
                {editingAddress ? "Edit Shipping Address" : "Add New Delivery Address"}
              </h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="address-form">
              {/* Address Label Selector */}
              <div className="form-group">
                <label className="field-label">Address Type</label>
                <div className="channel-pills">
                  {(["HOME", "OFFICE", "OTHER"] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      className={`channel-pill ${label === l ? "active" : ""}`}
                      onClick={() => setLabel(l)}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Consignee Name & Phone */}
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="consignee" className="field-label">Consignee Name</label>
                  <input
                    id="consignee"
                    type="text"
                    placeholder="Recipient's full name"
                    value={consigneeName}
                    onChange={(e) => setConsigneeName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="phone" className="field-label">Contact Phone (+880)</label>
                  <input
                    id="phone"
                    type="text"
                    placeholder="017XXXXXXXX"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Bangladesh Geo Cascade */}
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="division-select" className="field-label">Division</label>
                  <select
                    id="division-select"
                    value={division}
                    onChange={(e) => setDivision(e.target.value)}
                  >
                    <option value="Dhaka">Dhaka (ঢাকা)</option>
                    <option value="Chittagong">Chittagong (চট্টগ্রাম)</option>
                    <option value="Rajshahi">Rajshahi (রাজশাহী)</option>
                    <option value="Khulna">Khulna (খুলনা)</option>
                    <option value="Barisal">Barisal (বরিশাল)</option>
                    <option value="Sylhet">Sylhet (সিলেট)</option>
                    <option value="Rangpur">Rangpur (রংপুর)</option>
                    <option value="Mymensingh">Mymensingh (ময়মনসিংহ)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="district-select" className="field-label">District</label>
                  <select
                    id="district-select"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                  >
                    <option value="Dhaka">Dhaka</option>
                    <option value="Gazipur">Gazipur</option>
                    <option value="Narayanganj">Narayanganj</option>
                    <option value="Tangail">Tangail</option>
                    <option value="Chittagong">Chittagong</option>
                    <option value="Sylhet">Sylhet</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="thana-select" className="field-label">Thana / Upazila</label>
                <select
                  id="thana-select"
                  value={thana}
                  onChange={(e) => setThana(e.target.value)}
                >
                  <option value="Kotwali (Nawabpur)">Kotwali (Nawabpur)</option>
                  <option value="Dhanmondi">Dhanmondi</option>
                  <option value="Gulshan">Gulshan</option>
                  <option value="Banani">Banani</option>
                  <option value="Uttara">Uttara</option>
                  <option value="Mirpur">Mirpur</option>
                  <option value="Motijheel">Motijheel</option>
                </select>
              </div>

              {/* Street Address */}
              <div className="form-group">
                <label htmlFor="street-address" className="field-label">Street Address & Landmark</label>
                <textarea
                  id="street-address"
                  rows={2}
                  placeholder="House/Shop no, road no, building, nearest landmark"
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  required
                />
              </div>

              {/* Default Checkbox */}
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                />
                <span>Set as Default Shipping Address</span>
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save Address"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .address-book-container {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .address-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1.5rem;
          padding-bottom: 1.5rem;
          border-bottom: 1px solid var(--color-border, #e5e7eb);
        }

        @media (max-width: 640px) {
          .address-header {
            flex-direction: column;
          }
        }

        .address-header h1 {
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--color-text-primary);
          margin-bottom: 0.25rem;
        }

        .address-header p {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }

        .btn-add {
          background: #059669;
          color: #ffffff;
          border: none;
          padding: 0.625rem 1.25rem;
          border-radius: var(--radius-md, 0.5rem);
          font-size: 0.875rem;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }

        .btn-add:hover {
          background: #047857;
        }

        .addresses-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .address-card {
          background: var(--color-surface, #ffffff);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: var(--radius-xl, 1.25rem);
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 1.25rem;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
        }

        .address-card.is-default {
          border-color: #059669;
          box-shadow: 0 4px 20px rgba(5, 150, 105, 0.1);
        }

        .card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .label-badge {
          font-size: 0.6875rem;
          font-weight: 700;
          padding: 0.2rem 0.5rem;
          border-radius: 9999px;
          background: #f1f5f9;
          color: #475569;
        }

        .default-pill {
          font-size: 0.6875rem;
          font-weight: 700;
          color: #059669;
          background: #dcfce7;
          padding: 0.2rem 0.5rem;
          border-radius: 9999px;
        }

        .consignee-name {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--color-text-primary);
          margin-bottom: 0.15rem;
        }

        .contact-phone {
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          font-family: var(--font-mono, monospace);
          display: block;
          margin-bottom: 0.75rem;
        }

        .address-street {
          font-size: 0.875rem;
          color: var(--color-text-primary);
          line-height: 1.4;
          margin-bottom: 0.25rem;
        }

        .address-geo {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--color-text-secondary);
        }

        .card-actions {
          display: flex;
          gap: 0.5rem;
          padding-top: 1rem;
          border-top: 1px dashed var(--color-border, #e5e7eb);
        }

        .action-btn {
          background: transparent;
          border: 1px solid var(--color-border, #cbd5e1);
          border-radius: var(--radius-sm, 0.375rem);
          padding: 0.35rem 0.625rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .action-btn:hover {
          background: var(--color-surface-subtle, #f8fafc);
          color: var(--color-text-primary);
        }

        .text-danger:hover {
          background: #fee2e2;
          color: #dc2626;
          border-color: #fca5a5;
        }

        .zero-state-card {
          background: var(--color-surface, #ffffff);
          border: 1px dashed var(--color-border, #cbd5e1);
          border-radius: var(--radius-xl, 1.25rem);
          padding: 3.5rem 1.5rem;
          text-align: center;
          color: var(--color-text-secondary);
        }

        .zero-icon {
          font-size: 3rem;
          display: block;
          margin-bottom: 1rem;
        }

        /* ---------------------------------------------------- */
        /* MODAL STYLES */
        /* ---------------------------------------------------- */
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1.5rem;
        }

        .modal-content {
          background: var(--color-surface, #ffffff);
          border-radius: var(--radius-xl, 1.25rem);
          max-width: 520px;
          width: 100%;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--color-border, #e5e7eb);
        }

        .modal-header h3 {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--color-text-primary);
        }

        .close-btn {
          background: transparent;
          border: none;
          font-size: 1.25rem;
          color: var(--color-text-secondary);
          cursor: pointer;
        }

        .address-form {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          overflow-y: auto;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        @media (max-width: 520px) {
          .form-grid {
            grid-template-columns: 1fr;
          }
        }

        .field-label {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .channel-pills {
          display: flex;
          gap: 0.5rem;
        }

        .channel-pill {
          flex: 1;
          padding: 0.45rem;
          font-size: 0.75rem;
          font-weight: 600;
          border: 1px solid var(--color-border, #cbd5e1);
          border-radius: var(--radius-md, 0.5rem);
          background: transparent;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .channel-pill.active {
          border-color: #059669;
          background: #dcfce7;
          color: #15803d;
          font-weight: 700;
        }

        input, select, textarea {
          padding: 0.625rem 0.875rem;
          border: 1px solid var(--color-border, #cbd5e1);
          border-radius: var(--radius-md, 0.5rem);
          font-size: 0.875rem;
          font-family: inherit;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          cursor: pointer;
          user-select: none;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }

        .btn {
          padding: 0.625rem 1.25rem;
          border-radius: var(--radius-md, 0.5rem);
          font-size: 0.875rem;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-primary {
          background: #059669;
          color: #ffffff;
          border: none;
        }

        .btn-secondary {
          background: transparent;
          color: var(--color-text-primary);
          border: 1px solid var(--color-border, #cbd5e1);
        }
      `}</style>
    </div>
  );
}
