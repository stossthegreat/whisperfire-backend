# Whisperfire Backend

A simple Express.js backend API for the Whisperfire app.

## Features

- **Analyze Routes**: Handle scan and pattern analysis requests
- **Progress Tracking**: Manage user XP, levels, and progress events
- **Mentor Chat**: SSE streaming for mentor conversations
- **Firebase Integration**: User data and progress storage

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up Firebase credentials (environment variables)

3. Start the server:
```bash
npm start
```

## API Endpoints

- `POST /analyze/scan` - Analyze single message
- `POST /analyze/pattern` - Analyze message patterns
- `POST /progress/event` - Track user progress
- `POST /mentors/chat` - Mentor chat with SSE

## Development

```bash
npm run dev
```

## Environment Variables

- `PORT` - Server port (default: 3000)
- Firebase configuration variables 