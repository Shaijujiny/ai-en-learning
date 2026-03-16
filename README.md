# AI Interview Platform

AI-powered conversation practice platform with scenario-based chat, voice input/output, evaluation, analytics, coaching, admin tools, and custom prompt-driven sessions.

## Stack

- Frontend: Next.js 15, React 19, Tailwind CSS 4
- Backend: FastAPI, SQLAlchemy 2, Alembic
- Database: PostgreSQL
- Cache: Redis optional
- AI: OpenAI Responses API, Whisper speech-to-text, OpenAI text-to-speech
- Language analysis: LanguageTool

## Monorepo Structure

- `frontend/`: user portal, auth UI, dashboard, chat UI, admin UI
- `backend/`: API, database models, migrations, analysis/coaching logic

### Backend App Layout

```text
backend/app
  main.py
  core/
    config.py
    database.py
    security.py
    jwt_handler.py
    exceptions.py
  features/
    auth/
      routes.py
      service.py
      schema.py
      model.py
      repository.py
    scenarios/
      routes.py
      service.py
      schema.py
      model.py
      repository.py
    conversations/
      routes.py
      service.py
      schema.py
      model.py
      repository.py
    messages/
      routes.py
      service.py
      schema.py
      model.py
      repository.py
    ai_chat/
      ai_service.py
      prompt_builder.py
  utils/
    helpers.py
```

## Standard API Response Format

Most JSON endpoints now return:

```json
{
  "status": 1,
  "message": "Success",
  "data": {}
}
```

## Phase Report

### Phase 1: Platform Foundation (MVP)

Status: completed

Delivered:

- project setup with `frontend/` and `backend/`
- Next.js frontend with Tailwind CSS
- FastAPI backend with PostgreSQL, SQLAlchemy, and Alembic
- database schema for:
  - `users`
  - `scenarios`
  - `conversations`
  - `messages`
- authentication system:
  - register
  - login
  - JWT
  - protected endpoints
- default scenario system:
  - Job Interview
  - Customer Support
  - Casual Conversation
- conversation session start
- chat message save -> AI call -> AI reply save flow
- AI prompt engine
- conversation history endpoint
- frontend scenario selection and chat UI

Steps covered:

- Step 1: Project Setup
- Step 2: Backend Core Setup
- Step 3: Database Configuration
- Step 4: Authentication System
- Step 5: Scenario System
- Step 6: Conversation Session System
- Step 7: Chat Message System
- Step 8: AI Conversation Engine
- Step 9: Conversation History
- Step 10: Frontend Chat UI

### Phase 2: Stability and Performance

Status: completed

Delivered:

- Docker deployment for frontend and backend
- request logging
- error logging
- AI latency logging
- Redis-based optional caching for:
  - AI responses
  - session data

Steps covered:

- Step 11: Docker Deployment
- Step 12: Logging System
- Step 14: Redis Cache

### Phase 3: AI Quality Improvement

Status: completed

Delivered:

- stronger prompt engineering using:
  - conversation context
  - scenario instructions
  - previous answers
- conversation memory with capped history window
- scenario difficulty support:
  - Beginner
  - Intermediate
  - Advanced

Steps covered:

- Step 15: Prompt Engineering
- Step 16: Conversation Memory
- Step 17: Scenario Personalization

### Phase 4: Speech Features

Status: completed

Delivered:

- OpenAI Whisper speech recognition
- microphone recording in UI
- backend speech transcription endpoint
- AI text-to-speech voice response
- frontend voice playback integration

Steps covered:

- Step 18: Speech Recognition
- Step 19: Voice Input UI
- Step 20: AI Voice Response

### Phase 5: AI Evaluation

Status: completed

Delivered:

- grammar analysis via LanguageTool
- fluency scoring
- sentence complexity analysis
- grammar accuracy analysis
- vocabulary diversity analysis
- advanced vocabulary detection

Steps covered:

- Step 21: Grammar Analysis
- Step 22: Fluency Scoring
- Step 23: Vocabulary Evaluation

### Phase 6: Analytics Dashboard

Status: completed

Delivered:

- analytics tables:
  - `user_scores`
  - `skill_metrics`
- dashboard UI
- performance score view
- improvement trends
- conversation history view

Steps covered:

- Step 24: Analytics Database
- Step 25: Dashboard UI

### Phase 7: AI Coaching

Status: completed

Delivered:

- AI coach feedback
- grammar improvement suggestions
- better interview answer suggestions
- learning path recommendations
- practice scenario recommendations
- skill improvement recommendations

Steps covered:

- Step 26: AI Coach
- Step 27: Learning Path System

### Phase 8: Enterprise Features

Status: completed

Delivered:

- admin panel
- scenario management
- analytics overview
- usage monitoring
- multi-language conversation support:
  - Spanish
  - French
  - German
- AI career advisor
- resume feedback
- career advice
- mock interview preparation

Steps covered:

- Step 28: Admin Panel
- Step 29: Multi-Language Support
- Step 30: AI Career Advisor

### Current Build Summary

Current system includes:

- separated user and admin login flows
- user portal for scenario-based and custom-prompt conversations
- standardized backend API response envelope
- scenario-driven AI conversations with memory and voice
- evaluation, analytics, coaching, and admin tooling

Error format:

```json
{
  "status": -1,
  "message": "Invalid credentials",
  "data": null
}
```

Examples:

```json
{
  "status": 1,
  "message": "User registered successfully",
  "data": {
    "user_id": 1,
    "email": "john@email.com"
  }
}
```

```json
{
  "status": 1,
  "message": "Login successful",
  "data": {
    "access_token": "jwt_token_here",
    "token_type": "bearer"
  }
}
```

```json
{
  "status": 1,
  "message": "Scenario list",
  "data": [
    {
      "id": 1,
      "title": "Job Interview"
    }
  ]
}
```

## Implemented Features

### User Experience

- Separate `login` and `register` pages
- Dedicated user portal at `/portal`
- Scenario selection
- Custom conversation builder with custom title and prompt
- Chat page with:
  - message history
  - microphone recording
  - speech transcription
  - AI voice playback
- Dashboard page with:
  - performance score
  - improvement trends
  - conversation history

### Authentication

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- bcrypt password hashing
- JWT token generation
- protected routes

### Conversation System

- scenarios table
- conversations table
- messages table
- start conversation from a base scenario
- optional conversation customization with:
  - `custom_title`
  - `custom_prompt`
- last-N message memory for AI context

### AI Conversation

- scenario-aware prompt building
- recent context injection
- previous answer reuse
- language-aware replies
- mock fallback when OpenAI key is not configured

### Voice

- `POST /speech/transcribe`
- `POST /speech/synthesize`
- Whisper transcription
- OpenAI TTS playback

### Analysis

- `POST /analysis/grammar`
- `POST /analysis/fluency`
- `POST /analysis/vocabulary`

Includes:

- grammar mistakes
- fluency scoring
- sentence complexity
- grammar accuracy
- vocabulary diversity
- advanced vocabulary detection

### Analytics

- analytics tables:
  - `user_scores`
  - `skill_metrics`
- `GET /analytics/dashboard`
- trend aggregation
- conversation history summary

### Coaching

- `POST /coaching/feedback`
- `GET /coaching/learning-path`
- `POST /coaching/career-advisor`

Includes:

- grammar improvement suggestions
- better interview answer guidance
- scenario recommendations
- skill improvement recommendations
- resume feedback
- career advice
- mock interview preparation

### Admin

- separate admin login route at `/admin/login`
- admin panel at `/admin`
- scenario management
- usage monitoring
- analytics overview

### Platform

- request logging
- error logging
- AI latency logging
- Docker setup for frontend/backend
- optional Redis cache for AI responses and sessions
- multilingual conversation support:
  - English
  - Spanish
  - French
  - German

## Current Frontend Routes

- `/`: public landing page
- `/login`: user login
- `/register`: user registration
- `/portal`: user scenario/custom conversation portal
- `/chat/[id]`: conversation chat
- `/dashboard`: user analytics dashboard
- `/admin/login`: admin login
- `/admin`: admin panel

## Backend API Routes

### Health

- `GET /health`

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

### Scenarios

- `GET /scenarios`

### Conversations

- `POST /conversations/start`
- `GET /conversations/{conversation_id}`

### Messages

- `POST /messages/send`

### Speech

- `POST /speech/transcribe`
- `POST /speech/synthesize`

### Analysis

- `POST /analysis/grammar`
- `POST /analysis/fluency`
- `POST /analysis/vocabulary`

### Analytics

- `GET /analytics/dashboard`

### Coaching

- `POST /coaching/feedback`
- `GET /coaching/learning-path`
- `POST /coaching/career-advisor`

### Admin

- `GET /admin/scenarios`
- `POST /admin/scenarios`
- `PUT /admin/scenarios/{scenario_id}`
- `GET /admin/usage`
- `GET /admin/analytics`

## Database Tables

- `users`
- `scenarios`
- `conversations`
- `messages`
- `user_scores`
- `skill_metrics`

## Local Development

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
cp .env.example .env
```

Set your PostgreSQL URL in `backend/.env`.

Example:

```env
DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/ai_interview_platform
```

Run migrations:

```bash
.venv/bin/alembic upgrade head
```

Start the API:

```bash
.venv/bin/uvicorn app.main:app --reload --port 8989
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Set:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8989
```

### 3. Open in Browser

- Frontend: `http://localhost:3000`
- Backend docs: `http://localhost:8989/docs`

## Environment Variables

### Backend

Important variables in `backend/.env`:

- `DATABASE_URL`
- `APP_NAME`
- `APP_ENV`
- `FRONTEND_ORIGINS`
- `ADMIN_EMAILS`
- `JWT_SECRET_KEY`
- `JWT_ALGORITHM`
- `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_WHISPER_MODEL`
- `OPENAI_TTS_MODEL`
- `OPENAI_TTS_VOICE`
- `OPENAI_TTS_FORMAT`
- `LANGUAGETOOL_API_URL`
- `LANGUAGETOOL_LANGUAGE`
- `REDIS_URL`
- `REDIS_SESSION_TTL_SECONDS`
- `REDIS_AI_CACHE_TTL_SECONDS`
- `AI_CONVERSATION_MEMORY_LIMIT`

### Frontend

- `NEXT_PUBLIC_API_BASE_URL`

## Migrations

Current Alembic revisions:

- `0001_create_core_tables`
- `0002_seed_default_scenarios`
- `0003_scenario_difficulty`
- `0004_analytics_tables`
- `0005_conv_language`
- `0006_conversation_customization`

If you pull new code and get missing-column errors, run:

```bash
cd backend
.venv/bin/alembic upgrade head
```

## Docker

Start both services:

```bash
docker compose up --build
```

Services:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

Notes:

- PostgreSQL is expected outside compose unless you add a DB service
- `backend/.env` must point to a reachable database

## Quality Checks

Frontend:

```bash
cd frontend
npm run lint
```

Backend:

```bash
cd backend
python3 -m compileall app
```

## Current Notes

- Admin access depends on `ADMIN_EMAILS`
- Redis is optional
- OpenAI features fall back where local development needs a non-blocking path
- If the frontend cannot reach the backend, verify:
  - backend port
  - `NEXT_PUBLIC_API_BASE_URL`
  - `FRONTEND_ORIGINS`
  - browser CORS errors
