export interface ProfileCacheStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface CachedUserProfile {
  userId: string;
  nickname: string;
  avatarId: number;
  avatarName: string;
}

export interface CachedUserProfileInput {
  nickname: string;
  avatarId: number;
  avatarName: string;
}

const LEGACY_PROFILE_KEY = 'musesync_user_profile';
const profileKey = (userId: string) => `musesync_user_profile:${userId}`;

const parseProfile = (value: string | null, userId: string): CachedUserProfile | null => {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<CachedUserProfile>;
    if (
      parsed.userId !== userId
      || typeof parsed.nickname !== 'string'
      || !Number.isInteger(parsed.avatarId)
      || (parsed.avatarId as number) < 0
      || (parsed.avatarId as number) > 9
    ) {
      return null;
    }

    return {
      userId,
      nickname: parsed.nickname,
      avatarId: parsed.avatarId as number,
      avatarName: typeof parsed.avatarName === 'string' ? parsed.avatarName : ''
    };
  } catch {
    return null;
  }
};

export const writeCachedUserProfile = (
  storage: ProfileCacheStorage,
  userId: string,
  profile: CachedUserProfileInput
) => {
  const cachedProfile: CachedUserProfile = {
    userId,
    nickname: profile.nickname,
    avatarId: profile.avatarId,
    avatarName: profile.avatarName
  };
  storage.setItem(profileKey(userId), JSON.stringify(cachedProfile));
};

export const readCachedUserProfile = (
  storage: ProfileCacheStorage,
  userId: string
): CachedUserProfile | null => {
  try {
    const current = parseProfile(storage.getItem(profileKey(userId)), userId);
    if (current) return current;

    const legacy = parseProfile(storage.getItem(LEGACY_PROFILE_KEY), userId);
    if (!legacy) return null;

    writeCachedUserProfile(storage, userId, legacy);
    storage.removeItem(LEGACY_PROFILE_KEY);
    return legacy;
  } catch {
    return null;
  }
};
