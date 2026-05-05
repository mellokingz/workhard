# Nexus Study — Backend API

Production-ready Node.js backend for the Nexus Study AI-powered study application.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ (ESM) |
| Framework | Express 4 |
| Database | PostgreSQL 16 via Prisma ORM |
| AI | Anthropic Claude (claude-sonnet-4) |
| Auth | JWT + HttpOnly cookies + DB sessions |
| File handling | Multer (PDF/TXT/MD) + pdf-parse |
| Validation | express-validator |
| Logging | Winston |
| Dev DB | Docker Compose |

---

## Quick Start

### 1. Prerequisites

```bash
node --version   # 20+
docker --version # for PostgreSQL
```

### 2. Install

```bash
cd nexus-study-backend
npm install
```

### 3. Environment

```bash
cp .env.example .env
# Edit .env — set ANTHROPIC_API_KEY and JWT_SECRET at minimum
```

### 4. Start PostgreSQL

```bash
docker compose up -d
# Postgres available at localhost:5432
```

### 5. Database setup

```bash
npm run db:generate   # Generate Prisma client
npm run db:push       # Push schema to DB
npm run db:seed       # Load demo data
```

### 6. Run

```bash
npm run dev    # Development (nodemon)
npm start      # Production
```

API is live at: **http://localhost:4000**

---

## API Reference

### Health
```
GET  /api/health
```

### Auth
```
POST /api/auth/register    { email, password, name }
POST /api/auth/login       { email, password }
POST /api/auth/logout
POST /api/auth/logout-all
GET  /api/auth/me
```

### Notes
```
GET    /api/notes                  ?page, limit, subject, search, archived
GET    /api/notes/:id
GET    /api/notes/:id/status       Poll AI generation state
POST   /api/notes                  { content, title, subject, tags, color, generate }
POST   /api/notes/upload           multipart: file + meta fields
PATCH  /api/notes/:id              { title, subject, tags, color, isArchived }
DELETE /api/notes/:id
POST   /api/notes/:id/regenerate   { generate: { flashcards, quiz, summary } }
```

#### Generate options
```json
{
  "generate": {
    "flashcards": true,
    "quiz": true,
    "summary": true,
    "flashcardCount": 12,
    "quizCount": 8
  }
}
```

#### AI Status polling
Generation is async. Poll `GET /notes/:id/status` every 2s until `aiStatus` is `COMPLETE` or `FAILED`.

### Flashcards
```
GET  /api/flashcards/sets              All sets for user
GET  /api/flashcards/sets/:setId       Set + cards (sorted for review)
GET  /api/flashcards/note/:noteId      Set for a specific note
GET  /api/flashcards/due               Cards due for review today
GET  /api/flashcards/mastery           Overall mastery breakdown
POST /api/flashcards/cards/:cardId/rate  { rating: "HARD"|"OK"|"EASY", timeSpentMs? }
```

SM-2 spaced repetition runs on every `/rate` call. Cards are automatically rescheduled.

### Quiz
```
GET  /api/quiz                         All quizzes
GET  /api/quiz/:quizId
GET  /api/quiz/note/:noteId
GET  /api/quiz/:quizId/history         Past attempts (last 10)
POST /api/quiz/:quizId/attempt         { answers: [{questionId, answer, timeSpentMs?}], timeTakenMs? }
```

### Summary
```
GET  /api/summary/:summaryId
GET  /api/summary/note/:noteId
```

### Chat (AI Tutor)
```
POST /api/chat/message    { message, history?, noteId? }
POST /api/chat/explain    { concept, noteId? }
```

### Progress
```
GET  /api/progress/dashboard    Full dashboard stats
GET  /api/progress/activity     7-day activity breakdown
POST /api/progress/session      { type, durationMs, cardsReviewed?, noteId? }
```

### Users
```
PATCH  /api/users/profile           { name, avatarUrl }
PATCH  /api/users/settings          { prefersDarkMode, dailyGoalCards, notificationsOn }
POST   /api/users/change-password   { currentPassword, newPassword }
DELETE /api/users/account           { password }
```

---

## Response Format

### Success
```json
{
  "success": true,
  "message": "...",
  "data": { ... },
  "timestamp": "2025-..."
}
```

### Error
```json
{
  "success": false,
  "error": "Human-readable message",
  "code": "ERROR_CODE"
}
```

### Paginated
```json
{
  "success": true,
  "data": [...],
  "pagination": { "page": 1, "limit": 20, "total": 45, "pages": 3 }
}
```

---

## Authentication

All endpoints except `/auth/register`, `/auth/login`, and `/health` require authentication.

**Option 1 — Bearer token (recommended for Next.js)**
```
Authorization: Bearer <token>
```

**Option 2 — HttpOnly Cookie**
Automatically set on login. Works for same-origin requests.

---

## Connecting the Frontend

Copy `src/api.client.js` to your Next.js project at `lib/api.js`:

```js
import api from '@/lib/api'

// After login
const { data } = await api.auth.login({ email, password })
api.auth.setToken(data.token)

// Upload notes
const { data: noteData } = await api.notes.upload(file, {
  title: 'My Biology Notes',
  subject: 'Biology',
  generate: { flashcards: true, quiz: true, summary: true }
})

// Poll until AI is done
const stop = api.notes.pollStatus(noteData.note.id, (status) => {
  console.log('Status:', status.aiStatus)
  if (status.aiStatus === 'COMPLETE') {
    // Load flashcards
    api.flashcards.byNote(noteData.note.id).then(...)
  }
})

// Rate a card (runs SM-2 automatically)
await api.flashcards.rate(cardId, 'EASY', 3500)

// AI Tutor chat
const { data: reply } = await api.chat.send(
  "What's the difference between thylakoid and stroma?",
  conversationHistory,
  noteId
)
```

---

## Database Schema Overview

```
users
  └── sessions (auth tokens)
  └── notes
        └── flashcard_sets → flashcards → card_reviews
        └── quizzes → quiz_questions → quiz_attempts → quiz_answers
        └── summaries
  └── study_sessions
  └── quiz_attempts
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Min 32 chars, random string |
| `ANTHROPIC_API_KEY` | ✅ | Your Anthropic key |
| `PORT` | — | Default: 4000 |
| `FRONTEND_URL` | — | CORS origin, default: localhost:3000 |
| `ANTHROPIC_MODEL` | — | Default: claude-sonnet-4-20250514 |
| `MAX_FILE_SIZE_MB` | — | Default: 10 |
| `AI_RATE_LIMIT_MAX` | — | AI calls per hour per user, default: 20 |

---

## Project Structure

```
src/
├── server.js              Entry point, bootstrap
├── app.js                 Express app + middleware
├── api.client.js          Frontend JS client (copy to Next.js)
├── controllers/
│   ├── auth.controller.js
│   ├── notes.controller.js      ← AI generation trigger lives here
│   ├── flashcards.controller.js ← SM-2 spaced repetition
│   ├── quiz.controller.js
│   ├── summary.controller.js
│   ├── chat.controller.js
│   ├── progress.controller.js
│   └── users.controller.js
├── routes/                One file per resource
├── middleware/
│   ├── auth.js            JWT verification + session check
│   ├── upload.js          Multer file handling
│   ├── validate.js        express-validator runner
│   └── errorHandler.js    Centralised error handling
├── services/
│   ├── ai.service.js      All Anthropic API calls
│   └── fileProcessor.service.js  PDF/text extraction
└── utils/
    ├── prisma.js           DB client singleton
    ├── jwt.js              Sign/verify/cookie helpers
    ├── response.js         ApiError class + success helpers
    ├── spacedRepetition.js SM-2 algorithm
    └── logger.js           Winston logger
prisma/
├── schema.prisma           Full DB schema
└── seed.js                 Demo data
```

---

## Demo Credentials (after seeding)

```
Email:    demo@nexusstudy.com
Password: demo1234
```
