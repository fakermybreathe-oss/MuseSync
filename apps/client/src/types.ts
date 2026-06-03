/** MuseSync 共享类型定义 */

/** 音乐平台标识 */
export type Platform = 'netease' | 'qq';

/** 歌曲数据模型 */
export interface Track {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  audioUrl: string;
  duration: number;
  platform: Platform;
  lyrics?: string;
  isFallback?: boolean;
}

/** 歌单文件夹模型 */
export interface PlaylistFolder {
  id: string;
  name: string;
  coverUrl: string;
  trackCount: number;
  platform: Platform;
}

/** 平台登录状态 */
export interface PlatformAuth {
  loggedIn: boolean;
  userId: string;
  nickname: string;
  avatar: string;
  cookie?: string;
}

/** 播放器模式 */
export type PlayerMode = 'classic' | 'wave';
