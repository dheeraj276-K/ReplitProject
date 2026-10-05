export type Role = 'user' | 'admin';
export type TokenStatus = 'WAITING' | 'CALLED' | 'SERVING' | 'COMPLETED' | 'CANCELLED' | 'SKIPPED' | 'EXPIRED';
export interface Profile {
  id: string; full_name: string; email: string; phone: string; role: Role;
  date_of_birth?: string; gender?: string; address?: string; created_at: string; updated_at: string;
}
export interface Service {
  id: string; name: string; description: string; department: string; prefix: string;
  average_service_time_minutes: number; max_daily_tokens: number; is_active: boolean;
  created_at: string; updated_at: string; queue_size: number; current_serving_token: string | null;
}
export interface Token {
  id: string; user_id: string; service_id: string; token_number: string; sequence_number: number;
  status: TokenStatus; created_at: string; called_at?: string; completed_at?: string; cancelled_at?: string;
  service_name?: string; people_ahead?: number; queue_position?: number; estimated_wait_minutes?: number;
  current_serving_token?: string | null;
  profile?: { full_name: string; email: string } | null;
}
export interface QueueInfo extends Token {
  service_name: string; current_serving_token: string | null; people_ahead: number;
  queue_position: number; estimated_wait_minutes: number;
}
