import React from 'react';
import { VerificationStatus, BookingStatus } from '../../data/schema';
import { Clock, ShieldCheck, AlertCircle, XCircle, FileText } from 'lucide-react';

/**
 * StatusBadge
 * 
 * Centralized badge rendering for standard entity states.
 */
const StatusBadge = ({ status, type = 'verification' }) => {
  const normalizedStatus = typeof status === 'string' ? status.toLowerCase() : status;
  let config = { label: status, color: '#9CA3AF', bg: 'rgba(255,255,255,0.1)', icon: FileText };

  if (type === 'verification') {
    switch (normalizedStatus) {
      case VerificationStatus.DRAFT:
        config = { label: 'Draft', color: '#9CA3AF', bg: 'rgba(255,255,255,0.05)', icon: FileText };
        break;
      case VerificationStatus.PENDING_DOCS:
      case 'pending':
        config = { label: 'Action Required', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', icon: AlertCircle };
        break;
      case VerificationStatus.UNDER_REVIEW:
        config = { label: 'Under Review', color: '#818cf8', bg: 'rgba(129,140,248,0.1)', icon: Clock };
        break;
      case VerificationStatus.APPROVED:
        config = { label: 'Verified', color: 'var(--brand-green)', bg: 'rgba(0,210,106,0.1)', icon: ShieldCheck };
        break;
      case VerificationStatus.REJECTED:
        config = { label: 'Rejected', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: XCircle };
        break;
      default:
        break;
    }
  }

  if (type === 'booking') {
    switch (normalizedStatus) {
        case BookingStatus.PENDING.toLowerCase():
          config = { label: 'Pending', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', icon: Clock };
          break;
        case BookingStatus.CONFIRMED.toLowerCase():
          config = { label: 'Confirmed', color: 'var(--brand-cyan)', bg: 'rgba(0,240,255,0.1)', icon: ShieldCheck };
          break;
        case BookingStatus.COMPLETED.toLowerCase():
          config = { label: 'Completed', color: 'var(--brand-green)', bg: 'rgba(0,210,106,0.1)', icon: ShieldCheck };
          break;
        case BookingStatus.CANCELLED.toLowerCase():
          config = { label: 'Cancelled', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: XCircle };
          break;
        default:
          break;
      }
  }

  const Icon = config.icon;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '4px 10px', borderRadius: '20px',
      background: config.bg, color: config.color,
      fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px'
    }}>
      <Icon size={12} strokeWidth={2.5} />
      {config.label}
    </span>
  );
};

export default StatusBadge;
