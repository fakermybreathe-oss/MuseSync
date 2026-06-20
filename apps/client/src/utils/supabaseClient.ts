// Supabase 客户端单例
// 在 Cloudflare Pages 环境变量中配置以下两个变量：
//   VITE_SUPABASE_URL = https://uaypgtiuocytadgbrnue.supabase.co
//   VITE_SUPABASE_ANON_KEY = <your-anon-key>
// 本地开发时，在 apps/client/.env.local 中填入上述变量（不上传 Git）

import { createClient } from '@supabase/supabase-js';
import type { Session, User } from '@supabase/supabase-js';
import { getAuthCallbackMessage } from '../auth/authRedirect';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';


export const initialAuthCallbackMessage = typeof window === 'undefined'
  ? null
  : getAuthCallbackMessage(window.location.hash);

// 若环境变量未配置，则导出 null 客户端，由调用方做降级处理
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        detectSessionInUrl: true,
        flowType: 'implicit',
        persistSession: true
      }
    })
  : null;

// 判断 Supabase 是否可用
export const isSupabaseAvailable = !!supabase;

export type SupabaseSession = Session;
export type SupabaseUser = User;

export interface UserProfile {
  id: string;
  displayName: string;
  avatarIndex: number;
  avatarUrl: string | null;
  neteaseAuth?: any;
  qqAuth?: any;
  updatedAt?: string;
}

export interface SaveUserProfileInput {
  displayName: string;
  avatarIndex: number;
  avatarUrl?: string | null;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  avatar_index: number | null;
  avatar_url: string | null;
  netease_auth?: any;
  qq_auth?: any;
  updated_at?: string;
}

const mapProfileRow = (row: ProfileRow): UserProfile => ({
  id: row.id,
  displayName: row.display_name ?? '',
  avatarIndex: typeof row.avatar_index === 'number' ? row.avatar_index : 0,
  avatarUrl: row.avatar_url,
  neteaseAuth: row.netease_auth,
  qqAuth: row.qq_auth,
  updatedAt: row.updated_at
});

export const fetchUserProfile = async (userId: string): Promise<{ data: UserProfile | null; error: string | null }> => {
  if (!supabase) return { data: null, error: 'Supabase 未配置，无法读取个人资料。' };

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_index, avatar_url, netease_auth, qq_auth, updated_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[Supabase] 读取用户资料失败:', error.message);
      return { data: null, error: error.message };
    }

    return { data: data ? mapProfileRow(data as ProfileRow) : null, error: null };
  } catch (e) {
    console.error('[Supabase] 读取用户资料网络异常:', e);
    return { data: null, error: '网络异常，无法读取个人资料。' };
  }
};

export const saveUserProfile = async (
  userId: string,
  profile: SaveUserProfileInput
): Promise<{ data: UserProfile | null; error: string | null }> => {
  if (!supabase) return { data: null, error: 'Supabase 未配置，无法保存个人资料。' };

  try {
    // 避免 upsert 覆盖掉未传递的 netease_auth 和 qq_auth 字段
    // 先尝试 update，如果更新了 0 行（说明没这条记录），再执行 upsert
    const updatePayload = {
      display_name: profile.displayName.trim(),
      avatar_index: profile.avatarIndex,
      avatar_url: profile.avatarUrl ?? null,
      updated_at: new Date().toISOString()
    };
    
    let result = await supabase.from('profiles').update(updatePayload).eq('id', userId).select();
    
    if (!result.data || result.data.length === 0) {
      // 记录不存在，执行插入
      result = await supabase.from('profiles').upsert({
        id: userId,
        ...updatePayload
      }, { onConflict: 'id' }).select();
    }
    
    if (result.error) {
      console.error('[Supabase] 保存用户资料失败:', result.error.message);
      return { data: null, error: result.error.message };
    }

    return { data: result.data && result.data[0] ? mapProfileRow(result.data[0] as ProfileRow) : null, error: null };
  } catch (e) {
    console.error('[Supabase] 保存用户资料网络异常:', e);
    return { data: null, error: '网络异常，无法保存个人资料。' };
  }
};

export const saveUserAuth = async (
  userId: string,
  platform: 'netease' | 'qq',
  authData: any | null
): Promise<{ success: boolean; error: string | null }> => {
  if (!supabase) return { success: false, error: 'Supabase 未配置' };

  try {
    const updateData: any = { updated_at: new Date().toISOString() };
    if (platform === 'netease') updateData.netease_auth = authData;
    else updateData.qq_auth = authData;

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (error) {
      console.error(`[Supabase] 更新 ${platform} Auth失败:`, error.message);
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  } catch (e) {
    console.error(`[Supabase] 更新 ${platform} Auth网络异常:`, e);
    return { success: false, error: '网络异常' };
  }
};

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
  has_password: boolean;
  is_public: boolean;
}

// ─── 在线大厅 API：获取所有活跃房间，包括私密房和密码房（最多 20 个）───
export const fetchActiveRooms = async (): Promise<PublicRoom[]> => {
  if (!supabase) return [];
  try {
    let { data, error } = await supabase
      .from('public_rooms')
      .select('room_id, host_nickname, host_avatar_index, current_track_title, current_track_artist, current_track_cover, rtt_ms, is_active, updated_at, has_password, is_public')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (error && error.message.includes('does not exist')) {
      console.warn('[Supabase] 远端表缺少部分列，启用降级查询...');
      const fallback = await supabase
        .from('public_rooms')
        .select('room_id, host_nickname, host_avatar_index, current_track_title, current_track_artist, current_track_cover, rtt_ms, is_active, updated_at')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(20);
      data = fallback.data as any;
      error = fallback.error;
    }

    if (error) {
      console.error('[Supabase] 获取公共大厅失败:', error.message);
      return [];
    }
    
    // 返回数据并对缺失的字段做默认值兜底
    return (data || []).map((r: any) => ({
      ...r,
      has_password: r.has_password ?? false,
      is_public: r.is_public ?? true
    })) as PublicRoom[];
  } catch (e) {
    console.error('[Supabase] 网络异常:', e);
    return [];
  }
};
