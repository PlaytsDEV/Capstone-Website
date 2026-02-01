// Custom hook for managing tenants
import { useState, useEffect } from "react";

export const useTenants = () => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Add your API calls and logic here

  return { tenants, loading, error, setTenants };
};
