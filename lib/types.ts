// lib/types.ts

export interface AuditFields {
  created_by?: string | null;
  date_created?: string | null;
  updated_by_?: string | null;
  date_updated?: string | null;
}

export interface RoomType extends AuditFields {
  room_type_id: number;
  type: string;
  price: number;
  size: number;
}

export interface Feature extends AuditFields {
  feature_id: number;
  room_features: string;
  feature_desc?: string | null;
}

export interface Room extends AuditFields {
  room_id: number;
  room_desc?: string | null;
  room_status: "Available" | "Maintenance";
  room_type_room_type_id: number;
  room_type?: RoomType;
  room_feature?: { feature: Feature }[];
}

export interface Service extends AuditFields {
  service_id: number;
  service_name: string;
  service_desc?: string | null;
  price: number;
}

export interface Tour extends AuditFields {
  tour_id: number;
  tour_name: string;
  tour_desc?: string | null;
  adult_price: number;
  child_price: number;
  durations: number;
}

export type StaffRole =
  | "Admin"
  | "Receptnst"
  | "Housekpr"
  | "Technician"
  | "Plumber"
  | "Electric"
  | "Chef";

export interface Staff extends AuditFields {
  staff_id: number;
  staff_fname: string;
  staff_lname: string;
  role: StaffRole;
  email: string;
  password_hash?: string;
  contact_info: string;
  is_active: "Y" | "N";
}

export interface Customer extends AuditFields {
  cust_id: number;
  cust_fname: string;
  cust_lname: string;
  town?: string | null;
  city?: string | null;
  gender?: "M" | "F" | null;
  email: string;
  contact_info: string;
  passport_number?: string | null;
  country?: string | null;
  nationality?: string | null;
}

export interface Booking extends AuditFields {
  booking_id: number;
  booking_date: string;
  booking_status: "Pending" | "Confirmed" | "Cancelled";
  booking_type: "RO" | "HB" | "FB";
  customer_cust_id: number;
  stripe_session_id?: string | null;
  customer?: Customer;
}

export interface CheckInOut extends AuditFields {
  room_room_id: number;
  booking_booking_id: number;
  check_in_date: string;
  check_out_date: string;
  actual_check_in?: string | null;
  actual_check_out?: string | null;
  status?: string | null;
  room?: Room;
  booking?: Booking;
}

export interface Payment extends AuditFields {
  payment_id: number;
  pay_id?: number;
  payment_date: string;
  payment_amount: number;
  amount_paid?: number;
  payment_method: string;
  payment_type?: string;
  booking_booking_id: number;
  booking?: Booking;
}

export interface Notification extends AuditFields {
  notif_id: number;
  sent_date: string;
  notif_type: "Booking Confirmation" | "Cancellation" | "Check-in Reminder";
  notif_status: "Pending" | "Sent" | "Failed";
  customer_cust_id: number;
  booking_booking_id: number;
  customer?: Customer;
  booking?: Booking;
}

export interface MaintenanceRequest extends AuditFields {
  mr_id: number;
  request_date: string;
  mr_desc: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  request_status: "Open" | "In Progress" | "Resolved";
  room_room_id: number;
  room?: Room;
}

export interface PricingRule extends AuditFields {
  pr_id: number;
  start_date: string;
  end_date: string;
  rate_override: number;
  reason?: string | null;
  room_type_room_type_id: number;
  room_type?: RoomType;
}

export interface RoomFeatureJunction {
  room_room_id: number;
  feature_feature_id: number;
  room?: Room;
  feature?: Feature;
}

export interface ServiceBooking extends AuditFields {
  sb_id: number;
  service_date: string;
  time_in: string;
  time_out: string;
  num_person: number;
  total_amount: number;
  sb_status: "Pending" | "Confirmed" | "Cancelled" | "Completed";
  booking_booking_id: number;
  service_service_id: number;
  booking?: Booking;
  service?: Service;
}

export interface Trip extends AuditFields {
  trip_id: number;
  trip_date: string;
  start_time: string;
  return_time: string;
  trip_status: "Scheduled" | "Ongoing" | "Completed" | "Cancelled";
  tour_tour_id: number;
  tour?: Tour;
}

export interface TripBooking extends AuditFields {
  tb_id: number;
  num_adult: number;
  num_child: number;
  total_amount: number;
  trip_trip_id: number;
  booking_booking_id: number;
  trip?: Trip;
  booking?: Booking;
}

export interface SystemStats {
  totalRooms: number;
  availableRooms: number;
  totalStaff: number;
  activeBookings: number;
}
