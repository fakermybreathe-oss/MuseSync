import type { PublicRoomUpsert } from './supabaseService';

type HeaderValue = string | string[] | undefined;

interface SyncMember {
  id: string;
  nickname: string;
  avatar: string;
  rtt: number;
  joinedAt: number;
  isHost: boolean;
  ip?: string;
}

interface SyncTrack {
  title: string;
  artist: string;
  cover: string;
}

interface SyncRoom {
  hostId?: string;
  password?: string;
  isPublic?: boolean;
  members: SyncMember[];
  track: SyncTrack | null;
}

interface MutableHostRoom {
  hostId: string;
  members: SyncMember[];
}

interface RoomSecuritySettings {
  password?: string;
  isPublic?: boolean;
}

const firstHeaderValue = (value: HeaderValue) => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return '';
  return raw.split(',')[0].trim().replace(/^::ffff:/, '');
};

export const resolveClientIp = (
  headers: Record<string, HeaderValue>,
  handshakeAddress: string | undefined
) => (
  firstHeaderValue(headers['cf-connecting-ip'])
  || firstHeaderValue(headers['true-client-ip'])
  || firstHeaderValue(headers['x-forwarded-for'])
  || firstHeaderValue(headers['x-real-ip'])
  || firstHeaderValue(headers['x-client-ip'])
  || firstHeaderValue(handshakeAddress)
  || '127.0.0.1'
);

export const resolveRoomCreationSettings = (
  existing: RoomSecuritySettings | undefined,
  requestedPassword: string | undefined,
  requestedIsPublic: boolean | undefined
): RoomSecuritySettings => {
  if (existing) {
    return {
      password: existing.password,
      isPublic: existing.isPublic
    };
  }

  return {
    password: requestedPassword,
    isPublic: requestedIsPublic ?? true
  };
};

export const removeMemberAndPromoteHost = (
  room: MutableHostRoom,
  memberId: string
) => {
  room.members = room.members.filter((member) => member.id !== memberId);

  if (room.members.length === 0) {
    room.hostId = '';
    return;
  }

  const existingHost = room.members.find((member) => member.isHost);
  const nextHost = existingHost
    ?? room.members.reduce((earliest, member) => (
      member.joinedAt < earliest.joinedAt ? member : earliest
    ));

  room.hostId = nextHost.id;
  room.members.forEach((member) => {
    member.isHost = member.id === nextHost.id;
  });
};

export const buildPublicRoomPayload = (
  roomId: string,
  room: SyncRoom
): PublicRoomUpsert | null => {
  const host = room.members.find((member) => member.isHost) || room.members[0];
  if (!host) return null;

  const avatarMatch = host.avatar.match(/cartoon_avatar_index_(\d+)/);
  const hostAvatarIndex = avatarMatch ? Number.parseInt(avatarMatch[1], 10) : 0;

  return {
    room_id: roomId,
    host_nickname: host.nickname,
    host_avatar_index: hostAvatarIndex,
    current_track_title: room.track?.title || null,
    current_track_artist: room.track?.artist || null,
    current_track_cover: room.track?.cover || null,
    rtt_ms: host.rtt,
    is_active: true,
    login_address: host.ip || '127.0.0.1',
    has_password: !!room.password,
    is_public: room.isPublic !== false
  };
};
