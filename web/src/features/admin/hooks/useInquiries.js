import { useState, useEffect } from "react";

export function useInquiries() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(false);

  // TODO: Implement API call
  useEffect(() => {
    // Fetch inquiries from API
  }, []);

  return { inquiries, loading };
}
