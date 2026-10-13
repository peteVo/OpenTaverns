# Table storage and management

## Durable state

The single authoritative server writes one versioned JSON snapshot per table under `OPENTAVERNS_DATA_DIR` (default: repository `data/`). `TableStore` writes a temporary file, flushes its contents, then atomically renames it over the previous snapshot. Client state is sent only after saving. A storage write failure stops the process before acknowledging unsaved actions. Incomplete temporary files are ignored on startup; malformed/unsupported snapshots fail startup rather than silently dropping a game.

Snapshots include the game ID, full authoritative game state, seat identities and credentials, current host, spectator sessions, seed, pacing, match ID, accepted action IDs, bot turn limits, deadline and save timestamp. Each game validates its restored state. Sockets, tab controllers and running bot loops are recreated rather than serialized.

After restart all human seats become Away; bots keep their seats. Matches wait for a seated human to reconnect before bots or clocks progress. The first reconnect restores the remaining clock duration measured at the save, with a 30-second minimum. Downtime does not count against private decisions. Cookie credentials restore the same private projection; shared game rules are unchanged. Normal disconnect grace remains available according to the saved window state.

Use one server process per directory. An exclusive PID lock refuses simultaneous writers; a dead process's lock is recovered. This is local persistence, not multi-instance coordination. Snapshots use synchronous writes to keep mutation and durable acknowledgement ordered for small friend tables. A transactional database is the upgrade path if write latency or distributed hosting becomes necessary.

## Host register

`/manage` is a lazy-loaded register for the **server operator**, distinct from a table's rotating player host. It lists all table codes, games, public host names, seat/bot/connection counts, spectator session counts, phase and creation date. It exposes no game state, credentials, hands, factions, locked responses, votes or random state.

On first startup a random management key is stored in `admin-key`, or supplied through `OPENTAVERNS_ADMIN_KEY` (32–200 characters). The server prints a private `/manage#key=…` link. The browser strips the fragment, exchanges the key through a same-origin POST, and receives an HttpOnly, SameSite=Strict cookie limited to `/api/admin`. It is Secure behind HTTPS. The key and cookie remain valid across restart; Lock register clears the browser cookie. Rotating the configured/stored key invalidates earlier access. Protect the key and disk files like credentials.

Routes:

| Method | Path | Meaning |
| --- | --- | --- |
| POST | `/api/admin/login` | Exchange `{key}` for the host cookie |
| POST | `/api/admin/logout` | Clear the host cookie |
| GET | `/api/admin/tables` | Authorized table summaries |
| DELETE | `/api/admin/tables/:code` | Permanently remove one saved and live table |

All management routes except login require the host credential. Writes also check request origin. Ordinary seat/spectator cookies grant no management privilege. The native confirmation dialog defaults focus to Keep table and supports Escape. Deletion removes the snapshot before removing the live room, notifies sockets with `TABLE_DELETED`, and prevents bots or closing sockets from recreating it. Clients return to a closed-table view and stop reconnect retries. No production debug endpoint is enabled by host login.

## Operating and backing up

Keep the directory outside static assets; it is gitignored. File creation requests owner-only access where supported; on Windows restrict its ACL to the server operator. Stop the server before copying the whole directory for a consistent backup. Keep the browser's existing cookies to recover private seats. Moving to a new origin requires the usual browser session considerations; a nickname is not a credential.

An OS process restart is covered. Deployment replacement also requires a persistent disk or volume at the configured path; default ephemeral container storage is insufficient. Disk loss still requires a backup. Existing games running on an older build before persistence was installed cannot be recovered retroactively.

## Verification

Storage tests cover atomic replacement/reopening, private payloads and retry IDs, permanent deletion, path validation, corrupt snapshots and concurrent/stale locks. Process integration starts four real games, changes state, locks a Forecast, restarts the server, compares all public/private projections, checks spectator redaction, retries an accepted action and checks paused/resumed deadlines. Authorization tests cover key login, denied ordinary requests, cross-origin deletion, safe summaries and deletion surviving restart. Browser tests cover register login, desktop/mobile layouts, native confirmation, cancellation, live deletion notice and logout.

The 2026-10-13 validation passed 155 tests, typecheck, lint, production build, 20 production browser tests and six development scenario tests across the four games. Restart checks also preserve a locked Blackout response and locked Compass decision. A failed snapshot replacement leaves the previous save intact. Test runs use isolated disposable data directories and never alter the operator's saved tables.

### Visual refinement

Hallmark and frontend-master guided the existing editorial palette and typography: an operator's register with table codes and game names, not an analytics dashboard. Initial real Edge screenshots covered desktop and 320/375/414/768 px. Critique found cramped phone metadata, orphaned count labels and a deletion warning dependent on a stale connection count. Refinement separated the host name, kept each count together, removed redundant lobby labels, shortened the heading and used an accurate warning for anyone connected. The final render preserves readable rows, 44 px controls, keyboard focus, native dialog focus/escape and no root overflow. The private-link exchange also works in an already-open register tab and removes the fragment from the address bar.

[Desktop register](images/qa/management-desktop-final.png) · [Phone register](images/qa/management-mobile-final.png) · [Deletion confirmation](images/qa/management-delete-mobile-final.png) · [Host access](images/qa/management-login-mobile-final.png)
