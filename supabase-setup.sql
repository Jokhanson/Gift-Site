-- ============================================
-- Настройка Supabase для Gift-Site
-- Выполни этот SQL в SQL Editor Supabase
-- ============================================

-- 1. Таблица страниц
CREATE TABLE IF NOT EXISTS pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  slug TEXT UNIQUE NOT NULL,
  occasion TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  greeting TEXT NOT NULL,
  message TEXT NOT NULL,
  signature TEXT DEFAULT '',
  sticker TEXT DEFAULT '🎉',
  video_url TEXT DEFAULT '',
  photo_urls TEXT[] DEFAULT '{}'
);

-- 2. RLS (Row Level Security)
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON pages
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON pages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update" ON pages
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete" ON pages
  FOR DELETE USING (true);

-- 3. Storage bucket для фото (выполнить через Storage UI или SQL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('gift-photos', 'gift-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 4. RLS для Storage
CREATE POLICY "Allow public read photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'gift-photos');

CREATE POLICY "Allow public upload photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'gift-photos');

CREATE POLICY "Allow public delete photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'gift-photos');
