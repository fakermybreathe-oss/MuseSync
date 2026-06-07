import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAuthRedirectUrl,
  getAuthCallbackMessage,
  shouldNormalizeAuthCallbackRoute
} from '../../apps/client/src/auth/authRedirect';

test('email auth redirect leaves the URL fragment to Supabase implicit flow', () => {
  assert.equal(
    getAuthRedirectUrl({
      origin: 'https://music.example.com',
      pathname: '/musesync/'
    }),
    'https://music.example.com/musesync/'
  );
  assert.doesNotMatch(
    getAuthRedirectUrl({
      origin: 'http://127.0.0.1:5173',
      pathname: '/'
    }),
    /#/
  );
});

test('expired and denied email callbacks receive Chinese messages', () => {
  assert.equal(
    getAuthCallbackMessage(
      '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
    ),
    '邮箱登录链接已失效，请重新发送'
  );
  assert.equal(
    getAuthCallbackMessage(
      '#error=access_denied&error_description=User+denied+the+request'
    ),
    '邮箱登录未完成，请重新发送登录链接'
  );
  assert.equal(getAuthCallbackMessage('#/login'), null);
});

test('only auth callback and empty hashes normalize to the app route', () => {
  assert.equal(shouldNormalizeAuthCallbackRoute(''), true);
  assert.equal(shouldNormalizeAuthCallbackRoute('#'), true);
  assert.equal(shouldNormalizeAuthCallbackRoute('#access_token=fake'), true);
  assert.equal(shouldNormalizeAuthCallbackRoute('#error=access_denied'), true);
  assert.equal(shouldNormalizeAuthCallbackRoute('#/login'), false);
  assert.equal(shouldNormalizeAuthCallbackRoute('#/lyrics'), false);
});
