# GPT Clone

A full-stack ChatGPT-like application built with React, Node.js, and OpenAI API. Features real-time streaming responses, file upload support, conversation management, and user authentication.

## ✨ Features

- **Real-time Chat**: Streaming responses from OpenAI GPT models
- **File Upload Support**: Upload and analyze documents (PDF, Word, text files)  
- **Conversation Management**: Create, organize, delete, and export conversations
- **Export Formats**: JSON, Plain Text, and Markdown export options
- **User Authentication**: Secure JWT-based login/signup system
- **Search & Organization**: Search through conversation history
- **Theme Support**: Dark/Light mode toggle
- **Security**: Rate limiting and input validation
- **Responsive Design**: Works on desktop and mobile devices

## 🏗️ Tech Stack

- **Backend**: Node.js, Express.js, Prisma ORM, PostgreSQL
- **Frontend**: React, React Router, Axios, Server-Sent Events
- **AI Integration**: OpenAI GPT-3.5-turbo, GPT-4o
- **Authentication**: JWT tokens
- **Real-time**: Server-Sent Events (SSE) for streaming

## 📁 Project Structure

```
GPT-clone/
├── backend/                 # Node.js Express API server
│   ├── lib/                # Database connection (Prisma)
│   ├── middleware/         # Authentication & rate limiting
│   ├── routes/             # API endpoints (auth, conversations, messages)
│   ├── utils/              # Reusable utility functions
│   │   ├── authUtils.js    # JWT & password utilities
│   │   ├── conversationUtils.js  # Conversation operations
│   │   ├── messageUtils.js # Message handling & validation  
│   │   ├── openaiUtils.js  # OpenAI API integration
│   │   ├── streamingUtils.js  # Server-Sent Events utilities
│   │   └── exportFormatters.js  # Export format handlers
│   ├── prisma/             # Database schema and migrations
│   └── server.js           # Express app setup
└── frontend/               # React application
    ├── src/
    │   ├── components/     # React components
    │   ├── contexts/       # React contexts (Theme)
    │   └── hooks/          # Custom React hooks
    └── public/             # Static assets
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v16 or higher)
- **PostgreSQL** database
- **OpenAI API key** ([Get one here](https://platform.openai.com/api-keys))

### 1. Clone and Install

```bash
git clone <repository-url>
cd GPT-clone

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Database Setup

```bash
cd backend

# Set up PostgreSQL database
createdb gpt_clone  # or use your preferred method

# Run database migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### 3. Environment Configuration

Create a `.env` file in the `backend` directory:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/gpt_clone"

# JWT Secret (use a strong random string)
JWT_SECRET="your-super-secret-jwt-key-here"

# OpenAI API
OPENAI_API_KEY="sk-your-openai-api-key-here"

# Server Configuration
PORT=3002
```

**Frontend Environment** (optional):
Create a `.env` file in the `frontend` directory if using a different backend URL:

```env
REACT_APP_API_URL=http://localhost:3002
```

### 4. Start the Application

**Backend** (Terminal 1):
```bash
cd backend
npm run dev  # Uses nodemon for auto-reload
```

**Frontend** (Terminal 2):
```bash
cd frontend
npm start
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3002

## 📝 API Reference

### Authentication
- `POST /api/auth/signup` - Create account (`{email, password}`)
- `POST /api/auth/login` - Login user (`{email, password}`)

### Conversations
- `GET /api/conversations` - List user conversations  
- `POST /api/conversations` - Create new conversation
- `DELETE /api/conversations/:id` - Delete conversation
- `GET /api/conversations/:id/export?format=json|txt|md` - Export conversation

### Messages
- `GET /api/messages/:conversationId` - Get conversation messages
- `POST /api/messages` - Send message (non-streaming)
- `GET /api/messages/stream` - Streaming chat (EventSource)
- `POST /api/messages/stream` - Streaming with file uploads

### Streaming Events (Server-Sent Events)
- `start` - Conversation and user message created
- `chunk` - AI response content chunks  
- `complete` - Final assistant message saved
- `error` - Error occurred during processing

### Code Conventions
- ES6+ JavaScript with async/await
- Functional React components with hooks
- RESTful API design with consistent error handling
- Prisma ORM for type-safe database operations

### Adding Features
1. **Database**: Update `schema.prisma` → `npx prisma migrate dev`
2. **API**: Add routes with auth middleware in `routes/`
3. **Frontend**: Create components in `components/`
4. **Utils**: Add reusable functions to appropriate `utils/` files

## 📊 Database Schema

```sql
Users Table:
- id (CUID primary key)
- email (unique)
- password (hashed)
- createdAt, updatedAt

Conversations Table:
- id (CUID primary key)  
- title (optional)
- userId (foreign key)
- createdAt, updatedAt

Messages Table:
- id (CUID primary key)
- content (text)
- role ('user' | 'assistant')
- conversationId (foreign key)
- userId (foreign key)
- createdAt
```

## ⚙️ Configuration & Security

### OpenAI Models
- **Text chat**: `gpt-3.5-turbo` (fast, cost-effective)
- **File uploads**: `gpt-4o` (better file understanding)

### Rate Limiting
```javascript
// Configure in backend/server.js
const authRateLimit = createRateLimit(15 * 60 * 1000, 10);    // Auth: 10/15min  
const messageRateLimit = createRateLimit(60 * 1000, 20);     // Messages: 20/min
```

### Security Features
- JWT authentication with secure token validation
- Rate limiting to prevent API abuse  
- CORS configuration and Helmet.js security headers
- Input validation and sanitization
- Database-level user isolation (userId filtering)