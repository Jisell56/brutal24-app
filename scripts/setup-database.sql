-- Script para configurar la base de datos de Brutal24
-- Aplicación de posts efímeros que expiran en 24 horas

-- Tabla de posts efímeros
CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  author TEXT NOT NULL,
  author_id TEXT,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  has_image BOOLEAN DEFAULT FALSE,
  image_url TEXT
);

-- Tabla de comentarios
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author TEXT NOT NULL,
  author_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de usuarios anónimos
CREATE TABLE IF NOT EXISTS anonymous_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de likes de usuarios
CREATE TABLE IF NOT EXISTS user_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  post_ids TEXT[] DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_posts_expires_at ON posts(expires_at);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_user_likes_user_id ON user_likes(user_id);

-- Habilitar Realtime para las tablas
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;

-- Row Level Security (RLS)
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE anonymous_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_likes ENABLE ROW LEVEL SECURITY;

-- Políticas para permitir acceso público (ya que es una app anónima)
CREATE POLICY "Allow public read posts" ON posts FOR SELECT USING (true);
CREATE POLICY "Allow public insert posts" ON posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update posts" ON posts FOR UPDATE USING (true);
CREATE POLICY "Allow public delete posts" ON posts FOR DELETE USING (true);

CREATE POLICY "Allow public read comments" ON comments FOR SELECT USING (true);
CREATE POLICY "Allow public insert comments" ON comments FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read anonymous_users" ON anonymous_users FOR SELECT USING (true);
CREATE POLICY "Allow public insert anonymous_users" ON anonymous_users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update anonymous_users" ON anonymous_users FOR UPDATE USING (true);

CREATE POLICY "Allow public read user_likes" ON user_likes FOR SELECT USING (true);
CREATE POLICY "Allow public insert user_likes" ON user_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update user_likes" ON user_likes FOR UPDATE USING (true);
