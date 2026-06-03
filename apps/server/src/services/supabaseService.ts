import { createClient } from '@supabase/supabase-js';

// 同步前端使用的 Supabase URL 和 Anon Key
const supabaseUrl = 'https://uaypgt1uocytadgbrnue.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVheXBndGl1b2N5dGFkZ2JybnVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0OTEwNzEsImV4cCI6MjA5NjA2NzA3MX0.Ujx19r5UeHSvO1Evw5-3aBJPB2SBnagaBkWnyGukXBQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const upsertPublicRoom = async (roomData: any) => {
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
