import assert from 'node:assert/strict';
import test from 'node:test';

interface MemoryStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const createMemoryStorage = (): MemoryStorage => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
};

test('profile fallback cache is isolated by Supabase user id', async () => {
  let profileCache: typeof import('../../apps/client/src/utils/profileCache');
  try {
    profileCache = await import('../../apps/client/src/utils/profileCache');
  } catch {
    assert.fail('profile cache helper is missing');
  }

  const storage = createMemoryStorage();
  profileCache.writeCachedUserProfile(storage, 'user-a', {
    nickname: '甲',
    avatarId: 2,
    avatarName: '头像甲'
  });
  profileCache.writeCachedUserProfile(storage, 'user-b', {
    nickname: '乙',
    avatarId: 7,
    avatarName: '头像乙'
  });

  assert.deepEqual(profileCache.readCachedUserProfile(storage, 'user-a'), {
    userId: 'user-a',
    nickname: '甲',
    avatarId: 2,
    avatarName: '头像甲'
  });
  assert.deepEqual(profileCache.readCachedUserProfile(storage, 'user-b'), {
    userId: 'user-b',
    nickname: '乙',
    avatarId: 7,
    avatarName: '头像乙'
  });
});

test('legacy profile cache migrates only when it belongs to the current user', async () => {
  let profileCache: typeof import('../../apps/client/src/utils/profileCache');
  try {
    profileCache = await import('../../apps/client/src/utils/profileCache');
  } catch {
    assert.fail('profile cache helper is missing');
  }

  const storage = createMemoryStorage();
  storage.setItem('musesync_user_profile', JSON.stringify({
    userId: 'user-a',
    nickname: '旧资料',
    avatarId: 4,
    avatarName: '旧头像'
  }));

  assert.equal(profileCache.readCachedUserProfile(storage, 'user-b'), null);
  assert.deepEqual(profileCache.readCachedUserProfile(storage, 'user-a'), {
    userId: 'user-a',
    nickname: '旧资料',
    avatarId: 4,
    avatarName: '旧头像'
  });
});

test('unavailable local storage does not block profile fallback reads', async () => {
  const profileCache = await import('../../apps/client/src/utils/profileCache');
  const unavailableStorage: MemoryStorage = {
    getItem: () => {
      throw new Error('storage unavailable');
    },
    setItem: () => {
      throw new Error('storage unavailable');
    },
    removeItem: () => {
      throw new Error('storage unavailable');
    }
  };

  assert.equal(
    profileCache.readCachedUserProfile(unavailableStorage, 'user-a'),
    null
  );
});
