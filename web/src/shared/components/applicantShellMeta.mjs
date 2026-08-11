const PAGE_META = {
  "/applicant/reservation": { title: "Reserve Your Room" },
  "/applicant/contracts": { title: "My Rental Contract" },
  "/applicant/billing": { title: "My Bills & Payments" },
  "/applicant/maintenance": { title: "Maintenance Requests" },
  "/applicant/announcements": { title: "Announcements" },
  "/applicant/notifications": { title: "Notifications" },
};

export function getApplicantPageMeta(pathname, _search = "", state = null) {
  if (pathname === "/applicant/profile") {
    switch (state?.tab) {
      case "personal": return { title: "Personal Details" };
      case "reservation": return { title: "Reserve Your Room" };
      case "notifications": return { title: "Notifications" };
      case "settings": return { title: "Settings" };
      case "history": return { title: "My History" };
      default: return { title: "Dashboard" };
    }
  }
  return PAGE_META[pathname] || { title: "Dashboard" };
}

