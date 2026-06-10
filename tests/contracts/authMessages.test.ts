import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SIGNUP_CONFIRMATION_MESSAGE,
  toChineseAuthMessage
} from '../../apps/client/src/auth/authMessages';

test('signup confirmation text does not reveal whether an email already exists', () => {
  assert.equal(
    SIGNUP_CONFIRMATION_MESSAGE,
    '请检查邮箱。如果这是新账号，我们已发送确认链接；已有账号可直接返回登录。'
  );
  assert.doesNotMatch(SIGNUP_CONFIRMATION_MESSAGE, /账号已创建|邮箱已注册/);
});

test('Supabase credential errors are mapped to Chinese', () => {
  assert.equal(
    toChineseAuthMessage('Invalid login credentials'),
    '邮箱或密码不正确'
  );
  assert.equal(
    toChineseAuthMessage('Email not confirmed'),
    '邮箱还未确认，请先打开邮箱中的确认链接'
  );
});
