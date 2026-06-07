export const SIGNUP_CONFIRMATION_MESSAGE =
  '请检查邮箱。如果这是新账号，我们已发送确认链接；已有账号可直接返回登录。';

export const toChineseAuthMessage = (message: string) => {
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials')) return '邮箱或密码不正确';
  if (normalized.includes('email not confirmed')) return '邮箱还未确认，请先打开邮箱中的确认链接';
  if (normalized.includes('already registered') || normalized.includes('already been registered')) {
    return '无法完成注册，请返回登录或使用邮箱登录链接';
  }
  if (normalized.includes('password should be at least') || normalized.includes('password')) {
    return '密码至少需要 6 位';
  }
  if (
    normalized.includes('rate limit')
    || normalized.includes('too many')
    || normalized.includes('security purposes')
  ) {
    return '请求过于频繁，请稍后再试';
  }
  if (normalized.includes('supabase is not configured')) return 'Supabase 还没有配置，暂时无法登录';
  if (message.includes('网络异常')) return message;

  return '请求失败，请稍后再试';
};
