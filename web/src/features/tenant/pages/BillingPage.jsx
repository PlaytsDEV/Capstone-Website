import React, { useState, useEffect } from "react";
import { billingApi } from "../../../shared/api/apiClient";
import TenantLayout from "../../../shared/layouts/TenantLayout";
import "../styles/tenant-common.css";

const BillingPage = () => {
  const [loading, setLoading] = useState(true);
  const [billingData, setBillingData] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    try {
      setLoading(true);
      const [current, history] = await Promise.all([
        billingApi.getCurrentBilling(),
        billingApi.getHistory(50),
      ]);
      setBillingData(current);
      setPaymentHistory(history.bills || []);
    } catch (error) {
      console.error("Failed to load billing data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
  };

  if (loading || !billingData) {
    return (
      <TenantLayout>
        <div className="tenant-page">
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <p>{loading ? "Loading..." : "No billing data available"}</p>
          </div>
        </div>
      </TenantLayout>
    );
  }

  return (
    <TenantLayout>
      <div className="tenant-page">
        <div className="page-header">
          <h1>
            <i className="fas fa-file-invoice-dollar"></i> Billing & Payments
          </h1>
          <p>View your balance, utility breakdown, and payment history</p>
        </div>

        {/* Current Balance */}
        <div className="billing-summary">
          <div className="balance-card">
            <div className="balance-header">
              <h2>Current Balance</h2>
              <span className="due-date">
                Due: {new Date(billingData.dueDate).toLocaleDateString()}
              </span>
            </div>
            <div className="balance-amount">
              {formatCurrency(billingData.currentBalance)}
            </div>
            <button className="btn btn-primary">Upload Proof of Payment</button>
          </div>

          <div className="breakdown-card">
            <h3>Breakdown</h3>
            <div className="breakdown-list">
              <div className="breakdown-item">
                <span>Monthly Rent</span>
                <span>{formatCurrency(billingData.monthlyRent)}</span>
              </div>
              <div className="breakdown-item">
                <span>Electricity</span>
                <span>{formatCurrency(billingData.electricity)}</span>
              </div>
              <div className="breakdown-item">
                <span>Water</span>
                <span>{formatCurrency(billingData.water)}</span>
              </div>
              <div className="breakdown-item">
                <span>Appliance Fees</span>
                <span>{formatCurrency(billingData.applianceFees)}</span>
              </div>
              <div className="breakdown-item">
                <span>Corkage Fees</span>
                <span>{formatCurrency(billingData.corkageFees)}</span>
              </div>
              {billingData.penalties > 0 && (
                <div className="breakdown-item penalty">
                  <span>Penalties</span>
                  <span>{formatCurrency(billingData.penalties)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment History */}
        <div className="section-card">
          <h2>
            <i className="fas fa-history"></i> Payment History
          </h2>
          <div className="payment-history-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {paymentHistory.map((payment) => (
                  <tr key={payment.id}>
                    <td>{new Date(payment.date).toLocaleDateString()}</td>
                    <td>{payment.type}</td>
                    <td>{formatCurrency(payment.amount)}</td>
                    <td>
                      <span className="badge badge-success">
                        {payment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </TenantLayout>
  );
};

export default BillingPage;
