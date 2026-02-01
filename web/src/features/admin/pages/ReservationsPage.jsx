import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import ReservationDetailsModal from '../components/ReservationDetailsModal';
import '../styles/admin-reservations.css';

function ReservationsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [selectedReservation, setSelectedReservation] = useState(null);

  // Sample data
  const reservations = [
    {
      id: 'RES-2026-001',
      date: '2026-01-24',
      customer: 'Alex Rodriguez',
      email: 'alex.rodriguez@email.com',
      room: 'Standard Room (Quadruple)',
      branch: 'Makati',
      moveInDate: '2026-02-15',
      expiry: '2026-02-20',
      expiryDays: '20 days left',
      status: 'Reserved',
      customerName: 'Alex Rodriguez',
      customerEmail: 'alex.rodriguez@email.com',
      customerPhone: '+63 912 111 2222',
      roomType: 'Standard Room (Quadruple)',
      preferredMoveIn: '2026-02-15',
      reservationFee: '₱2,000',
      expiresOn: '2026-02-20',
      daysRemaining: '20 days',
      appliancePriceEach: 200,
      appliances: ['Laptop', 'Electric Fan'],
      totalApplianceFee: '400',
      paymentProofAmount: '2,000',
      paymentProofImage: null,
      adminNotes: 'Completed viewing on Jan 19. All requirements submitted.'
    },
    {
      id: 'RES-2026-002',
      date: '2026-01-22',
      customer: 'Maria Santos',
      email: 'maria.santos@email.com',
      room: 'Deluxe Room (Double)',
      branch: 'Makati',
      moveInDate: '2026-02-10',
      expiry: '2026-02-18',
      expiryDays: '18 days left',
      status: 'Ready for Move-In',
      customerName: 'Maria Santos',
      customerEmail: 'maria.santos@email.com',
      customerPhone: '+63 915 234 5678',
      roomType: 'Deluxe Room (Double)',
      preferredMoveIn: '2026-02-10',
      reservationFee: '₱2,000',
      expiresOn: '2026-02-18',
      daysRemaining: '18 days',
      appliancePriceEach: 200,
      appliances: ['Air Conditioner'],
      totalApplianceFee: '200',
      paymentProofAmount: '2,000',
      paymentProofImage: null,
      adminNotes: ''
    },
    {
      id: 'RES-2026-003',
      date: '2026-01-22',
      customer: 'James Wilson',
      email: 'james.w@example.com',
      room: 'Standard Room (Double)',
      branch: 'Makati',
      moveInDate: '2026-04-01',
      expiry: '2026-02-22',
      expiryDays: '28 days left',
      status: 'Pending Payment',
      customerName: 'James Wilson',
      customerEmail: 'james.w@example.com',
      customerPhone: '+63 917 345 6789',
      roomType: 'Standard Room (Double)',
      preferredMoveIn: '2026-04-01',
      reservationFee: '₱2,000',
      expiresOn: '2026-02-22',
      daysRemaining: '28 days',
      appliancePriceEach: 200,
      appliances: [],
      totalApplianceFee: '0',
      paymentProofAmount: null,
      paymentProofImage: null,
      adminNotes: 'Awaiting payment confirmation'
    },
    {
      id: 'RES-2025-099',
      date: '2025-12-15',
      customer: 'Nicole Tan',
      email: 'nicole.tan@email.com',
      room: 'Standard Room (Quadruple)',
      branch: 'Makati A',
      moveInDate: '2026-01-18',
      expiry: '2026-01-15',
      expiryDays: 'Expired',
      status: 'Expired/Cancelled',
      customerName: 'Nicole Tan',
      customerEmail: 'nicole.tan@email.com',
      customerPhone: '+63 918 456 7890',
      roomType: 'Standard Room (Quadruple)',
      preferredMoveIn: '2026-01-18',
      reservationFee: '₱2,000',
      expiresOn: '2026-01-15',
      daysRemaining: '0 days',
      appliancePriceEach: 200,
      appliances: ['Laptop', 'Microwave'],
      totalApplianceFee: '400',
      paymentProofAmount: null,
      paymentProofImage: null,
      adminNotes: 'Reservation expired without move-in'
    },
    {
      id: 'RES-2026-004',
      date: '2026-01-24',
      customer: 'Carlos Lopez',
      email: 'carlos.l@example.com',
      room: 'Standard Room (Quadruple)',
      branch: 'Makati',
      moveInDate: '2026-01-26',
      expiry: '2026-02-24',
      expiryDays: 'Today',
      status: 'Active Tenant',
      customerName: 'Carlos Lopez',
      customerEmail: 'carlos.l@example.com',
      customerPhone: '+63 919 567 8901',
      roomType: 'Standard Room (Quadruple)',
      preferredMoveIn: '2026-01-26',
      reservationFee: '₱2,000',
      expiresOn: '2026-02-24',
      daysRemaining: '24 days',
      appliancePriceEach: 200,
      appliances: ['Laptop', 'Electric Fan', 'Refrigerator'],
      totalApplianceFee: '600',
      paymentProofAmount: '2,000',
      paymentProofImage: null,
      adminNotes: 'Successfully converted to tenant on 2026-01-26'
    }
  ];

  const stats = [
    { label: 'Pending Payment', value: '1', color: 'yellow' },
    { label: 'Reserved (Slot Hold)', value: '1', color: 'blue' },
    { label: 'Ready for Move-In', value: '1', color: 'green' },
    { label: 'Converted to Tenant', value: '1', color: 'purple' },
    { label: 'Expired / Cancelled', value: '1', color: 'red' }
  ];

  const handleView = (id) => {
    const reservation = reservations.find(res => res.id === id);
    if (reservation) {
      setSelectedReservation(reservation);
    }
  };

  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-main-content">
        <div className="admin-reservations-container">
          {/* Header */}
          <div className="admin-reservations-header">
            <h1 className="admin-reservations-title">Reservations Management</h1>
            <p className="admin-reservations-subtitle">
              ₱2,000 slot holder - NOT a tenant yet | Non-refundable, deductible from rent
            </p>
          </div>

          {/* Reservation Rules Info Box */}
          <div className="admin-reservations-info-box">
            <div className="admin-reservations-info-header">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 18.3333C14.6024 18.3333 18.3333 14.6024 18.3333 9.99999C18.3333 5.39762 14.6024 1.66666 10 1.66666C5.39763 1.66666 1.66667 5.39762 1.66667 9.99999C1.66667 14.6024 5.39763 18.3333 10 18.3333Z" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 13.3333V10" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 6.66666H10.0083" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="admin-reservations-info-title">RESERVATION RULES:</span>
            </div>
            <ul className="admin-reservations-info-list">
              <li><strong>₱2,000 fee:</strong> <strong>non-refundable</strong> + deductible from first month rent</li>
              <li>Reservations hold a slot; customer is <strong>NOT</strong> a tenant</li>
              <li><strong>NOT counted</strong> in room occupancy</li>
              <li>1 month validity (extendable)</li>
              <li>Refund terms: ONLY after fee credit <strong>not payment</strong> + physical arrival</li>
            </ul>
          </div>

          {/* Stats Cards */}
          <div className="admin-reservations-stats">
            {stats.map((stat, index) => (
              <div key={index} className={`admin-reservations-stat-card admin-reservations-stat-card-${stat.color}`}>
                <div className="admin-reservations-stat-label">{stat.label}</div>
                <div className="admin-reservations-stat-value">{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Search Bar */}
          <div className="admin-reservations-search-section">
            <div className="admin-reservations-search-wrapper">
              <svg className="admin-reservations-search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.16667 15.8333C12.8486 15.8333 15.8333 12.8486 15.8333 9.16667C15.8333 5.48477 12.8486 2.5 9.16667 2.5C5.48477 2.5 2.5 5.48477 2.5 9.16667C2.5 12.8486 5.48477 15.8333 9.16667 15.8333Z" stroke="#9CA3AF" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M17.5 17.5L13.875 13.875" stroke="#9CA3AF" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input
                type="text"
                className="admin-reservations-search-input"
                placeholder="Search by reservation ID, customer name, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="admin-reservations-filters">
              <select 
                className="admin-reservations-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending Payment</option>
                <option value="reserved">Reserved (Slot Hold)</option>
                <option value="ready">Ready for Move-In</option>
                <option value="converted">Converted to Tenant</option>
                <option value="expired">Expired / Cancelled</option>
              </select>
              <select 
                className="admin-reservations-filter-select"
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
              >
                <option value="all">All Branches</option>
                <option value="makati">Makati</option>
                <option value="makati-a">Makati A</option>
                <option value="guadalupe">Guadalupe</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="admin-reservations-table-wrapper">
            <table className="admin-reservations-table">
              <thead className="admin-reservations-table-head">
                <tr>
                  <th className="admin-reservations-table-th">RESERVATION ID</th>
                  <th className="admin-reservations-table-th">CUSTOMER</th>
                  <th className="admin-reservations-table-th">ROOM & BRANCH</th>
                  <th className="admin-reservations-table-th">MOVE-IN DATE</th>
                  <th className="admin-reservations-table-th">EXPIRY</th>
                  <th className="admin-reservations-table-th">STATUS</th>
                  <th className="admin-reservations-table-th">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="admin-reservations-table-body">
                {reservations.map((reservation) => (
                  <tr key={reservation.id} className="admin-reservations-table-row">
                    <td className="admin-reservations-table-td">
                      <div className="admin-reservations-id">{reservation.id}</div>
                      <div className="admin-reservations-date">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M9.5 2H2.5C1.94772 2 1.5 2.44772 1.5 3V10C1.5 10.5523 1.94772 11 2.5 11H9.5C10.0523 11 10.5 10.5523 10.5 10V3C10.5 2.44772 10.0523 2 9.5 2Z" stroke="#9CA3AF" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M8 1V3" stroke="#9CA3AF" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M4 1V3" stroke="#9CA3AF" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M1.5 5H10.5" stroke="#9CA3AF" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {reservation.date}
                      </div>
                    </td>
                    <td className="admin-reservations-table-td">
                      <div className="admin-reservations-customer">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M7 7C8.65685 7 10 5.65685 10 4C10 2.34315 8.65685 1 7 1C5.34315 1 4 2.34315 4 4C4 5.65685 5.34315 7 7 7Z" stroke="#6B7280" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M13 13C13 11.1435 13 10.2152 12.6955 9.48237C12.3166 8.57537 11.6246 7.88338 10.7176 7.50447C9.98477 7.2 9.05652 7.2 7.2 7.2H6.8C4.94348 7.2 4.01523 7.2 3.28237 7.50447C2.37537 7.88338 1.68338 8.57537 1.30447 9.48237C1 10.2152 1 11.1435 1 13" stroke="#6B7280" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {reservation.customer}
                      </div>
                      <div className="admin-reservations-email">{reservation.email}</div>
                    </td>
                    <td className="admin-reservations-table-td">
                      <div className="admin-reservations-room">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 7.5C1 7.5 2.5 5 7 5C11.5 5 13 7.5 13 7.5" stroke="#6B7280" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M1 13V7.5" stroke="#6B7280" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M13 13V7.5" stroke="#6B7280" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="7" cy="3" r="2" stroke="#6B7280" strokeWidth="1.2"/>
                        </svg>
                        {reservation.room}
                      </div>
                      <div className="admin-reservations-branch">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M6 10.5C8.48528 10.5 10.5 8.48528 10.5 6C10.5 3.51472 8.48528 1.5 6 1.5C3.51472 1.5 1.5 3.51472 1.5 6C1.5 8.48528 3.51472 10.5 6 10.5Z" stroke="#9CA3AF" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M6 1.5C7.2 3 7.8 4.95 7.8 6C7.8 7.05 7.2 9 6 10.5C4.8 9 4.2 7.05 4.2 6C4.2 4.95 4.8 3 6 1.5Z" stroke="#9CA3AF" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M1.5 6H10.5" stroke="#9CA3AF" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {reservation.branch}
                      </div>
                    </td>
                    <td className="admin-reservations-table-td">
                      <div className="admin-reservations-date-icon">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M11 2H3C2.44772 2 2 2.44772 2 3V11C2 11.5523 2.44772 12 3 12H11C11.5523 12 12 11.5523 12 11V3C12 2.44772 11.5523 2 11 2Z" stroke="#2563EB" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M9 1V3" stroke="#2563EB" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M5 1V3" stroke="#2563EB" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M2 5H12" stroke="#2563EB" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {reservation.moveInDate}
                      </div>
                      <div className="admin-reservations-date-label">Charged Fri</div>
                    </td>
                    <td className="admin-reservations-table-td">
                      <div className="admin-reservations-expiry-date">{reservation.expiry}</div>
                      <div className={`admin-reservations-expiry-days ${reservation.status === 'Expired/Cancelled' ? 'expired' : ''}`}>
                        {reservation.expiryDays}
                      </div>
                    </td>
                    <td className="admin-reservations-table-td">
                      <span className={`admin-reservations-status admin-reservations-status-${reservation.status.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-')}`}>
                        {reservation.status}
                      </span>
                    </td>
                    <td className="admin-reservations-table-td">
                      <button 
                        className="admin-reservations-action-btn"
                        onClick={() => handleView(reservation.id)}
                        title="View Details"
                      >
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1.5 9C1.5 9 4.5 3 9 3C13.5 3 16.5 9 16.5 9C16.5 9 13.5 15 9 15C4.5 15 1.5 9 1.5 9Z" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M9 11.25C10.2426 11.25 11.25 10.2426 11.25 9C11.25 7.75736 10.2426 6.75 9 6.75C7.75736 6.75 6.75 7.75736 6.75 9C6.75 10.2426 7.75736 11.25 9 11.25Z" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Reservation Details Modal */}
      {selectedReservation && (
        <ReservationDetailsModal 
          reservation={selectedReservation}
          onClose={() => setSelectedReservation(null)}
        />
      )}
    </div>
  );
}

export default ReservationsPage;
