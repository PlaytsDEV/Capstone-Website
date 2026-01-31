# Public Feature Module

## Overview

This module handles all public-facing features accessible without authentication. It includes the landing page, branch information, room listings, and inquiry forms.

## Structure

```
public/
├── pages/                    # Public pages
│   ├── LandingPage.jsx      # Main landing page
│   ├── BranchPage.jsx       # Branch information pages
│   │   ├── GPuyatPage.jsx
│   │   └── GuadalupePage.jsx
│   └── RoomsPage.jsx        # Room listing pages
│       ├── GPuyatRoomsPage.jsx
│       ├── GuadalupeRoomsPage.jsx
│       ├── PrivateRoomPage.jsx
│       ├── DoubleSharingPage.jsx
│       └── QuadrupleSharingPage.jsx
│
├── components/              # Reusable public components
│   ├── Navbar.js           # Main navigation
│   ├── Footer.jsx          # Site footer
│   ├── LilycrestLogo.js    # Logo component
│   └── RoomDetailsPage.jsx # Room detail view
│
├── modals/                 # Modal dialogs
│   └── InquiryModal.jsx   # Inquiry submission form
│
└── styles/                # Component styles
    ├── landingpage.css
    ├── gpuyat.css
    ├── gpuyat-rooms.css
    ├── guadalupe.css
    ├── guadalupe-rooms.css
    ├── room-details.css
    └── inquirymodal.css
```

## Key Features

### Pages

- **LandingPage**: Homepage with introduction and call-to-action
- **Branch Pages**: Information about Gpuyat and Guadalupe branches
- **Room Pages**: Browse available rooms by type and branch

### Components

- **Navbar**: Site-wide navigation with links to branches and rooms
- **Footer**: Contact information and social media links
- **RoomDetailsPage**: Detailed room information and booking options

### Modals

- **InquiryModal**: Contact form for visitor inquiries

## Usage

### Accessing Public Pages

All pages in this module are accessible without authentication:

- `/` - Landing page
- `/gpuyat` - Gpuyat branch information
- `/guadalupe` - Guadalupe branch information
- `/gpuyat/rooms` - Gpuyat room listings
- `/guadalupe/rooms` - Guadalupe room listings

### Making Inquiries

Visitors can submit inquiries through the InquiryModal component which appears on room detail pages and branch pages.

## Dependencies

- React Router for navigation
- Shared components from `/shared/components`
- Common API utilities from `/shared/api/commonApi.js`

## Future Enhancements

- Virtual tour integration
- Real-time room availability
- Online reservation system
- Multi-language support
