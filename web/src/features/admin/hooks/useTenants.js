import { useState, useEffect } from "react";

export function useTenants() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);

  // TODO: Implement API call
  useEffect(() => {
    // Fetch tenants from API
  }, []);

  return { tenants, loading };
}
