import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null;

let hasWarnedNotConfigured = false;

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
  netease_auth?: any;
  qq_auth?: any;
}

export const upsertPublicRoom = async (roomData: PublicRoomUpsert) => {
  if (!supabase) {
    if (!hasWarnedNotConfigured) {
      console.warn('[Supabase] Sync skipped: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not configured.');
      hasWarnedNotConfigured = true;
    }
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

export const getRoomAuth = async (roomId: string): Promise<{ neteaseAuth: any, qqAuth: any } | null> => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('public_rooms')
      .select('netease_auth, qq_auth')
      .eq('room_id', roomId)
      .maybeSingle();
    if (error) {
      console.error('[Supabase] GetRoomAuth Error:', error.message);
      return null;
    }
    if (data) {
      return {
        neteaseAuth: data.netease_auth || null,
        qqAuth: data.qq_auth || null
      };
    }
  } catch (err) {
    console.error('[Supabase] GetRoomAuth Exception:', err);
  }
  return null;
};

