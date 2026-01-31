import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";

function TenantLayout() {
  return (
    <div className="tenant-layout">
      <Navbar />
      <main className="tenant-content">
        <Outlet />
      </main>
    </div>
  );
}

export default TenantLayout;
