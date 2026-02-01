# Public Feature Structure

This document provides a complete overview of the public-facing features accessible to all visitors without authentication.

## 📁 Folder Structure

```
features/public/
├── components/                 # Reusable public components
│   └── RoomDetailsPage.jsx    # Room details display component
│
├── pages/                     # Public page views
│   ├── LandingPage.jsx        # Main landing page
│   ├── GPuyatPage.jsx         # Gil Puyat branch page
│   ├── GPuyatRoomsPage.jsx    # Gil Puyat rooms listing
│   ├── GuadalupePage.jsx      # Guadalupe branch page
│   ├── GuadalupeRoomsPage.jsx # Guadalupe rooms listing
│   ├── PrivateRoomPage.jsx    # Private room details
│   ├── DoubleSharingPage.jsx  # Double sharing room details
│   └── QuadrupleSharingPage.jsx # Quadruple sharing room details
│
├── modals/                    # Modal dialogs
│   └── InquiryModal.jsx       # Inquiry form modal
│
├── styles/                    # Public-specific CSS files
│   ├── landingpage.css
│   ├── gpuyat.css
│   ├── gpuyat-rooms.css
│   ├── guadalupe.css
│   ├── guadalupe-rooms.css
│   ├── room-details.css
│   └── inquirymodal.css
│
└── index.js                   # Export barrel for public components
```

---

## 🔗 Public Routes

| Route                      | Component            | Description                                |
| -------------------------- | -------------------- | ------------------------------------------ |
| `/`                        | LandingPage          | Main homepage with branch selection        |
| `/gil-puyat`               | GPuyatPage           | Gil Puyat branch information               |
| `/gil-puyat/rooms`         | GPuyatRoomsPage      | Gil Puyat available rooms                  |
| `/gil-puyat/rooms/private` | PrivateRoomPage      | Private room details                       |
| `/gil-puyat/rooms/double`  | DoubleSharingPage    | Double sharing room details                |
| `/:branch/rooms/quadruple` | QuadrupleSharingPage | Quadruple sharing details (dynamic branch) |
| `/guadalupe`               | GuadalupePage        | Guadalupe branch information               |
| `/guadalupe/rooms`         | GuadalupeRoomsPage   | Guadalupe available rooms                  |

---

## 📄 Pages Documentation

### LandingPage

**Purpose:** Main entry point showcasing both branches

**Features:**

- Branch selection (Gil Puyat / Guadalupe)
- Hero section with images
- Quick overview of services
- Call-to-action buttons
- Inquiry modal trigger

**Location:** `features/public/pages/LandingPage.jsx`

---

### Branch Pages (GPuyatPage, GuadalupePage)

**Purpose:** Detailed information about each branch

**Features:**

- Branch location and contact info
- Photo gallery
- Available room types
- Amenities overview
- Location map
- Quick inquiry form

**Location:**

- `features/public/pages/GPuyatPage.jsx`
- `features/public/pages/GuadalupePage.jsx`

---

### Rooms Pages (GPuyatRoomsPage, GuadalupeRoomsPage)

**Purpose:** Display all available room types for a branch

**Features:**

- Room cards with images and pricing
- Filter by room type
- Quick view of amenities
- Call-to-action for booking

**Location:**

- `features/public/pages/GPuyatRoomsPage.jsx`
- `features/public/pages/GuadalupeRoomsPage.jsx`

---

### Room Details Pages

**Purpose:** Detailed information about specific room types

**Features:**

- Image gallery with room photos
- Detailed pricing information
- Complete amenities list
- Room specifications
- Similar room suggestions
- Inquiry/reservation buttons

**Components:**

- `PrivateRoomPage.jsx` - Single occupancy rooms
- `DoubleSharingPage.jsx` - Two-person shared rooms
- `QuadrupleSharingPage.jsx` - Four-person shared rooms

---

## 🧩 Components Documentation

### RoomDetailsPage

**Purpose:** Reusable component for displaying room details

**Props:**

- `roomTitle` - Room type title
- `roomSubtitle` - Branch and description
- `price` - Monthly price
- `priceNote` - Pricing details
- `minStay` - Minimum stay requirement
- `beds` - Number of beds
- `images` - Array of room images
- `descriptions` - Array of description paragraphs
- `amenities` - Array of amenity objects
- `otherRooms` - Array of similar room options
- `branchType` - Branch identifier

**Usage:**

```jsx
<RoomDetailsPage
  roomTitle="PRIVATE ROOMS"
  price={8000}
  images={[image1, image2]}
  amenities={amenitiesList}
  // ... other props
/>
```

---

### InquiryModal

**Purpose:** Modal form for customer inquiries

**Features:**

- Contact form fields (name, email, phone)
- Message/inquiry text area
- Branch selection
- Form validation
- Submit functionality

**Location:** `features/public/modals/InquiryModal.jsx`

---

## 🎨 Styling

All public styles follow consistent design patterns:

**Color Scheme:**

- Primary: `#FF6900` (Orange)
- Secondary: `#1A1A1A` (Dark)
- Background: `#FFFFFF` (White)
- Text: `#333333` (Dark Gray)

**Typography:**

- Headings: Bold, uppercase for emphasis
- Body: Clean, readable fonts
- Call-to-action: High contrast, prominent

---

## 📊 User Flow

```
Landing Page
    ├─> Gil Puyat Branch Page
    │       ├─> Gil Puyat Rooms
    │       │       ├─> Private Room Details
    │       │       ├─> Double Sharing Details
    │       │       └─> Quadruple Sharing Details
    │       └─> Inquiry Modal
    │
    └─> Guadalupe Branch Page
            ├─> Guadalupe Rooms
            │       └─> Quadruple Sharing Details
            └─> Inquiry Modal
```

---

## 🔄 Future Enhancements

1. **Search & Filter:**
   - Price range filter
   - Availability calendar
   - Room type filter

2. **Real-time Availability:**
   - Live room status
   - Booking calendar integration

3. **Virtual Tours:**
   - 360° room views
   - Video walkthroughs

4. **Comparison Tool:**
   - Compare multiple rooms
   - Side-by-side feature comparison

5. **Reviews & Ratings:**
   - Tenant reviews
   - Rating system
   - Photo submissions from tenants

---

**Last Updated:** January 31, 2026  
**Role:** Public (No Authentication Required)
