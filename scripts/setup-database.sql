-- ============================================================
-- BRUTAL24 - Script de Configuración de Base de Datos
-- Aplicación de posts efímeros que expiran en 24 horas
-- ============================================================
-- 
-- INSTRUCCIONES:
-- 1. Crea un proyecto nuevo en https://supabase.com
-- 2. Ve a "SQL Editor" en el menú lateral
-- 3. Copia y pega TODO este script
-- 4. Haz clic en "Run" para ejecutarlo
-- ============================================================

-- ============================================================
-- PASO 1: CREAR TABLAS
-- ============================================================

-- Tabla de posts efímeros
CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Tabla de comentarios
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de usuarios anónimos
CREATE TABLE IF NOT EXISTS anonymous_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de likes de usuarios (para rastrear qué posts le gustaron a cada usuario)
CREATE TABLE IF NOT EXISTS user_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  post_ids TEXT[] DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de notificaciones (opcional)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment')),
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- PASO 2: CREAR ÍNDICES PARA MEJOR RENDIMIENTO
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_posts_expires_at ON posts(expires_at);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_user_likes_user_id ON user_likes(user_id);

-- ============================================================
-- PASO 3: HABILITAR ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE anonymous_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PASO 4: CREAR POLÍTICAS DE ACCESO PÚBLICO
-- (Necesario porque es una app con usuarios anónimos)
-- ============================================================

-- Políticas para POSTS
CREATE POLICY "Allow public read posts" ON posts 
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert posts" ON posts 
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update posts" ON posts 
  FOR UPDATE USING (true);
CREATE POLICY "Allow public delete posts" ON posts 
  FOR DELETE USING (true);

-- Políticas para COMMENTS
CREATE POLICY "Allow public read comments" ON comments 
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert comments" ON comments 
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete comments" ON comments 
  FOR DELETE USING (true);

-- Políticas para ANONYMOUS_USERS
CREATE POLICY "Allow public read anonymous_users" ON anonymous_users 
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert anonymous_users" ON anonymous_users 
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update anonymous_users" ON anonymous_users 
  FOR UPDATE USING (true);

-- Políticas para USER_LIKES
CREATE POLICY "Allow public read user_likes" ON user_likes 
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert user_likes" ON user_likes 
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update user_likes" ON user_likes 
  FOR UPDATE USING (true);

-- Políticas para NOTIFICATIONS
CREATE POLICY "Allow public read notifications" ON notifications 
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert notifications" ON notifications 
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update notifications" ON notifications 
  FOR UPDATE USING (true);

-- ============================================================
-- PASO 5: HABILITAR REALTIME (actualizaciones en tiempo real)
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;

-- ============================================================
-- PASO 6: FUNCIÓN PARA LIMPIAR POSTS EXPIRADOS (OPCIONAL)
-- Puedes ejecutar esto manualmente o configurar un cron job
-- ============================================================

CREATE OR REPLACE FUNCTION delete_expired_posts()
RETURNS void AS $$
BEGIN
  DELETE FROM posts WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ¡LISTO! Tu base de datos está configurada.
-- Ahora configura las variables de entorno en tu proyecto.
-- ============================================================
