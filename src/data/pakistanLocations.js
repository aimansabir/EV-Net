/**
 * EV-Net — Comprehensive Pakistan Location Data
 * 
 * Separates grouped phases (DHA 1-9) into individual entries
 * for better searchability and data integrity.
 */

export const PakistanCities = [
  {
    city: 'Karachi',
    areas: [
      'DHA Phase 1', 'DHA Phase 2', 'DHA Phase 4', 'DHA Phase 5', 'DHA Phase 6', 'DHA Phase 7', 'DHA Phase 8', 'DHA Phase 8 Ext',
      'Clifton Block 1', 'Clifton Block 2', 'Clifton Block 3', 'Clifton Block 4', 'Clifton Block 5', 'Clifton Block 7', 'Clifton Block 8', 'Clifton Block 9',
      'PECHS Block 2', 'PECHS Block 3', 'PECHS Block 6',
      'Gulshan-e-Iqbal Block 1', 'Gulshan-e-Iqbal Block 2', 'Gulshan-e-Iqbal Block 3', 'Gulshan-e-Iqbal Block 4', 'Gulshan-e-Iqbal Block 5', 'Gulshan-e-Iqbal Block 10', 'Gulshan-e-Iqbal Block 13',
      'Bahria Town Karachi - Precinct 1', 'Bahria Town Karachi - Precinct 2', 'Bahria Town Karachi - Precinct 12', 'Bahria Town Karachi - Precinct 19',
      'Scheme 33', 'KDA Scheme 1', 'Malir Cantt', 'North Nazimabad Block A', 'North Nazimabad Block B', 'North Nazimabad Block F', 'North Nazimabad Block H',
      'Emaar Crescent Bay', 'Garden', 'Federal B Area', 'Karsaz', 'Naval Anchorage', 'Gulistan-e-Jauhar Block 1', 'Gulistan-e-Jauhar Block 12', 'Gulistan-e-Jauhar Block 15'
    ]
  },
  {
    city: 'Lahore',
    areas: [
      'DHA Phase 1', 'DHA Phase 2', 'DHA Phase 3', 'DHA Phase 4', 'DHA Phase 5', 'DHA Phase 6', 'DHA Phase 7', 'DHA Phase 8', 'DHA Phase 9 Prism', 'DHA Phase 9 Town', 'DHA Phase 11 (Rahbar)',
      'Gulberg I', 'Gulberg II', 'Gulberg III', 'Gulberg V',
      'Model Town', 'Johar Town Phase 1', 'Johar Town Phase 2', 'Bahria Town Sector A', 'Bahria Town Sector B', 'Bahria Town Sector C', 'Bahria Town Sector D', 'Bahria Town Sector E',
      'Defense Raya', 'Cavalry Ground', 'Cantt', 'Garden Town', 'Faisal Town', 'Valencia Town', 'WAPDA Town', 'Lake City', 'State Life', 'Sui Gas Society',
      'Green City', 'Paragon City', 'New Lahore City', 'Zaitoon City', 'Al Kabir Town', 'Park View City', 'Etihad Town', 'Central Park', 'LDA City'
    ]
  },
  {
    city: 'Islamabad',
    areas: [
      'E-7', 'F-6', 'F-7', 'F-8', 'F-10', 'F-11', 'G-6', 'G-7', 'G-8', 'G-9', 'G-10', 'G-11', 'G-13', 'G-15', 'H-13', 'I-8', 'I-9', 'I-10',
      'DHA Phase 1', 'DHA Phase 2', 'DHA Phase 3', 'DHA Phase 4', 'DHA Phase 5', 'DHA Valley',
      'Bahria Town Phase 1', 'Bahria Town Phase 2', 'Bahria Town Phase 3', 'Bahria Town Phase 4', 'Bahria Town Phase 5', 'Bahria Town Phase 6', 'Bahria Town Phase 7', 'Bahria Town Phase 8', 'Bahria Enclave',
      'Gulberg Residencia', 'Gulberg Greens', 'Park View City', 'Eighteen', 'Top City-1', 'Mumtaz City', 'University Town', 'B-17 Multi Gardens', 'D-12', 'E-11'
    ]
  },
  {
    city: 'Rawalpindi',
    areas: [
      'Bahria Town Phase 7', 'Bahria Town Phase 8', 'Chaklala Scheme 3', 'Saddar', 'Rawalpindi Cantt', 'Satellite Town', 'Westridge', 'Gulraiz', 'Airport Housing Society', 'DHA Phase 1'
    ]
  },
  {
    city: 'Faisalabad',
    areas: [
      'Madina Town', 'Peoples Colony', 'Samanabad', 'Lyallpur Town', 'Canal Road', 'Citi Housing', 'Faisalabad Motorway City', 'Sargodha Road', 'Jinnah Town'
    ]
  },
  {
    city: 'Multan',
    areas: [
      'DHA Multan', 'Bosan Road', 'Gulgasht Colony', 'Multan Cantt', 'Wapda Town', 'Buch Villas', 'Model Town', 'Garden Town'
    ]
  },
  {
    city: 'Peshawar',
    areas: [
      'DHA Peshawar', 'Hayatabad Phase 1', 'Hayatabad Phase 3', 'Hayatabad Phase 5', 'Hayatabad Phase 7', 'University Town', 'Peshawar Cantt', 'Regi Model Town'
    ]
  },
  {
    city: 'Quetta',
    areas: [
        'Quetta Cantt', 'Jinnah Town', 'Satellite Town', 'Samungli Road', 'DHA Quetta'
    ]
  },
  {
    city: 'Gujranwala',
    areas: [
        'Citi Housing', 'DHA Gujranwala', 'Satellite Town', 'Model Town', 'Garden Town', 'Master City'
    ]
  },
  {
    city: 'Sialkot',
    areas: [
        'Sialkot Cantt', 'Citi Housing', 'Model Town', 'Defence'
    ]
  }
];

export const PakistanCitiesSorted = [...PakistanCities].sort((a, b) => a.city.localeCompare(b.city));
