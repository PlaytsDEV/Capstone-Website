import { useState } from 'react';
import Sidebar from '../admin-components/Sidebar';
import ReservationItem from '../admin-components/ReservationItem';
import InquiryItem from '../admin-components/InquiryItem';
import '../admin-styles/admin-dashboard.css';

export default function Dashboard() {
  const [stats] = useState([
    {
      id: 1,
      label: 'Total Inquiries',
      value: '24',
      icon: 'inquiries',
      color: '#3B82F6',
      percentage: '+12%',
    },
    {
      id: 2,
      label: 'Available Rooms',
      value: '18',
      icon: 'rooms',
      color: '#F59E0B',
      percentage: '+75%',
    },
    {
      id: 3,
      label: 'Registered Users',
      value: '156',
      icon: 'tenants',
      color: '#10B981',
      percentage: '+8%',
    },
    {
      id: 4,
      label: 'Active Bookings',
      value: '42',
      icon: 'reservations',
      color: '#A855F7',
      percentage: '+15%',
    },
  ]);

  const [branchData] = useState([
    { month: '01', gilPuyat: 8, guadalupe: 7 },
    { month: '02', gilPuyat: 12, guadalupe: 8 },
    { month: '03', gilPuyat: 6, guadalupe: 6 },
    { month: '04', gilPuyat: 15, guadalupe: 10 },
    { month: '05', gilPuyat: 9, guadalupe: 9 },
  ]);

  const [reservationData] = useState([
    { month: '01', value: 14 },
    { month: '02', value: 20 },
    { month: '03', value: 12 },
    { month: '04', value: 26 },
    { month: '05', value: 18 },
  ]);

  const [recentInquiries] = useState([
    {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      branch: 'Gil Puyat',
      time: '5 min ago',
      status: 'new',
    },
    {
      id: 2,
      name: 'Jane Smith',
      email: 'jane@example.com',
      branch: 'Makati',
      time: '15 min ago',
      status: 'new',
    },
    {
      id: 3,
      name: 'Mike Johnson',
      email: 'mike@example.com',
      branch: 'Gil Puyat',
      time: '1 hour ago',
      status: 'responded',
    },
    {
      id: 4,
      name: 'Sarah Lee',
      email: 'sarah@example.com',
      branch: 'Makati',
      time: '2 hours ago',
      status: 'new',
    },
  ]);

  const [reservationStatus] = useState({
    approved: 8,
    pending: 12,
    rejected: 3,
  });

  const [recentReservations] = useState([
    {
      id: 1,
      roomType: 'Standard Room',
      guestName: 'Ana Brown',
      branch: 'Gil Puyat',
      date: '2026-02-01',
      status: 'confirmed',
    },
    {
      id: 2,
      roomType: 'Deluxe Room',
      guestName: 'Emma Davis',
      branch: 'Makati',
      date: '2026-02-05',
      status: 'pending',
    },
    {
      id: 3,
      roomType: 'Standard Room',
      guestName: 'Chris Wilson',
      branch: 'Makati',
      date: '2026-02-10',
      status: 'confirmed',
    },
  ]);

  const renderStatIcon = (iconType) => {
    switch (iconType) {
      case 'inquiries':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M21 15A2 2 0 0 1 19 17H7L4 21V5A2 2 0 0 1 6 3H18A2 2 0 0 1 20 5V15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'reservations':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 11H2V20C2 21.1046 2.89543 22 4 22H20C21.1046 22 22 21.1046 22 20V11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 7H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'rooms':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 22V12H15V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'tenants':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 15.1716C18.0783 14.4214 17.0609 14 16 14H8C6.93913 14 5.92172 14.4214 5.17157 15.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      default:
        return null;
    }
  };

  const renderActivityIcon = (activityType) => {
    switch (activityType) {
      case 'inquiry':
        return (
          <div className="admin-dashboard-activity-icon inquiry">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M14 11.2A1.5 1.5 0 0 1 12.5 12.7H4.2L2 15V3.5A1.5 1.5 0 0 1 3.5 2H12.5A1.5 1.5 0 0 1 14 3.5V11.2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        );
      case 'reservation':
        return (
          <div className="admin-dashboard-activity-icon reservation">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M9 1V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7 1V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 3H2V14C2 14.5304 2.21071 15.0391 2.58579 15.4142C2.96086 15.7893 3.46957 16 4 16H12C12.5304 16 13.0391 15.7893 13.4142 15.4142C13.7893 15.0391 14 14.5304 14 14V3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        );
      case 'booking':
        return (
          <div className="admin-dashboard-activity-icon booking">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M14 8V12C14 12.5304 13.7893 13.0391 13.4142 13.4142C13.0391 13.7893 12.5304 14 12 14H2C1.46957 14 0.960859 13.7893 0.585786 13.4142C0.210714 13.0391 0 12.5304 0 12V4C0 3.46957 0.210714 2.96086 0.585786 2.58579C0.960859 2.21071 1.46957 2 2 2H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 0V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        );
      case 'tenant':
        return (
          <div className="admin-dashboard-activity-icon tenant">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M13 14V12.2C13 11.0799 12.5056 10.0157 11.6112 9.22183C10.7168 8.427 9.50936 8 8.25 8H3.75C2.49064 8 1.28317 8.427 0.388849 9.22183C-0.505474 10.0157 -1 11.0799 -1 12.2V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6 6C7.38071 6 8.5 4.88071 8.5 3.5C8.5 2.11929 7.38071 1 6 1C4.61929 1 3.5 2.11929 3.5 3.5C3.5 4.88071 4.61929 6 6 6Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="admin-dashboard">
      <Sidebar />
      <main className="admin-dashboard-main">
        <div className="admin-dashboard-header">
          <div>
            <h1 className="admin-dashboard-title">Dashboard</h1>
            <p className="admin-dashboard-subtitle">Welcome back! Here's your admin overview.</p>
          </div>
          <div className="admin-dashboard-date">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="admin-dashboard-stats">
          {stats.map((stat) => (
            <div key={stat.id} className="admin-dashboard-stat-card">
              <div className="admin-dashboard-stat-header">
                <div className="admin-dashboard-stat-icon" style={{ color: stat.color }}>
                  {renderStatIcon(stat.icon)}
                </div>
                <p className="admin-dashboard-stat-percentage">{stat.percentage}</p>
              </div>
              <div className="admin-dashboard-stat-body">
                <p className="admin-dashboard-stat-value">{stat.value}</p>
                <p className="admin-dashboard-stat-label">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="admin-dashboard-charts">
          {/* Branch Distribution Chart */}
          <div className="admin-dashboard-chart-card">
            <h3 className="admin-dashboard-chart-title">Branch Distribution</h3>
            <div className="admin-dashboard-chart">
              <div className="admin-dashboard-chart-bars">
                {branchData.map((data, index) => {
                  const maxValue = 16;
                  const gilPuyatHeight = (data.gilPuyat / maxValue) * 100;
                  const guadalupeHeight = (data.guadalupe / maxValue) * 100;
                  
                  return (
                    <div key={index} className="admin-dashboard-chart-bar-group">
                      <div className="admin-dashboard-chart-bars-pair">
                        <div 
                          className="admin-dashboard-chart-bar blue"
                          style={{ height: `${gilPuyatHeight}%` }}
                          title={`Gil Puyat: ${data.gilPuyat}`}
                        >
                          <span className="admin-dashboard-chart-bar-value">{data.gilPuyat}</span>
                        </div>
                        <div 
                          className="admin-dashboard-chart-bar orange"
                          style={{ height: `${guadalupeHeight}%` }}
                          title={`Guadalupe: ${data.guadalupe}`}
                        >
                          <span className="admin-dashboard-chart-bar-value">{data.guadalupe}</span>
                        </div>
                      </div>
                      <div className="admin-dashboard-chart-label">{data.month}</div>
                    </div>
                  );
                })}
              </div>
              <div className="admin-dashboard-chart-legend">
                <div className="admin-dashboard-chart-legend-item">
                  <span className="admin-dashboard-chart-legend-color blue"></span>
                  <span>Gil Puyat</span>
                </div>
                <div className="admin-dashboard-chart-legend-item">
                  <span className="admin-dashboard-chart-legend-color orange"></span>
                  <span>Guadalupe</span>
                </div>
              </div>
            </div>
          </div>

          {/* Reservation Activity Chart */}
          <div className="admin-dashboard-chart-card">
            <h3 className="admin-dashboard-chart-title">Reservation Activity</h3>
            <div className="admin-dashboard-chart">
              <div className="admin-dashboard-chart-bars">
                {reservationData.map((data, index) => {
                  const maxValue = 28;
                  const height = (data.value / maxValue) * 100;
                  
                  return (
                    <div key={index} className="admin-dashboard-chart-bar-group single">
                      <div className="admin-dashboard-chart-bars-pair">
                        <div 
                          className="admin-dashboard-chart-bar blue single"
                          style={{ height: `${height}%` }}
                          title={`Reservations: ${data.value}`}
                        >
                          <span className="admin-dashboard-chart-bar-value">{data.value}</span>
                        </div>
                      </div>
                      <div className="admin-dashboard-chart-label">{data.month}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Inquiries and Reservation Status Section */}
        <div className="admin-dashboard-bottom-section">
          {/* Recent Inquiries */}
          <div className="admin-dashboard-inquiries-section">
            <div className="admin-dashboard-inquiries-header">
              <h2 className="admin-dashboard-section-title">Recent Inquiries</h2>
              <a href="#view-all" className="admin-dashboard-view-all">View All</a>
            </div>
            <div className="admin-dashboard-inquiries-list">
              {recentInquiries.map((inquiry) => (
                <InquiryItem key={inquiry.id} inquiry={inquiry} />
              ))}
            </div>
          </div>

          {/* Reservation Status */}
          <div className="admin-dashboard-reservation-status-section">
            <h2 className="admin-dashboard-section-title">Reservation Status</h2>
            <div className="admin-dashboard-donut-container">
              <svg className="admin-dashboard-donut-chart" viewBox="0 0 200 200">
                <circle
                  cx="100"
                  cy="100"
                  r="70"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="40"
                  strokeDasharray={`${(reservationStatus.approved / 23) * 439.8} 439.8`}
                  transform="rotate(-90 100 100)"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="70"
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="40"
                  strokeDasharray={`${(reservationStatus.pending / 23) * 439.8} 439.8`}
                  strokeDashoffset={`-${(reservationStatus.approved / 23) * 439.8}`}
                  transform="rotate(-90 100 100)"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="70"
                  fill="none"
                  stroke="#EF4444"
                  strokeWidth="40"
                  strokeDasharray={`${(reservationStatus.rejected / 23) * 439.8} 439.8`}
                  strokeDashoffset={`-${((reservationStatus.approved + reservationStatus.pending) / 23) * 439.8}`}
                  transform="rotate(-90 100 100)"
                />
              </svg>
            </div>
            <div className="admin-dashboard-reservation-legend">
              <div className="admin-dashboard-reservation-legend-item">
                <span className="admin-dashboard-reservation-legend-dot green"></span>
                <span className="admin-dashboard-reservation-legend-label">Approved</span>
                <span className="admin-dashboard-reservation-legend-value">({reservationStatus.approved})</span>
              </div>
              <div className="admin-dashboard-reservation-legend-item">
                <span className="admin-dashboard-reservation-legend-dot orange"></span>
                <span className="admin-dashboard-reservation-legend-label">Pending</span>
                <span className="admin-dashboard-reservation-legend-value">({reservationStatus.pending})</span>
              </div>
              <div className="admin-dashboard-reservation-legend-item">
                <span className="admin-dashboard-reservation-legend-dot red"></span>
                <span className="admin-dashboard-reservation-legend-label">Rejected</span>
                <span className="admin-dashboard-reservation-legend-value">({reservationStatus.rejected})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Reservations Section */}
        <div className="admin-dashboard-reservations-full-section">
          <div className="admin-dashboard-reservations-header">
            <h2 className="admin-dashboard-section-title">Recent Reservations</h2>
            <a href="#view-all" className="admin-dashboard-view-all">View All</a>
          </div>
          <div className="admin-dashboard-reservations-list">
            {recentReservations.map((reservation) => (
              <ReservationItem key={reservation.id} reservation={reservation} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
