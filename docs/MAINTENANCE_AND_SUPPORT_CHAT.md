# Lilycrest DMS — Maintenance & Support Chat Systems

This guide documents the ticket workflow, urgency categories, resolution metrics, and visitor support chatbot specifications.

---

## 1. Maintenance Request Module

### Request Workflow & Categories
Tenants can log maintenance issues under five categories:
- **Plumbing**: Leaks, clogged drains, toilet repairs.
- **Electrical**: Faulty outlets, light fixture replacements, breaker issues.
- **Hardware**: Door lock repair, window latching, furniture damage.
- **Appliance**: Electric fan, rice cooker, or refrigerator defects.
- **Cleaning / Other**: Common area reporting, general facility requests.

### Urgency Matrix & Priority Assignment
- **High**: Water leaks, power failure, broken door lock (Resolution target: <24 hours).
- **Medium**: Appliance malfunction, slow drain (Resolution target: 48 hours).
- **Low**: Minor cosmetic touch-ups, light cleaning requests (Resolution target: 5 days).

### Admin Resolution Metrics
The Admin Maintenance Dashboard displays:
- Total resolved tickets per category.
- Average resolution time (hours).
- Issue frequency trends per room.

---

## 2. Support Chat & Inquiry Module

### Public Visitor Inquiries (`/api/inquiries`)
Unregistered website visitors can submit inquiries regarding room availability, pricing, or house rules:
- Inquiries are assigned to the target branch admin dashboard.
- Admins reply directly via the system dashboard, triggering an automated email notification to the visitor.

### Chatbot Architecture (Future Scope)
Specifications for the intelligent inquiry assistant:
- Automated FAQ response matching (room rates, branch locations, visit hours).
- Escalate unresolved queries to live admin inquiry inbox.
