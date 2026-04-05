// Typed request interfaces for API calls

export interface CreateTripRequest {
  title: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  currency?: string;
  reminder_days?: number;
}

export interface UpdateTripRequest {
  title?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  currency?: string;
  reminder_days?: number;
  is_archived?: boolean;
  cover_image?: string;
}

export interface CreatePlaceRequest {
  name: string;
  description?: string;
  lat?: number;
  lng?: number;
  address?: string;
  category_id?: number;
  google_place_id?: string;
  osm_id?: string;
  website?: string;
  phone?: string;
  notes?: string;
}

export interface UpdatePlaceRequest extends Partial<CreatePlaceRequest> {}

export interface CreateBudgetItemRequest {
  name: string;
  total_price: number;
  category?: string;
  note?: string;
  persons?: number;
  days?: number;
}

export interface UpdateBudgetItemRequest extends Partial<CreateBudgetItemRequest> {}

export interface CreatePackingItemRequest {
  name: string;
  category?: string;
  quantity?: number;
}

export interface CreateReservationRequest {
  title: string;
  type: 'flight' | 'hotel' | 'restaurant' | 'train' | 'car' | 'cruise' | 'event' | 'tour' | 'activity' | 'other';
  confirmation_number?: string;
  reservation_time?: string;
  location?: string;
  notes?: string;
  day_id?: number;
  assignment_id?: number;
  place_id?: number;
  start_day_id?: number;
  end_day_id?: number;
}

export interface UpdateReservationRequest extends Partial<CreateReservationRequest> {
  status?: 'pending' | 'confirmed' | 'cancelled';
}

export interface UpdateDayRequest {
  title?: string | null;
  notes?: string;
}

export interface CreateDayNoteRequest {
  text: string;
  time?: string;
  icon?: string;
}
