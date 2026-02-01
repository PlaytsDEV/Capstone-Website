import RoomDetailsPage from '../components/RoomDetailsPage';
import { useNavigate, useParams } from 'react-router-dom';

function QuadrupleSharingPage() {
  const navigate = useNavigate();
  const { branch = 'gil-puyat' } = useParams();

  // Determine branch-specific data
  const getBranchData = () => {
    if (branch === 'guadalupe') {
      return {
        roomTitle: "QUADRUPLE SHARING",
        roomSubtitle: "Guadalupe Branch - Shared Room",
        price: 4500,
        priceNote: "Per Month",
        minStay: "3 months minimum",
        beds: "4 beds",
        images: [
          require('../assets/gpuyat-images/premium-room.jpg'),
          require('../assets/gpuyat-images/standard-room.jpg'),
          require('../assets/gpuyat-images/deluxe-room.jpg')
        ],
        descriptions: [
          "Welcome to our Guadalupe branch quadruple sharing rooms! Designed for students and young professionals seeking an affordable, community-focused living experience. Our rooms are thoughtfully furnished to comfortably accommodate four occupants while maintaining excellent standards of comfort and convenience.",
          "Our quadruple sharing rooms at Guadalupe feature four comfortable single beds with quality mattresses, individual study spaces, ample storage for each occupant, and modern amenities to ensure a pleasant stay.",
          "Our Guadalupe location offers a vibrant neighborhood atmosphere with 24/7 security personnel and CCTV monitoring. Easy access to major transportation hubs, shopping centers, dining establishments, and business districts make it the perfect location for professionals and students alike.",
          "The monthly rental includes basic utilities (water and common area electricity), high-speed internet access, and use of all common facilities. Individual room electricity is metered separately for fair billing. A security deposit equivalent to one month's rent is required upon move-in, fully refundable upon checkout with proper notice and room inspection."
        ],
        onViewOtherRoom: (roomType) => navigate(`/guadalupe/rooms/${roomType}`)
      };
    } else {
      return {
        roomTitle: "QUADRUPLE SHARING",
        roomSubtitle: "Gil Puyat Branch - Shared Room",
        price: 4500,
        priceNote: "Per Month",
        minStay: "3 months minimum",
        beds: "4 beds",
        images: [
          require('../assets/gpuyat-images/premium-room.jpg'),
          require('../assets/gpuyat-images/standard-room.jpg'),
          require('../assets/gpuyat-images/deluxe-room.jpg')
        ],
        descriptions: [
          "Experience budget-friendly and social living in our quadruple sharing rooms designed for students and young professionals. Each room is thoughtfully furnished to accommodate four occupants, providing a comfortable and vibrant environment perfect for those seeking affordability and community.",
          "Our quadruple sharing rooms feature four comfortable single beds with quality mattresses, individual study spaces, ample storage for each occupant, and modern amenities to ensure a pleasant stay.",
          "Located in a secure building with 24/7 security personnel and CCTV monitoring, you can rest easy knowing your safety is our priority. The building is strategically positioned with easy access to public transportation, shopping centers, restaurants, and business districts.",
          "The monthly rental includes basic utilities (water and common area electricity), high-speed internet access, and use of all common facilities. Individual room electricity is metered separately for fair billing. A security deposit equivalent to one month's rent is required upon move-in, fully refundable upon checkout with proper notice and room inspection."
        ],
        onViewOtherRoom: (roomType) => navigate(`/gil-puyat/rooms/${roomType}`)
      };
    }
  };

  const branchData = getBranchData();

  const roomData = {
    ...branchData,
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
    otherRooms: branch === 'guadalupe' ? [] : [
      {
        title: "Private Room",
        price: 8000,
        minStay: "6 months minimum",
        beds: "1 bed",
        image: require('../assets/gpuyat-images/standard-room.jpg'),
        badge: "Popular",
        onViewDetails: () => navigate('/gil-puyat/rooms/private')
      },
      {
        title: "Double Sharing",
        price: 6500,
        minStay: "6 months minimum",
        beds: "2 beds",
        image: require('../assets/gpuyat-images/deluxe-room.jpg'),
        onViewDetails: () => navigate('/gil-puyat/rooms/double')
      }
    ]
  };

  return (
    <RoomDetailsPage
      {...roomData}
      branchType={branch}
      onCheckAvailability={() => {
        console.log('Check availability clicked');
      }}
      onReserveNow={() => {
        console.log('Reserve now clicked');
      }}
    />
  );
}

export default QuadrupleSharingPage;
