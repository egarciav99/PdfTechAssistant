# PDF Technical Assistant

> Turn technical PDFs into actionable knowledge through AI-powered conversation.

<div align="center">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.2-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Firebase-Cloud-FFCA28?logo=firebase&logoColor=black" alt="Firebase" />
  <img src="https://img.shields.io/badge/n8n-Automation-FF6D5A?logo=n8n&logoColor=white" alt="n8n" />
  <img src="https://img.shields.io/badge/Vite-Build-646CFF?logo=vite&logoColor=white" alt="Vite" />
</div>

## 🎯 Problem & Solution

**Problem:** Technical teams waste hours searching through lengthy PDF documents (manuals, research papers, specifications) to find critical information.

**Solution:** A three-step workflow:
1. **Upload** - Drag & drop any technical PDF
2. **Summarize** - AI generates structured technical summary
3. **Chat** - Ask questions and get contextual answers from the document

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   React Client  │────▶│  Firebase Suite  │◀────│   n8n Workflow  │
│  (TypeScript)   │     │  • Auth          │     │   (AI Brain)    │
│                 │     │  • Firestore     │     │                 │
│                 │     │  • Storage       │     │  • Document     │
└─────────────────┘     └──────────────────┘     │    Ingestion    │
         │                      │                │  • RAG Chat     │
         │                      ▼                │    Engine       │
         │               ┌──────────────┐        └─────────────────┘
         └──────────────▶│  Resumenes   │                 │
                         │ Collection   │◀────────────────┘
                         └──────────────┘
```

**Flow:**
1. User uploads PDF → Firebase Storage
2. Metadata saved → Firestore (`users/{uid}`)
3. n8n webhook triggered → Document processing pipeline
4. Summary stored → Firestore (`resumenes/{storageId}`)
5. Chat queries → n8n RAG workflow with vector search

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Firebase project with Auth, Firestore, and Storage enabled
- n8n instance with ingestion and chat workflows

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/pdf-technical-assistant.git
cd pdf-technical-assistant

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
# Edit .env.local with your Firebase and n8n credentials

# 4. Start development server
npm run dev
```

### Environment Variables

Create `.env.local`:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# n8n Webhooks
VITE_N8N_INGESTION_URL=https://your-n8n-instance.com/webhook/ingestion
VITE_N8N_CHAT_URL=https://your-n8n-instance.com/webhook/chat
```

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + TypeScript | UI Components, State Management |
| **Styling** | Tailwind CSS | Utility-first responsive design |
| **Backend** | Firebase (Auth, Firestore, Storage) | Auth, Data persistence, File storage |
| **Automation** | n8n | Document processing, AI orchestration |
| **AI** | Google Gemini (via n8n) | Summarization, RAG chat |
| **Build** | Vite | Fast development, optimized builds |

## 📁 Project Structure

```
src/
├── components/          # React UI components
│   ├── ChatSection.tsx
│   ├── DocumentList.tsx
│   ├── Login.tsx
│   ├── Register.tsx
│   ├── SummarySection.tsx
│   ├── UploadSection.tsx
│   └── IconComponents.tsx
├── hooks/              # Custom React hooks
│   ├── useAuth.ts
│   └── useDocuments.ts
├── services/           # External service integrations
│   └── firebase.ts
├── types.ts            # TypeScript type definitions
├── constants.ts        # Environment-based configuration
└── App.tsx             # Main application component
```

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run tests with coverage
npm run test:coverage

# Run E2E tests (Playwright)
npm run test:e2e
```

## 🚀 Deployment

### Firebase Hosting (Recommended)

```bash
# Build for production
npm run build

# Deploy to Firebase
firebase deploy
```

### Vercel/Netlify

Connect your GitHub repository for automatic deployments on push.

## 📝 License

MIT License - see [LICENSE](./LICENSE) for details.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

Built with ❤️ for technical teams who value their time.
