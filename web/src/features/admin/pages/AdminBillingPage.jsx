import { useState } from "react";
import { useAuth } from "../../../shared/hooks/useAuth";
import UtilityBillingTab from "../components/billing/UtilityBillingTab";
import RentBillingTab from "../components/billing/RentBillingTab";
import ReservationPaymentReviewTab from "../components/billing/ReservationPaymentReviewTab";
import BillingToolbar from "../components/billing/shared/BillingToolbar";


const AdminBillingPage = () => {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const [activeTab, setActiveTab] = useState("electricity");
  const [branchFilter, setBranchFilter] = useState("");

  return (
    <div>
      <header className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Billing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate statements, review balances, and follow payment progress
            without leaving the admin workspace
          </p>
        </div>

        <BillingToolbar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          branchFilter={isOwner ? branchFilter : undefined}
          onBranchChange={isOwner ? setBranchFilter : undefined}
          isOwner={isOwner}
          user={user}
        />
      </header>

      <div className="mt-5 min-h-[680px]">
        <section
          role="tabpanel"
          id="billing-panel-electricity"
          aria-labelledby="billing-tab-electricity"
          className={activeTab === "electricity" ? "block" : "hidden"}
        >
          <UtilityBillingTab
            utilityType="electricity"
            isActive={activeTab === "electricity"}
            ownerBranchFilter={isOwner ? branchFilter : undefined}
            onOwnerBranchChange={isOwner ? setBranchFilter : undefined}
          />
        </section>

        <section
          role="tabpanel"
          id="billing-panel-water"
          aria-labelledby="billing-tab-water"
          className={activeTab === "water" ? "block" : "hidden"}
        >
          <UtilityBillingTab
            utilityType="water"
            isActive={activeTab === "water"}
            ownerBranchFilter={isOwner ? branchFilter : undefined}
            onOwnerBranchChange={isOwner ? setBranchFilter : undefined}
          />
        </section>

        <section
          role="tabpanel"
          id="billing-panel-rent"
          aria-labelledby="billing-tab-rent"
          className={activeTab === "rent" ? "block" : "hidden"}
        >
          <RentBillingTab isActive={activeTab === "rent"} />
        </section>

        <section
          role="tabpanel"
          id="billing-panel-reservation-payments"
          aria-labelledby="billing-tab-reservation-payments"
          className={activeTab === "reservation-payments" ? "block" : "hidden"}
        >
          <ReservationPaymentReviewTab isActive={activeTab === "reservation-payments"} />
        </section>
      </div>
    </div>
  );
};

export default AdminBillingPage;
