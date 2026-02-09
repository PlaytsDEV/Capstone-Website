// Custom hook for managing users
import { useState, useEffect } from "react";

export const useUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Add your API calls and logic here

  return { users, loading, error, setUsers };
};
