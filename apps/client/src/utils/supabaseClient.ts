// Supabase 客户端单例
// 在 Cloudflare Pages 环境变量中配置以下两个变量：
//   VITE_SUPABASE_URL = https://uaypgt1uocytadgbrnue.supabase.co
//   VITE_SUPABASE_ANON_KEY = <your-anon-key>
// 本地开发时，在 apps/client/.env.local 中填入上述变量（不上传 Git）

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// 若环境变量未配置，则导出 null 客户端，由调用方做降级处理
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// 判断 Supabase 是否可用
export const isSupabaseAvailable = !!supabase;

// ─── 公开同播大厅相关类型 ───
export interface PublicRoom {
  room_id: string;
  host_nickname: string;
  host_avatar_index: number;
  current_track_title: string | null;
  current_track_artist: string | null;
  current_track_cover: string | null;
  rtt_ms: number;
  is_active: boolean;
  updated_at: string;
}

// ─── 公开大厅 API：获取所有活跃公开房间（最多 20 个）───
export const fetchPublicRooms = async (): Promise<PublicRoom[]> => {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('public_rooms')
      .select('*')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(20);
    if (error) {
      console.error('[Supabase] 获取公共大厅失败:', error.message);
      return [];
    }
    return data || [];
  } catch (e) {
    console.error('[Supabase] 网络异常:', e);
    return [];
  }
};

// ─── 公开大厅 API：upsert（插入或更新）一个公开房间 ───
export const upsertPublicRoom = async (room: Omit<PublicRoom, 'updated_at'>): Promise<void> => {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('public_rooms')
      .upsert({ ...room, updated_at: new Date().toISOString() }, { onConflict: 'room_id' });
    if (error) console.error('[Supabase] 更新公共大厅失败:', error.message);
  } catch (e) {
    console.error('[Supabase] 网络异常:', e);
  }
};

// ─── 公开大厅 API：将房间标记为非活跃（房间解散时调用）───
export const deactivatePublicRoom = async (roomId: string): Promise<void> => {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('public_rooms')
      .update({ is_active: false })
      .eq('room_id', roomId);
    if (error) console.error('[Supabase] 标记房间失活失败:', error.message);
  } catch (e) {
    console.error('[Supabase] 网络异常:', e);
  }
};
