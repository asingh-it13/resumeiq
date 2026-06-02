// ResumeIQ Pro v6 — World-Class, All Bugs Fixed, Full Unit Tests
import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const MODEL       = "claude-haiku-4-5-20251001";
const API_URL     = "https://api.anthropic.com/v1/messages";
const NAVY        = "#1B3A6B";
const TEAL        = "#0D7C77";
const NAVY_L      = "E8EDF5";
const AMBER       = "92400E";
const GRAY        = "374151";
const MGRAY       = "6B7280";
const LGRAY       = "9CA3AF";
const BLACK       = "111827";
const FONT        = "Times New Roman";

const SECTION_KW = [
  "PROFESSIONAL SUMMARY","SUMMARY","EXECUTIVE SUMMARY","PROFILE","CAREER OBJECTIVE",
  "KEY SKILLS","KEY SKILLS & COMPETENCIES","SKILLS","CORE COMPETENCIES",
  "TECHNICAL SKILLS","AREAS OF EXPERTISE","SYSTEMS & TECHNOLOGY",
  "PROFESSIONAL EXPERIENCE","EXPERIENCE","WORK EXPERIENCE","EMPLOYMENT HISTORY","EMPLOYMENT",
  "EDUCATION","EDUCATION & QUALIFICATIONS","QUALIFICATIONS","ACADEMIC BACKGROUND",
  "LICENCES","LICENSES","LICENCES & CERTIFICATIONS","CERTIFICATIONS",
  "CERTIFICATIONS & ADDITIONAL INFORMATION","ACCREDITATIONS",
  "ACHIEVEMENTS","KEY ACHIEVEMENTS","AWARDS","REFERENCES","REFEREES"
];

const TABS = [
  { label:"Score Resume",   icon:"🎯" },
  { label:"Build Resume",   icon:"🛠️" },
  { label:"Job Match",      icon:"🔍" },
  { label:"Interview Prep", icon:"💬" },
  { label:"Market Intel",   icon:"📈" },
];

const MARKET = [
  { name:"ResumeIQ Pro", price:"FREE",       ats:true,  match:true,  ai:true,  salary:true,  iv:true,  rt:true,  star:true },
  { name:"Jobscan",      price:"$49.95/mo",  ats:true,  match:true,  ai:false, salary:false, iv:false, rt:false },
  { name:"Teal HQ",      price:"$29/mo",     ats:true,  match:true,  ai:false, salary:false, iv:false, rt:false },
  { name:"Kickresume",   price:"$19/mo",     ats:true,  match:false, ai:true,  salary:false, iv:false, rt:false },
  { name:"Zety",         price:"$23.99/mo",  ats:false, match:false, ai:false, salary:false, iv:false, rt:false },
  { name:"Resume.io",    price:"$24.95/mo",  ats:false, match:false, ai:false, salary:false, iv:false, rt:false },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPTS — Minimal tokens = cheap cost
// ═══════════════════════════════════════════════════════════════════════════════
const SCORE_SYSTEM = `You are an ATS resume analyst. Your response must be ONLY a valid JSON object — no prose, no markdown, no backticks, no explanation before or after.

Return this exact JSON structure with real values (not placeholders):
{
  "overallScore": 85,
  "hireChance": 78,
  "breakdown": {
    "atsCompatibility":  {"score": 21, "max": 25, "feedback": "specific feedback"},
    "keywordDensity":    {"score": 16, "max": 20, "feedback": "specific feedback"},
    "impactMetrics":     {"score": 15, "max": 20, "feedback": "specific feedback"},
    "formatStructure":   {"score": 13, "max": 15, "feedback": "specific feedback"},
    "relevanceMatch":    {"score": 18, "max": 20, "feedback": "specific feedback"}
  },
  "topStrengths":       ["strength 1", "strength 2", "strength 3"],
  "criticalFixes":      ["fix 1", "fix 2", "fix 3"],
  "missingKeywords":    ["keyword1", "keyword2", "keyword3"],
  "salaryRange":        {"min": 75000, "max": 95000, "currency": "AUD"},
  "competitorComparison": {"vsAvgCandidate": 68, "vsTopCandidate": 38},
  "interviewQuestions": ["question 1?", "question 2?", "question 3?"],
  "rewrittenSummary":   "2-3 sentence professional summary.",
  "verdict":            "One sentence overall assessment."
}

Rules: all score values must be plain integers. Base analysis on actual resume content. Be honest and specific.`;

const OPTIMIZE_SYSTEM = `You are a professional resume writer and ATS expert. Return ONLY a valid JSON object — no markdown, no backticks, nothing else.

JSON shape:
{"optimizedResume":"full resume text","newAtsScore":95,"keywordsAdded":["kw1","kw2"],"sectionsChanged":["section: change"],"improvements":[{"section":"x","before":"old","after":"new"}],"verdict":"one sentence."}

━━━ STRICT WORD COUNT RULES ━━━

PROFESSIONAL SUMMARY — must be 100 to 150 words (count them):
• Sentence 1 (20–25w): Job title + years + core expertise
• Sentence 2 (30–40w): Technical skills, systems, key responsibilities  
• Sentence 3 (20–30w): Soft skills, work rights, availability
• Sentence 4 optional (10–20w): One standout point
After writing, count: if over 150 cut words. If under 100 add detail.

EACH EXPERIENCE ENTRY — must be 70 to 100 words total:
• Most recent job: exactly 6 bullets × 12–17 words each
• Previous jobs: exactly 5 bullets × 12–17 words each  
• Short/old jobs (under 1 year): 3 bullets × 12–17 words each
• After writing each job, count ALL bullet words. Adjust until 70–100.

EACH BULLET — exactly 12–17 words. ONE idea only. Action verb first (past tense for finished roles):
GOOD: "Resolved 80+ daily inbound calls and emails, maintaining 95% customer satisfaction"  (13w ✓)
GOOD: "Processed 40+ weekly claims with 99% accuracy within 24-hour timeframes"  (11w ✓)
GOOD: "Supervised team of 6 representatives across query resolution and escalation channels"  (11w ✓)
BAD:  "Serve as the first point of contact for a high volume of customer calls and emails maintaining a positive experience"  (20w ✗ — too long, two ideas)
BAD:  "Responsible for managing customer queries"  (6w ✗ — too short, weak verb)

SELF-CHECK before outputting:
1. Count summary words → must be 100–150
2. Count bullets in each job → 6 / 5 / 3 as above
3. Count words in each bullet → must be 12–17
4. Count total words per job → must be 70–100
If any check fails, rewrite until it passes. Only then output the JSON.

SKILLS: Keep all original skills. Add ATS keywords as new items. Max 6 words per skill item.

CONTENT RULES:
1. Return 100% of resume — ALL sections, ALL jobs, ALL dates — nothing omitted
2. Keep all job titles, company names, dates exactly as written
3. Never invent experience or qualifications
4. newAtsScore: integer 88–98
5. improvements: show 3–5 real before/after rewrites`;

const BUILD_SYSTEM = `You are a professional resume writer. Return ONLY valid JSON — no markdown, no backticks.
Shape: {"resume":"full text","atsScore":88,"keywordsIncluded":["kw1","kw2"]}

Word count rules:
- Professional Summary: 100–150 words. 3–4 sentences. Title + years + skills + availability.
- Each job: 70–100 words total. 5–6 bullets. Each bullet 12–18 words. Action verb first.
- Short/old jobs: 2–3 bullets only.
- Skills: noun phrases, max 6 words each.
- Quantify every achievement with numbers, %, or volume where possible.`;

const INTERVIEW_SYSTEM = `Interview coach. Reply ONLY with raw JSON, no markdown, no backticks.
Shape: {"questions":[{"q":"?","type":"Behavioural|Technical|Situational","tip":"STAR tip"}],"keyCompetencies":["..."],"redFlags":["..."]}
6-8 questions, all types, based specifically on the job description provided.`;

// ═══════════════════════════════════════════════════════════════════════════════
// UTILS — Pure functions, fully unit-testable
// ═══════════════════════════════════════════════════════════════════════════════

/** Extract JSON from AI response — handles fences, preamble, trailing text */
export function extractJSON(raw) {
  if (!raw || typeof raw !== "string" || !raw.trim())
    throw new Error("No response received. Please check your connection and try again.");
  // Strip markdown fences
  let s = raw.replace(/```[a-zA-Z]*\n?/gi, "").replace(/```/g, "").trim();
  // Direct parse
  try { return JSON.parse(s); } catch (_) {}
  // Extract first {...} block
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a !== -1 && b > a) {
    try { return JSON.parse(s.slice(a, b + 1)); } catch (_) {}
  }
  // Detect common failure modes
  if (s.includes('"optimizedResume"') && !s.includes('"verdict"'))
    throw new Error("Response was cut off. Please try again — your resume may be very long.");
  if (s.toLowerCase().includes("error") || s.toLowerCase().includes("invalid"))
    throw new Error("Service error: " + s.slice(0, 120));
  throw new Error("Unexpected response format. Please try again.");
}

/** XML escape for DOCX generation */
export function xmlEsc(s) {
  return String(s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}

/** Clamp number between min and max */
export function clamp(v, min, max) {
  return Math.min(Math.max(Number(v) || 0, min), max);
}

/** Format salary number with locale commas */
export function fmtSalary(v) {
  return Number(v || 0).toLocaleString("en-AU");
}

/** Parse resume text into structured sections */
/** Strip markdown bold/italic — used both in parser and DOCX builder */
export function stripMd(s) {
  return String(s)
    .replace(/\*\*([^*]*)\*\*/g, "$1")  // **text** → text  (greedy content)
    .replace(/\*([^*]+)\*/g,    "$1")   // *text*   → text
    .replace(/\*\*/g,           "")     // stray **  → nothing
    .replace(/\*/g,             "")     // stray *   → nothing
    .replace(/\t/g,            "  ")   // tabs → 2 spaces
    .replace(/  +/g,            " ")    // collapse multiple spaces
    .trim();
}

export function parseResumeText(text) {
  if (!text || typeof text !== "string") return { name:"", tagline:"", contactLines:[], sections:[] };
  const lines = text.split("\n")
    .map(l => stripMd(l))           // ← strip ALL markdown BEFORE any logic
    .filter(l => l.length > 0);
  const isSection = l => SECTION_KW.some(k => l.toUpperCase().trim() === k);
  let headerLines = [], sections = [], curr = null;
  for (const line of lines) {
    if (isSection(line)) {
      if (curr) sections.push(curr);
      curr = { header: line, items: [] };
    } else if (!curr) {
      headerLines.push(line);
    } else {
      curr.items.push(line);
    }
  }
  if (curr) sections.push(curr);
  return {
    name:         headerLines[0] || "Resume",
    tagline:      headerLines[1] || "",
    contactLines: headerLines.slice(2),
    sections,
  };
}

/** Safe clipboard copy with fallback */
export function safeCopy(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(() => _fbCopy(text));
  } else { _fbCopy(text); }
}
function _fbCopy(text) {
  const el = Object.assign(document.createElement("textarea"),
    { value: text, style: "position:fixed;opacity:0" });
  document.body.appendChild(el);
  el.select();
  try { document.execCommand("copy"); } finally { document.body.removeChild(el); }
}

/** Read uploaded resume file — .txt, .pdf, .docx */
export async function readResumeFile(file) {
  if (!file) throw new Error("No file provided.");
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt")) return await file.text();

  if (name.endsWith(".pdf")) {
    await _loadScript("pdfjs", "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
    const lib = window["pdfjs-dist/build/pdf"];
    if (!lib) throw new Error("PDF.js failed to initialise.");
    lib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const buf = await file.arrayBuffer();
    const pdf = await lib.getDocument({ data: new Uint8Array(buf) }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page    = await pdf.getPage(i);
      const content = await page.getTextContent();
      let lastY = null;
      for (const item of content.items) {
        const y = item.transform?.[5];
        if (lastY !== null && Math.abs(y - lastY) > 5) text += "\n";
        text += item.str;
        if (item.hasEOL) text += "\n";
        lastY = y;
      }
      text += "\n";
    }
    const clean = text.replace(/\n{3,}/g, "\n\n").trim();
    return clean || "Could not extract text from this PDF. Please paste manually.";
  }

  if (name.endsWith(".docx") || name.endsWith(".doc")) {
    await _loadScript("jszip", "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
    const JSZip = window.JSZip;
    if (!JSZip) throw new Error("JSZip failed to load. Check your connection and try again.");
    const buf = await file.arrayBuffer();
    let zip;
    try { zip = await JSZip.loadAsync(buf); }
    catch (_) { throw new Error("Could not open this file. Make sure it is a .docx (Word 2007+) and try again."); }
    const docEntry = zip.file("word/document.xml");
    if (!docEntry) throw new Error("This does not appear to be a valid .docx file.");
    const xml = await docEntry.async("string");

    // ── Strategy 1: Regex extraction — works on ALL browsers including iOS Safari
    // Avoids DOMParser namespace issues entirely.
    // Extract text between <w:t> and <w:t ...> tags (with or without attributes)
    const textFromRegex = () => {
      const lines = [];
      // Split on <w:p[ >] to get paragraphs, then extract <w:t> content from each
      const paraChunks = xml.split(/<w:p[\s>\/]/);
      for (const chunk of paraChunks) {
        // Extract all <w:t ...>text</w:t> and <w:t>text</w:t> from this paragraph
        const parts = [];
        const tRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
        let m;
        while ((m = tRegex.exec(chunk)) !== null) {
          if (m[1]) parts.push(m[1]);
        }
        const line = parts.join("")
        .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">")
        .replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&#x[\dA-Fa-f]+;/g,"")
        .trim();
      if (line) lines.push(line);
      }
      return lines;
    };

    // ── Strategy 2: DOMParser with html mode — works on Safari iOS
    // Parses as HTML not XML, so namespace prefixes are ignored gracefully
    const textFromDOMHTML = () => {
      try {
        const dom   = new DOMParser().parseFromString(xml, "text/html");
        const lines = [];
        // In HTML mode, <w:p> becomes just elements we can iterate
        // Use textContent on the body and split by logical breaks
        // Better: find all elements whose tag includes ":t" (w:t parsed as "w:t" nodeName in some engines)
        const allEls = dom.getElementsByTagName("w:t");
        if (allEls.length > 0) {
          // Group by paragraph: walk nodes and emit line on each w:p
          const paras = dom.getElementsByTagName("w:p");
          for (const p of paras) {
            const tNodes = p.getElementsByTagName("w:t");
            const line = Array.from(tNodes).map(t => t.textContent).join("").trim();
            if (line) lines.push(line);
          }
        }
        return lines;
      } catch(_) { return []; }
    };

    // ── Strategy 3: Strip all XML tags — last resort, gets all text
    const textFromStrip = () => {
      // Remove XML/HTML tags and decode entities
      const plain = xml
        .replace(/<w:br[^>]*\/>/g, "\n")   // line breaks
        .replace(/<\/w:p>/g, "\n")          // paragraph ends → newline
        .replace(/<[^>]+>/g, "")            // strip all tags
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&#x\w+;/g, "")           // remove hex entities
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      return plain.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    };

    // Try strategies in order, use first that gives results
    let lines = textFromRegex();

    if (lines.length === 0) {
      lines = textFromDOMHTML();
    }

    if (lines.length === 0) {
      lines = textFromStrip();
    }

    if (lines.length === 0 || lines.join("").length < 20) {
      throw new Error("Could not extract text from this Word file. Please copy and paste your resume text instead.");
    }

    return lines.join("\n");
  }
  throw new Error("Unsupported file type. Upload .txt, .pdf, or .docx.");
}

function _loadScript(id, src) {
  return new Promise((res, rej) => {
    const el = document.getElementById(id);
    if (el && el.dataset.loaded === "1") { res(); return; }
    if (el) { el.addEventListener("load", res); el.addEventListener("error", () => rej(new Error("Script failed: " + src))); return; }
    const s = document.createElement("script");
    s.id = id; s.src = src;
    s.onload  = () => { s.dataset.loaded = "1"; res(); };
    s.onerror = () => rej(new Error("Could not load: " + src));
    document.head.appendChild(s);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOCX BUILDER — Pure XML+JSZip, zero CDN weight, instant
// ═══════════════════════════════════════════════════════════════════════════════
function _rpr(o = {}) {
  let x = "";
  if (o.font)   x += `<w:rFonts w:ascii="${o.font}" w:hAnsi="${o.font}" w:cs="${o.font}"/>`;
  if (o.bold)   x += "<w:b/><w:bCs/>";
  if (o.italic) x += "<w:i/><w:iCs/>";
  if (o.size)   x += `<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>`;
  if (o.color)  x += `<w:color w:val="${o.color}"/>`;
  if (o.caps)   x += "<w:caps/>";
  if (o.spacing) x += `<w:spacing w:val="${o.spacing}"/>`;
  return x ? `<w:rPr>${x}</w:rPr>` : "";
}
function _run(text, o = {}) {
  if (text === null || text === undefined || text === "") return "";
  return `<w:r>${_rpr(o)}<w:t xml:space="preserve">${xmlEsc(String(text))}</w:t></w:r>`;
}
function _ppr(o = {}) {
  let x = "";
  if (o.spacing) x += `<w:spacing w:before="${o.spacing.before||0}" w:after="${o.spacing.after||0}"/>`;
  if (o.ind)     x += `<w:ind w:left="${o.ind.left||0}"${o.ind.hanging ? ` w:hanging="${o.ind.hanging}"` : ""}/>`;
  if (o.numId)   x += `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${o.numId}"/></w:numPr>`;
  if (o.shd)     x += `<w:shd w:val="clear" w:color="auto" w:fill="${o.shd}"/>`;
  if (o.keepNext) x += "<w:keepNext/>";
  if (o.borderBottom) x += `<w:pBdr><w:bottom w:val="single" w:sz="${o.borderBottom.sz||4}" w:space="1" w:color="${o.borderBottom.color||"000000"}"/></w:pBdr>`;
  if (o.borderLeft)   x += `<w:pBdr><w:left w:val="single" w:sz="${o.borderLeft.sz||12}" w:space="${o.borderLeft.space||4}" w:color="${o.borderLeft.color||"000000"}"/></w:pBdr>`;
  return x ? `<w:pPr>${x}</w:pPr>` : "";
}
function _para(pOpts = {}, runs = "") { return `<w:p>${_ppr(pOpts)}${runs}</w:p>`; }
function _sp(before = 0, after = 80)  { return _para({ spacing: { before, after } }); }

function _buildDocumentXml(resumeText) {
  const parsed = parseResumeText(resumeText);
  const { name, tagline, contactLines, sections } = parsed;

  // ── Palette ─────────────────────────────────────────────────────────────
  const N  = "1B3A6B", NL = "E8EDF5", T  = "0D7C77";
  const GR = "374151", MG = "6B7280", LG = "9CA3AF";
  const BL = "111827", AM = "854D0E";
  const F  = "Times New Roman";

  // ── Sizes (Word half-points) ─────────────────────────────────────────────
  const H1   = 40;  // 20pt — name
  const POS  = 26;  // 13pt — position/tagline
  const H2   = 24;  // 12pt — section headings, job titles
  const BODY = 22;  // 11pt — body text, bullets
  const SM   = 20;  // 10pt — contact, dates

  // ── Auto-fit line spacing ────────────────────────────────────────────────
  const lineCount = sections.reduce((s, sec) => s + 3 + sec.items.length, 8);
  const LINE  = lineCount <= 95  ? 300 : lineCount <= 130 ? 276 : 259;
  const BUL_S = lineCount <= 95  ? 20  : lineCount <= 130 ? 14  : 8;
  const SKL_S = lineCount <= 95  ? 16  : lineCount <= 130 ? 10  : 6;
  const BOD_S = lineCount <= 95  ? 20  : lineCount <= 130 ? 14  : 8;
  const SGAP  = lineCount <= 95  ? 140 : lineCount <= 130 ? 100 : 70;

  // ── Clean markdown from any line ─────────────────────────────────────────
  const cl = s => String(s||"")
    .replace(/\*\*([^*]*)\*\*/g,"$1").replace(/\*([^*]*)\*/g,"$1")
    .replace(/^#+\s*/,"").replace(/&amp;/g,"&").replace(/&lt;/g,"<")
    .replace(/&gt;/g,">").replace(/&apos;/g,"'").replace(/&quot;/g,'"').trim();

  // ── Line classifiers ─────────────────────────────────────────────────────
  const isBul    = raw => { const c=cl(raw); return /^[▪•\-–—]\s/.test(c)||/^▪\s/.test(c); };
  const isDate   = s   => /\b\d{4}\b/.test(s)||/Present/.test(s)||/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s/.test(s);
  const isLoc    = s   => !isDate(s)&&s.length<80&&/\bWA\b|\bNSW\b|\bVIC\b|\bQLD\b|\bSA\b|\bNT\b|\bACT\b|\bTAS\b/.test(s);
  const isDateLoc= s   => isDate(s)||isLoc(s);
  const actionRE = /^(Serve|Process|Perform|Liaise|Follow|Assist|Comply|Monitor|Maintain|Deliver|Achieve|Coordinate|Supervise|Manage|Handle|Support|Train|Work|Resolve|Adapt|Utilise|Utilize|Establish|Oversee|Lead|Build|Drive|Implement|Review|Report|Ensure|Prepare|Execute|Create|Oversee|Handle|Record)/i;
  const titleRE  = /(Administrator|Supervisor|Officer|Manager|Coordinator|Operator|Assistant|Specialist)/i;
  const isAutoBul= s   => actionRE.test(s)&&s.length>35&&!titleRE.test(s.slice(0,50));
  const isEduDate= s   => /\b\d{4}\b/.test(s)||/Completed|Current|Present/.test(s);

  // ── XML primitives ───────────────────────────────────────────────────────
  const rp = o => {
    let x="";
    if(o.font)   x+=`<w:rFonts w:ascii="${o.font}" w:hAnsi="${o.font}" w:cs="${o.font}" w:eastAsia="${o.font}"/>`;
    if(o.bold)   x+="<w:b/><w:bCs/>";
    if(o.italic) x+="<w:i/><w:iCs/>";
    if(o.size)   x+=`<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>`;
    if(o.color)  x+=`<w:color w:val="${o.color}"/>`;
    if(o.caps)   x+="<w:caps/>";
    return x?`<w:rPr>${x}</w:rPr>`:"";
  };
  const ru = (text,o={}) => {
    const t=cl(text); if(!t) return "";
    return `<w:r>${rp({font:F,...o})}<w:t xml:space="preserve">${xmlEsc(t)}</w:t></w:r>`;
  };
  const pp = o => {
    let x="";
    const lineVal = o.noLine ? null : (o.line!==undefined ? o.line : LINE);
    if(o.spacing) {
      const ls = lineVal!==null ? ` w:line="${lineVal}" w:lineRule="auto"` : "";
      x+=`<w:spacing w:before="${o.spacing.b||0}" w:after="${o.spacing.a||0}"${ls}/>`;
    } else if(lineVal!==null) {
      x+=`<w:spacing w:before="0" w:after="0" w:line="${lineVal}" w:lineRule="auto"/>`;
    }
    if(o.ind)        x+=`<w:ind w:left="${o.ind.l||0}"${o.ind.h?` w:hanging="${o.ind.h}"`:""}/>`; 
    if(o.numId)      x+=`<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${o.numId}"/></w:numPr>`;
    if(o.shd)        x+=`<w:shd w:val="clear" w:color="auto" w:fill="${o.shd}"/>`;
    if(o.keepNext)   x+="<w:keepNext/>";
    if(o.ctxSpacing) x+="<w:contextualSpacing/>";
    const jcVal = o.jc||(o.noJustify?null:"both");
    if(jcVal)        x+=`<w:jc w:val="${jcVal}"/>`;
    if(o.bdrB||o.bdrL) {
      let b="";
      if(o.bdrL) b+=`<w:left   w:val="single" w:sz="${o.bdrL.sz||12}" w:space="${o.bdrL.sp||4}" w:color="${o.bdrL.c}"/>`;
      if(o.bdrB) b+=`<w:bottom w:val="single" w:sz="${o.bdrB.sz||4}"  w:space="1"               w:color="${o.bdrB.c}"/>`;
      x+=`<w:pBdr>${b}</w:pBdr>`;
    }
    return x?`<w:pPr>${x}</w:pPr>`:"";
  };
  const pa  = (o={},runs="") => `<w:p>${pp(o)}${runs}</w:p>`;
  const gap = (b=0,a=60)     => pa({spacing:{b,a},noJustify:true,noLine:true});

  let body = "";

  // ── NAME ─────────────────────────────────────────────────────────────────
  body += pa(
    {spacing:{b:0,a:30},bdrL:{sz:32,sp:10,c:T},noJustify:true,jc:"left",noLine:true},
    ru(name,{bold:true,size:H1,color:N})
  );

  // ── POSITION ─────────────────────────────────────────────────────────────
  const pos = tagline && tagline.trim() ? cl(tagline) : "Professional";
  body += pa(
    {spacing:{b:0,a:28},noJustify:true,jc:"left",noLine:true},
    ru(pos,{size:POS,color:T})
  );

  // ── CONTACT ──────────────────────────────────────────────────────────────
  for (const line of contactLines) {
    const sep   = line.includes("·") ? "·" : "|";
    const parts = line.split(sep).map(p=>cl(p)).filter(Boolean);
    let runs = "";
    parts.forEach((p,i) => {
      runs += ru(p,{size:SM,color:GR});
      if(i<parts.length-1) runs += ru("  ·  ",{size:SM,color:T,bold:true});
    });
    body += pa({spacing:{b:0,a:0},noJustify:true,jc:"center",noLine:true},runs);
  }

  // ── DIVIDER ───────────────────────────────────────────────────────────────
  body += pa({spacing:{b:70,a:40},bdrB:{sz:10,c:T},noJustify:true,noLine:true});

  // ══════════════════════════════════════════════════════════════════════════
  // SECTIONS
  // ══════════════════════════════════════════════════════════════════════════
  for (const section of sections) {
    const hh    = section.header.toUpperCase().trim();
    const isExp   = /EXPERIENCE|EMPLOYMENT/.test(hh);
    const isSkill = /SKILL|COMPETENC/.test(hh);
    const isSys   = /SYSTEM|TECHNOLOG|CERTIF|ADDITIONAL|LICENC/.test(hh);
    const isEdu   = /EDUCATION|QUALIF/.test(hh);

    // ── SECTION HEADING ────────────────────────────────────────────────────
    body += gap(SGAP,0);
    body += pa(
      {spacing:{b:50,a:0},shd:NL,ind:{l:100},keepNext:true,noJustify:true,jc:"left",noLine:true},
      ru("  "+hh+"  ",{bold:true,size:H2,color:N,caps:true})
    );
    body += pa({spacing:{b:0,a:50},bdrB:{sz:4,c:T},noJustify:true,noLine:true});

    // ── SKILLS / SYSTEMS / CERTS — 2 or 3 column table ────────────────────
    if (isSkill || isSys) {
      const items = section.items.map(s=>cl(s)).filter(Boolean);
      const cols  = items.length <= 6 ? 2 : 3;
      while (items.length % cols !== 0) items.push("");
      const colW = cols===2 ? 4873 : 3248;
      const cell = text => {
        // Paragraph-level rPr sets default bold=0 so ▪ bold never bleeds onto text
        const pPrXml = pp({spacing:{b:SKL_S,a:SKL_S},ind:{l:200,h:200},noJustify:true,jc:"left"});
        const pPrSafe = pPrXml
          ? pPrXml.replace("</w:pPr>", `<w:rPr><w:b w:val="0"/><w:bCs w:val="0"/><w:color w:val="${BL}"/><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr></w:pPr>`)
          : `<w:pPr><w:rPr><w:b w:val="0"/><w:bCs w:val="0"/><w:color w:val="${BL}"/></w:rPr></w:pPr>`;
        const p = `<w:p>${pPrSafe}${text ? ru("▪  ",{size:BODY,color:T,bold:true}) + ru(text,{size:BODY,color:BL,bold:false}) : ""}</w:p>`;
        return `<w:tc><w:tcPr><w:tcW w:w="${colW}" w:type="dxa"/><w:tcBorders><w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/></w:tcBorders><w:vAlign w:val="top"/><w:tcMar><w:top w:w="0" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tcMar></w:tcPr>${p}</w:tc>`;
      };
      let tbl = `<w:tbl><w:tblPr><w:tblW w:w="${colW*cols}" w:type="dxa"/><w:tblBorders><w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/></w:tblBorders><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${Array(cols).fill(`<w:gridCol w:w="${colW}"/>`).join("")}</w:tblGrid>`;
      for (let r=0; r<items.length/cols; r++) {
        tbl += "<w:tr>";
        for (let c=0; c<cols; c++) tbl += cell(items[r*cols+c]);
        tbl += "</w:tr>";
      }
      tbl += "</w:tbl>";
      body += tbl;
      body += gap(0,SKL_S);
      continue;
    }

    // ── EDUCATION ─────────────────────────────────────────────────────────
    if (isEdu) {
      let i=0;
      while(i<section.items.length) {
        const raw  = section.items[i]||"";
        const item = cl(raw);
        if(!item){i++;continue;}
        const hasPipe  = item.includes("|");
        const hasEDate = isEduDate(item);

        if(hasEDate && hasPipe) {
          // "Institution | Completed 2026" — split: institution teal + year amber
          const parts = item.split("|").map(p=>p.trim()).filter(Boolean);
          let runs="";
          parts.forEach((p,idx)=>{
            const isY = isEduDate(p);
            runs += ru(p,{size:isY?SM:BODY, color:isY?AM:T, italic:true});
            if(idx<parts.length-1) runs += ru("   |   ",{size:SM,color:LG});
          });
          body += pa({spacing:{b:4,a:BOD_S},noJustify:true,jc:"left",noLine:true},runs);
        } else if(hasEDate) {
          // Standalone "Completed 2026"
          body += pa({spacing:{b:4,a:BOD_S},noJustify:true,jc:"left",noLine:true},
            ru(item,{size:SM,color:AM,italic:true}));
        } else if(hasPipe) {
          // "Institution | Date" on one line
          const [inst,...rest]=item.split("|").map(p=>p.trim());
          body += pa({spacing:{b:4,a:0},keepNext:true,noJustify:true,jc:"left",noLine:true},
            ru(inst,{size:BODY,color:T,italic:true}));
          if(rest.length) body += pa({spacing:{b:0,a:BOD_S},noJustify:true,jc:"left",noLine:true},
            ru(rest.join("|"),{size:SM,color:AM,italic:true}));
        } else {
          // Qualification name — bold 12pt black
          body += pa({spacing:{b:BOD_S,a:4},keepNext:true,noJustify:true,jc:"left",noLine:true},
            ru(item,{bold:true,size:H2,color:BL}));
        }
        i++;
      }
      continue;
    }

    // ── EXPERIENCE — pre-pass block builder ────────────────────────────────
    // Pass 1: classify every line into typed tokens
    if (isExp) {
      const tokens = section.items.map(raw => {
        const c = cl(raw);
        if(!c) return null;
        if(isBul(raw))           return {type:"bullet",  text:c.replace(/^[▪•\-–—]\s*/,"").trim()};
        if(isDateLoc(c))         return {type:"dateloc", text:c};
        if(isAutoBul(c))         return {type:"bullet",  text:c};
        return                          {type:"header",  text:c};
      }).filter(Boolean);

      // Pass 2: group tokens into job blocks
      const jobs = [];
      let jb = null;
      for (let ti=0; ti<tokens.length; ti++) {
        const tok  = tokens[ti];
        const next = tokens[ti+1];

        if(tok.type==="header") {
          // Determine: is this a job title or a company name?
          // A job title comes BEFORE a company name or date
          // A company name comes right after a job title (no pipe)
          const hasPipe = tok.text.includes("|");

          if(hasPipe) {
            // "Title | Company" on one line
            const pIdx    = tok.text.indexOf("|");
            const title   = tok.text.slice(0,pIdx).trim();
            const company = tok.text.slice(pIdx+1).trim();
            if(jb) jobs.push(jb);
            jb = {title, company, dateStr:"", bullets:[]};
          } else if(jb===null || (next && next.type==="dateloc")) {
            // This line is a job title (next is date/loc)
            if(jb) jobs.push(jb);
            jb = {title:tok.text, company:"", dateStr:"", bullets:[]};
          } else if(jb && !jb.company && jb.bullets.length===0) {
            // This line follows a title with no company yet → it's the company
            jb.company = tok.text;
          } else {
            // Orphan header → new job block
            if(jb) jobs.push(jb);
            jb = {title:tok.text, company:"", dateStr:"", bullets:[]};
          }
        } else if(tok.type==="dateloc") {
          if(!jb) jb = {title:"", company:"", dateStr:"", bullets:[]};
          // Combine date and location on one line
          jb.dateStr = jb.dateStr ? jb.dateStr + "   ·   " + tok.text : tok.text;
        } else if(tok.type==="bullet") {
          if(!jb) jb = {title:"", company:"", dateStr:"", bullets:[]};
          jb.bullets.push(tok.text);
        }
      }
      if(jb) jobs.push(jb);

      // Pass 3: emit XML for each job block
      for (const [ji, job] of jobs.entries()) {
        body += gap(ji===0 ? SGAP-40 : SGAP-20, 0);

        // Job title — bold 12pt black, no line spacing
        if(job.title) body += pa(
          {spacing:{b:0,a:0},keepNext:true,noJustify:true,jc:"left",noLine:true},
          ru(job.title,{bold:true,size:H2,color:BL})
        );

        // Company — teal italic 11pt
        if(job.company) body += pa(
          {spacing:{b:0,a:4},keepNext:true,noJustify:true,jc:"left",noLine:true},
          ru(job.company,{size:BODY,color:T,italic:true})
        );

        // Date / location — amber italic 10pt
        if(job.dateStr) {
          // Handle "Mar 2025 – Present  Bentley, WA" (spaces) and "Location|Date" (pipe)
          const parts = job.dateStr.includes("|")
            ? job.dateStr.split("|").map(p=>p.trim()).filter(Boolean)
            : job.dateStr.split(/\s{2,}|\s*·\s*/).map(p=>p.trim()).filter(Boolean);
          let runs="";
          parts.forEach((p,idx)=>{
            runs += ru(p,{size:SM,color:AM,italic:true});
            if(idx<parts.length-1) runs += ru("   ·   ",{size:SM,color:LG});
          });
          body += pa({spacing:{b:0,a:60},noJustify:true,jc:"left",noLine:true},runs);
        }

        // Bullets — 11pt black justified, teal disc
        for (const bul of job.bullets) {
          body += pa(
            {spacing:{b:BUL_S,a:BUL_S},line:LINE,numId:1,ctxSpacing:true},
            ru(bul,{size:BODY,color:BL})
          );
        }
      }
      continue;
    }

    // ── GENERIC SECTION (Summary, References) ────────────────────────────
    let i=0;
    while(i<section.items.length) {
      const raw  = section.items[i]||"";
      const item = cl(raw);
      if(!item){i++;continue;}
      if(isBul(raw)) {
        const txt = item.replace(/^[▪•\-–—]\s*/,"").trim();
        body += pa(
          {spacing:{b:BUL_S,a:BUL_S},line:LINE,numId:1,ctxSpacing:true},
          ru(txt,{size:BODY,color:BL})
        );
      } else {
        body += pa(
          {spacing:{b:BOD_S,a:BOD_S},line:LINE},
          ru(item,{size:BODY,color:BL})
        );
      }
      i++;
    }
  }

  body += "<w:p/>";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>${body}
<w:sectPr>
  <w:pgSz w:w="11906" w:h="16838"/>
  <w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="709" w:footer="709" w:gutter="0"/>
</w:sectPr>
</w:body></w:document>`;
}


export async function buildDocxBuffer(resumeText) {
  await _loadScript("jszip","https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
  const JSZip = window.JSZip;
  if (!JSZip) throw new Error("JSZip failed to load.");
  const docXml = _buildDocumentXml(resumeText);
  const zip = new JSZip();
  zip.file("[Content_Types].xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/word/styles.xml"   ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`);
  zip.file("_rels/.rels",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.file("word/_rels/document.xml.rels",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"    Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings"  Target="settings.xml"/>
</Relationships>`);
  zip.file("word/document.xml", docXml);
  zip.file("word/styles.xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
          xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <!-- Document defaults: Times New Roman 11pt justified -->
  <w:docDefaults>
    <w:rPrDefault><w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/>
      <w:sz w:val="22"/><w:szCs w:val="22"/>
      <w:lang w:val="en-AU" w:eastAsia="en-AU"/>
    </w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr>
      <w:jc w:val="both"/>
      <w:spacing w:after="0" w:line="300" w:lineRule="auto"/>
    </w:pPr></w:pPrDefault>
  </w:docDefaults>
  <!-- Normal body: 11pt TNR justified -->
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1">
    <w:name w:val="Normal"/>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
      <w:sz w:val="22"/><w:szCs w:val="22"/>
    </w:rPr>
    <w:pPr>
      <w:jc w:val="both"/>
      <w:spacing w:after="0" w:line="300" w:lineRule="auto"/>
    </w:pPr>
  </w:style>
  <!-- Heading 1: 14pt bold TNR left (name) -->
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
      <w:b/><w:bCs/>
      <w:sz w:val="28"/><w:szCs w:val="28"/>
    </w:rPr>
    <w:pPr>
      <w:jc w:val="left"/>
      <w:spacing w:before="0" w:after="50"/>
      <w:keepNext/>
    </w:pPr>
  </w:style>
  <!-- Heading 2: 12pt bold TNR left (section headers, job titles) -->
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:rPr>
      <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
      <w:b/><w:bCs/>
      <w:sz w:val="24"/><w:szCs w:val="24"/>
    </w:rPr>
    <w:pPr>
      <w:jc w:val="left"/>
      <w:spacing w:before="120" w:after="0"/>
      <w:keepNext/>
    </w:pPr>
  </w:style>
</w:styles>`);
  zip.file("word/numbering.xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/><w:numFmt w:val="bullet"/>
      <w:lvlText w:val="&#x2022;"/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="380" w:hanging="220"/></w:pPr>
      <w:rPr><w:color w:val="0D7C77"/><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:cs="Symbol"/></w:rPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`);
  zip.file("word/settings.xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:defaultTabStop w:val="709"/>
  <w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>
</w:settings>`);
  return await zip.generateAsync({ type:"uint8array", compression:"DEFLATE", compressionOptions:{level:1} });
}

export async function downloadDocx(resumeText, filename="Optimised_Resume.docx", preBuiltBuffer=null) {
  const buf  = preBuiltBuffer || await buildDocxBuffer(resumeText);
  const blob = new Blob([buf], { type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href:url, download:filename });
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Extract candidate name from resume text and format as a safe filename.
 *  e.g. "JASHAN KAUR" → "Jashan_Kaur"
 *  Falls back to "Resume" if no name found.
 */
export function resumeFilename(resumeText, suffix = "Resume.docx") {
  try {
    const { name } = parseResumeText(resumeText || "");
    if (!name || name === "Resume") return suffix;
    // Title-case and replace spaces/special chars with underscores
    // Title-case each word: "JASHAN KAUR" → "Jashan Kaur"
    const titled = name.trim()
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
    const safe = titled
      .replace(/\s+/g, "_")
      .replace(/[^A-Za-z0-9_\-]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
    return safe ? `${safe}_${suffix}` : suffix;
  } catch (_) {
    return suffix;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// API LAYER
// ═══════════════════════════════════════════════════════════════════════════════
export async function callAI(system, user, apiKey, maxTokens=2048) {
  if (!apiKey || !apiKey.trim())
    throw new Error("Enter your Anthropic API key to use this app.");
  const res = await fetch(API_URL, {
    method:"POST",
    headers:{
      "content-type":"application/json",
      "anthropic-version":"2023-06-01",
      "x-api-key": apiKey.trim(),
      "anthropic-dangerous-direct-browser-access":"true"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages:[{ role:"user", content:user }]
    })
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j=await res.json(); msg += ": "+(j.error?.message||JSON.stringify(j).slice(0,150)); } catch(_){}
    throw new Error(msg);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "API error");
  if (data.stop_reason === "max_tokens")
    throw new Error("Response was cut off. Please try a shorter resume.");
  const text = (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("").trim();
  if (!text) throw new Error("API returned empty content.");
  return text;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED STYLES (memoized object — never rebuilt on render)
// ═══════════════════════════════════════════════════════════════════════════════
const S = {
  card:  { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:24, marginBottom:16 },
  green: { background:"linear-gradient(135deg,rgba(0,229,160,0.08),rgba(13,124,119,0.05))", border:"1px solid rgba(0,229,160,0.2)", borderRadius:16, padding:24, marginBottom:16 },
  purple:{ background:"linear-gradient(135deg,rgba(124,92,252,0.09),rgba(0,229,160,0.05))", border:"1px solid rgba(124,92,252,0.22)", borderRadius:16, padding:24, marginBottom:16 },
  amber: { background:"linear-gradient(135deg,rgba(245,200,66,0.08),rgba(245,200,66,0.03))", border:"1px solid rgba(245,200,66,0.2)", borderRadius:16, padding:24, marginBottom:16 },
  ta:    { width:"100%", minHeight:160, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.11)", borderRadius:12, padding:16, color:"#e2e8f0", fontSize:14, fontFamily:"inherit", resize:"vertical", outline:"none", boxSizing:"border-box", lineHeight:1.7 },
  inp:   { width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.11)", borderRadius:10, padding:"12px 16px", color:"#e2e8f0", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" },
  lbl:   { fontSize:13, color:"#94a3b8", marginBottom:6, display:"block", fontWeight:600 },
  sec:   (c="#7c5cfc") => ({ fontSize:11, fontWeight:700, color:c, textTransform:"uppercase", letterSpacing:"1.8px", marginBottom:14, fontFamily:"'Space Mono',monospace" }),
  btn:   (dis=false) => ({ padding:"14px 28px", borderRadius:12, border:"none", width:"100%", marginTop:14, fontSize:15, fontWeight:700, fontFamily:"inherit", letterSpacing:"0.3px", cursor:dis?"not-allowed":"pointer", background:dis?"rgba(255,255,255,0.07)":"linear-gradient(135deg,#7c5cfc,#5b8cff)", color:dis?"#475569":"#fff", boxShadow:dis?"none":"0 4px 24px #7c5cfc44", opacity:dis?0.65:1, transition:"all 0.2s" }),
  ghost: { padding:"8px 16px", borderRadius:9, border:"1px solid rgba(255,255,255,0.14)", background:"rgba(255,255,255,0.05)", color:"#94a3b8", fontSize:13, fontWeight:600, fontFamily:"inherit", cursor:"pointer" },
  g2:    { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:14 },
  stripe:(on)=>({ fontSize:13, color:"#94a3b8", marginBottom:10, paddingLeft:12, borderLeft:`2px solid ${on?"#00e5a0":"#ff5b5b"}`, lineHeight:1.5 }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// MICRO COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════
function Gauge({ score, max=100, size=148 }) {
  const v    = clamp(score, 0, max);
  const r    = (size-22)/2;
  const circ = 2*Math.PI*r;
  const arc  = circ*0.75;
  const fill = (v/max)*arc;
  const col  = v/max>=0.75?"#00e5a0":v/max>=0.5?"#f5c842":"#ff5b5b";
  return (
    <svg width={size} height={size} style={{ transform:"rotate(-225deg)", display:"block" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="11" strokeDasharray={`${arc} ${circ}`} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth="11" strokeLinecap="round"
        strokeDasharray={`${fill} ${circ}`}
        style={{ transition:"stroke-dasharray 1.3s cubic-bezier(.4,0,.2,1)", filter:`drop-shadow(0 0 9px ${col})` }} />
    </svg>
  );
}

function Bar({ label, score, max, feedback }) {
  const v = clamp(score, 0, Number(max)||1);
  const m = Number(max)||1;
  const pct = (v/m)*100;
  const col = pct>=75?"#00e5a0":pct>=50?"#f5c842":"#ff5b5b";
  return (
    <div style={{ marginBottom:18 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
        <span style={{ fontSize:13, color:"#94a3b8", fontFamily:"'Space Mono',monospace" }}>{label}</span>
        <span style={{ fontSize:13, fontWeight:700, color:col }}>{v}/{m}</span>
      </div>
      <div style={{ height:7, borderRadius:99, background:"rgba(255,255,255,0.08)", overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, borderRadius:99,
          background:`linear-gradient(90deg,${col}66,${col})`,
          boxShadow:`0 0 10px ${col}44`, transition:"width 1.1s ease" }} />
      </div>
      {feedback && <p style={{ margin:"5px 0 0", fontSize:12, color:"#64748b", lineHeight:1.5 }}>{feedback}</p>}
    </div>
  );
}

function Chip({ text, color="#00e5a0" }) {
  return (
    <span style={{ display:"inline-block", margin:"3px 4px 3px 0", padding:"3px 11px", borderRadius:99,
      border:`1px solid ${color}44`, background:`${color}10`, color, fontSize:12,
      fontFamily:"'Space Mono',monospace" }}>
      {text}
    </span>
  );
}



function Alert({ msg, onClose }) {
  if (!msg) return null;
  return (
    <div style={{ display:"flex", gap:10, alignItems:"flex-start", justifyContent:"space-between",
      background:"#ff5b5b12", border:"1px solid #ff5b5b44", borderRadius:10,
      padding:"12px 16px", marginBottom:16, color:"#ff5b5b", fontSize:14, lineHeight:1.5 }}>
      <span style={{ flex:1 }}>⚠️ {msg}</span>
      <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer",
        color:"#ff5b5b", fontSize:20, lineHeight:1, padding:0, flexShrink:0 }}>×</button>
    </div>
  );
}

// ─── LOADING WITH COUNTDOWN ──────────────────────────────────────────────────
// steps: array of {at: secondsRemaining, label: string} — shown as AI progresses
const ACTION_STEPS = {
  analyse: [
    { at:99, label:"Reading your resume…" },
    { at:20, label:"Scoring ATS compatibility…" },
    { at:12, label:"Analysing keyword gaps…" },
    { at: 5, label:"Calculating hire probability…" },
  ],
  optimize: [
    { at:99, label:"Scanning for missing keywords…" },
    { at:20, label:"Rewriting bullet points…" },
    { at:12, label:"Strengthening professional summary…" },
    { at: 6, label:"Final ATS scoring pass…" },
  ],
  build: [
    { at:99, label:"Crafting your resume structure…" },
    { at:14, label:"Writing impact statements…" },
    { at: 6, label:"Embedding ATS keywords…" },
  ],
  interview: [
    { at:99, label:"Analysing job requirements…" },
    { at: 8, label:"Generating targeted questions…" },
  ],
};

function LoadingWithCountdown({ seconds, action="analyse", running }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
    if (!running) return;
    const iv = setInterval(() =>
      setRemaining(r => Math.max(0, r - 1)), 1000);
    return () => clearInterval(iv);
  }, [running, seconds]);

  if (!running) return null;

  const elapsed = seconds - remaining;
  const pct     = clamp(elapsed / seconds * 100, 0, 100);
  const steps   = ACTION_STEPS[action] || ACTION_STEPS.analyse;

  // Find the current step label — last step whose 'at' >= remaining
  const currentStep = steps.reduce((found, step) =>
    remaining <= step.at ? step : found, steps[0]);

  // Colour transitions: purple → teal → green as it finishes
  const timerColor = pct < 40 ? "#7c5cfc" : pct < 75 ? "#f5c842" : "#00e5a0";
  const barColor   = pct < 40
    ? "linear-gradient(90deg,#7c5cfc66,#7c5cfc)"
    : pct < 75
    ? "linear-gradient(90deg,#f5c84266,#f5c842)"
    : "linear-gradient(90deg,#00e5a066,#00e5a0)";

  return (
    <div style={{ padding:"36px 20px 12px", textAlign:"center" }}>

      {/* Spinner */}
      <div style={{ position:"relative", width:64, height:64, margin:"0 auto 20px" }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ position:"absolute", inset:i*9, border:"2px solid transparent",
            borderTopColor:[timerColor,"#7c5cfc44","#7c5cfc22"][i], borderRadius:"50%",
            animation:`riq-spin ${1+i*0.3}s linear infinite ${i%2?"reverse":""}` }} />
        ))}
      </div>

      {/* Big countdown number — shows "Almost done" when timer expires but API still running */}
      <div style={{ fontSize:52, fontWeight:800, color:timerColor,
        fontFamily:"'Space Mono',monospace", lineHeight:1,
        transition:"color 0.8s ease",
        textShadow:`0 0 30px ${timerColor}44` }}>
        {remaining > 0 ? remaining : "~"}
        <span style={{ fontSize:18, color:"#64748b", marginLeft:4 }}>
          {remaining > 0 ? "s" : ""}
        </span>
      </div>

      {/* Step label */}
      <div style={{ fontSize:14, color:"#94a3b8", marginTop:10, marginBottom:16,
        fontFamily:"'Space Mono',monospace", minHeight:20,
        transition:"opacity 0.4s" }}>
        {remaining > 0 ? currentStep.label : "Almost there — finalising…"}
      </div>

      {/* Progress bar */}
      <div style={{ height:6, borderRadius:99, background:"rgba(255,255,255,0.07)",
        overflow:"hidden", maxWidth:320, margin:"0 auto 12px" }}>
        <div style={{ height:"100%", width:`${pct}%`, borderRadius:99,
          background:barColor, boxShadow:`0 0 10px ${timerColor}44`,
          transition:"width 1s linear, background 0.8s ease" }} />
      </div>

      {/* Step dots */}
      <div style={{ display:"flex", justifyContent:"center", gap:6 }}>
        {steps.map((step,i) => {
          const done = remaining < step.at && (i === steps.length-1 || remaining >= (steps[i+1]?.at||0));
          const active = currentStep === step;
          return (
            <div key={i} style={{ width:7, height:7, borderRadius:99, transition:"all 0.4s",
              background: active ? timerColor : done ? "#ffffff33" : "rgba(255,255,255,0.1)",
              boxShadow: active ? `0 0 8px ${timerColor}` : "none" }} />
          );
        })}
      </div>
    </div>
  );
}

// Keep Spinner as a thin alias for compatibility
function Spinner({ msg }) { return <LoadingWithCountdown seconds={30} action="analyse" running={true} />; }


function UploadBtn({ onText, disabled }) {
  const [busy, setBusy] = useState(false);
  const [ok,   setOk]   = useState(false);
  const [hint, setHint] = useState("");
  const ref = useRef(null);
  const handle = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setOk(false); setHint("");
    try {
      const text = await readResumeFile(file);
      onText(text);
      setOk(true); setHint(file.name);
      setTimeout(() => { setOk(false); setHint(""); }, 3500);
    } catch (err) {
      setHint(err.message);
      setTimeout(() => setHint(""), 4500);
    } finally { setBusy(false); e.target.value = ""; }
  };
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:10, flexWrap:"wrap" }}>
      <input ref={ref} type="file" accept=".txt,.pdf,.doc,.docx" style={{ display:"none" }} onChange={handle} />
      <button type="button" disabled={disabled||busy} onClick={() => ref.current?.click()}
        style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"9px 16px", borderRadius:9,
          border:`1px solid ${ok?"#00e5a044":"rgba(255,255,255,0.13)"}`,
          background: ok?"#00e5a014":"rgba(255,255,255,0.05)",
          color: ok?"#00e5a0":"#94a3b8", fontSize:13, fontWeight:600, fontFamily:"'DM Sans',sans-serif",
          cursor:(disabled||busy)?"not-allowed":"pointer", opacity:(disabled||busy)?0.6:1, transition:"all 0.2s" }}>
        {busy
          ? (<><span style={{ width:14,height:14,border:"2px solid #7c5cfc44",borderTopColor:"#7c5cfc",borderRadius:"50%",display:"inline-block",animation:"riq-spin 0.7s linear infinite" }} />Reading…</>)
          : ok ? <>✅ Loaded!</>
                : <>📎 Upload Resume</>}
      </button>
      <span style={{ fontSize:11, color:hint.length>40?"#ff5b5b":"#64748b",
        fontFamily:"'Space Mono',monospace", maxWidth:260, lineHeight:1.4 }}>
        {hint || "Supports .txt  .pdf  .docx"}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// OPTIMIZE PANEL — shown after optimization replaces the score panel
// ═══════════════════════════════════════════════════════════════════════════════
function OptimizePanel({ data }) {
  const [copied,     setCopied]     = useState(false);
  const [dlBusy,     setDlBusy]     = useState(false);
  const [dlDone,     setDlDone]     = useState(false);
  const [dlErr,      setDlErr]      = useState("");
  const [docxBuffer, setDocxBuffer] = useState(null);
  const [showFull,   setShowFull]   = useState(false);

  // Pre-build DOCX in background immediately when data arrives
  useEffect(() => {
    if (!data?.optimizedResume) return;
    setDocxBuffer(null);
    buildDocxBuffer(data.optimizedResume)
      .then(buf => setDocxBuffer(buf))
      .catch(() => {});
  }, [data]);

  if (!data) return null;

  if (data.error) return (
    <div style={{ ...S.card, borderColor:"#ff5b5b44", background:"#ff5b5b08",
      color:"#ff5b5b", fontSize:14, padding:20 }}>
      ⚠️ Optimisation failed: {data.error}
      <br/><span style={{ fontSize:12, color:"#64748b", marginTop:6, display:"block" }}>
        Try shortening your resume or check your API key.
      </span>
    </div>
  );

  const oldScore = clamp(data.originalScore, 0, 100);
  const newScore = clamp(data.newAtsScore,   0, 100);
  const diff     = newScore - oldScore;

  const handleDownload = async () => {
    if (dlBusy) return;
    setDlBusy(true); setDlErr("");
    try {
      await downloadDocx(data.optimizedResume, resumeFilename(data.optimizedResume, "Optimised_Resume.docx"), docxBuffer || null);
      setDlDone(true); setTimeout(() => setDlDone(false), 4000);
    } catch (e) {
      setDlErr(e.message || "Download failed.");
      setTimeout(() => setDlErr(""), 5000);
    } finally { setDlBusy(false); }
  };

  return (
    <div className="riq-fade">
      {/* ── HERO: Score + Download ─────────────────────────────────────────── */}
      <div style={{ ...S.green, textAlign:"center", padding:"28px 20px" }}>
        <div style={S.sec("#00e5a0")}>✨ Optimisation Complete</div>

        {/* Gauges */}
        <div style={{ display:"flex", justifyContent:"center", alignItems:"center",
          gap:16, flexWrap:"wrap", marginBottom:18 }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:10, color:"#64748b", fontFamily:"'Space Mono',monospace",
              marginBottom:6, textTransform:"uppercase", letterSpacing:"1px" }}>Before</div>
            <div style={{ position:"relative", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
              <Gauge score={oldScore} size={118} />
              <div style={{ position:"absolute", textAlign:"center" }}>
                <div style={{ fontSize:20, fontWeight:800, color:"#ff5b5b", lineHeight:1 }}>{oldScore}</div>
                <div style={{ fontSize:8, color:"#64748b", fontFamily:"'Space Mono',monospace" }}>ATS</div>
              </div>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:22, color:"#f5c842" }}>→</span>
            <span style={{ padding:"3px 10px", borderRadius:99, background:"#00e5a018",
              border:"1px solid #00e5a044", color:"#00e5a0", fontSize:13, fontWeight:800,
              fontFamily:"'Space Mono',monospace" }}>
              +{diff} pts
            </span>
          </div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:10, color:"#64748b", fontFamily:"'Space Mono',monospace",
              marginBottom:6, textTransform:"uppercase", letterSpacing:"1px" }}>After</div>
            <div style={{ position:"relative", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
              <Gauge score={newScore} size={118} />
              <div style={{ position:"absolute", textAlign:"center" }}>
                <div style={{ fontSize:20, fontWeight:800, color:"#00e5a0", lineHeight:1 }}>{newScore}</div>
                <div style={{ fontSize:8, color:"#64748b", fontFamily:"'Space Mono',monospace" }}>ATS</div>
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ maxWidth:420, margin:"0 auto 16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
            <span style={{ fontSize:11, color:"#64748b" }}>Before: {oldScore}/100</span>
            <span style={{ fontSize:11, color:"#00e5a0", fontWeight:700 }}>After: {newScore}/100</span>
          </div>
          <div style={{ height:8, borderRadius:99, background:"rgba(255,255,255,0.07)", overflow:"hidden", position:"relative" }}>
            <div style={{ position:"absolute", height:"100%", width:`${oldScore}%`, borderRadius:99, background:"#ff5b5b44" }} />
            <div style={{ position:"absolute", height:"100%", width:`${newScore}%`, borderRadius:99,
              background:"linear-gradient(90deg,#f5c84266,#00e5a0)",
              boxShadow:"0 0 12px #00e5a044", transition:"width 1.3s ease" }} />
          </div>
        </div>

        {data.verdict && (
          <p style={{ color:"#94a3b8", fontSize:13, lineHeight:1.6, fontStyle:"italic",
            maxWidth:520, margin:"0 auto 20px" }}>"{data.verdict}"</p>
        )}

        {/* Big download button */}
        <button onClick={handleDownload} disabled={dlBusy}
          style={{ display:"inline-flex", alignItems:"center", gap:10, padding:"15px 36px",
            borderRadius:14, border:"none", fontSize:16, fontWeight:800, fontFamily:"inherit",
            cursor:dlBusy?"not-allowed":"pointer", transition:"all 0.2s",
            background:dlBusy?"rgba(255,255,255,0.07)":"linear-gradient(135deg,#00e5a0,#00b377)",
            color:dlBusy?"#64748b":"#000",
            boxShadow:dlBusy?"none":"0 6px 32px #00e5a055" }}>
          {dlBusy
            ? (<><span style={{ width:18,height:18,border:"2px solid #64748b44",borderTopColor:"#64748b",
                borderRadius:"50%",display:"inline-block",animation:"riq-spin 0.8s linear infinite" }}/>
               Building .docx…</>)
            : dlDone ? "✅ Downloaded!"
            : docxBuffer ? "⚡ Download Optimised Resume (.docx)"
            : "⬇️ Download Optimised Resume (.docx)"}
        </button>
        {docxBuffer && !dlBusy && !dlDone && (
          <p style={{ fontSize:11, color:"#00e5a0", marginTop:8, fontFamily:"'Space Mono',monospace" }}>
            ⚡ File ready — instant download
          </p>
        )}
        {dlErr && <p style={{ color:"#ff5b5b", fontSize:12, marginTop:8 }}>⚠️ {dlErr}</p>}
      </div>

      {/* ── KEYWORDS ADDED ─────────────────────────────────────────────────── */}
      {data.keywordsAdded?.length > 0 && (
        <div style={S.card}>
          <div style={S.sec("#00e5a0")}>🔑 Keywords Added ({data.keywordsAdded.length})</div>
          <div>{data.keywordsAdded.map((k,i) => <Chip key={i} text={k} color="#00e5a0" />)}</div>
        </div>
      )}

      {/* ── WHAT WE CHANGED ────────────────────────────────────────────────── */}
      {data.sectionsChanged?.length > 0 && (
        <div style={S.card}>
          <div style={S.sec("#7c5cfc")}>📝 What We Changed ({data.sectionsChanged.length} sections)</div>
          {data.sectionsChanged.map((s,i) => (
            <div key={i} style={S.stripe(true)}>✓ {s}</div>
          ))}
        </div>
      )}

      {/* ── BEFORE vs AFTER ────────────────────────────────────────────────── */}
      {data.improvements?.length > 0 && (
        <div style={S.card}>
          <div style={S.sec("#f5c842")}>🔄 Before vs After — Every Change Made</div>
          {data.improvements.map((item,i) => (
            <div key={i} style={{ marginBottom:18, paddingBottom:18,
              borderBottom: i < data.improvements.length-1 ? "1px solid rgba(255,255,255,0.06)":"none" }}>
              <div style={{ display:"inline-block", padding:"3px 10px", borderRadius:6,
                background:"#f5c84213", border:"1px solid #f5c84230",
                color:"#f5c842", fontSize:11, fontWeight:700,
                fontFamily:"'Space Mono',monospace", marginBottom:10 }}>
                {item.section}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div style={{ padding:"12px 14px", background:"rgba(255,91,91,0.05)",
                  border:"1px solid rgba(255,91,91,0.18)", borderRadius:10 }}>
                  <div style={{ fontSize:10, color:"#ff5b5b", fontWeight:700, fontFamily:"'Space Mono',monospace",
                    marginBottom:7, textTransform:"uppercase", letterSpacing:"1px" }}>✕ Before</div>
                  <div style={{ fontSize:13, color:"#94a3b8", lineHeight:1.6 }}>{item.before}</div>
                </div>
                <div style={{ padding:"12px 14px", background:"rgba(0,229,160,0.05)",
                  border:"1px solid rgba(0,229,160,0.18)", borderRadius:10 }}>
                  <div style={{ fontSize:10, color:"#00e5a0", fontWeight:700, fontFamily:"'Space Mono',monospace",
                    marginBottom:7, textTransform:"uppercase", letterSpacing:"1px" }}>✓ After</div>
                  <div style={{ fontSize:13, color:"#e2e8f0", lineHeight:1.6 }}>{item.after}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── FULL RESUME (collapsible) ───────────────────────────────────────── */}
      {data.optimizedResume && (
        <div style={S.card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
            flexWrap:"wrap", gap:10, marginBottom:showFull?16:0 }}>
            <div style={S.sec("#7c5cfc")}>📄 Full Optimised Resume</div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => setShowFull(v=>!v)} style={S.ghost}>
                {showFull ? "🔼 Collapse" : "🔽 Preview"}
              </button>
              <button onClick={() => { safeCopy(data.optimizedResume); setCopied(true); setTimeout(()=>setCopied(false),2200); }} style={S.ghost}>
                {copied ? "✅ Copied!" : "📋 Copy"}
              </button>
              <button onClick={handleDownload} disabled={dlBusy}
                style={{ ...S.ghost, borderColor:"#00e5a044", color:dlBusy?"#64748b":"#00e5a0", background:"#00e5a010" }}>
                {dlBusy ? "⏳" : dlDone ? "✅" : "⬇️ .docx"}
              </button>
            </div>
          </div>
          {showFull && (
            <pre style={{ whiteSpace:"pre-wrap", fontSize:12, color:"#94a3b8", lineHeight:1.85,
              fontFamily:"inherit", background:"rgba(255,255,255,0.02)", padding:18,
              borderRadius:10, border:"1px solid rgba(255,255,255,0.05)",
              maxHeight:560, overflowY:"auto" }}>
              {data.optimizedResume}
            </pre>
          )}
          {!showFull && (
            <p style={{ fontSize:12, color:"#475569", paddingTop:4 }}>
              Click <strong style={{color:"#94a3b8"}}>Preview</strong> to read it, or ⬇️ download directly above.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCORE PANEL — shows analysis; replaced by OptimizePanel after optimization
// ═══════════════════════════════════════════════════════════════════════════════
function ScorePanel({ data, copied, onCopy, resultRef, resume, jobDesc, loading, apiKey }) {
  const [optData,   setOptData]   = useState(null);
  const [optBusy,   setOptBusy]   = useState(false);
  const [countdown, setCountdown] = useState(false);
  const optRef = useRef(null);

  // Scroll to optimize results
  useEffect(() => {
    if (optData && optRef.current) {
      setTimeout(() => optRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 120);
    }
  }, [optData]);

  if (!data) return null;

  // After optimization — show ONLY the results (no score panel)
  if (optData) {
    return <div ref={optRef}><OptimizePanel data={optData} /></div>;
  }

  const ov  = clamp(data.overallScore, 0, 100);
  const hc  = clamp(data.hireChance,   0, 100);
  const ovc = ov>=75?"#00e5a0":ov>=50?"#f5c842":"#ff5b5b";
  const hcc = hc>=65?"#00e5a0":hc>=40?"#f5c842":"#ff5b5b";

  const handleOptimize = async (parsedResult) => {
    setOptBusy(false); setCountdown(false);
    setOptData(parsedResult);
  };

  return (
    <div ref={resultRef} className="riq-fade" style={{ marginTop:28 }}>

      {/* Overview */}
      <div style={{ ...S.purple, textAlign:"center" }}>
        <div style={S.sec()}>🎯 Career Intelligence Report</div>
        <div style={{ display:"flex", justifyContent:"center", gap:36, flexWrap:"wrap", marginBottom:20 }}>
          {[{lbl:"RESUME SCORE",val:ov,col:ovc,sfx:""},{lbl:"HIRE CHANCE",val:hc,col:hcc,sfx:"%"}].map(({lbl,val,col,sfx})=>(
            <div key={lbl} style={{ position:"relative", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
              <Gauge score={val} />
              <div style={{ position:"absolute", textAlign:"center" }}>
                <div style={{ fontSize:26, fontWeight:800, color:col, lineHeight:1 }}>{val}{sfx}</div>
                <div style={{ fontSize:9, color:"#64748b", fontFamily:"'Space Mono',monospace", marginTop:3 }}>{lbl}</div>
              </div>
            </div>
          ))}
        </div>
        {data.competitorComparison && (
          <div style={{ display:"flex", justifyContent:"center", gap:32, flexWrap:"wrap", marginBottom:16 }}>
            {[
              { lbl:"vs Average Candidates", val:data.competitorComparison.vsAvgCandidate, col:"#7c5cfc" },
              { lbl:"vs Top Applicants",     val:data.competitorComparison.vsTopCandidate, col:"#5b8cff" },
            ].map(({lbl,val,col}) => (
              <div key={lbl} style={{ textAlign:"center" }}>
                <div style={{ fontSize:20, fontWeight:800, color:col }}>
                  Top {Math.max(1, 100-(clamp(val,0,100)))}%
                </div>
                <div style={{ fontSize:11, color:"#64748b" }}>{lbl}</div>
              </div>
            ))}
          </div>
        )}
        {data.salaryRange && (
          <div style={{ display:"inline-block", padding:"9px 20px", borderRadius:10,
            background:"#00e5a010", border:"1px solid #00e5a033", marginBottom:14 }}>
            <span style={{ color:"#64748b", fontSize:13 }}>💰 Market Value: </span>
            <span style={{ color:"#00e5a0", fontWeight:800, fontSize:15 }}>
              {data.salaryRange.currency||"AUD"} ${fmtSalary(data.salaryRange.min)} – ${fmtSalary(data.salaryRange.max)}
            </span>
          </div>
        )}
        {data.verdict && (
          <p style={{ color:"#94a3b8", fontSize:14, lineHeight:1.7, fontStyle:"italic",
            maxWidth:580, margin:"8px auto 16px" }}>"{data.verdict}"</p>
        )}

        {/* Optimize button */}
        <div>
          <button
            type="button"
            disabled={loading || optBusy || !resume.trim()}
            onClick={() => {
              setOptBusy(true);
              setCountdown(true);
              // Send the FULL resume — never trim it, truncation causes incomplete output
              const user = `${jobDesc.trim() ? `JOB DESCRIPTION:\n${jobDesc.slice(0,1000)}\n\n` : ""}RESUME TO OPTIMISE (return EVERY section in full):\n${resume}`;
              callAI(OPTIMIZE_SYSTEM, user, apiKey, 6000)
                .then(raw => extractJSON(raw))
                .then(parsed => handleOptimize({ ...parsed, originalScore: ov }))
                .catch(e => handleOptimize({ error: e.message }));
            }}
            style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"12px 24px",
              borderRadius:10, border:"1px solid #f5c84244",
              background:"linear-gradient(135deg,#f5c84218,#f59e0b18)",
              color:(loading||optBusy||!resume.trim())?"#94a3b8":"#f5c842",
              fontSize:14, fontWeight:700, fontFamily:"'DM Sans',sans-serif",
              cursor:(loading||optBusy||!resume.trim())?"not-allowed":"pointer",
              opacity:(loading||optBusy||!resume.trim())?0.55:1,
              transition:"all 0.2s", boxShadow:optBusy?"none":"0 0 20px #f5c84222" }}>
            {optBusy
              ? (<><span style={{ width:15,height:15,border:"2px solid #f5c84244",borderTopColor:"#f5c842",
                  borderRadius:"50%",display:"inline-block",animation:"riq-spin 0.8s linear infinite" }} />Optimising…</>)
              : <>✨ Optimise Resume for ATS</>}
          </button>
          {optBusy && <LoadingWithCountdown seconds={40} action="optimize" running={optBusy} />}
          <p style={{ fontSize:12, color:"#475569", marginTop:8 }}>
            Adds missing keywords · Strengthens bullet points · Boosts ATS score · Download as .docx
          </p>
        </div>
      </div>

      {/* Score breakdown */}
      {data.breakdown && (
        <div style={S.card}>
          <div style={S.sec()}>📊 Score Breakdown</div>
          {Object.entries(data.breakdown).map(([k,v]) => (
            <Bar key={k}
              label={k.replace(/([A-Z])/g," $1").replace(/^./,c=>c.toUpperCase())}
              score={v.score} max={v.max} feedback={v.feedback} />
          ))}
        </div>
      )}

      {/* Strengths + Fixes */}
      <div style={S.g2}>
        {data.topStrengths?.length > 0 && (
          <div style={S.card}>
            <div style={S.sec("#00e5a0")}>✅ Top Strengths</div>
            {data.topStrengths.map((s,i) => <div key={i} style={S.stripe(true)}>{s}</div>)}
          </div>
        )}
        {data.criticalFixes?.length > 0 && (
          <div style={S.card}>
            <div style={S.sec("#ff5b5b")}>🔧 Critical Fixes</div>
            {data.criticalFixes.map((f,i) => <div key={i} style={S.stripe(false)}>{f}</div>)}
          </div>
        )}
      </div>

      {/* Missing keywords */}
      {data.missingKeywords?.length > 0 && (
        <div style={S.card}>
          <div style={S.sec("#ff5b5b")}>🔑 Missing Keywords</div>
          <div>{data.missingKeywords.map((k,i) => <Chip key={i} text={k} color="#ff5b5b" />)}</div>
        </div>
      )}

      {/* Rewritten summary */}
      {data.rewrittenSummary && (
        <div style={S.card}>
          <div style={S.sec()}>✍️ AI-Rewritten Summary</div>
          <p style={{ color:"#94a3b8", fontSize:14, lineHeight:1.8, fontStyle:"italic", marginBottom:14 }}>
            "{data.rewrittenSummary}"
          </p>
          <button style={S.ghost} onClick={() => onCopy(data.rewrittenSummary)}>
            {copied ? "✅ Copied!" : "📋 Copy"}
          </button>
        </div>
      )}

      {/* Interview questions */}
      {data.interviewQuestions?.length > 0 && (
        <div style={S.card}>
          <div style={S.sec()}>💬 Predicted Interview Questions</div>
          {data.interviewQuestions.map((q,i) => (
            <div key={i} style={{ ...S.stripe(true), borderColor:"#7c5cfc", marginBottom:10 }}>
              Q{i+1}: {q}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// RESUME PREVIEW — renders uploaded resume in the exact DOCX visual format
// ═══════════════════════════════════════════════════════════════════════════════
function ResumePreview({ text }) {
  const parsed = useMemo(() => parseResumeText(text || ""), [text]);
  const { name, tagline, contactLines, sections } = parsed;

  const cl = s => String(s||"")
    .replace(/\*\*([^*]*)\*\*/g,"$1").replace(/\*([^*]*)\*/g,"$1")
    .replace(/^#+\s*/,"").trim();

  const isBul = raw => { const c=cl(raw); return /^[▪•\-–—]\s/.test(c)||/^▪\s/.test(c); };

  // Shared detection helpers — identical logic to _buildDocumentXml
  const isDateLine = s =>
    /\b\d{4}\b/.test(s) || /Present/.test(s) ||
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s/.test(s);
  const isLocLine  = s =>
    !isDateLine(s) && s.length < 70 &&
    /\bWA\b|\bNSW\b|\bVIC\b|\bQLD\b|\bSA\b|\bNT\b|\bACT\b|\bTAS\b/.test(s);
  const actionVerbRE = /^(Serve|Process|Perform|Liaise|Follow|Assist|Comply|Computer|Monitor|Maintain|Deliver|Achieve|Coordinate|Supervise|Manage|Handle|Support|Train|Work|Resolve|Adapt|Utilise|Utilize|Establish|Oversee|Lead|Build|Drive|Implement|Review|Report|Ensure|Prepare|Execute|Create)/i;
  const titleWordRE  = /(Administrator|Supervisor|Officer|Manager|Coordinator|Operator|Assistant|Specialist)/i;

  if (!name && sections.length === 0) return null;

  const FF   = '"Times New Roman", Times, serif';
  const NAVY = "#1B3A6B", NAVYL = "#E8EDF5", TEAL = "#0D7C77";
  const GR   = "#374151", MG = "#6B7280", LG = "#9CA3AF", AM = "#854D0E";

  // ── Experience section renderer ───────────────────────────────────────────
  // Groups items into job blocks: [title, company?, date/location, ...bullets]
  // Handles all formats seen in Jashan's resume
  const renderExperience = (items) => {
    const blocks = [];
    let i = 0;

    while (i < items.length) {
      const raw  = items[i] || "";
      const item = cl(raw);
      if (!item) { i++; continue; }

      // Bullet — not a job header
      if (isBul(raw)) {
        // Append to last block's bullets, or create orphan block
        const txt = item.replace(/^[▪•\-–—]\s*/,"").trim();
        if (blocks.length > 0) { blocks[blocks.length-1].bullets.push(txt); }
        else blocks.push({ title:"", company:"", dateLoc:[], bullets:[txt] });
        i++; continue;
      }

      // Check if this looks like a job title / header line
      // Job title heuristics: no bullet prefix, not a pure date, length reasonable
      const nextRaw  = items[i+1] || "";
      const next1    = cl(nextRaw);
      const next2    = cl(items[i+2] || "");

      const hasBar      = item.includes("|") && item.includes("–") === false;
      const looksDate   = isDateLine(item);
      const looksLoc    = isLocLine(item);
      const looksBullet = isBul(raw);

      // Auto-bullet: action verb lines in experience that aren't headers
      const isAutoBulletLine = actionVerbRE.test(item) && item.length > 40 && !titleWordRE.test(item.slice(0,60));

      if (!looksBullet && !looksDate && !looksLoc && !isAutoBulletLine) {
        // This is a job title or company line — start a new block
        const block = { title:"", company:"", dateLoc:[], bullets:[] };

        if (hasBar) {
          // "Job Title | Company Name" on one line — split on first |
          const [jobTitle, ...compParts] = item.split("|").map(p=>p.trim());
          block.title   = jobTitle;
          block.company = compParts.join(" | ");
        } else {
          block.title = item;
          // Peek: next line company?
          if (next1 && !isDateLine(next1) && !isLocLine(next1) && !isBul(nextRaw) && next1.length < 120 && !actionVerbRE.test(next1)) {
            block.company = next1;
            i++;
          }
        }

        // Collect date/location lines that follow
        while (i + 1 < items.length) {
          const peek    = cl(items[i+1] || "");
          const peekRaw = items[i+1] || "";
          if (!peek) { i++; continue; }
          if (isDateLine(peek) || isLocLine(peek)) {
            block.dateLoc.push(peek);
            i++;
          } else { break; }
        }

        blocks.push(block);
        i++; continue;
      }

      // Date/location orphan (no block started yet)
      if (looksDate || looksLoc) {
        if (blocks.length > 0) { blocks[blocks.length-1].dateLoc.push(item); }
        else blocks.push({ title:"", company:"", dateLoc:[item], bullets:[] });
        i++; continue;
      }

      // Auto-bullet line
      if (isAutoBulletLine) {
        const txt = item.trim();
        if (blocks.length > 0) { blocks[blocks.length-1].bullets.push(txt); }
        else blocks.push({ title:"", company:"", dateLoc:[], bullets:[txt] });
        i++; continue;
      }

      i++;
    }

    return blocks.map((block, bi) => {
      // Word count for this job block
      const jobWords = block.bullets.reduce((s,b) => s + b.split(/\s+/).filter(Boolean).length, 0);
      const wColor = jobWords >= 70 && jobWords <= 100 ? "#00e5a0"
        : jobWords > 100 ? "#ff5b5b" : "#f5c842";
      const wLabel = jobWords === 0 ? "" :
        jobWords < 70  ? `${jobWords}w ⚠️ too short (need 70–100)` :
        jobWords > 100 ? `${jobWords}w ❌ too long (need 70–100)` :
                         `${jobWords}w ✓`;
      return (
        <div key={bi} style={{
          marginTop: bi === 0 ? 4 : 14,
          borderLeft: `3px solid ${TEAL}`,
          paddingLeft: 10,
        }}>
          {/* Job title + word count badge */}
          <div style={{ display:"flex", justifyContent:"space-between",
            alignItems:"flex-start", gap:8, flexWrap:"wrap" }}>
            <div>
              {block.title && (
                <div style={{ fontWeight:700, fontSize:12, color:"#111827",
                  fontFamily:FF, lineHeight:1.3, marginBottom:1 }}>
                  {block.title}
                </div>
              )}
              {block.company && (
                <div style={{ fontSize:11, color:TEAL, fontStyle:"italic",
                  fontFamily:FF, lineHeight:1.3, marginBottom:2 }}>
                  {block.company}
                </div>
              )}
            </div>
            {wLabel && (
              <span style={{ fontSize:9, color:wColor, fontFamily:"monospace",
                whiteSpace:"nowrap", paddingTop:2, flexShrink:0,
                fontWeight:700 }}>
                {wLabel}
              </span>
            )}
          </div>
          {/* Date + Location */}
          {block.dateLoc.length > 0 && (
            <div style={{ fontSize:10, color:AM, fontStyle:"italic",
              fontFamily:FF, marginBottom:5, lineHeight:1.3 }}>
              {block.dateLoc.join("  ·  ")}
            </div>
          )}
          {/* Bullets */}
          {block.bullets.map((b, bi2) => {
            const bw = b.split(/\s+/).filter(Boolean).length;
            const tooLong = bw > 20;
            return (
              <div key={bi2} style={{ display:"flex", gap:7, marginBottom:3, lineHeight:1.35 }}>
                <span style={{ color:TEAL, fontWeight:700, flexShrink:0, fontSize:11, marginTop:1 }}>•</span>
                <span style={{ fontSize:11, textAlign:"justify", fontFamily:FF,
                  color: tooLong ? "#cc4444" : "#111827" }}>
                  {b}
                  {tooLong && (
                    <span style={{ fontSize:9, color:"#cc4444", marginLeft:4,
                      fontFamily:"monospace" }}>({bw}w)</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      );
    });
  };

  return (
    <div style={{ background:"#fff", borderRadius:12, padding:"28px 32px",
      boxShadow:"0 4px 32px rgba(0,0,0,0.18)", maxWidth:780, margin:"0 auto",
      fontFamily:FF, fontSize:11, color:"#111827", lineHeight:1.25 }}>

      {/* NAME */}
      <div style={{ borderLeft:`4px solid ${TEAL}`, paddingLeft:12, marginBottom:3 }}>
        <div style={{ fontSize:20, fontWeight:700, color:NAVY, fontFamily:FF }}>
          {cl(name)}
        </div>
      </div>

      {/* POSITION */}
      <div style={{ fontSize:13, color:TEAL, marginBottom:5, paddingLeft:16, fontFamily:FF }}>
        {tagline ? cl(tagline) : "Professional"}
      </div>

      {/* CONTACT */}
      {contactLines.map((line, ci) => {
        const sep   = line.includes("·") ? "·" : "|";
        const parts = line.split(sep).map(p => cl(p)).filter(Boolean);
        return (
          <div key={ci} style={{ textAlign:"center", fontSize:10, color:GR,
            marginBottom:2, fontFamily:FF }}>
            {parts.map((p, pi) => (
              <span key={pi}>
                {p}
                {pi < parts.length-1 &&
                  <span style={{ color:TEAL, fontWeight:700, margin:"0 4px" }}>·</span>}
              </span>
            ))}
          </div>
        );
      })}

      {/* TEAL DIVIDER */}
      <div style={{ borderBottom:`2px solid ${TEAL}`, margin:"8px 0 0" }} />

      {/* SECTIONS */}
      {sections.map((sec, si) => {
        const hh    = sec.header.toUpperCase().trim();
        const isExp   = /EXPERIENCE|EMPLOYMENT/.test(hh);
        const isSkill = /SKILL|COMPETENC/.test(hh);
        const isSys   = /SYSTEM|TECHNOLOG|CERTIF|ADDITIONAL|LICENC/.test(hh);
        const isEdu   = /EDUCATION|QUALIF/.test(hh);
        const items   = sec.items;

        const rows = [];
        let i = 0;

        if (isExp) {
          // Use the structured experience renderer
          // Count total experience words for the badge
          const expWordCount = items.reduce((sum, line) => {
            const c2 = cl(line);
            if (!c2 || isDateLine(c2) || isLocLine(c2)) return sum;
            return sum + c2.replace(/^[▪•\-–—]\s*/, "").trim().split(/\s+/).filter(Boolean).length;
          }, 0);
          const expBadgeColor = expWordCount >= 70 && expWordCount <= 100 ? "#00e5a0"
            : expWordCount > 100 ? "#ff5b5b" : "#f5c842";
          return (
            <div key={si} style={{ marginTop:14 }}>
              <div style={{ background:NAVYL, padding:"4px 10px",
                display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontWeight:700, fontSize:12, color:NAVY,
                  letterSpacing:"1.2px", fontFamily:FF }}>{hh}</span>
              </div>
              <div style={{ borderBottom:`1.5px solid ${TEAL}`, marginBottom:6 }} />
              <div>{renderExperience(items)}</div>
            </div>
          );
        }

        while (i < items.length) {
          const raw   = items[i] || "";
          const item  = cl(raw);
          const next1 = cl(items[i+1] || "");
          if (!item) { i++; continue; }

          const hasBullet = isBul(raw);
          const hasBar    = item.includes("|") && !hasBullet;
          const hasDate   = /\d{4}/.test(item) || /Present/.test(item);
          const bulletTxt = item.replace(/^[▪•\-–—]\s*/,"").trim();

          if (hasBullet) {
            const bw = bulletTxt.split(/\s+/).filter(Boolean).length;
            rows.push(
              <div key={i} style={{ display:"flex", gap:7, marginBottom:3, lineHeight:1.35 }}>
                <span style={{ color:TEAL, fontWeight:700, flexShrink:0, fontSize:11, marginTop:1 }}>•</span>
                <span style={{ fontSize:11, textAlign:"justify", fontFamily:FF,
                  color: bw > 20 ? "#cc4444" : "#111827" }}>
                  {bulletTxt}
                  {bw > 20 && <span style={{ fontSize:9, color:"#cc4444", marginLeft:4, fontFamily:"monospace" }}>({bw}w ❌)</span>}
                </span>
              </div>
            );
          } else if (isSkill || isSys) {
            const skillBatch = [];
            while (i < items.length) {
              const sRaw = items[i] || "";
              const sItem = cl(sRaw);
              if (!sItem || isBul(sRaw)) break;
              skillBatch.push(sItem);
              i++;
            }
            const cols = skillBatch.length <= 6 ? 2 : 3;
            rows.push(
              <div key={`sk-${si}-${i}`}
                style={{ display:"grid", gridTemplateColumns:`repeat(${cols}, 1fr)`, gap:"2px 4px", marginBottom:4 }}>
                {skillBatch.map((sk, ki) => sk ? (
                  <div key={ki} style={{ display:"flex", gap:5, alignItems:"flex-start", padding:"2px 4px", lineHeight:1.3 }}>
                    <span style={{ color:TEAL, fontWeight:700, flexShrink:0, fontSize:10, marginTop:1 }}>▪</span>
                    <span style={{ fontSize:10, color:"#111827", fontFamily:FF, lineHeight:1.3 }}>{sk}</span>
                  </div>
                ) : null)}
              </div>
            );
            continue;
          } else if (isEdu) {
            const eduDate = /\b\d{4}\b/.test(item) || /Completed|Current|Present/.test(item);
            const hasBar2 = item.includes("|");

            if (eduDate && hasBar2) {
              // "Institution  |  Completed 2026"
              const parts = item.split("|").map(p=>p.trim()).filter(Boolean);
              rows.push(
                <div key={i} style={{ display:"flex", gap:6, alignItems:"center",
                  marginBottom:4, flexWrap:"wrap", fontFamily:FF }}>
                  {parts.map((p,pi) => (
                    <span key={pi} style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:10, color: /\d{4}|Completed/.test(p) ? AM : MG,
                        fontStyle:"italic", fontFamily:FF }}>{p}</span>
                      {pi < parts.length-1 &&
                        <span style={{ color:LG, fontSize:10 }}>|</span>}
                    </span>
                  ))}
                </div>
              );
            } else if (eduDate) {
              // "Completed 2026" standalone
              rows.push(
                <div key={i} style={{ fontSize:10, color:AM, fontStyle:"italic",
                  marginBottom:4, fontFamily:FF }}>{item}</div>
              );
            } else if (hasBar2) {
              // "Institution | Date" — split into institution (teal italic) + date (amber italic)
              const [inst,...rest] = item.split("|").map(p=>p.trim());
              rows.push(
                <div key={i} style={{ marginBottom:4, fontFamily:FF }}>
                  <div style={{ fontSize:11, color:TEAL, fontStyle:"italic",
                    fontFamily:FF, marginBottom:1 }}>{inst}</div>
                  {rest.length > 0 && (
                    <div style={{ fontSize:10, color:AM, fontStyle:"italic", fontFamily:FF }}>
                      {rest.join(" | ")}
                    </div>
                  )}
                </div>
              );
            } else {
              // Qualification name — bold 12pt black
              rows.push(
                <div key={i} style={{ fontWeight:700, fontSize:12, color:"#111827",
                  marginBottom:2, fontFamily:FF }}>{item}</div>
              );
            }
          } else {
            // Word count badge for summary paragraph
            const isSummarySection = /SUMMARY|PROFILE|OBJECTIVE/.test(hh);
            const paraWords = item.split(/\s+/).filter(Boolean).length;
            const summaryAllWords = isSummarySection
              ? items.reduce((s,ln)=>s+cl(ln).split(/\s+/).filter(Boolean).length, 0) : 0;
            const swColor = summaryAllWords >= 100 && summaryAllWords <= 150 ? "#00e5a0"
              : summaryAllWords > 0 ? "#ff5b5b" : null;
            const swLabel = summaryAllWords > 0
              ? (summaryAllWords < 100 ? `${summaryAllWords}w ⚠️ too short (100–150)` :
                 summaryAllWords > 150 ? `${summaryAllWords}w ❌ too long (100–150)` :
                 `${summaryAllWords}w ✓`) : null;
            rows.push(
              <div key={i}>
                {isSummarySection && swLabel && i === 0 && (
                  <div style={{ fontSize:9, fontWeight:700, fontFamily:"monospace",
                    marginBottom:4, color:swColor }}>
                    {swLabel}
                  </div>
                )}
                <div style={{ fontSize:11, color:"#111827", marginBottom:3,
                  textAlign:"justify", lineHeight:1.35, fontFamily:FF }}>
                  {hasBullet
                    ? <><span style={{color:TEAL,fontWeight:700,marginRight:5}}>•</span>{bulletTxt}</>
                    : item}
                </div>
              </div>
            );
          }
          i++;
        }

        // Word count badge for PROFESSIONAL SUMMARY
        const summaryWC = hh.includes("SUMMARY") && rows.length > 0
          ? items.reduce((sum, line) => {
              const c2 = cl(line);
              return c2 ? sum + c2.split(/\s+/).filter(Boolean).length : sum;
            }, 0)
          : 0;
        const summaryBadge = summaryWC > 0
          ? { count: summaryWC,
              color: summaryWC >= 100 && summaryWC <= 150 ? "#00e5a0"
                : summaryWC < 100 ? "#f5c842" : "#ff5b5b",
              label: summaryWC < 100  ? `${summaryWC}w ⚠️ under 100`
                   : summaryWC > 150  ? `${summaryWC}w ❌ over 150`
                   :                    `${summaryWC}w ✓` }
          : null;

        return (
          <div key={si} style={{ marginTop:14 }}>
            <div style={{ background:NAVYL, padding:"4px 10px",
              display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontWeight:700, fontSize:12, color:NAVY,
                letterSpacing:"1.2px", fontFamily:FF }}>{hh}</span>
              {summaryBadge && (
                <span style={{ fontSize:9, fontWeight:700, fontFamily:"monospace",
                  color:summaryBadge.color, whiteSpace:"nowrap" }}>
                  {summaryBadge.label}
                </span>
              )}
            </div>
            <div style={{ borderBottom:`1.5px solid ${TEAL}`, marginBottom:6 }} />
            <div>{rows}</div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  // API key — persisted in localStorage, shown as collapsed pill on dashboard
  const [apiKey,    setApiKeyRaw] = useState(() => {
    try { return localStorage.getItem("riq_api_key") || ""; } catch(_){ return ""; }
  });
  const [keyOpen,   setKeyOpen]   = useState(false);

  const saveKey = useCallback((val) => {
    setApiKeyRaw(val);
    try {
      if (val.trim()) localStorage.setItem("riq_api_key", val.trim());
      else localStorage.removeItem("riq_api_key");
    } catch(_) {}
  }, []);

  const isKeyOk = apiKey.trim().startsWith("sk-ant-");

  // Shared state
  const [tab,         setTab]        = useState(0);
  const [resume,      setResume]     = useState("");
  const [jobDesc,     setJobDesc]    = useState("");
  const [scoreData,   setScoreData]  = useState(null);
  const [builtData,   setBuiltData]  = useState(null);
  const [ivData,      setIvData]     = useState(null);
  const [loading,     setLoading]    = useState(false);
  const [loadMsg,     setLoadMsg]    = useState("");
  const [err,         setErr]        = useState("");
  const [copied,      setCopied]     = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [form, setForm] = useState({ name:"",role:"",exp:"",skills:"",achievements:"",edu:"" });
  const resultRef = useRef(null);

  // Scroll to results
  useEffect(() => {
    if ((scoreData||builtData||ivData) && resultRef.current) {
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 100);
    }
  }, [scoreData, builtData, ivData]);

  const run = useCallback(async (system, user, onSuccess, msg, maxTokens=2048) => {
    setErr(""); setLoadMsg(msg); setLoading(true);
    try {
      const raw    = await callAI(system, user, apiKey, maxTokens);
      const parsed = extractJSON(raw);
      onSuccess(parsed);
    } catch(e) {
      setErr(e.message || "Something went wrong — please try again.");
    } finally { setLoading(false); }
  }, [apiKey]);

  const analyse = useCallback(() => {
    if (!resume.trim()) { setErr("Please paste your resume first."); return; }
    setScoreData(null);
    const user = jobDesc.trim()
      ? `Analyse this resume against the job description.\n\nRESUME:\n${resume}\n\nJOB DESCRIPTION:\n${jobDesc}`
      : `Analyse this resume thoroughly.\n\nRESUME:\n${resume}`;
    run(SCORE_SYSTEM, user, setScoreData, "Analysing your resume");
  }, [resume, jobDesc, run]);

  const buildResume = useCallback(() => {
    if (!form.name.trim()||!form.role.trim()) { setErr("Name and Target Role are required."); return; }
    setBuiltData(null);
    run(BUILD_SYSTEM,
      `Build a resume.\nName:${form.name}\nRole:${form.role}\nExperience:${form.exp||"n/a"}\nSkills:${form.skills||"n/a"}\nAchievements:${form.achievements||"n/a"}\nEducation:${form.edu||"n/a"}`,
      setBuiltData, "Building your resume");
  }, [form, run]);

  const prepInterview = useCallback(() => {
    if (!jobDesc.trim()) { setErr("Please paste a job description."); return; }
    setIvData(null);
    run(INTERVIEW_SYSTEM, `JOB DESCRIPTION:\n${jobDesc}`, setIvData, "Generating interview questions");
  }, [jobDesc, run]);

  const copy   = useCallback((t) => { safeCopy(t); setCopied(true); setTimeout(()=>setCopied(false),2200); }, []);
  const clrTab = useCallback((i) => {
    setTab(i); setErr(""); setScoreData(null); setBuiltData(null); setIvData(null);
  }, []);

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:"#080c14", color:"#e2e8f0", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-thumb{background:#ffffff22;border-radius:99px}
        textarea:focus,input:focus{border-color:#7c5cfc88!important;box-shadow:0 0 0 3px #7c5cfc14!important;outline:none!important}
        @keyframes riq-spin{to{transform:rotate(360deg)}}
        @keyframes riq-fade{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        .riq-fade{animation:riq-fade 0.4s ease forwards}
        button:hover:not(:disabled){opacity:0.86!important}
        button:active:not(:disabled){transform:scale(0.98)}
      `}</style>

      {/* BG glow */}
      <div style={{ position:"fixed", top:"-15%", left:"50%", transform:"translateX(-50%)",
        width:700, height:450,
        background:"radial-gradient(ellipse,#7c5cfc14 0%,#00e5a00d 45%,transparent 70%)",
        pointerEvents:"none", zIndex:0 }} />

      <div style={{ maxWidth:920, margin:"0 auto", padding:"0 20px 80px", position:"relative", zIndex:1 }}>

        {/* ── HEADER ── */}
        <div style={{ padding:"40px 0 20px", textAlign:"center" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"5px 14px",
            borderRadius:99, border:"1px solid #00e5a033", background:"#00e5a00e",
            color:"#00e5a0", fontSize:12, fontFamily:"'Space Mono',monospace", marginBottom:18 }}>
            ⚡ AI-Powered · 100% Free · No Sign-up
          </div>
          <h1 style={{ fontSize:"clamp(28px,6vw,52px)", fontWeight:800, lineHeight:1.1, marginBottom:10, letterSpacing:"-1px" }}>
            <span style={{ color:"#fff" }}>Resume</span>
            <span style={{ background:"linear-gradient(135deg,#7c5cfc,#00e5a0)",
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>IQ Pro</span>
          </h1>
          <p style={{ color:"#64748b", fontSize:15, maxWidth:480, margin:"0 auto 28px" }}>
            Score · Optimise · Build · Interview Prep — beats every $50/mo tool, free forever
          </p>

          {/* Market comparison */}
          <div style={{ ...S.card, overflowX:"auto", marginBottom:0 }}>
            <div style={S.sec()}>📊 vs Paid Market Leaders</div>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth:580 }}>
              <thead><tr>
                {["Platform","Price","ATS","Match","AI Write","Salary","Interview","Real-time"].map(h=>(
                  <th key={h} style={{ padding:"7px 10px", textAlign:h==="Platform"?"left":"center",
                    color:"#64748b", borderBottom:"1px solid rgba(255,255,255,0.07)",
                    fontFamily:"'Space Mono',monospace", fontSize:10, fontWeight:600 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {MARKET.map(r=>(
                  <tr key={r.name} style={{ background:r.star?"linear-gradient(90deg,#7c5cfc09,#00e5a007)":"transparent" }}>
                    <td style={{ padding:"9px 10px", fontWeight:r.star?800:400, color:r.star?"#00e5a0":"#94a3b8" }}>
                      {r.star&&"🏆 "}{r.name}
                    </td>
                    <td style={{ textAlign:"center", padding:"9px 10px", color:r.star?"#00e5a0":"#64748b", fontWeight:r.star?700:400 }}>{r.price}</td>
                    {[r.ats,r.match,r.ai,r.salary,r.iv,r.rt].map((v,i)=>(
                      <td key={i} style={{ textAlign:"center", padding:"9px 10px", fontSize:13 }}>{v?"✅":"❌"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── API KEY PILL ── */}
        <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:12 }}>
          {!keyOpen ? (
            <button onClick={()=>setKeyOpen(true)}
              style={{ display:"inline-flex", alignItems:"center", gap:6,
                padding:"6px 14px", borderRadius:99,
                border:`1px solid ${isKeyOk?"#00e5a033":"#f5c84266"}`,
                background: isKeyOk?"#00e5a00c":"#f5c8420c",
                color: isKeyOk?"#00e5a0":"#f5c842",
                fontSize:12, fontWeight:600,
                fontFamily:"'Space Mono',monospace", cursor:"pointer" }}>
              {isKeyOk ? "🔒 API Key Active" : "🔑 Add API Key"}
            </button>
          ) : (
            <div style={{ background:"rgba(255,255,255,0.03)",
              border:`1px solid ${isKeyOk?"#00e5a033":"#f5c84266"}`,
              borderRadius:12, padding:"12px 16px", width:"100%",
              display:"flex", flexWrap:"wrap", alignItems:"center", gap:10 }}>
              <div style={{ flex:"0 0 auto" }}>
                <div style={{ fontSize:12, fontWeight:700,
                  color:isKeyOk?"#00e5a0":"#f5c842",
                  fontFamily:"'Space Mono',monospace" }}>
                  {isKeyOk ? "✅ API Key Connected" : "🔑 Anthropic API Key"}
                </div>
                <div style={{ fontSize:11, color:"#475569", marginTop:2 }}>
                  {isKeyOk
                    ? "~$0.001 per analysis · get keys at console.anthropic.com"
                    : "Get your free key → console.anthropic.com → API Keys"}
                </div>
              </div>
              <div style={{ display:"flex", flex:"1 1 260px", gap:8, alignItems:"center" }}>
                <input
                  type="password"
                  placeholder="sk-ant-api03-…"
                  value={apiKey}
                  onChange={e => saveKey(e.target.value)}
                  style={{ flex:1, background:"rgba(255,255,255,0.05)",
                    border:`1px solid ${isKeyOk?"#00e5a044":"rgba(255,255,255,0.15)"}`,
                    borderRadius:8, padding:"8px 12px", color:"#e2e8f0",
                    fontSize:13, fontFamily:"'Space Mono',monospace", outline:"none" }}
                />
                <button onClick={()=>setKeyOpen(false)}
                  style={{ background:"none", border:"none", cursor:"pointer",
                    color:"#64748b", fontSize:20, lineHeight:1, padding:"4px 8px",
                    flexShrink:0 }}>✕</button>
              </div>
            </div>
          )}
        </div>

        {/* ── TABS ── */}
        <div style={{ display:"flex", gap:4, background:"rgba(255,255,255,0.04)",
          borderRadius:12, padding:4, marginBottom:24, overflowX:"auto" }}>
          {TABS.map((t,i)=>(
            <button key={t.label} onClick={()=>clrTab(i)}
              style={{ flex:"0 0 auto", padding:"10px 16px", borderRadius:9, border:"none",
                cursor:"pointer", fontSize:13, fontWeight:600, fontFamily:"'DM Sans',sans-serif",
                whiteSpace:"nowrap", transition:"all 0.2s",
                background:tab===i?"linear-gradient(135deg,#7c5cfc,#5b8cff)":"transparent",
                color:tab===i?"#fff":"#64748b",
                boxShadow:tab===i?"0 4px 20px #7c5cfc44":"none" }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <Alert msg={err} onClose={()=>setErr("")} />

        {/* ══ TAB 0 — SCORE ══════════════════════════════════════════════════ */}
        {tab===0 && (
          <div className="riq-fade">
            <div style={S.card}>
              <div style={S.sec()}>📄 Your Resume</div>
              <textarea style={S.ta} placeholder="Paste your full resume here…"
                value={resume} onChange={e=>setResume(e.target.value)} />
              <UploadBtn onText={t=>{ setResume(t); setShowPreview(true); }} disabled={loading} />
              {resume.trim() && (
                <div style={{ marginTop:12, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                  <button
                    onClick={()=>setShowPreview(v=>!v)}
                    style={{ display:"inline-flex", alignItems:"center", gap:6,
                      padding:"7px 14px", borderRadius:8,
                      border:`1px solid ${showPreview?"#7c5cfc44":"rgba(255,255,255,0.12)"}`,
                      background: showPreview?"#7c5cfc14":"rgba(255,255,255,0.04)",
                      color: showPreview?"#a78bfa":"#64748b",
                      fontSize:12, fontWeight:600, fontFamily:"inherit", cursor:"pointer" }}>
                    {showPreview ? "🔼 Hide Preview" : "👁️ Preview Resume"}
                  </button>
                  {showPreview && (
                    <span style={{ fontSize:11, color:"#475569",
                      fontFamily:"'Space Mono',monospace" }}>
                      Renders exactly as your downloaded .docx
                    </span>
                  )}
                </div>
              )}
            </div>
            {showPreview && resume.trim() && (
              <div className="riq-fade" style={{ marginBottom:20 }}>
                <div style={{ ...S.card, padding:"20px 24px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between",
                    alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
                    <div style={S.sec("#7c5cfc")}>👁️ Resume Preview</div>
                    <span style={{ fontSize:11, color:"#334155",
                      fontFamily:"'Space Mono',monospace" }}>
                      Same layout as your .docx download
                    </span>
                  </div>
                  <ResumePreview text={resume} />
                </div>
              </div>
            )}
            <div style={S.card}>
              <div style={S.sec()}>💼 Job Description
                <span style={{ color:"#334155", fontWeight:400, textTransform:"none", letterSpacing:"normal" }}>
                  {" "}(optional — improves accuracy)
                </span>
              </div>
              <textarea style={{ ...S.ta, minHeight:110 }}
                placeholder="Paste the job ad for a precise match score and keyword gap analysis…"
                value={jobDesc} onChange={e=>setJobDesc(e.target.value)} />
            </div>
            <button style={S.btn(loading)} disabled={loading} onClick={analyse}>
              {loading ? `🔍 ${loadMsg}…` : "⚡ Analyse My Resume — FREE"}
            </button>
            {loading && <LoadingWithCountdown seconds={30} action="analyse" running={loading} />}
            {scoreData && !loading && (
              <ScorePanel data={scoreData} copied={copied} onCopy={copy}
                resultRef={resultRef} resume={resume} jobDesc={jobDesc}
                loading={loading} apiKey={apiKey} />
            )}
          </div>
        )}

        {/* ══ TAB 1 — BUILD ══════════════════════════════════════════════════ */}
        {tab===1 && (
          <div className="riq-fade">
            <div style={S.card}>
              <div style={S.sec()}>🛠️ Your Details</div>
              <div style={S.g2}>
                {[
                  ["Full Name *",         "name",        "e.g. Anil Singh"],
                  ["Target Role *",       "role",        "e.g. Dispatch Officer"],
                  ["Years of Experience", "exp",         "e.g. 4 years in logistics"],
                  ["Key Skills",          "skills",      "e.g. SAP, Dispatch, WHS, Forklift"],
                ].map(([lbl,key,ph])=>(
                  <div key={key}>
                    <label style={S.lbl}>{lbl}</label>
                    <input style={S.inp} placeholder={ph}
                      value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop:14 }}>
                <label style={S.lbl}>Key Achievements <span style={{ color:"#334155",fontWeight:400 }}>(quantify where possible)</span></label>
                <textarea style={{ ...S.ta, minHeight:90 }}
                  placeholder="e.g. Processed 200+ daily shipments, reduced errors 30%…"
                  value={form.achievements} onChange={e=>setForm(f=>({...f,achievements:e.target.value}))} />
              </div>
              <div style={{ marginTop:12 }}>
                <label style={S.lbl}>Education</label>
                <input style={S.inp} placeholder="e.g. Master of IT, Southern Cross University, 2024"
                  value={form.edu} onChange={e=>setForm(f=>({...f,edu:e.target.value}))} />
              </div>
              <button style={S.btn(loading)} disabled={loading} onClick={buildResume}>
                {loading ? "🛠️ Building…" : "⚡ Generate My Resume — FREE"}
              </button>
            </div>
            {loading && <LoadingWithCountdown seconds={20} action="build" running={loading} />}
            {builtData && !loading && (
              <div ref={resultRef} className="riq-fade" style={{ marginTop:20 }}>
                <div style={S.card}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                    flexWrap:"wrap", gap:10, marginBottom:14 }}>
                    <div style={S.sec()}>📄 Your AI Resume</div>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <span style={{ padding:"4px 12px", background:"#00e5a015",
                        border:"1px solid #00e5a033", borderRadius:99,
                        color:"#00e5a0", fontSize:13, fontWeight:700 }}>
                        ATS: {clamp(builtData.atsScore,0,100)}/100
                      </span>
                      <button style={S.ghost} onClick={()=>copy(builtData.resume)}>
                        {copied?"✅ Copied!":"📋 Copy"}
                      </button>
                      <button style={{ ...S.ghost, borderColor:"#00e5a044", color:"#00e5a0", background:"#00e5a010" }}
                        onClick={()=>downloadDocx(builtData.resume, resumeFilename(builtData.resume, "Resume.docx"))}>
                        ⬇️ .docx
                      </button>
                    </div>
                  </div>
                  <pre style={{ whiteSpace:"pre-wrap", fontSize:13, color:"#94a3b8", lineHeight:1.85,
                    fontFamily:"inherit", background:"rgba(255,255,255,0.02)", padding:18,
                    borderRadius:10, border:"1px solid rgba(255,255,255,0.06)" }}>
                    {builtData.resume}
                  </pre>
                  {builtData.keywordsIncluded?.length > 0 && (
                    <div style={{ marginTop:14 }}>
                      <div style={{ ...S.sec("#00e5a0"), marginBottom:8 }}>✅ ATS Keywords Embedded</div>
                      {builtData.keywordsIncluded.map((k,i)=><Chip key={i} text={k} color="#00e5a0" />)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ TAB 2 — JOB MATCH ══════════════════════════════════════════════ */}
        {tab===2 && (
          <div className="riq-fade">
            <div style={S.card}>
              <div style={S.sec()}>🔍 Job Match Analyser</div>
              <label style={S.lbl}>Your Resume</label>
              <textarea style={S.ta} placeholder="Paste your resume…"
                value={resume} onChange={e=>setResume(e.target.value)} />
              <UploadBtn onText={setResume} disabled={loading} />
              <label style={{ ...S.lbl, marginTop:16 }}>Job Description</label>
              <textarea style={S.ta} placeholder="Paste the job ad…"
                value={jobDesc} onChange={e=>setJobDesc(e.target.value)} />
              <button style={S.btn(loading)} disabled={loading} onClick={analyse}>
                {loading ? "🔍 Matching…" : "⚡ Calculate My Match — FREE"}
              </button>
            </div>
            {loading && <LoadingWithCountdown seconds={30} action="analyse" running={loading} />}
            {scoreData && !loading && (
              <ScorePanel data={scoreData} copied={copied} onCopy={copy}
                resultRef={resultRef} resume={resume} jobDesc={jobDesc}
                loading={loading} apiKey={apiKey} />
            )}
          </div>
        )}

        {/* ══ TAB 3 — INTERVIEW ══════════════════════════════════════════════ */}
        {tab===3 && (
          <div className="riq-fade">
            <div style={S.card}>
              <div style={S.sec()}>💬 Interview Coach</div>
              <label style={S.lbl}>Job Description</label>
              <textarea style={S.ta}
                placeholder="Paste the job description for targeted questions with STAR tips…"
                value={jobDesc} onChange={e=>setJobDesc(e.target.value)} />
              <button style={S.btn(loading)} disabled={loading} onClick={prepInterview}>
                {loading ? "💬 Generating…" : "⚡ Generate Questions — FREE"}
              </button>
            </div>
            {loading && <LoadingWithCountdown seconds={20} action="interview" running={loading} />}
            {ivData && !loading && (
              <div ref={resultRef} className="riq-fade" style={{ marginTop:20 }}>
                {ivData.keyCompetencies?.length > 0 && (
                  <div style={S.card}>
                    <div style={S.sec()}>🎯 Key Competencies Assessed</div>
                    <div>{ivData.keyCompetencies.map((k,i)=><Chip key={i} text={k} color="#7c5cfc" />)}</div>
                  </div>
                )}
                {ivData.questions?.map((q,i)=>(
                  <div key={i} style={S.card}>
                    <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                      <span style={{ background:"linear-gradient(135deg,#7c5cfc,#5b8cff)",
                        borderRadius:99, width:28, height:28, minWidth:28,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:11, fontWeight:800, color:"#fff", flexShrink:0 }}>
                        Q{i+1}
                      </span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, color:"#e2e8f0", fontWeight:600,
                          marginBottom:8, lineHeight:1.5 }}>{q.q}</div>
                        <span style={{ padding:"2px 10px", background:"#7c5cfc14",
                          border:"1px solid #7c5cfc33", borderRadius:99,
                          color:"#7c5cfc", fontSize:11, fontFamily:"'Space Mono',monospace" }}>
                          {q.type}
                        </span>
                        {q.tip && (
                          <div style={{ marginTop:10, padding:"10px 14px",
                            background:"#00e5a008", border:"1px solid #00e5a022",
                            borderRadius:8, fontSize:12, color:"#64748b", lineHeight:1.6 }}>
                            💡 <strong style={{color:"#00e5a0"}}>Tip:</strong> {q.tip}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {ivData.redFlags?.length > 0 && (
                  <div style={S.card}>
                    <div style={S.sec("#ff5b5b")}>🚩 Watch Out For</div>
                    {ivData.redFlags.map((f,i)=>(
                      <div key={i} style={S.stripe(false)}>{f}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ TAB 4 — MARKET INTEL ═══════════════════════════════════════════ */}
        {tab===4 && (
          <div className="riq-fade">
            <div style={S.card}>
              <div style={S.sec()}>📈 Why ResumeIQ Pro Wins</div>
              <div style={S.g2}>
                {[
                  {icon:"🆓",title:"100% Free Forever",      desc:"No subscription. No credit card. Every feature free."},
                  {icon:"⚡",title:"Haiku AI — Ultra Cheap",  desc:"~$0.001 per analysis. $5 credit = 3,000+ optimisations."},
                  {icon:"🎯",title:"ATS Intelligence",        desc:"Reverse-engineers Applicant Tracking Systems used by 99% of employers."},
                  {icon:"✨",title:"One-Click Optimizer",     desc:"Rewrites to 95+ ATS score with before/after diff and instant .docx download."},
                  {icon:"🔑",title:"Keyword Gap Analysis",    desc:"Shows exactly which keywords recruiters and ATS are scanning for."},
                  {icon:"💬",title:"Interview Coach",         desc:"Role-specific questions with STAR-method coaching tips."},
                ].map((x,i)=>(
                  <div key={i} style={{ ...S.card, padding:18, marginBottom:0 }}>
                    <div style={{ fontSize:26, marginBottom:8 }}>{x.icon}</div>
                    <div style={{ fontWeight:700, fontSize:14, marginBottom:6 }}>{x.title}</div>
                    <div style={{ fontSize:13, color:"#64748b", lineHeight:1.6 }}>{x.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ ...S.green, textAlign:"center" }}>
              <div style={{ fontSize:28, marginBottom:10 }}>🚀</div>
              <div style={{ fontWeight:800, fontSize:18, marginBottom:6 }}>Save $600/year vs paid tools</div>
              <div style={{ color:"#64748b", fontSize:14 }}>
                Everything Jobscan + Teal + Zety offer — combined — completely free.
              </div>
            </div>
          </div>
        )}

        <div style={{ textAlign:"center", paddingTop:20, color:"#1e293b",
          fontSize:11, fontFamily:"'Space Mono',monospace" }}>
          ResumeIQ Pro v6 · Powered by Claude Haiku · Free for Job Seekers
        </div>
      </div>
    </div>
  );
}
