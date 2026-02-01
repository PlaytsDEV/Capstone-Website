// Custom hook for managing roles
import { useState, useEffect } from "react";

export const useRoles = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Add your API calls and logic here

  return { roles, loading, error, setRoles };
};
