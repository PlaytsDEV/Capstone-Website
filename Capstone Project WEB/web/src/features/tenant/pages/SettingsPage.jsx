import React from "react";
import TenantLayout from "../../../shared/layouts/TenantLayout";
import "../styles/tenant-common.css";

const SettingsPage = () => {
  return (
    <TenantLayout>
      <div className="tenant-page">
        <div className="page-header">
          <h1>
            <i className="fas fa-cog"></i> Settings
          </h1>
          <p>Manage your account preferences</p>
        </div>

        <div className="settings-sections">
          <div className="section-card">
            <h2>Account Security</h2>
            <div className="settings-item">
              <div>
                <h4>Change Password</h4>
                <p>Update your password to keep your account secure</p>
              </div>
              <button className="btn btn-secondary">Change</button>
            </div>
          </div>

          <div className="section-card">
            <h2>Notifications</h2>
            <div className="settings-item">
              <div>
                <h4>Email Notifications</h4>
                <p>Receive updates via email</p>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" defaultChecked />
                <span className="toggle-slider"></span>
              </label>
            </div>
            <div className="settings-item">
              <div>
                <h4>SMS Notifications</h4>
                <p>Receive important alerts via SMS</p>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>

          <div className="section-card">
            <h2>Privacy</h2>
            <div className="settings-item">
              <div>
                <h4>Data Privacy</h4>
                <p>View our privacy policy and data protection terms</p>
              </div>
              <button className="btn btn-secondary">View Policy</button>
            </div>
          </div>
        </div>
      </div>
    </TenantLayout>
  );
};

export default SettingsPage;
