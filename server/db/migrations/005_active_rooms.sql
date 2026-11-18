-- Snapshots of the running rooms (D-117): restored after a restart, deleted when a room closes.
CREATE TABLE active_rooms (
  room_code TEXT PRIMARY KEY,
  state_json TEXT NOT NULL,
  saved_at INTEGER NOT NULL
);
