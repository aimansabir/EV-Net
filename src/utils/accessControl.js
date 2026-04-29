import { VerificationStatus, BookingStatus } from '../data/schema';

/**
 * Access Control Module
 * Centralizes all permission, privacy, and moderation logic.
 */

export const canBook = (user) => {
  if (!user || user.role !== 'USER') return false;
  // Soft-lock booking explicitly if any verification step is missing
  return !!(user.emailVerified && user.cnicSubmitted && user.evProofSubmitted && user.verificationStatus === VerificationStatus.APPROVED);
};

export const exactLocationUnlocked = (user, listingId, userBookings = []) => {
  if (!user || !canBook(user)) return false;
  if (!listingId) return false;

  // Has the user confirmed or completed a booking *for this specific listing*?
  return userBookings.some(b => 
    b.listingId === listingId && 
    (b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.COMPLETED)
  );
};

export const canViewExactLocation = (user, listingId, userBookings = []) => {
  // Alias for semantic clarity in UI components
  return exactLocationUnlocked(user, listingId, userBookings);
};

export const canCreateInquiry = (user) => {
  if (!user || user.role !== 'USER') return false;
  if (user.isRestrictedFromInquiry) return false;
  return true;
};

export const canAccessBookingChat = (user, booking) => {
  if (!user || !booking) return false;
  if (user.role === 'ADMIN') return true;
  
  // Must be part of the booking
  const isParticipant = booking.userId === user.id || booking.listing?.hostId === user.id;
  if (!isParticipant) return false;

  // Booking chat opens when confirmed, stays open when completed
  return booking.status === BookingStatus.CONFIRMED || booking.status === BookingStatus.COMPLETED;
};

export const canModerateConversation = (user) => {
  return user?.role === 'ADMIN';
};
