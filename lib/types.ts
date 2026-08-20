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
  room_status: 'Available' | 'Maintenance';
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

export type StaffRole = 'Admin' | 'Receptnst' | 'Housekpr' | 'Technician' | 'Plumber' | 'Electric' | 'Chef';

export interface Staff extends AuditFields {
  staff_id: number;
  staff_fname: string;
  staff_lname: string;
  role: StaffRole;
  email: string;
  password_hash?: string;
  contact_info: string;
  is_active: 'Y' | 'N';
}

export interface SystemStats {
  totalRooms: number;
  availableRooms: number;
  totalStaff: number;
  activeBookings: number;
}
