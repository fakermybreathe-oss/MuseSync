interface AuthLocation {
  origin: string;
  pathname: string;
}

export const getAuthRedirectUrl = ({ origin, pathname }: AuthLocation) => (
  `${origin}${pathname}`
);

export const getAuthCallbackMessage = (hash: string) => {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!fragment || fragment.startsWith('/')) return null;

  const params = new URLSearchParams(fragment);
  const error = params.get('error');
  const errorCode = params.get('error_code');
  const description = params.get('error_description')?.toLowerCase() ?? '';

  if (!error && !errorCode && !description) return null;

  if (
    errorCode === 'otp_expired'
    || description.includes('expired')
    || description.includes('invalid')
  ) {
    return '邮箱登录链接已失效，请重新发送';
  }

  return '邮箱登录未完成，请重新发送登录链接';
};

export const shouldNormalizeAuthCallbackRoute = (hash: string) => (
  hash === ''
  || hash === '#'
  || hash.startsWith('#access_token=')
  || hash.startsWith('#error=')
);
