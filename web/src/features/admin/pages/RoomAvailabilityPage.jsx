import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import RoomCard from '../components/RoomCard';
import '../styles/admin-room-availability.css';

function RoomAvailabilityPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [floorFilter, setFloorFilter] = useState('all');
  const [roomTypeFilter, setRoomTypeFilter] = useState('all');

  // Sample room data
  const rooms = [
    // Floor 1 - Gil Puyat
    { id: 'GP-101', floor: 1, branch: 'Gil Puyat', type: 'Single', beds: 1, occupied: 1, reserved: 0 },
    { id: 'GP-102', floor: 1, branch: 'Gil Puyat', type: 'Double', beds: 2, occupied: 1, reserved: 0 },
    { id: 'GP-103', floor: 1, branch: 'Gil Puyat', type: 'Double', beds: 2, occupied: 0, reserved: 0 },
    { id: 'MK-101', floor: 1, branch: 'Gil Puyat', type: 'Single', beds: 1, occupied: 0, reserved: 0 },
    { id: 'MK-102', floor: 1, branch: 'Gil Puyat', type: 'Single', beds: 1, occupied: 1, reserved: 0 },
    { id: 'MK-103', floor: 1, branch: 'Gil Puyat', type: 'Double', beds: 2, occupied: 0, reserved: 0 },
    // Floor 2 - Gil Puyat
    { id: 'GP-201', floor: 2, branch: 'Gil Puyat', type: 'Quadruple', beds: 4, occupied: 1, reserved: 0 },
    { id: 'GP-202', floor: 2, branch: 'Gil Puyat', type: 'Quadruple', beds: 4, occupied: 4, reserved: 0 },
    { id: 'GP-203', floor: 2, branch: 'Gil Puyat', type: 'Double', beds: 2, occupied: 2, reserved: 0 },
    { id: 'MK-201', floor: 2, branch: 'Gil Puyat', type: 'Double', beds: 2, occupied: 2, reserved: 0 },
    { id: 'MK-202', floor: 2, branch: 'Gil Puyat', type: 'Quadruple', beds: 4, occupied: 2, reserved: 1 },
    { id: 'MK-203', floor: 2, branch: 'Gil Puyat', type: 'Quadruple', beds: 4, occupied: 0, reserved: 0 },
  ];

  // Calculate stats
  const totalRooms = rooms.length;
  const fullyOccupied = rooms.filter(r => r.occupied === r.beds).length;
  const fullyAvailable = rooms.filter(r => r.occupied === 0 && r.reserved === 0).length;
  const partial = totalRooms - fullyOccupied - fullyAvailable;
  const totalBeds = rooms.reduce((sum, r) => sum + r.beds, 0);
  const occupiedBeds = rooms.reduce((sum, r) => sum + r.occupied, 0);
  const reservedBeds = rooms.reduce((sum, r) => sum + r.reserved, 0);
  const availableBeds = totalBeds - occupiedBeds - reservedBeds;
  const occupancyRate = ((occupiedBeds / totalBeds) * 100).toFixed(1);

  // Group rooms by floor
  const floor1Rooms = rooms.filter(r => r.floor === 1);
  const floor2Rooms = rooms.filter(r => r.floor === 2);

  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-main-content">
        <div className="room-availability-container">
          {/* Header */}
          <div className="room-availability-header">
            <h1 className="room-availability-title">Room Availability</h1>
            <p className="room-availability-subtitle">Visual overview of all rooms and bed occupancy</p>
          </div>

          {/* Top Stats */}
          <div className="room-availability-top-stats">
            <div className="room-stat-card">
              <div className="room-stat-label">Total Rooms</div>
              <div className="room-stat-value">{totalRooms}</div>
            </div>
            <div className="room-stat-card room-stat-occupied">
              <div className="room-stat-label">Fully Occupied</div>
              <div className="room-stat-value">{fullyOccupied}</div>
            </div>
            <div className="room-stat-card room-stat-partial">
              <div className="room-stat-label">Partial</div>
              <div className="room-stat-value">{partial}</div>
            </div>
            <div className="room-stat-card room-stat-available">
              <div className="room-stat-label">Fully Available</div>
              <div className="room-stat-value">{fullyAvailable}</div>
            </div>
            <div className="room-stat-card room-stat-rate">
              <div className="room-stat-label">Occupancy Rate</div>
              <div className="room-stat-value">{occupancyRate}%</div>
            </div>
          </div>

          {/* Bed Stats */}
          <div className="room-availability-bed-stats">
            <div className="bed-stat-card">
              <div className="bed-stat-label">Total Beds</div>
              <div className="bed-stat-value">{totalBeds}</div>
            </div>
            <div className="bed-stat-card bed-stat-occupied">
              <div className="bed-stat-label">Occupied</div>
              <div className="bed-stat-value">{occupiedBeds}</div>
            </div>
            <div className="bed-stat-card bed-stat-reserved">
              <div className="bed-stat-label">Reserved</div>
              <div className="bed-stat-value">{reservedBeds}</div>
            </div>
            <div className="bed-stat-card bed-stat-available">
              <div className="bed-stat-label">Available</div>
              <div className="bed-stat-value">{availableBeds}</div>
            </div>
          </div>

          {/* Search */}
          <div className="room-availability-search-section">
            <div className="room-availability-search-wrapper">
              <svg className="room-search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.16667 15.8333C12.8486 15.8333 15.8333 12.8486 15.8333 9.16667C15.8333 5.48477 12.8486 2.5 9.16667 2.5C5.48477 2.5 2.5 5.48477 2.5 9.16667C2.5 12.8486 5.48477 15.8333 9.16667 15.8333Z" stroke="#9CA3AF" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M17.5 17.5L13.875 13.875" stroke="#9CA3AF" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input
                type="text"
                className="room-search-input"
                placeholder="Search room or tenant..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="room-availability-filters">
              <select
                className="room-availability-filter-select"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
              >
                <option value="all">All Branches</option>
                <option value="gil-puyat">Gil Puyat</option>
                <option value="guadalupe">Guadalupe</option>
              </select>
              <select
                className="room-availability-filter-select"
                value={floorFilter}
                onChange={(e) => setFloorFilter(e.target.value)}
              >
                <option value="all">All Floors</option>
                <option value="1">Floor 1</option>
                <option value="2">Floor 2</option>
              </select>
              <select
                className="room-availability-filter-select"
                value={roomTypeFilter}
                onChange={(e) => setRoomTypeFilter(e.target.value)}
              >
                <option value="all">All Room Types</option>
                <option value="single">Single</option>
                <option value="double">Double</option>
                <option value="quadruple">Quadruple</option>
              </select>
            </div>
          </div>

          {/* Legend */}
          <div className="room-legend">
            <div className="room-legend-title">Legend:</div>
            <div className="room-legend-items">
              <div className="room-legend-item">
                <svg className="room-legend-icon room-legend-available" width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2.66699 5.33331V26.6666" stroke="currentColor" strokeWidth="2.66667" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2.66699 10.6667H26.667C27.3742 10.6667 28.0525 10.9476 28.5526 11.4477C29.0527 11.9478 29.3337 12.6261 29.3337 13.3334V26.6667" stroke="currentColor" strokeWidth="2.66667" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2.66699 22.6667H29.3337" stroke="currentColor" strokeWidth="2.66667" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8 10.6667V22.6667" stroke="currentColor" strokeWidth="2.66667" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Available</span>
              </div>
              <div className="room-legend-item">
                <svg className="room-legend-icon room-legend-reserved" width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2.66699 5.33331V26.6666" stroke="currentColor" strokeWidth="2.66667" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2.66699 10.6667H26.667C27.3742 10.6667 28.0525 10.9476 28.5526 11.4477C29.0527 11.9478 29.3337 12.6261 29.3337 13.3334V26.6667" stroke="currentColor" strokeWidth="2.66667" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2.66699 22.6667H29.3337" stroke="currentColor" strokeWidth="2.66667" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8 10.6667V22.6667" stroke="currentColor" strokeWidth="2.66667" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Reserved</span>
              </div>
              <div className="room-legend-item">
                <svg className="room-legend-icon room-legend-occupied" width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2.66699 5.33331V26.6666" stroke="currentColor" strokeWidth="2.66667" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2.66699 10.6667H26.667C27.3742 10.6667 28.0525 10.9476 28.5526 11.4477C29.0527 11.9478 29.3337 12.6261 29.3337 13.3334V26.6667" stroke="currentColor" strokeWidth="2.66667" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2.66699 22.6667H29.3337" stroke="currentColor" strokeWidth="2.66667" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8 10.6667V22.6667" stroke="currentColor" strokeWidth="2.66667" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Occupied</span>
              </div>
            </div>
          </div>

          {/* Floor 1 */}
          <div className="room-floor-section">
            <div className="room-floor-header">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.25 6.75L9 2.25L15.75 6.75V15C15.75 15.3978 15.592 15.7794 15.3107 16.0607C15.0294 16.342 14.6478 16.5 14.25 16.5H3.75C3.35218 16.5 2.97064 16.342 2.68934 16.0607C2.40804 15.7794 2.25 15.3978 2.25 15V6.75Z" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h2 className="room-floor-title">Floor 1 - Gil Puyat</h2>
            </div>
            <div className="room-grid">
              {floor1Rooms.map(room => (
                <RoomCard key={room.id} room={room} />
              ))}
            </div>
          </div>

          {/* Floor 2 */}
          <div className="room-floor-section">
            <div className="room-floor-header">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.25 6.75L9 2.25L15.75 6.75V15C15.75 15.3978 15.592 15.7794 15.3107 16.0607C15.0294 16.342 14.6478 16.5 14.25 16.5H3.75C3.35218 16.5 2.97064 16.342 2.68934 16.0607C2.40804 15.7794 2.25 15.3978 2.25 15V6.75Z" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h2 className="room-floor-title">Floor 2 - Gil Puyat</h2>
            </div>
            <div className="room-grid">
              {floor2Rooms.map(room => (
                <RoomCard key={room.id} room={room} />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default RoomAvailabilityPage;
