# GPT Clone

A full-stack ChatGPT-like application built with React, Node.js, and OpenAI API. Features include real-time streaming responses, file upload support, conversation management, and user authentication.

## ✨ Features

- **Real-time Chat**: Streaming responses from OpenAI's GPT models
- **File Upload Support**: Upload and analyze documents (PDF, Word, text files)
- **Conversation Management**: Create, organize, and delete conversations
- **User Authentication**: Secure login/signup with JWT tokens
- **Search Functionality**: Search through conversation history
- **Dark/Light Theme**: Toggle between themes
- **Rate Limiting**: Built-in protection against API abuse
- **Responsive Design**: Works on desktop and mobile devices

## 🏗️ Architecture

```
GPT-clone/
├── backend/                 # Node.js Express API server
│   ├── lib/                # Database connection (Prisma)
│   ├── middleware/         # Auth, rate limiting
│   ├── routes/             # API endpoints
│   ├── prisma/             # Database schema and migrations
│   └── server.js           # Main server file
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
NODE_ENV=development
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

## 📝 API Documentation

### Authentication Endpoints

```
POST /api/auth/signup    # Create new user account
POST /api/auth/login     # Login user

Body: { "email": "user@example.com", "password": "password" }
```

### Conversation Endpoints

```
GET    /api/conversations           # List user conversations
POST   /api/conversations           # Create new conversation
DELETE /api/conversations/:id       # Delete conversation
```

### Message Endpoints

```
GET  /api/messages/:conversationId  # Get messages for conversation
POST /api/messages                  # Send message (non-streaming)
GET  /api/messages/stream           # Streaming endpoint (EventSource)
POST /api/messages/stream           # Streaming endpoint (file uploads)
```

### Streaming Response Format

The streaming endpoints return Server-Sent Events with the following event types:

```javascript
// Start event - conversation and user message created
{ type: 'start', userMessage: {...}, conversation: {...} }

// Content chunks - AI response being generated
{ type: 'chunk', content: "partial response text" }

// Completion - final AI message saved
{ type: 'complete', assistantMessage: {...} }

// Error handling
{ type: 'error', error: "error message" }
```

## 🛠️ Development Guide

### Project Structure

**Backend Structure:**
```
backend/
├── lib/prisma.js           # Database client
├── middleware/
│   ├── auth.js             # JWT authentication
│   └── rateLimit.js        # Request rate limiting
├── routes/
│   ├── auth.js             # User auth endpoints
│   ├── conversations.js    # Conversation CRUD
│   └── messages.js         # Message handling & streaming
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── migrations/         # Database migrations
└── server.js               # Express app setup
```

**Frontend Structure:**
```
frontend/src/
├── components/
│   ├── Auth.js             # Login/Signup forms
│   ├── Chat.js             # Main chat interface
│   ├── Sidebar.js          # Conversation list
│   ├── MessageList.js      # Message display
│   ├── MessageInput.js     # Message input form
│   └── FileUpload.js       # File upload component
├── hooks/
│   ├── useConversations.js # Conversation state management
│   └── useMessages.js      # Message handling & streaming
├── contexts/
│   └── ThemeContext.js     # Dark/light theme
└── App.js                  # Main app component
```

### Key Technologies

- **Backend**: Express.js, Prisma ORM, PostgreSQL, OpenAI SDK
- **Frontend**: React, React Router, Axios, Server-Sent Events
- **Authentication**: JWT tokens
- **Database**: PostgreSQL with Prisma ORM
- **AI Integration**: OpenAI GPT-3.5-turbo and GPT-4o models

### Development Commands

**Backend:**
```bash
npm run dev        # Start with nodemon (auto-reload)
npm start          # Production start
npx prisma studio  # Database admin UI
npx prisma migrate dev  # Create new migration
```

**Frontend:**
```bash
npm start          # Development server
npm run build      # Production build
npm test           # Run tests
```

### Code Style & Conventions

- **ES6+ JavaScript** with async/await patterns
- **Functional React components** with hooks
- **RESTful API design** with consistent error handling
- **Prisma ORM** for type-safe database operations
- **JWT authentication** with middleware protection

### Adding New Features

1. **Database Changes**: Update `prisma/schema.prisma` and run `npx prisma migrate dev`
2. **API Endpoints**: Add routes in `routes/` directory with proper auth middleware
3. **Frontend Components**: Create reusable components in `components/`
4. **State Management**: Use custom hooks for complex state logic

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

## 🔧 Configuration Options

### Rate Limiting

Configure in `backend/server.js`:
```javascript
const authRateLimit = createRateLimit(15 * 60 * 1000, 10);    // 10 requests per 15 minutes for auth
const messageRateLimit = createRateLimit(60 * 1000, 20);     // 20 requests per minute for messages
```

### OpenAI Models

Models used by the application:
- **Text-only messages**: `gpt-3.5-turbo` (faster, cost-effective)
- **File uploads**: `gpt-4o` (better file understanding)

Configure in `backend/routes/messages.js`.

## 🔒 Security Features

- **JWT Authentication** with secure token validation
- **Rate Limiting** to prevent API abuse
- **CORS Configuration** for cross-origin requests
- **Helmet.js** for security headers
- **Input Validation** and sanitization
- **Database-level** user isolation (all queries filtered by userId)