import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPublicRoomPayload,
  removeMemberAndPromoteHost,
  resolveRoomCreationSettings,
  resolveClientIp
} from './roomSync';

test('private password room remains eligible for Supabase sync', () => {
  const payload = buildPublicRoomPayload('ABC123', {
    password: 'hashed-password',
    isPublic: false,
    members: [{
      id: 'host-socket',
      nickname: '云端听友',
      avatar: 'cartoon_avatar_index_7',
      rtt: 86,
      joinedAt: 1,
      isHost: true,
      ip: '203.0.113.24'
    }],
    track: {
      title: '同频测试曲',
      artist: 'MuseSync',
      coverUrl: 'https://example.com/cover.jpg'
    }
  });

  assert.ok(payload);
  assert.equal(payload.room_id, 'ABC123');
  assert.equal(payload.has_password, true);
  assert.equal(payload.is_public, false);
  assert.equal(payload.login_address, '203.0.113.24');
  assert.equal(payload.host_avatar_index, 7);
});

test('room without members is the only room excluded from sync', () => {
  const payload = buildPublicRoomPayload('EMPTY1', {
    members: [],
    track: null,
    isPublic: false,
    password: 'still-private'
  });

  assert.equal(payload, null);
});

test('client IP uses proxy headers in the documented priority order', () => {
  assert.equal(resolveClientIp({
    'cf-connecting-ip': '198.51.100.8',
    'x-forwarded-for': '203.0.113.10, 10.0.0.2',
    'x-real-ip': '192.0.2.9'
  }, '::ffff:127.0.0.1'), '198.51.100.8');

  assert.equal(resolveClientIp({
    'x-forwarded-for': '203.0.113.10, 10.0.0.2',
    'x-real-ip': '192.0.2.9'
  }, '::ffff:127.0.0.1'), '203.0.113.10');

  assert.equal(resolveClientIp({}, '::ffff:192.0.2.45'), '192.0.2.45');
});

test('remaining member becomes host when the current host leaves', () => {
  const room = {
    hostId: 'host-socket',
    password: '',
    isPublic: true,
    members: [
      {
        id: 'host-socket',
        nickname: '旧房主',
        avatar: 'cartoon_avatar_index_1',
        rtt: 20,
        joinedAt: 1,
        isHost: true,
        ip: '198.51.100.1'
      },
      {
        id: 'next-host',
        nickname: '新房主',
        avatar: 'cartoon_avatar_index_2',
        rtt: 30,
        joinedAt: 2,
        isHost: false,
        ip: '198.51.100.2'
      }
    ],
    track: null
  };

  removeMemberAndPromoteHost(room, 'host-socket');

  assert.equal(room.hostId, 'next-host');
  assert.equal(room.members.length, 1);
  assert.equal(room.members[0].isHost, true);
  assert.equal(
    buildPublicRoomPayload('HOST01', room)?.login_address,
    '198.51.100.2'
  );
});

test('non-host departure keeps the existing host and empty room clears host id', () => {
  const room = {
    hostId: 'host-socket',
    members: [
      {
        id: 'host-socket',
        nickname: '房主',
        avatar: 'cartoon_avatar_index_1',
        rtt: 20,
        joinedAt: 1,
        isHost: true,
        ip: '198.51.100.1'
      },
      {
        id: 'guest-socket',
        nickname: '访客',
        avatar: 'cartoon_avatar_index_2',
        rtt: 30,
        joinedAt: 2,
        isHost: false,
        ip: '198.51.100.2'
      }
    ],
    track: null
  };

  removeMemberAndPromoteHost(room, 'guest-socket');
  assert.equal(room.hostId, 'host-socket');
  assert.equal(room.members[0].isHost, true);

  removeMemberAndPromoteHost(room, 'host-socket');
  assert.equal(room.hostId, '');
  assert.deepEqual(room.members, []);
});

test('join parameters cannot overwrite an existing room security settings', () => {
  assert.deepEqual(
    resolveRoomCreationSettings({
      password: undefined,
      isPublic: true
    }, 'attacker-password', false),
    {
      password: undefined,
      isPublic: true
    }
  );

  assert.deepEqual(
    resolveRoomCreationSettings({
      password: 'owner-password',
      isPublic: false
    }, 'owner-password', true),
    {
      password: 'owner-password',
      isPublic: false
    }
  );
});

test('new room uses creator password and public setting', () => {
  assert.deepEqual(
    resolveRoomCreationSettings(undefined, 'creator-password', false),
    {
      password: 'creator-password',
      isPublic: false
    }
  );
  assert.deepEqual(
    resolveRoomCreationSettings(undefined, undefined, undefined),
    {
      password: undefined,
      isPublic: true
    }
  );
});
