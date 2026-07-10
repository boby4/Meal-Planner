-- ==========================================
-- 用户系统
-- ==========================================

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_session_expires ON sessions(expires_at);

-- ==========================================
-- 收藏的菜谱
-- ==========================================
CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  device_id TEXT DEFAULT '',
  recipe_name TEXT NOT NULL,
  recipe_data TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fav_unique ON favorites(COALESCE(user_id, -1), COALESCE(device_id, ''), recipe_name);

-- ==========================================
-- 浏览历史
-- ==========================================
CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  device_id TEXT DEFAULT '',
  recipe_name TEXT NOT NULL,
  recipe_data TEXT,
  source TEXT DEFAULT '',
  viewed_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_history_viewed ON history(COALESCE(user_id, 0), COALESCE(device_id, ''), viewed_at DESC);

-- ==========================================
-- 一周菜单
-- ==========================================
CREATE TABLE IF NOT EXISTS weekly_menu (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  device_id TEXT DEFAULT '',
  day_of_week INTEGER NOT NULL,
  meal_type TEXT NOT NULL,
  recipe_name TEXT NOT NULL,
  recipe_data TEXT,
  week_start TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_menu_week ON weekly_menu(COALESCE(user_id, 0), COALESCE(device_id, ''), week_start, day_of_week, meal_type);

-- ==========================================
-- 买菜清单
-- ==========================================
CREATE TABLE IF NOT EXISTS shopping_list (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  device_id TEXT DEFAULT '',
  item_name TEXT NOT NULL,
  amount TEXT DEFAULT '',
  checked INTEGER DEFAULT 0,
  related_recipe TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_shopping_user ON shopping_list(COALESCE(user_id, 0), COALESCE(device_id, ''), checked ASC, created_at DESC);
