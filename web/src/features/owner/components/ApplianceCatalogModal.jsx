import React, { useState, useMemo } from "react";
import {
  Zap,
  Plus,
  Edit2,
  Archive,
  Search,
  Loader2,
  Package,
  Sparkles,
  Flame,
  Tv,
  Wind,
  X,
} from "lucide-react";
import {
  useAppliances,
  useApplianceMutations,
} from "../../../shared/hooks/queries/useAppliances";
import { showNotification } from "../../../shared/utils/notification";
import getFriendlyError from "../../../shared/utils/friendlyError";
import BaseModal from "../../../shared/components/BaseModal";
import ConfirmModal from "../../../shared/components/ConfirmModal";
import ApplianceFormModal from "./ApplianceFormModal";

const CATEGORY_MAP = {
  cooling: { label: "Cooling", icon: Wind },
  cooking: { label: "Cooking", icon: Flame },
  electronics: { label: "Electronics", icon: Tv },
  personal_care: { label: "Personal Care", icon: Sparkles },
  general: { label: "General", icon: Package },
};

export default function ApplianceCatalogModal({ isOpen, onClose }) {
  const { data: rawAppliances = [], isLoading, refetch } = useAppliances({
    includeInactive: true,
  });

  const {
    createAppliance,
    updateAppliance,
    archiveAppliance,
    isCreating,
    isUpdating,
    isArchiving,
  } = useApplianceMutations();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | null
  const [activeItem, setActiveItem] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const appliances = useMemo(() => {
    return Array.isArray(rawAppliances) ? rawAppliances : [];
  }, [rawAppliances]);

  const filteredAppliances = useMemo(() => {
    return appliances.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.name?.toLowerCase().includes(q) ||
        item.code?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q);

      const matchesCat =
        selectedCategory === "all" || item.category === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [appliances, searchQuery, selectedCategory]);

  const activeCount = useMemo(() => {
    return appliances.filter((a) => a.isActive).length;
  }, [appliances]);

  const handleOpenCreate = () => {
    setActiveItem(null);
    setModalMode("create");
  };

  const handleOpenEdit = (item) => {
    setActiveItem(item);
    setModalMode("edit");
  };

  const handleCloseFormModal = () => {
    setModalMode(null);
    setActiveItem(null);
  };

  const handleSubmitForm = async (payload) => {
    try {
      if (modalMode === "create") {
        await createAppliance(payload);
        showNotification("Appliance added to catalog successfully", "success");
      } else if (modalMode === "edit" && activeItem?._id) {
        await updateAppliance({ id: activeItem._id, updates: payload });
        showNotification("Appliance updated successfully", "success");
      }
      refetch();
    } catch (err) {
      const msg = getFriendlyError(err) || "Failed to save appliance.";
      showNotification(msg, "error");
      throw err;
    }
  };

  const handleToggleStatus = async (item) => {
    setTogglingId(item._id);
    try {
      await updateAppliance({
        id: item._id,
        updates: { isActive: !item.isActive },
      });
      showNotification(
        `Appliance ${!item.isActive ? "activated" : "deactivated"} in catalog`,
        "success"
      );
      refetch();
    } catch (err) {
      const msg = getFriendlyError(err) || "Failed to update appliance status.";
      showNotification(msg, "error");
    } finally {
      setTogglingId(null);
    }
  };

  const handleConfirmArchive = async () => {
    if (!archiveTarget?._id) return;
    try {
      await archiveAppliance(archiveTarget._id);
      showNotification("Appliance archived successfully", "success");
      setArchiveTarget(null);
      refetch();
    } catch (err) {
      const msg = getFriendlyError(err) || "Failed to archive appliance.";
      showNotification(msg, "error");
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Appliance Surcharge Catalog"
      subtitle="Manage allowed tenant appliances, monthly surcharge rates, and quantity limits."
      size="2xl"
      footer={null}
      cancelText={null}
    >
      <div className="space-y-4 pt-1">
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 flex-1">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search appliances by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Categories</option>
              <option value="cooling">Cooling & Air</option>
              <option value="cooking">Cooking & Kitchen</option>
              <option value="electronics">Electronics & Computing</option>
              <option value="personal_care">Personal Care</option>
              <option value="general">General</option>
            </select>
          </div>

          <div className="flex items-center gap-2.5 justify-between sm:justify-end shrink-0">
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap">
              {activeCount} Active in Catalog
            </span>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5 shrink-0 shadow-2xs"
              aria-label="Add new appliance"
            >
              <Plus size={14} />
              <span>Add Appliance</span>
            </button>
          </div>
        </div>

        {/* Catalog Table Container */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-[52vh] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800/90 backdrop-blur-xs border-b border-slate-200 dark:border-slate-700">
              <tr className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 min-w-[200px]">Appliance</th>
                <th className="py-3 px-4 min-w-[120px]">Category</th>
                <th className="py-3 px-4 min-w-[140px]">Monthly Surcharge</th>
                <th className="py-3 px-4 min-w-[110px]">Max Limit</th>
                <th className="py-3 px-4 min-w-[110px]">Status</th>
                <th className="py-3 px-4 min-w-[90px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900/50">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span>Loading appliance catalog...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredAppliances.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    <Package className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="font-medium text-slate-600 dark:text-slate-300">
                      No appliances found
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {searchQuery
                        ? "Try adjusting your search query or category filter."
                        : "Click 'Add Appliance' to add the first item to the catalog."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredAppliances.map((item) => {
                  const catMeta = CATEGORY_MAP[item.category] || CATEGORY_MAP.general;
                  const CatIcon = catMeta.icon;
                  const isToggling = togglingId === item._id;

                  return (
                    <tr
                      key={item._id || item.code}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                        !item.isActive ? "opacity-60 bg-slate-50/30 dark:bg-slate-900/20" : ""
                      }`}
                    >
                      {/* Appliance Name & Code */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                            <CatIcon size={14} className="text-slate-600 dark:text-slate-300" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                              {item.name}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              code: {item.code}
                            </p>
                            {item.description && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300">
                          {catMeta.label}
                        </span>
                      </td>

                      {/* Monthly Surcharge */}
                      <td className="py-3 px-4">
                        <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                          ₱{Number(item.monthlyFee || 0).toLocaleString("en-PH")}
                        </span>
                        <span className="text-[11px] text-slate-400 font-normal"> / mo</span>
                      </td>

                      {/* Max Quantity */}
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">
                          Max {item.maxQuantity || 5} units
                        </span>
                      </td>

                      {/* Active Status Switch */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={item.isActive}
                            aria-label={`Toggle active state for ${item.name}`}
                            onClick={() => handleToggleStatus(item)}
                            disabled={isToggling || isUpdating}
                            className={`w-9 h-5 rounded-full transition-colors relative flex items-center p-0.5 ${
                              item.isActive
                                ? "bg-emerald-500"
                                : "bg-slate-300 dark:bg-slate-600"
                            } ${isToggling ? "opacity-50 cursor-wait" : ""}`}
                          >
                            <div
                              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                                item.isActive ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>
                          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                            {item.isActive ? "Active" : "Archived"}
                          </span>
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Edit appliance settings"
                            aria-label={`Edit ${item.name}`}
                          >
                            <Edit2 size={13} />
                          </button>
                          {item.isActive && (
                            <button
                              type="button"
                              onClick={() => setArchiveTarget(item)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                              title="Archive appliance"
                              aria-label={`Archive ${item.name}`}
                            >
                              <Archive size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Changes apply to new room booking selections immediately.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>

      {/* Child Form Dialog */}
      <ApplianceFormModal
        isOpen={modalMode !== null}
        onClose={handleCloseFormModal}
        initialData={activeItem}
        existingAppliances={appliances}
        onSubmit={handleSubmitForm}
        isSubmitting={isCreating || isUpdating}
      />

      {/* Child Archive Confirm Dialog */}
      <ConfirmModal
        isOpen={archiveTarget !== null}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleConfirmArchive}
        title="Archive Appliance?"
        subtitle={`Are you sure you want to archive "${archiveTarget?.name}"?`}
        message="Archiving will hide this appliance from new tenant room bookings. Existing active reservations, contracts, and previous billing records will remain unaffected."
        confirmText="Archive Appliance"
        variant="danger"
        isLoading={isArchiving}
      />
    </BaseModal>
  );
}
