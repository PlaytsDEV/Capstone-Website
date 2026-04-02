import { useState } from "react";
import { Zap, Droplets } from "lucide-react";
import ElectricityBillingTab from "../components/billing/ElectricityBillingTab";
import WaterBillingTab from "../components/billing/WaterBillingParityTab";
import "./AdminBillingPage.css";

const tabs = [
  { id: "electricity", label: "Electricity", icon: Zap },
  { id: "water", label: "Water", icon: Droplets },
];

const AdminBillingPage = () => {
  const [activeTab, setActiveTab] = useState("electricity");

  return (
    <div className="admin-billing-page">
      <div className="admin-billing-page__header">
        <div>
          <h1 className="admin-billing-page__heading">
            <Zap size={18} />
            Billing Management
          </h1>
          <p className="admin-billing-page__subtitle">
            Manage electricity and water billing periods for all rooms
          </p>
        </div>

        <div className="admin-billing-tabs" role="tablist" aria-label="Billing type">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`admin-billing-tab${activeTab === tab.id ? " is-active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="admin-billing-tab__icon">
                  <Icon size={14} />
                </span>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "electricity" ? <ElectricityBillingTab /> : <WaterBillingTab />}
    </div>
  );
};

export default AdminBillingPage;
