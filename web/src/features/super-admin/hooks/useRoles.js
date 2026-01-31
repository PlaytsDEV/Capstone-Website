import { useState, useEffect } from "react";

export function useRoles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);

  // TODO: Implement API call
  useEffect(() => {
    // Fetch roles from API
  }, []);

  return { roles, loading };
}
