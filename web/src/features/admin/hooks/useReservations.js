import { useState, useEffect } from "react";

export function useReservations() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);

  // TODO: Implement API call
  useEffect(() => {
    // Fetch reservations from API
  }, []);

  return { reservations, loading };
}
