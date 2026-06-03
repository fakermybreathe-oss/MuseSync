export interface Member {
  id: string;
  nickname: string;
  role: "host" | "guest";
  avatar: string;
  latency: number;
  status: "synced" | "disconnected";
}

export interface Track {
  id: string;
  platform: "netease" | "qq";
  title: string;
  artist: string;
  album: string;
  cover: string;
  duration: number;
  lyrics: Array<{ time: number; text: string }>;
  sourceUrl?: string;
  proxyUrl?: string;
}

export interface RoomState {
  roomId: string;
  hostId: string;
  members: Member[];
  track: Track | null;
  position: number;
  isPlaying: boolean;
  lastSyncAt: number;
  queue: Track[];
}

export interface SearchResult {
  id: string;
  platform: "netease" | "qq";
  title: string;
  artist: string;
  album: string;
  cover: string;
  duration: number;
}
