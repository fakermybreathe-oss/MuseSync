-- 20260610221000_save_auth_in_rooms.sql
-- 增设网易云和 QQ 音乐的登录凭证持久化字段
ALTER TABLE public.public_rooms
  ADD COLUMN IF NOT EXISTS netease_auth jsonb,
  ADD COLUMN IF NOT EXISTS qq_auth jsonb;

-- 明确声明这些字段只有拥有 service_role 权限的后端才能进行读写，限制普通公共角色的直接访问
GRANT ALL ON TABLE public.public_rooms TO service_role;
