import RoomDetailsPage from '../components/RoomDetailsPage';
import { useNavigate } from 'react-router-dom';

function PrivateRoomPage() {
  const navigate = useNavigate();

  const roomData = {
    roomTitle: "PRIVATE ROOMS",
    roomSubtitle: "Gil Puyat Branch - Standard Room",
    price: 8000,
    priceNote: "Per Month",
    minStay: "6 months minimum",
    beds: "1 bed",
    images: [
      require('../../../assets/images/gpuyat/standard-room.jpg'),
      require('../../../assets/images/gpuyat/deluxe-room.jpg'),
      require('../../../assets/images/gpuyat/premium-room.jpg')
    ],
    descriptions: [
      "Experience comfortable urban living in our private rooms designed for students and young professionals. Each room is thoughtfully furnished to provide a cozy and productive environment, perfect for those seeking privacy and convenience in the heart of Gil Puyat.",
      "Our private rooms feature a comfortable single bed with premium mattress, study desk with ergonomic chair, spacious wardrobe for all your belongings, and modern amenities to ensure your comfort throughout the year.",
      "Located in a secure building with 24/7 security personnel and CCTV monitoring, you can rest easy knowing your safety is our priority. The building is strategically positioned with easy access to public transportation, shopping centers, restaurants, and business districts.",
      "The monthly rental includes basic utilities (water and common area electricity), high-speed internet access, and use of all common facilities. Individual room electricity is metered separately for fair billing. A security deposit equivalent to one month's rent is required upon move-in, fully refundable upon checkout with proper notice and room inspection."
    ],
    amenities: [
      {
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF6900" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>',
        title: "High-Speed WiFi",
        description: "Unlimited internet access"
      },
      {
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF6900" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>',
        title: "Air Conditioning",
        description: "Climate control"
      },
      {
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF6900" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>',
        title: "Smart TV",
        description: "Entertainment ready"
      },
      {
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF6900" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
        title: "Pantry Access",
        description: "Shared kitchen"
      },
      {
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF6900" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
        title: "Secure Lock",
        description: "Electronic door lock"
      },
      {
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF6900" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2v6"/><path d="M15 2v6"/><path d="M12 17v5"/><path d="M5 8h14"/><path d="M6 11V8h12v3"/></svg>',
        title: "Hot & Cold Shower",
        description: "Private bathroom"
      },
      {
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF6900" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
        title: "Power Backup",
        description: "24/7 electricity"
      },
      {
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF6900" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
        title: "Common Lounge",
        description: "Shared workspace"
      }
    ],
    otherRooms: [
      {
        title: "Double Sharing",
        price: 6500,
        minStay: "6 months minimum",
        beds: "2 beds",
        image: require('../../../assets/images/gpuyat/deluxe-room.jpg'),
        onViewDetails: () => navigate('/gil-puyat/rooms/double')
      },
      {
        title: "Quadruple Sharing",
        price: 4500,
        minStay: "3 months minimum",
        beds: "4 beds",
        image: require('../../../assets/images/gpuyat/premium-room.jpg'),
        onViewDetails: () => navigate('/gil-puyat/rooms/quadruple')
      }
    ]
  };

  return (
    <RoomDetailsPage
      {...roomData}
      branchType="gil-puyat"
      onCheckAvailability={() => {
        // Handle check availability
        console.log('Check availability clicked');
      }}
      onReserveNow={() => {
        // Handle reserve now
        console.log('Reserve now clicked');
      }}
    />
  );
}

export default PrivateRoomPage;
