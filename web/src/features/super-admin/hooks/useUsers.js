import { useState, useEffect } from "react";

export function useUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // TODO: Implement API call
  useEffect(() => {
    // Fetch users from API
  }, []);

  return { users, loading };
}
