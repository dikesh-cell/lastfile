export const BOOKING_OBJECT = {
  name: 'Booking',
  label: 'Booking',
  pluralLabel: 'Bookings',
  icon: 'book-open-check',
  description: 'Plot bookings created from quotations',
} as const;

export const BOOKING_STAGE_OPTIONS = [
  { value: 'NEW_BOOKING', label: 'New Booking' },
  { value: 'WELCOME_CALL', label: 'Welcome Call' },
  { value: 'WELCOME_MAIL_RECEIPT_SENT', label: 'Welcome Mail & Receipt Sent' },
  { value: 'PARENT_DOCUMENT_SENT', label: 'Parent Document Sent' },
  { value: 'QUERIES', label: 'Queries' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const;

type BookingFieldSpec = {
  name: string;
  label: string;
  fieldType: string;
  lookupObject?: string;
  section: string;
};

const BASIC = 'Booking Information';
const PROPERTY = 'Property and Pricing';
const FIRST = 'First Applicant';
const SECOND = 'Second Applicant';
const PROFESSION = 'Profession and Referral';
const WELCOME = 'Welcome Call';

export const BOOKING_FIELDS: BookingFieldSpec[] = [
  { name: 'bookingNumber', label: 'Booking Number', fieldType: 'text', section: BASIC },
  { name: 'bookingStage', label: 'Booking Status', fieldType: 'picklist', section: BASIC },
  { name: 'status', label: 'Reservation Status', fieldType: 'text', section: BASIC },
  { name: 'lead', label: 'Lead', fieldType: 'lookup', lookupObject: 'Lead', section: BASIC },
  { name: 'quotationNumber', label: 'Quotation Number', fieldType: 'text', section: BASIC },
  { name: 'createdBy', label: 'Created By', fieldType: 'lookup', lookupObject: 'User', section: BASIC },
  { name: 'createdAt', label: 'Booking Date', fieldType: 'dateTime', section: BASIC },

  { name: 'project', label: 'Project', fieldType: 'lookup', lookupObject: 'Project', section: PROPERTY },
  { name: 'unit', label: 'Plot / Unit', fieldType: 'lookup', lookupObject: 'Unit', section: PROPERTY },
  { name: 'facingDirection', label: 'Facing Direction', fieldType: 'text', section: PROPERTY },
  { name: 'areaCent', label: 'Area (Cents)', fieldType: 'number', section: PROPERTY },
  { name: 'basePrice', label: 'Basic Price', fieldType: 'currency', section: PROPERTY },
  { name: 'plcAmount', label: 'PLC / Other Charges', fieldType: 'currency', section: PROPERTY },
  { name: 'discountAmount', label: 'Discount', fieldType: 'currency', section: PROPERTY },
  { name: 'totalPrice', label: 'Total Cost', fieldType: 'currency', section: PROPERTY },
  { name: 'bookingAmount', label: 'Booking Amount', fieldType: 'currency', section: PROPERTY },
  { name: 'paymentPlanName', label: 'Payment Plan', fieldType: 'text', section: PROPERTY },

  { name: 'firstApplicantName', label: 'Name', fieldType: 'text', section: FIRST },
  { name: 'firstApplicantDateOfBirth', label: 'Date of Birth', fieldType: 'date', section: FIRST },
  { name: 'firstApplicantAadhaar', label: 'Aadhaar Number', fieldType: 'text', section: FIRST },
  { name: 'firstApplicantPan', label: 'PAN Number', fieldType: 'text', section: FIRST },
  { name: 'firstApplicantEmail', label: 'Email', fieldType: 'email', section: FIRST },
  { name: 'firstApplicantMobile', label: 'Mobile Number', fieldType: 'phone', section: FIRST },
  { name: 'firstApplicantAddress', label: 'Corresponding Address', fieldType: 'longText', section: FIRST },

  { name: 'secondApplicantName', label: 'Name', fieldType: 'text', section: SECOND },
  { name: 'secondApplicantMobile', label: 'Mobile Number', fieldType: 'phone', section: SECOND },

  { name: 'organizationType', label: 'Organization Type', fieldType: 'text', section: PROFESSION },
  { name: 'industry', label: 'Industry', fieldType: 'text', section: PROFESSION },
  { name: 'referredBy', label: 'Referred By', fieldType: 'text', section: PROFESSION },

  { name: 'welcomeCallCompletedAt', label: 'Welcome Call Completed At', fieldType: 'dateTime', section: WELCOME },
  { name: 'welcomeCallNotes', label: 'Welcome Call Notes', fieldType: 'longText', section: WELCOME },
];

export function bookingLayoutSections() {
  const sections = new Map<string, string[]>();
  for (const field of BOOKING_FIELDS) {
    sections.set(field.section, [...(sections.get(field.section) ?? []), field.name]);
  }
  return [...sections].map(([name, fields]) => ({ name, fields }));
}
