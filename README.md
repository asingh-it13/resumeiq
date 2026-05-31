# ResumeIQ Pro 🚀

AI-powered resume intelligence platform. Scores, optimises, and builds ATS-ready resumes — completely free for job seekers.

## Deploy in 5 minutes — 3 options

---

### Option A: Vercel (Recommended — easiest)

1. **Install Vercel CLI** (skip if already installed)
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   cd resumeiq
   npm install
   vercel
   ```
   Follow the prompts — choose defaults for everything.

3. **Add your API key**
   - Go to your project on [vercel.com](https://vercel.com)
   - Settings → Environment Variables
   - Add: `ANTHROPIC_API_KEY` = your key from [console.anthropic.com](https://console.anthropic.com)
   - Redeploy: `vercel --prod`

4. **Done** — you get a free `yourapp.vercel.app` URL ✅

---

### Option B: GitHub + Vercel (Best for ongoing updates)

1. Push this folder to a new GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
3. Add environment variable `ANTHROPIC_API_KEY` in Vercel dashboard
4. Click Deploy → live in 60 seconds

---

### Option C: Run locally

```bash
cd resumeiq
npm install
# Edit .env.local — add your real API key
npm run dev
# Open http://localhost:3000
```

---

## Get your free Anthropic API key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up (free)
3. API Keys → Create Key
4. Copy and paste into Vercel env vars or `.env.local`

New accounts get free credits — enough for hundreds of resume analyses.

---

## Project structure

```
resumeiq/
├── pages/
│   ├── index.js        ← Full app (all UI + logic)
│   ├── _app.js         ← Global styles wrapper
│   └── api/
│       └── ai.js       ← Server-side Anthropic API route (keeps key secret)
├── styles/
│   └── globals.css     ← Minimal global reset
├── .env.local          ← Your API key (never commit this)
├── .env.example        ← Safe to commit — shows what vars are needed
├── next.config.js      ← Next.js config
└── package.json
```

## Features

- 🎯 **Resume Scorer** — ATS score, hire probability, salary estimate
- 🛠️ **Resume Builder** — AI builds a complete resume from your details
- 🔍 **Job Match** — compares your resume against any job description
- 💬 **Interview Coach** — generates targeted questions with STAR tips
- ✨ **ATS Optimizer** — rewrites resume, adds keywords, downloads as .docx
- 📎 **File Upload** — reads .txt, .pdf, .docx
