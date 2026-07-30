# Backend Project — Senior Engineering Review & Fix Report

## 1. Architecture overview

This is a Node.js/Express REST API (ESM, `"type": "module"`) backing a YouTube-style
platform: users, videos, comments, likes, tweets, playlists, subscriptions, and a
creator dashboard. Standard layered structure:

- `src/models` — Mongoose schemas (User, Video, Comment, Like, Tweet, Playlist, Subscription)
- `src/controllers` — business logic per resource
- `src/routes` — Express routers binding URLs to controllers
- `src/middlewares` — auth (JWT), file upload (multer), error handling (new)
- `src/utils` — `ApiError`, `ApiResponse`, `asyncHandler`, Cloudinary upload helper
- `src/db`, `src/index.js`, `src/app.js` — DB connection and app bootstrap

Auth model: JWT access + refresh tokens, refresh token persisted on the user document,
tokens issued as httpOnly cookies (and returned in body for non-browser clients).
File uploads go local disk (multer) → Cloudinary → local temp file deleted.

The architecture itself is sound and idiomatic for this stack. The problems were
almost entirely at the implementation level: typos, unfinished stubs, and a few
logic inversions — not structural issues. I preserved the structure and conventions
throughout.

## 2. Critical bugs found and fixed

| # | File | Bug | Fix |
|---|------|-----|-----|
| 1 | `models/tweet.model.js` | `import mongoose, {Schema} from mongoose` — missing quotes around the module specifier. This is a **fatal syntax error**; the process would crash immediately on startup. | Quoted the import path. |
| 2 | `models/tweet.model.js` | `owner: { ref: true }` — invalid ref target. | Changed to `ref: "User"`. |
| 3 | `models/comment.model.js` | `content: { req: true }` — not a real Mongoose option, so comments could be created with no content despite looking "required". | Changed to `required: true`. |
| 4 | `models/like.model.js` | `comment`, `tweet`, and `likedBy` fields all had `ref: "Video"` instead of `"Comment"`, `"Tweet"`, `"User"` respectively. `populate()` on any of these would silently return nothing/wrong data. | Corrected each `ref`. |
| 5 | `models/subscription.model.js` | Exported the model as lowercase `subscription`, but `subscription.controller.js` and `dashboard.controller.js` imported the named export `{ Subscription }`. In ESM this is a **hard crash at import time** (`SyntaxError: does not provide an export named 'Subscription'`) — the whole server would fail to boot. | Renamed export to `Subscription` (also aligns with the naming convention used by every other model). |
| 6 | `routes/user.routes.js` | `/update-account` route registered `verifyJWT` but never attached the actual controller — the request would just hang/404. | Imported and wired `updateAccountDetails`. |
| 7 | `controllers/user.controller.js` | `mongoose` used (`new mongoose.Types.ObjectId(...)`) in `getWatchHistory` but never imported. | Added the import. |
| 8 | `controllers/user.controller.js` | `refreshAccessToken`: read `req.cookie.refreshToken` (should be `req.cookies`), used env var `REFRESH_TOKEN_SECREAT` (typo — the real var is `REFRESH_TOKEN_SECRET`), missing `await` on `User.findById(...)` (comparison was against a Query object, always truthy), inverted comparison `!incomingRefreshToken !== user?.refreshToken` (compares a boolean to a string — nearly always true), and `return res.status` was never *called* as a function before chaining `.cookie(...)`, which throws a `TypeError`. | All five fixed — refresh flow now actually works end-to-end. |
| 9 | `controllers/user.controller.js` | `updateUserAvatar`: `if (!avatr.url)` — `avatr` is undefined, throws `ReferenceError` on every avatar upload. | Fixed to `avatar?.url`. |
| 10 | `controllers/user.controller.js` | `updateUserAvatar` / `updateUserCoverImage`: `findByIdAndUpdate(..., { nre: true })` — typo of `new: true`. Without it, Mongoose returns the *pre*-update document, so the API response showed the old avatar/cover URL even though the DB was updated correctly. | Fixed to `new: true` in both. |
| 11 | `controllers/user.controller.js` | `updateAccountDetails`: `.select(-"password")` is invalid syntax (unary minus on a string). | Fixed to `.select("-password")`. |
| 12 | `controllers/user.controller.js` | `getUserChannelProfile` aggregation: wrong collection casing (`"Subscriptions"` vs actual `"subscriptions"`), typo'd field refs (`$subscibers`, `$subsciber`), and a broken `$in` condition that literally included the whole `req` object instead of `req.user?._id`. This meant `isSubscribed`/counts were always wrong or the query errored. | Corrected collection name, field names, and the `$in` expression to use `req.user?._id`. |
| 13 | `controllers/user.controller.js` | `getWatchHistory` aggregation: `foreignField: "id"` (should be `"_id"`) and nested lookup `from: "user"` (should be `"users"`, Mongoose's pluralized collection name) — the lookup would never match. Also the final response read `user[0].getWatchHistory`, a field that doesn't exist (`watchHistory` is the actual key). | Fixed both foreign field/collection names and the response accessor. |
| 14 | `controllers/user.controller.js` | `registerUser` validation `field?.trim() === ""` never catches an actually-missing (`undefined`) field. | Changed to `!field || field.trim() === ""`. |
| 15 | Whole project | No global error-handling middleware. Every `ApiError` thrown inside `asyncHandler` reached Express's default handler, which returns an HTML stack trace, not the project's JSON `ApiResponse`-style shape. | Added `middlewares/error.middleware.js` and registered it last in `app.js`. |

## 3. Unfinished features completed

Every controller other than `user.controller.js` was a stub (`// TODO`, empty body).
None of them had route files, and none were wired into `app.js`. I implemented full,
consistent CRUD logic for each, matching the existing code's conventions
(`asyncHandler`, `ApiError`/`ApiResponse`, ownership checks via `req.user._id`):

- **Tweets** — create / list by user / update / delete, with ownership checks.
- **Comments** — paginated video comments (`mongoose-aggregate-paginate-v2`, which was
  installed but unused), add / update / delete with ownership checks.
- **Likes** — toggle like/unlike for videos, comments, and tweets; fetch a user's liked videos.
- **Playlists** — create, list by user, get by id (populated), add/remove video, update, delete — all with ownership checks.
- **Subscriptions** — toggle subscribe/unsubscribe (with a self-subscribe guard), list a channel's subscribers, list a user's subscribed channels.
- **Videos** — paginated/filterable/sortable listing, publish (dual Cloudinary upload for video + thumbnail), get by id, update (with optional thumbnail replace), delete, toggle publish status — all with ownership checks.
- **Dashboard** — channel stats (total videos, views, subscribers, likes) and channel video list.
- **Healthcheck** — simple OK response with uptime.

New route files were created for all eight resources (`src/routes/*.routes.js`) and
wired into `app.js`, following the exact router pattern already used by `user.routes.js`.

## 4. Security improvements

- **Removed dead-but-live credentials.** The uploaded `.env` contained a real MongoDB Atlas
  password, real JWT signing secrets, and a real Cloudinary API secret. These have been
  stripped from the delivered `.env` (replaced with placeholders) and a `.env.example`
  template was added. **You should treat all of those values as compromised and rotate
  them** (MongoDB user password, both JWT secrets, Cloudinary API key/secret), since they
  were shared in this upload.
- **Added `helmet`** for standard security headers.
- **Added `express-rate-limit`** (300 req/15 min per IP on `/api/*`) to reduce brute-force/abuse risk, especially on auth endpoints.
- **Hardened multer uploads**: previously stored files under the client-supplied
  `file.originalname` verbatim (collision and path-traversal-adjacent risk); now
  generates a unique filename and strips unsafe characters from the extension. Also
  added a 100MB file size cap (previously unbounded).
- **`npm audit fix`** resolved 2 pre-existing vulnerabilities (multer DoS, qs DoS) — 0 vulnerabilities remain.
- Centralized error handling now avoids leaking stack traces in responses outside of `NODE_ENV=development`.

*Note:* your DB queries already use Mongoose's built-in parameterization (no raw string
concatenation), so there's no injection risk there beyond what's described above.

## 5. Dead code removed

- `app.js` had ~45 lines of fully commented-out duplicate boilerplate (an old draft of the same file) — removed.
- `user.controller.js` had a duplicate, fully commented-out copy of `generateAccessAndRefreshTokens` sitting above the live version — removed.
- Removed now-unused imports (`mongoose`, `User`) left over in `tweet.controller.js`, `playlist.controller.js`, `subscription.controller.js`, and `video.controller.js` after implementing the real logic.

## 6. Folder / structure notes

The existing structure (`controllers` / `models` / `routes` / `middlewares` / `utils`)
was already good practice and was preserved as-is. The only structural addition is
`src/middlewares/error.middleware.js` for centralized error handling, and the
previously-missing route files under `src/routes/`.

## 7. What I intentionally did *not* change

- Did not touch package major versions already in use (Express 5, Mongoose 9) — both were confirmed installed and working.
- Did not restructure folders beyond adding the missing route files, per your instruction to preserve the architecture.
- Left `.git` history as-is; note it may still contain the old `.env` with real secrets in prior commits — rotating those credentials is the safe fix regardless of history rewriting.

## 9. Post-delivery follow-up fix

- **Cookie `secure: true` on localhost.** The `loginUser`, `logoutUser`, and
  `refreshAccessToken` controllers all set `secure: true` unconditionally on the
  auth cookies. `secure: true` cookies are only stored/sent over HTTPS, which
  silently breaks local testing over plain `http://localhost` (login/refresh would
  return 200, but the client never actually persists the token cookies). Changed to
  `secure: process.env.NODE_ENV === "production"` in all three spots, so cookies
  work over HTTP in development and are still properly secured once `NODE_ENV=production`
  is set in a real deployment.

## 10. How to run


1. `npm install` (already reflected in the delivered `package-lock.json`, includes `helmet` + `express-rate-limit`)
2. Copy `.env.example` → `.env` and fill in **new, rotated** credentials.
3. `npm run dev`
