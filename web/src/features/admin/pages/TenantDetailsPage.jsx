import { useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "../styles/admin-tenants.css";

function TenantDetailsPage() {
  const { id } = useParams();

  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-content">
        <h1>Tenant Details #{id}</h1>
        <p>View detailed tenant information</p>
      </main>
    </div>
  );
}

export default TenantDetailsPage;
