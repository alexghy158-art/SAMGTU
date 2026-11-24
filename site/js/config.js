// Публичные настройки (не секреты): адрес Supabase и anon-ключ.
// Данные в облаке защищены кодом синхронизации, а не этим ключом.
export const SUPABASE_URL = 'https://ssuvxbxyzahvdlxqmbbz.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdXZ4Ynh5emFodmRseHFtYmJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzOTkwNDQsImV4cCI6MjEwNDk3NTA0NH0.eVVgOsYfmoh5sdWPnGIoryusdz0AB1K7k16adzBEyGg';

// Публичный ключ для push выдаёт функция Netlify (пара ключей живёт в Netlify Blobs).
export const PUSH_KEY_URL = '/api/push-key';
