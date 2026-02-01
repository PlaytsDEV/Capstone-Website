// Custom hook for managing inquiries
import { useState, useEffect } from "react";

export const useInquiries = () => {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Add your API calls and logic here

  return { inquiries, loading, error, setInquiries };
};
