import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null;

export interface PublicRoomUpsert {
  room_id: string;
  host_nickname: string;
  host_avatar_index: number;
  current_track_title: string | null;
  current_track_artist: string | null;
  current_track_cover: string | null;
  rtt_ms: number;
  is_active: boolean;
  login_address: string;
  has_password: boolean;
  is_public: boolean;
}

export const upsertPublicRoom = async (roomData: PublicRoomUpsert) => {
  if (!supabase) {
    console.warn('[Supabase] Sync skipped: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not configured.');
    return;
  }

  try {
    const { error } = await supabase
      .from('public_rooms')
      .upsert({ ...roomData, updated_at: new Date().toISOString() }, { onConflict: 'room_id' });
    if (error) {
      console.error('[Supabase] Sync Error:', error.message);
    }
  } catch (err) {
    console.error('[Supabase] Sync Exception:', err);
  }
};

export const deactivatePublicRoom = async (roomId: string) => {
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('public_rooms')
      .update({ is_active: false })
      .eq('room_id', roomId);
    if (error) {
      console.error('[Supabase] Deactivate Error:', error.message);
    }
  } catch (err) {
    console.error('[Supabase] Deactivate Exception:', err);
  }
};
