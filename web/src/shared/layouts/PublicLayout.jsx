import React from "react";
import Navbar from "../../features/public/components/Navbar";
import Footer from "../../features/public/components/ContactFooter";

const PublicLayout = ({ children }) => {
  return (
    <div className="public-layout">
      <Navbar />
      <main className="main-content">{children}</main>
      <Footer />
    </div>
  );
};

export default PublicLayout;
