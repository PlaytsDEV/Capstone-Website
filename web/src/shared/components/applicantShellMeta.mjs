const PAGE_META = {
  "/applicant/reservation": { title: "Reservation" },
  "/applicant/contracts": { title: "My Contract" },
  "/applicant/billing": { title: "My Bills" },
  "/applicant/maintenance": { title: "Maintenance" },
  "/applicant/announcements": { title: "Announcements" },
  "/applicant/notifications": { title: "Notifications" },
};

export function getApplicantPageMeta(pathname, _search = "", state = null) {
  if (pathname === "/applicant/profile") {
    switch (state?.tab) {
      case "personal": return { title: "Personal Details" };
      case "reservation": return { title: "My Reservation" };
      case "notifications": return { title: "Notifications" };
      case "settings": return { title: "Settings" };
      case "history": return { title: "My History" };
      default: return { title: "Dashboard" };
    }
  }
  return PAGE_META[pathname] || { title: "Dashboard" };
}
