// ResumeIQ Pro — Next.js page (API calls go through /api/ai server route)
import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────────────────
function extractJSON(raw) {
  if (!raw || typeof raw !== "string" || !raw.trim()) throw new Error("API returned empty text.");
  let s = raw.replace(/```[a-zA-Z]*\n?/g,"").replace(/```/g,"").trim();
  try { return JSON.parse(s); } catch(_) {}
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a !== -1 && b > a) { try { return JSON.parse(s.slice(a,b+1)); } catch(_){} }
  throw new Error("Could not parse JSON. Raw: " + raw.slice(0,200));
}

function safeCopy(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(()=>fbCopy(text));
  } else fbCopy(text);
}
function fbCopy(text) {
  const el = Object.assign(document.createElement("textarea"),{value:text,style:"position:fixed;opacity:0"});
  document.body.appendChild(el); el.select();
  try { document.execCommand("copy"); } finally { document.body.removeChild(el); }
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCX BUILDER — zero dependencies, pure JS XML+ZIP, instant generation
// ─────────────────────────────────────────────────────────────────────────────

// No preload needed — pure JS, no CDN, no waiting
function preloadDocxLib() {}

// Parse plain-text resume into structured sections
function parseResumeText(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const SECTION_KEYWORDS = [
    "PROFESSIONAL SUMMARY","SUMMARY","EXECUTIVE SUMMARY","PROFILE","CAREER OBJECTIVE",
    "KEY SKILLS","SKILLS","CORE COMPETENCIES","TECHNICAL SKILLS","AREAS OF EXPERTISE",
    "PROFESSIONAL EXPERIENCE","EXPERIENCE","WORK EXPERIENCE","EMPLOYMENT HISTORY","EMPLOYMENT",
    "EDUCATION","QUALIFICATIONS","ACADEMIC BACKGROUND",
    "LICENCES","LICENSES","LICENCES & CERTIFICATIONS","CERTIFICATIONS","ACCREDITATIONS",
    "ACHIEVEMENTS","KEY ACHIEVEMENTS","AWARDS",
    "REFERENCES","REFEREES"
  ];
  const isSection = l => {
    const clean = l.toUpperCase().replace(/[^A-Z& ]/g, "").trim();
    return SECTION_KEYWORDS.some(k => clean === k || clean === k + "S");
  };
  const isBullet  = l => /^[▪•\-–—*]\s/.test(l);

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
    name:     headerLines[0] || "Resume",
    tagline:  headerLines[1] || "",
    contact:  headerLines.slice(2).join("  |  "),
    sections,
  };
}

// ── XML helpers ────────────────────────────────────────────────────────────
function xmlEsc(s) {
  return String(s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}

// ── Paragraph XML builders ──────────────────────────────────────────────────
function wPr(opts={}) {
  const parts = [];
  if (opts.spacing) parts.push(`<w:spacing w:before="${opts.spacing.before||0}" w:after="${opts.spacing.after||0}"/>`);
  if (opts.borderBottom) parts.push(`<w:pBdr><w:bottom w:val="single" w:sz="${opts.borderBottom.sz||6}" w:space="1" w:color="${opts.borderBottom.color||"000000"}"/></w:pBdr>`);
  if (opts.numId) parts.push(`<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${opts.numId}"/></w:numPr>`);
  return parts.length ? `<w:pPr>${parts.join("")}</w:pPr>` : "";
}

function wRPr(opts={}) {
  const parts = [];
  if (opts.bold)    parts.push("<w:b/><w:bCs/>");
  if (opts.italic)  parts.push("<w:i/><w:iCs/>");
  if (opts.size)    parts.push(`<w:sz w:val="${opts.size}"/><w:szCs w:val="${opts.size}"/>`);
  if (opts.color)   parts.push(`<w:color w:val="${opts.color}"/>`);
  if (opts.font)    parts.push(`<w:rFonts w:ascii="${opts.font}" w:hAnsi="${opts.font}" w:cs="${opts.font}"/>`);
  return parts.length ? `<w:rPr>${parts.join("")}</w:rPr>` : "";
}

function wRun(text, rOpts={}) {
  if (!text) return "";
  return `<w:r>${wRPr(rOpts)}<w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r>`;
}

function wPara(pOpts={}, runs="") {
  return `<w:p>${wPr(pOpts)}${runs}</w:p>`;
}

// ── Document XML builder ────────────────────────────────────────────────────
function buildDocumentXml(resumeText) {
  const { name, tagline, contact, sections } = parseResumeText(resumeText);

  const NAVY  = "1B3A6B";
  const GRAY  = "4A5568";
  const LGRAY = "94A3B8";
  const BLACK = "1A1A1A";
  const RULE  = "CBD5E0";
  const FONT  = "Calibri";

  let body = "";

  // Name
  body += wPara(
    { spacing:{before:0,after:40} },
    wRun(name, {bold:true, size:56, color:NAVY, font:FONT})
  );
  // Tagline
  if (tagline) body += wPara(
    { spacing:{before:0,after:40} },
    wRun(tagline, {size:26, color:GRAY, font:FONT})
  );
  // Contact
  if (contact) body += wPara(
    { spacing:{before:0,after:100} },
    wRun(contact, {size:20, color:LGRAY, font:FONT})
  );
  // Navy rule
  body += wPara({ spacing:{before:0,after:60}, borderBottom:{sz:8,color:NAVY} });

  for (const section of sections) {
    // Spacer
    body += wPara({ spacing:{before:180,after:0} });
    // Section heading
    body += wPara(
      { spacing:{before:0,after:60} },
      wRun(section.header.toUpperCase(), {bold:true, size:22, color:NAVY, font:FONT})
    );
    // Thin rule
    body += wPara({ spacing:{before:0,after:100}, borderBottom:{sz:2,color:RULE} });

    for (const item of section.items) {
      const isBullet = /^[▪•\-–—*]\s/.test(item);
      const hasBar   = item.includes("|") && !isBullet && item.length < 140;
      const hasDate  = /\d{4}/.test(item) && item.includes("•") && item.length < 90;

      if (isBullet) {
        const text = item.replace(/^[▪•\-–—*]\s*/, "");
        body += wPara(
          { spacing:{before:30,after:30}, numId:1 },
          wRun(text, {size:21, color:BLACK, font:FONT})
        );
      } else if (hasDate) {
        body += wPara(
          { spacing:{before:0,after:60} },
          wRun(item, {size:20, color:LGRAY, font:FONT, italic:true})
        );
      } else if (hasBar) {
        const [title, ...rest] = item.split("|").map(p=>p.trim());
        const runs = wRun(title, {bold:true, size:24, color:BLACK, font:FONT})
          + (rest.length ? wRun("  |  ", {size:22, color:LGRAY, font:FONT})
              + wRun(rest.join(" | "), {size:22, color:GRAY, font:FONT}) : "");
        body += wPara({ spacing:{before:140,after:20} }, runs);
      } else {
        body += wPara(
          { spacing:{before:40,after:40} },
          wRun(item, {size:22, color:BLACK, font:FONT})
        );
      }
    }
  }

  // Trailing empty para (Word requires it)
  body += "<w:p/>";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>
${body}
<w:sectPr>
  <w:pgSz w:w="11906" w:h="16838"/>
  <w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="709" w:footer="709" w:gutter="0"/>
</w:sectPr>
</w:body>
</w:document>`;
}

// ── Minimal DOCX ZIP assembler — no external lib needed ─────────────────────
// Uses JSZip which is already loaded for DOCX upload reading
async function buildDocxBuffer(resumeText) {
  // Ensure JSZip is loaded (already used for upload — will be cached)
  if (!window.JSZip) {
    await new Promise((res, rej) => {
      if (document.getElementById("jszip")) { 
        const poll = setInterval(()=>{ if(window.JSZip){clearInterval(poll);res();} },30);
        return;
      }
      const s = document.createElement("script");
      s.id="jszip"; s.src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      s.onload=res; s.onerror=()=>rej(new Error("JSZip failed"));
      document.head.appendChild(s);
    });
  }

  const docXml = buildDocumentXml(resumeText);
  const zip = new window.JSZip();

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`);

  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`);

  zip.file("word/document.xml", docXml);

  zip.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
      <w:sz w:val="22"/><w:szCs w:val="22"/>
      <w:lang w:val="en-AU"/>
    </w:rPr></w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1">
    <w:name w:val="Normal"/>
    <w:pPr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/></w:pPr>
  </w:style>
</w:styles>`);

  zip.file("word/numbering.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="&#x2022;"/>
      <w:lvlJc w:val="left"/>
      <w:pPr><w:ind w:left="400" w:hanging="240"/></w:pPr>
      <w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:cs="Symbol"/></w:rPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
</w:numbering>`);

  zip.file("word/settings.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:defaultTabStop w:val="709"/>
  <w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>
</w:settings>`);

  return await zip.generateAsync({ type:"uint8array", compression:"DEFLATE", compressionOptions:{level:1} });
}

// Download from a pre-built buffer (instant) or build+download in one step
async function downloadDocx(resumeText, filename = "Optimised_Resume.docx", preBuiltBuffer = null) {
  const buf  = preBuiltBuffer || await buildDocxBuffer(resumeText);
  const blob = new Blob([buf], { type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href:url, download:filename });
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCRIPT LOADER + FILE READER
// ─────────────────────────────────────────────────────────────────────────────
function loadScript(id, src) {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id);
    if (existing) {
      if (existing.dataset.loaded==="1") { resolve(); return; }
      existing.addEventListener("load", ()=>resolve());
      existing.addEventListener("error",()=>reject(new Error("Script failed: "+src)));
      return;
    }
    const s = document.createElement("script");
    s.id=id; s.src=src;
    s.onload  = ()=>{ s.dataset.loaded="1"; resolve(); };
    s.onerror = ()=>reject(new Error("Could not load: "+src));
    document.head.appendChild(s);
  });
}

async function readResumeFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt")) return await file.text();

  if (name.endsWith(".pdf")) {
    await loadScript("pdfjs","https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
    const lib = window["pdfjs-dist/build/pdf"];
    if (!lib) throw new Error("PDF.js failed to load.");
    lib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    const buf = await file.arrayBuffer();
    const pdf = await lib.getDocument({ data:new Uint8Array(buf) }).promise;
    let text = "";
    for (let i=1; i<=pdf.numPages; i++) {
      const page    = await pdf.getPage(i);
      const content = await page.getTextContent();
      let lastY = null;
      for (const item of content.items) {
        const y = item.transform?.[5];
        if (lastY!==null && Math.abs(y-lastY)>5) text+="\n";
        text += item.str;
        if (item.hasEOL) text+="\n";
        lastY=y;
      }
      text+="\n";
    }
    return text.replace(/\n{3,}/g,"\n\n").trim() ||
      "Could not extract text from this PDF — it may be scanned. Please paste manually.";
  }

  if (name.endsWith(".docx")||name.endsWith(".doc")) {
    await loadScript("jszip","https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");
    const JSZip = window.JSZip;
    if (!JSZip) throw new Error("JSZip failed to load.");
    const buf = await file.arrayBuffer();
    let zip;
    try { zip = await JSZip.loadAsync(buf); }
    catch(_) { throw new Error("Could not open as Word doc. Please save as .docx and retry."); }
    const docXml = zip.file("word/document.xml");
    if (!docXml) throw new Error("word/document.xml not found — invalid .docx file.");
    const xml = await docXml.async("string");
    const dom = new DOMParser().parseFromString(xml,"application/xml");
    const paras = dom.querySelectorAll("p");
    const lines = [];
    paras.forEach(p => {
      const line = Array.from(p.querySelectorAll("t")).map(t=>t.textContent).join("");
      if (line.trim()) lines.push(line.trim());
    });
    if (lines.length===0) {
      const allT = Array.from(dom.querySelectorAll("t")).map(t=>t.textContent).join(" ").trim();
      if (allT.length>30) return allT;
      throw new Error("Could not extract text. Please paste your resume manually.");
    }
    return lines.join("\n");
  }
  throw new Error("Unsupported file. Please upload .txt, .pdf, or .docx.");
}

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────
async function callAI(system, user) {
  // Calls our Next.js API route — keeps the Anthropic key secret on the server
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ system, user }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  if (!data.text) throw new Error("Empty response from server");
  return data.text;
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPTS
// ─────────────────────────────────────────────────────────────────────────────
const SCORE_SYSTEM = `You are an expert ATS resume analyst. Analyse the resume (and job description if provided). Respond with ONLY a JSON object — no markdown, no backticks, no text outside JSON.

Output this exact structure with real analysis values:
{"overallScore":85,"hireChance":78,"breakdown":{"atsCompatibility":{"score":21,"max":25,"feedback":"Strong keyword alignment"},"keywordDensity":{"score":16,"max":20,"feedback":"Good coverage of industry terms"},"impactMetrics":{"score":15,"max":20,"feedback":"Several quantified achievements"},"formatStructure":{"score":13,"max":15,"feedback":"Clean ATS-readable layout"},"relevanceMatch":{"score":18,"max":20,"feedback":"High relevance to target role"}},"topStrengths":["Strength one","Strength two","Strength three"],"criticalFixes":["Fix one","Fix two","Fix three"],"missingKeywords":["keyword1","keyword2","keyword3"],"salaryRange":{"min":75000,"max":95000,"currency":"AUD"},"competitorComparison":{"vsAvgCandidate":68,"vsTopCandidate":38},"interviewQuestions":["Question one?","Question two?","Question three?"],"rewrittenSummary":"Compelling 2-3 sentence professional summary.","verdict":"One sentence overall assessment."}

All score fields must be plain integers. salaryRange min/max must be plain integers. Analyse deeply and give specific honest feedback based on actual resume content.`;

const OPTIMIZE_SYSTEM = `You are an expert ATS resume optimizer. Your job is to take an existing resume and make it ATS-perfect by naturally weaving in missing keywords, strengthening impact statements with metrics, and improving every section. Respond with ONLY a JSON object — no markdown, no backticks, no text outside JSON.

Output this exact structure:
{"optimizedResume":"Full optimized resume text here with real line breaks as \\n","newAtsScore":96,"keywordsAdded":["keyword1","keyword2","keyword3"],"sectionsChanged":["Professional Summary — rewritten with stronger positioning","Skills — added 6 ATS keywords","Experience bullets — quantified 4 achievements","Added new Certifications section"],"improvements":[{"section":"Professional Summary","before":"Generic summary text","after":"Specific ATS-optimised summary"},{"section":"Skills","before":"Listed basic skills","after":"Added DIFOT, 3PL, ETA Management, Load Planning"},{"section":"Experience Bullet 1","before":"Coordinated freight dispatch","after":"Coordinated 200+ daily freight dispatches achieving 98% DIFOT across WA mining sites"}],"verdict":"Concise statement of how much improvement was made."}

Rules:
- newAtsScore must be a plain integer between 92 and 99 (genuinely excellent but honest)
- keywordsAdded must list every keyword you added
- sectionsChanged must list every section you modified
- improvements must show real before/after for the most impactful changes (3-6 examples)
- The optimized resume must be complete and ready to submit — not a summary
- Preserve all real experience, dates, companies — only enhance wording and add keywords naturally
- Never invent fake jobs, qualifications, or achievements`;

const BUILD_SYSTEM = `You are an expert resume writer. Create a professional ATS-optimised resume then respond with ONLY a JSON object — no markdown, no backticks, no text outside JSON.

Output this exact structure:
{"resume":"Full resume text here","atsScore":88,"keywordsIncluded":["keyword1","keyword2"]}

Make it specific, achievement-focused, and tailored to the target role. Use action verbs. Include quantified results.`;

const INTERVIEW_SYSTEM = `You are an expert interview coach. Generate targeted interview preparation then respond with ONLY a JSON object — no markdown, no backticks, no text outside JSON.

Output this exact structure:
{"questions":[{"q":"Question?","type":"Behavioural","tip":"Answer tip using STAR method"},{"q":"Question?","type":"Technical","tip":"Key points to cover"},{"q":"Question?","type":"Situational","tip":"How to frame your answer"}],"keyCompetencies":["Competency one","Competency two"],"redFlags":["Watch out for this","Common mistake"]}

Generate 6-8 questions mixing all three types. Base everything specifically on the job description.`;

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { label:"Score Resume",   icon:"🎯" },
  { label:"Build Resume",   icon:"🛠️" },
  { label:"Job Match",      icon:"🔍" },
  { label:"Interview Prep", icon:"💬" },
  { label:"Market Intel",   icon:"📈" },
];
const MARKET = [
  { name:"ResumeIQ Pro", price:"FREE",       ats:true, match:true, ai:true, salary:true, iv:true, rt:true, star:true },
  { name:"Jobscan",      price:"$49.95/mo",  ats:true, match:true, ai:false,salary:false,iv:false,rt:false },
  { name:"Teal HQ",      price:"$29/mo",     ats:true, match:true, ai:false,salary:false,iv:false,rt:false },
  { name:"Kickresume",   price:"$19/mo",     ats:true, match:false,ai:true, salary:false,iv:false,rt:false },
  { name:"Zety",         price:"$23.99/mo",  ats:false,match:false,ai:false,salary:false,iv:false,rt:false },
  { name:"Resume.io",    price:"$24.95/mo",  ats:false,match:false,ai:false,salary:false,iv:false,rt:false },
];

// ─────────────────────────────────────────────────────────────────────────────
// MICRO COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function Gauge({ score, max=100, size=148 }) {
  const v = Math.min(Math.max(Number(score)||0,0),max);
  const r = (size-22)/2, circ=2*Math.PI*r, arc=circ*0.75;
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
  const v=Math.min(Math.max(Number(score)||0,0),Number(max)||1), m=Number(max)||1;
  const pct=(v/m)*100, col=pct>=75?"#00e5a0":pct>=50?"#f5c842":"#ff5b5b";
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

function Spinner({ msg }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:20, padding:"56px 0" }}>
      <div style={{ position:"relative", width:64, height:64 }}>
        {[0,1,2].map(i=>(
          <div key={i} style={{ position:"absolute", inset:i*9, border:"2px solid transparent",
            borderTopColor:["#00e5a0","#7c5cfc","#f5c842"][i], borderRadius:"50%",
            animation:`riq-spin ${1+i*0.3}s linear infinite ${i%2?"reverse":""}` }} />
        ))}
      </div>
      <p style={{ color:"#94a3b8", fontSize:14, fontFamily:"'Space Mono',monospace", margin:0 }}>{msg}…</p>
    </div>
  );
}

function Alert({ msg, onClose }) {
  if (!msg) return null;
  return (
    <div style={{ display:"flex", gap:10, alignItems:"flex-start", justifyContent:"space-between",
      background:"#ff5b5b12", border:"1px solid #ff5b5b44", borderRadius:10,
      padding:"13px 16px", marginBottom:18, color:"#ff5b5b", fontSize:14, lineHeight:1.5 }}>
      <span style={{ flex:1 }}>⚠️ {msg}</span>
      <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer",
        color:"#ff5b5b", fontSize:20, lineHeight:1, padding:0 }}>×</button>
    </div>
  );
}

function UploadBtn({ onText, disabled }) {
  const [busy, setBusy] = useState(false);
  const [ok,   setOk]   = useState(false);
  const [hint, setHint] = useState("");
  const ref = useRef(null);
  const handle = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true); setOk(false); setHint("");
    try {
      const text = await readResumeFile(file);
      onText(text); setOk(true); setHint(file.name);
      setTimeout(()=>{ setOk(false); setHint(""); }, 3500);
    } catch(err) {
      setHint(err.message); setTimeout(()=>setHint(""), 4500);
    } finally { setBusy(false); e.target.value=""; }
  };
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:10, flexWrap:"wrap" }}>
      <input ref={ref} type="file" accept=".txt,.pdf,.doc,.docx" style={{ display:"none" }} onChange={handle} />
      <button type="button" disabled={disabled||busy} onClick={()=>ref.current?.click()}
        style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"9px 16px", borderRadius:9,
          border:`1px solid ${ok?"#00e5a044":"rgba(255,255,255,0.13)"}`,
          background:ok?"#00e5a014":"rgba(255,255,255,0.05)",
          color:ok?"#00e5a0":"#94a3b8", fontSize:13, fontWeight:600, fontFamily:"'DM Sans',sans-serif",
          cursor:(disabled||busy)?"not-allowed":"pointer", opacity:(disabled||busy)?0.6:1, transition:"all 0.2s" }}>
        {busy ? (<><span style={{ width:14,height:14,border:"2px solid #7c5cfc44",borderTopColor:"#7c5cfc",borderRadius:"50%",display:"inline-block",animation:"riq-spin 0.7s linear infinite" }} />Reading…</>) :
         ok   ? <>✅ Loaded!</> : <>📎 Upload Resume</>}
      </button>
      <span style={{ fontSize:11, color:hint.length>40?"#ff5b5b":"#64748b", fontFamily:"'Space Mono',monospace", maxWidth:260, lineHeight:1.4 }}>
        {hint||"Supports .txt  .pdf  .docx"}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTIMIZE BUTTON
// ─────────────────────────────────────────────────────────────────────────────
function OptimizeBtn({ resume, jobDesc, originalScore, onResult, disabled }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!resume.trim()) return;
    setBusy(true);
    try {
      const user = `Optimise this resume for maximum ATS score. Add all missing keywords naturally, strengthen every bullet with metrics, improve the professional summary.
${jobDesc.trim() ? `\nJOB DESCRIPTION (target keywords from this):\n${jobDesc}\n` : ""}
RESUME TO OPTIMISE:
${resume}`;
      const raw    = await callAI(OPTIMIZE_SYSTEM, user);
      const parsed = extractJSON(raw);
      onResult({ ...parsed, originalScore: originalScore||0 });
    } catch(e) {
      onResult({ error: e.message });
    } finally { setBusy(false); }
  };
  return (
    <button type="button" disabled={disabled||busy||!resume.trim()} onClick={run}
      style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"11px 20px", borderRadius:10,
        border:"1px solid #f5c84244", background:"linear-gradient(135deg,#f5c84218,#f59e0b18)",
        color:busy?"#94a3b8":"#f5c842", fontSize:14, fontWeight:700, fontFamily:"'DM Sans',sans-serif",
        cursor:(disabled||busy||!resume.trim())?"not-allowed":"pointer",
        opacity:(disabled||busy||!resume.trim())?0.55:1,
        transition:"all 0.2s", marginTop:12, boxShadow:busy?"none":"0 0 20px #f5c84222" }}>
      {busy
        ? (<><span style={{ width:15,height:15,border:"2px solid #f5c84244",borderTopColor:"#f5c842",borderRadius:"50%",display:"inline-block",animation:"riq-spin 0.8s linear infinite" }} />Optimising…</>)
        : <>✨ Optimise Resume for ATS</>}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTIMIZE RESULTS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function OptimizePanel({ data, resultRef }) {
  const [copied,    setCopied]    = useState(false);
  const [dlBusy,    setDlBusy]    = useState(false);
  const [dlDone,    setDlDone]    = useState(false);
  const [dlErr,     setDlErr]     = useState("");
  const [docxBuffer,setDocxBuffer]= useState(null);

  // Pre-build DOCX in background as soon as data arrives — download becomes instant
  useEffect(() => {
    if (!data || data.error || !data.optimizedResume) return;
    setDocxBuffer(null);
    buildDocxBuffer(data.optimizedResume).then(setDocxBuffer).catch(() => {});
  }, [data]);

  if (!data) return null;
  if (data.error) return (
    <div style={{ background:"#ff5b5b12", border:"1px solid #ff5b5b44", borderRadius:12,
      padding:20, marginTop:20, color:"#ff5b5b", fontSize:14 }}>
      ⚠️ Optimisation failed: {data.error}
    </div>
  );

  const oldScore = Number(data.originalScore)||0;
  const newScore = Number(data.newAtsScore)||0;
  const diff     = newScore - oldScore;

  const handleDownload = async () => {
    if (dlBusy) return;
    setDlBusy(true); setDlErr("");
    try {
      // Use pre-built buffer if available (instant) — otherwise build now (rare)
      await downloadDocx(data.optimizedResume, "Optimised_Resume.docx", docxBuffer || null);
      setDlDone(true); setTimeout(()=>setDlDone(false), 4000);
    } catch(e) {
      setDlErr(e.message || "Download failed");
      setTimeout(()=>setDlErr(""), 5000);
    } finally { setDlBusy(false); }
  };

  return (
    <div ref={resultRef} className="riq-fade" style={{ marginTop:28 }}>

      {/* ── Score comparison banner ── */}
      <div style={{ background:"linear-gradient(135deg,rgba(245,200,66,0.08),rgba(0,229,160,0.06))",
        border:"1px solid rgba(245,200,66,0.25)", borderRadius:16, padding:28, marginBottom:20, textAlign:"center" }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#f5c842", textTransform:"uppercase",
          letterSpacing:"1.8px", marginBottom:20, fontFamily:"'Space Mono',monospace" }}>
          ✨ ATS Optimisation Complete
        </div>

        {/* Before / After gauges */}
        <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:16, flexWrap:"wrap", marginBottom:24 }}>
          {/* Before */}
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:11, color:"#64748b", fontFamily:"'Space Mono',monospace", marginBottom:8, textTransform:"uppercase", letterSpacing:"1px" }}>Before</div>
            <div style={{ position:"relative", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
              <Gauge score={oldScore} size={130} />
              <div style={{ position:"absolute", textAlign:"center" }}>
                <div style={{ fontSize:22, fontWeight:800, color:"#ff5b5b", lineHeight:1 }}>{oldScore}</div>
                <div style={{ fontSize:9, color:"#64748b", fontFamily:"'Space Mono',monospace" }}>ATS SCORE</div>
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
            <div style={{ fontSize:28, color:"#f5c842" }}>→</div>
            <div style={{ padding:"4px 12px", borderRadius:99, background:"#00e5a018",
              border:"1px solid #00e5a044", color:"#00e5a0", fontSize:13, fontWeight:800,
              fontFamily:"'Space Mono',monospace" }}>
              +{diff} pts
            </div>
          </div>

          {/* After */}
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:11, color:"#64748b", fontFamily:"'Space Mono',monospace", marginBottom:8, textTransform:"uppercase", letterSpacing:"1px" }}>After</div>
            <div style={{ position:"relative", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
              <Gauge score={newScore} size={130} />
              <div style={{ position:"absolute", textAlign:"center" }}>
                <div style={{ fontSize:22, fontWeight:800, color:"#00e5a0", lineHeight:1 }}>{newScore}</div>
                <div style={{ fontSize:9, color:"#64748b", fontFamily:"'Space Mono',monospace" }}>ATS SCORE</div>
              </div>
            </div>
          </div>
        </div>

        {/* Score bar comparison */}
        <div style={{ maxWidth:480, margin:"0 auto 20px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ fontSize:12, color:"#64748b" }}>Before: {oldScore}/100</span>
            <span style={{ fontSize:12, color:"#00e5a0", fontWeight:700 }}>After: {newScore}/100</span>
          </div>
          <div style={{ height:10, borderRadius:99, background:"rgba(255,255,255,0.07)", overflow:"hidden", position:"relative" }}>
            <div style={{ position:"absolute", height:"100%", width:`${oldScore}%`, borderRadius:99, background:"#ff5b5b66" }} />
            <div style={{ position:"absolute", height:"100%", width:`${newScore}%`, borderRadius:99,
              background:"linear-gradient(90deg,#f5c84277,#00e5a0)",
              boxShadow:"0 0 12px #00e5a055", transition:"width 1.2s ease" }} />
          </div>
        </div>

        {data.verdict && (
          <p style={{ color:"#94a3b8", fontSize:14, lineHeight:1.7, fontStyle:"italic", maxWidth:580, margin:"0 auto 20px" }}>
            "{data.verdict}"
          </p>
        )}

        {/* Download button */}
        <button onClick={handleDownload} disabled={dlBusy}
          style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"13px 28px", borderRadius:12,
            border:"none",
            background: dlBusy ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg,#00e5a0,#00b377)",
            color: dlBusy ? "#64748b" : "#000", fontSize:15, fontWeight:800, fontFamily:"inherit",
            cursor: dlBusy ? "not-allowed" : "pointer",
            boxShadow: dlBusy ? "none" : "0 4px 24px #00e5a044", transition:"all 0.2s" }}>
          {dlBusy
            ? (<><span style={{ width:16, height:16, border:"2px solid #64748b44", borderTopColor:"#64748b",
                borderRadius:"50%", display:"inline-block", animation:"riq-spin 0.8s linear infinite" }} />Building .docx…</>)
            : dlDone ? "✅ Downloaded!"
            : docxBuffer ? "⚡ Download Optimised Resume (.docx)"
            : "⬇️ Download Optimised Resume (.docx)"}
        </button>
        {docxBuffer && !dlDone && !dlBusy && (
          <p style={{ fontSize:11, color:"#00e5a0", marginTop:6, fontFamily:"'Space Mono',monospace" }}>
            ⚡ File ready — download is instant
          </p>
        )}
        {dlErr && <p style={{ color:"#ff5b5b", fontSize:12, marginTop:8 }}>⚠️ {dlErr}</p>}
      </div>

      {/* ── Keywords added ── */}
      {data.keywordsAdded?.length>0 && (
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:24, marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#00e5a0", textTransform:"uppercase", letterSpacing:"1.8px", marginBottom:16, fontFamily:"'Space Mono',monospace" }}>
            🔑 Keywords Added ({data.keywordsAdded.length})
          </div>
          <div>{data.keywordsAdded.map((k,i)=><Chip key={i} text={k} color="#00e5a0" />)}</div>
        </div>
      )}

      {/* ── Sections changed ── */}
      {data.sectionsChanged?.length>0 && (
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:24, marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#7c5cfc", textTransform:"uppercase", letterSpacing:"1.8px", marginBottom:16, fontFamily:"'Space Mono',monospace" }}>
            📝 Sections Changed ({data.sectionsChanged.length})
          </div>
          {data.sectionsChanged.map((s,i)=>(
            <div key={i} style={{ fontSize:13, color:"#94a3b8", marginBottom:8, paddingLeft:12,
              borderLeft:"2px solid #7c5cfc", lineHeight:1.5 }}>✓ {s}</div>
          ))}
        </div>
      )}

      {/* ── Before / After improvements ── */}
      {data.improvements?.length>0 && (
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:24, marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#f5c842", textTransform:"uppercase", letterSpacing:"1.8px", marginBottom:20, fontFamily:"'Space Mono',monospace" }}>
            🔄 Before vs After — Key Changes
          </div>
          {data.improvements.map((item,i)=>(
            <div key={i} style={{ marginBottom:20, paddingBottom:20, borderBottom: i<data.improvements.length-1?"1px solid rgba(255,255,255,0.06)":"none" }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#f5c842", marginBottom:12,
                fontFamily:"'Space Mono',monospace", textTransform:"uppercase", letterSpacing:"0.8px" }}>
                {item.section}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div style={{ padding:"12px 14px", background:"#ff5b5b0a", border:"1px solid #ff5b5b22",
                  borderRadius:10, fontSize:13, color:"#94a3b8", lineHeight:1.6 }}>
                  <div style={{ fontSize:10, color:"#ff5b5b", fontWeight:700, fontFamily:"'Space Mono',monospace",
                    marginBottom:6, textTransform:"uppercase", letterSpacing:"1px" }}>❌ Before</div>
                  {item.before}
                </div>
                <div style={{ padding:"12px 14px", background:"#00e5a00a", border:"1px solid #00e5a022",
                  borderRadius:10, fontSize:13, color:"#e2e8f0", lineHeight:1.6 }}>
                  <div style={{ fontSize:10, color:"#00e5a0", fontWeight:700, fontFamily:"'Space Mono',monospace",
                    marginBottom:6, textTransform:"uppercase", letterSpacing:"1px" }}>✅ After</div>
                  {item.after}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Full optimised resume ── */}
      {data.optimizedResume && (
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:24, marginBottom:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12, marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#7c5cfc", textTransform:"uppercase", letterSpacing:"1.8px", fontFamily:"'Space Mono',monospace" }}>
              📄 Full Optimised Resume
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>{ safeCopy(data.optimizedResume); setCopied(true); setTimeout(()=>setCopied(false),2200); }}
                style={{ padding:"8px 16px", borderRadius:9, border:"1px solid rgba(255,255,255,0.14)",
                  background:"rgba(255,255,255,0.05)", color:"#94a3b8", fontSize:13, fontWeight:600,
                  fontFamily:"inherit", cursor:"pointer" }}>
                {copied?"✅ Copied!":"📋 Copy"}
              </button>
              <button onClick={handleDownload} disabled={dlBusy}
                style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"8px 16px", borderRadius:9,
                  border:"1px solid #00e5a044", background:"#00e5a014",
                  color: dlBusy ? "#64748b" : "#00e5a0", fontSize:13, fontWeight:600,
                  fontFamily:"inherit", cursor: dlBusy ? "not-allowed" : "pointer", opacity: dlBusy?0.6:1 }}>
                {dlBusy
                  ? (<><span style={{ width:12, height:12, border:"2px solid #64748b44", borderTopColor:"#64748b",
                      borderRadius:"50%", display:"inline-block", animation:"riq-spin 0.7s linear infinite" }} />Building…</>)
                  : dlDone ? "✅ Done!" : "⬇️ Download .docx"}
              </button>
            </div>
          </div>
          <pre style={{ whiteSpace:"pre-wrap", fontSize:13, color:"#94a3b8", lineHeight:1.9,
            fontFamily:"inherit", background:"rgba(255,255,255,0.02)", padding:20,
            borderRadius:10, border:"1px solid rgba(255,255,255,0.06)" }}>
            {data.optimizedResume}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORE PANEL
// ─────────────────────────────────────────────────────────────────────────────
const S = {
  card:   { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:24, marginBottom:20 },
  hiCard: { background:"linear-gradient(135deg,rgba(124,92,252,0.09),rgba(0,229,160,0.05))", border:"1px solid rgba(124,92,252,0.22)", borderRadius:16, padding:28, marginBottom:20, textAlign:"center" },
  ta:     { width:"100%", minHeight:160, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.11)", borderRadius:12, padding:16, color:"#e2e8f0", fontSize:14, fontFamily:"inherit", resize:"vertical", outline:"none", boxSizing:"border-box", lineHeight:1.7 },
  inp:    { width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.11)", borderRadius:10, padding:"12px 16px", color:"#e2e8f0", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" },
  lbl:    { fontSize:13, color:"#94a3b8", marginBottom:6, display:"block", fontWeight:600 },
  sec:    { fontSize:11, fontWeight:700, color:"#7c5cfc", textTransform:"uppercase", letterSpacing:"1.8px", marginBottom:16, fontFamily:"'Space Mono',monospace" },
  btn:    (dis)=>({ padding:"14px 28px", borderRadius:12, border:"none", width:"100%", marginTop:14, fontSize:15, fontWeight:700, fontFamily:"inherit", letterSpacing:"0.3px", cursor:dis?"not-allowed":"pointer", background:dis?"rgba(255,255,255,0.07)":"linear-gradient(135deg,#7c5cfc,#5b8cff)", color:dis?"#475569":"#fff", boxShadow:dis?"none":"0 4px 24px #7c5cfc44", opacity:dis?0.65:1, transition:"opacity 0.2s" }),
  ghost:  { padding:"9px 18px", borderRadius:9, border:"1px solid rgba(255,255,255,0.14)", background:"rgba(255,255,255,0.05)", color:"#94a3b8", fontSize:13, fontWeight:600, fontFamily:"inherit", cursor:"pointer" },
  g2:     { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))", gap:16 },
  stripe: (on)=>({ fontSize:13, color:"#94a3b8", marginBottom:10, paddingLeft:12, borderLeft:`2px solid ${on?"#00e5a0":"#ff5b5b"}`, lineHeight:1.5 }),
};

function ScorePanel({ data, copied, onCopy, resultRef, resume, jobDesc, loading }) {
  const [optData,    setOptData]    = useState(null);
  const [optLoading, setOptLoading] = useState(false);
  const optRef = useRef(null);

  useEffect(()=>{
    if (optData && optRef.current) {
      setTimeout(()=>optRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 100);
    }
  },[optData]);

  if (!data) return null;
  const ov=Number(data.overallScore)||0, hc=Number(data.hireChance)||0;
  const ovc=ov>=75?"#00e5a0":ov>=50?"#f5c842":"#ff5b5b";
  const hcc=hc>=65?"#00e5a0":hc>=40?"#f5c842":"#ff5b5b";

  return (
    <div ref={resultRef} className="riq-fade" style={{ marginTop:32 }}>
      {/* Overview */}
      <div style={S.hiCard}>
        <div style={S.sec}>🎯 Career Intelligence Report</div>
        <div style={{ display:"flex", justifyContent:"center", gap:40, flexWrap:"wrap", marginBottom:20 }}>
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
          <div style={{ display:"flex", justifyContent:"center", gap:36, flexWrap:"wrap", marginBottom:16 }}>
            {[{lbl:"vs Average Candidates",val:data.competitorComparison.vsAvgCandidate,col:"#7c5cfc"},
              {lbl:"vs Top Applicants",val:data.competitorComparison.vsTopCandidate,col:"#5b8cff"}].map(({lbl,val,col})=>(
              <div key={lbl} style={{ textAlign:"center" }}>
                <div style={{ fontSize:22, fontWeight:800, color:col }}>Top {Math.max(1,100-(Number(val)||0))}%</div>
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
              {data.salaryRange.currency||"AUD"} ${Number(data.salaryRange.min||0).toLocaleString()} – ${Number(data.salaryRange.max||0).toLocaleString()}
            </span>
          </div>
        )}
        {data.verdict && (
          <p style={{ color:"#94a3b8", fontSize:14, lineHeight:1.7, fontStyle:"italic", maxWidth:600, margin:"8px auto 16px" }}>
            "{data.verdict}"
          </p>
        )}
        {/* ✨ OPTIMIZE BUTTON — lives inside the score card */}
        <div style={{ marginTop:8 }}>
          <OptimizeBtn
            resume={resume}
            jobDesc={jobDesc}
            originalScore={ov}
            disabled={loading||optLoading}
            onResult={(res)=>{ setOptLoading(false); setOptData(res); }}
          />
          <p style={{ fontSize:12, color:"#475569", marginTop:8 }}>
            Adds missing keywords, strengthens bullet points, boosts ATS score — then download instantly
          </p>
        </div>
      </div>

      {/* Breakdown */}
      {data.breakdown && (
        <div style={S.card}>
          <div style={S.sec}>📊 Score Breakdown</div>
          {Object.entries(data.breakdown).map(([k,v])=>(
            <Bar key={k} label={k.replace(/([A-Z])/g," $1").replace(/^./,c=>c.toUpperCase())}
              score={v.score} max={v.max} feedback={v.feedback} />
          ))}
        </div>
      )}

      {/* Strengths + Fixes */}
      <div style={S.g2}>
        {data.topStrengths?.length>0 && (
          <div style={S.card}>
            <div style={S.sec}>✅ Top Strengths</div>
            {data.topStrengths.map((s,i)=><div key={i} style={S.stripe(true)}>{s}</div>)}
          </div>
        )}
        {data.criticalFixes?.length>0 && (
          <div style={S.card}>
            <div style={S.sec}>🔧 Critical Fixes</div>
            {data.criticalFixes.map((f,i)=><div key={i} style={S.stripe(false)}>{f}</div>)}
          </div>
        )}
      </div>

      {/* Missing keywords */}
      {data.missingKeywords?.length>0 && (
        <div style={S.card}>
          <div style={S.sec}>🔑 Missing Keywords — Add to Beat ATS</div>
          <div>{data.missingKeywords.map((k,i)=><Chip key={i} text={k} color="#ff5b5b" />)}</div>
        </div>
      )}

      {/* Rewritten summary */}
      {data.rewrittenSummary && (
        <div style={S.card}>
          <div style={S.sec}>✍️ AI-Rewritten Professional Summary</div>
          <p style={{ color:"#94a3b8", fontSize:14, lineHeight:1.8, fontStyle:"italic", marginBottom:16 }}>"{data.rewrittenSummary}"</p>
          <button style={S.ghost} onClick={()=>onCopy(data.rewrittenSummary)}>{copied?"✅ Copied!":"📋 Copy"}</button>
        </div>
      )}

      {/* Interview questions */}
      {data.interviewQuestions?.length>0 && (
        <div style={S.card}>
          <div style={S.sec}>💬 Predicted Interview Questions</div>
          {data.interviewQuestions.map((q,i)=>(
            <div key={i} style={{ ...S.stripe(true), borderColor:"#7c5cfc", marginBottom:10 }}>Q{i+1}: {q}</div>
          ))}
        </div>
      )}

      {/* Optimize results */}
      <OptimizePanel data={optData} resultRef={optRef} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,       setTab]       = useState(0);
  const [resume,    setResume]    = useState("");
  const [jobDesc,   setJobDesc]   = useState("");
  const [scoreData, setScoreData] = useState(null);
  const [builtData, setBuiltData] = useState(null);
  const [ivData,    setIvData]    = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [loadMsg,   setLoadMsg]   = useState("");
  const [err,       setErr]       = useState("");
  const [copied,    setCopied]    = useState(false);
  const [form, setForm] = useState({ name:"", role:"", exp:"", skills:"", achievements:"", edu:"" });
  const resultRef = useRef(null);

  // Preload docx.js the instant the app mounts — user never waits on click
  useEffect(() => { preloadDocxLib(); }, []);

  useEffect(()=>{
    if ((scoreData||builtData||ivData) && resultRef.current) {
      setTimeout(()=>resultRef.current?.scrollIntoView({ behavior:"smooth", block:"start" }), 100);
    }
  },[scoreData,builtData,ivData]);

  const run = async (system, user, onSuccess, msg) => {
    setErr(""); setLoadMsg(msg); setLoading(true);
    try {
      const raw    = await callAI(system, user);
      const parsed = extractJSON(raw);
      onSuccess(parsed);
    } catch(e) { setErr(e.message||"Something went wrong — please try again."); }
    finally    { setLoading(false); }
  };

  const analyse = () => {
    if (!resume.trim()) { setErr("Please paste your resume first."); return; }
    setScoreData(null);
    const user = jobDesc.trim()
      ? `Analyse this resume against the job description.\n\nRESUME:\n${resume}\n\nJOB DESCRIPTION:\n${jobDesc}`
      : `Analyse this resume thoroughly.\n\nRESUME:\n${resume}`;
    run(SCORE_SYSTEM, user, setScoreData, "AI scanning your resume");
  };

  const buildResume = () => {
    if (!form.name.trim()||!form.role.trim()) { setErr("Name and Target Role are required."); return; }
    setBuiltData(null);
    run(BUILD_SYSTEM,
      `Build a professional ATS-optimised resume.\nName: ${form.name}\nTarget Role: ${form.role}\nExperience: ${form.exp||"not provided"}\nSkills: ${form.skills||"not provided"}\nAchievements: ${form.achievements||"not provided"}\nEducation: ${form.edu||"not provided"}`,
      setBuiltData, "Building your ATS-optimised resume");
  };

  const prepInterview = () => {
    if (!jobDesc.trim()) { setErr("Please paste a job description first."); return; }
    setIvData(null);
    run(INTERVIEW_SYSTEM, `Generate targeted interview prep.\n\nJOB DESCRIPTION:\n${jobDesc}`, setIvData, "Generating interview questions");
  };

  const copy = (text) => { safeCopy(text); setCopied(true); setTimeout(()=>setCopied(false),2200); };
  const switchTab = (i) => { setTab(i); setErr(""); setScoreData(null); setBuiltData(null); setIvData(null); };

  return (
    <div style={{ minHeight:"100vh", background:"#080c14", color:"#e2e8f0", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-thumb{background:#ffffff22;border-radius:99px}
        textarea:focus,input:focus{border-color:#7c5cfc88!important;box-shadow:0 0 0 3px #7c5cfc14!important;outline:none!important}
        @keyframes riq-spin{to{transform:rotate(360deg)}}
        @keyframes riq-fade{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .riq-fade{animation:riq-fade 0.45s ease forwards}
        button:hover:not(:disabled){opacity:0.85!important}
      `}</style>
      <div style={{ position:"fixed", top:"-15%", left:"50%", transform:"translateX(-50%)", width:700, height:450,
        background:"radial-gradient(ellipse,#7c5cfc14 0%,#00e5a00d 45%,transparent 70%)",
        pointerEvents:"none", zIndex:0 }} />

      <div style={{ maxWidth:920, margin:"0 auto", padding:"0 20px 80px", position:"relative", zIndex:1 }}>

        {/* HEADER */}
        <div style={{ padding:"44px 0 24px", textAlign:"center" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"5px 14px", borderRadius:99,
            border:"1px solid #00e5a033", background:"#00e5a00e", color:"#00e5a0",
            fontSize:12, fontFamily:"'Space Mono',monospace", marginBottom:20 }}>
            ⚡ AI-Powered • 100% Free • No Sign-up
          </div>
          <h1 style={{ fontSize:"clamp(30px,6vw,52px)", fontWeight:800, lineHeight:1.1, marginBottom:12, letterSpacing:"-1px" }}>
            <span style={{ color:"#fff" }}>Resume</span>
            <span style={{ background:"linear-gradient(135deg,#7c5cfc,#00e5a0)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>IQ Pro</span>
          </h1>
          <p style={{ color:"#64748b", fontSize:16, maxWidth:520, margin:"0 auto 32px" }}>
            The world's most advanced AI resume platform — beats every $50/mo competitor, completely free.
          </p>
          <div style={{ ...S.card, overflowX:"auto" }}>
            <div style={S.sec}>📊 vs Paid Market Leaders</div>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth:600 }}>
              <thead><tr>
                {["Platform","Price","ATS Score","Job Match","AI Write","Salary","Interview","Real-time"].map(h=>(
                  <th key={h} style={{ padding:"7px 10px", textAlign:h==="Platform"?"left":"center", color:"#64748b",
                    borderBottom:"1px solid rgba(255,255,255,0.07)", fontFamily:"'Space Mono',monospace", fontSize:10, fontWeight:600 }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{MARKET.map(r=>(
                <tr key={r.name} style={{ background:r.star?"linear-gradient(90deg,#7c5cfc09,#00e5a007)":"transparent" }}>
                  <td style={{ padding:"10px", fontWeight:r.star?800:400, color:r.star?"#00e5a0":"#94a3b8" }}>{r.star&&"🏆 "}{r.name}</td>
                  <td style={{ textAlign:"center", padding:"10px", color:r.star?"#00e5a0":"#64748b", fontWeight:r.star?700:400 }}>{r.price}</td>
                  {[r.ats,r.match,r.ai,r.salary,r.iv,r.rt].map((v,i)=>(
                    <td key={i} style={{ textAlign:"center", padding:"10px", fontSize:14 }}>{v?"✅":"❌"}</td>
                  ))}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>

        {/* TABS */}
        <div style={{ display:"flex", gap:4, background:"rgba(255,255,255,0.04)", borderRadius:12, padding:4, marginBottom:28, overflowX:"auto" }}>
          {TABS.map((t,i)=>(
            <button key={t.label} onClick={()=>switchTab(i)}
              style={{ flex:"0 0 auto", padding:"10px 16px", borderRadius:9, border:"none", cursor:"pointer",
                fontSize:13, fontWeight:600, fontFamily:"'DM Sans',sans-serif", whiteSpace:"nowrap", transition:"all 0.2s",
                background:tab===i?"linear-gradient(135deg,#7c5cfc,#5b8cff)":"transparent",
                color:tab===i?"#fff":"#64748b", boxShadow:tab===i?"0 4px 20px #7c5cfc44":"none" }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <Alert msg={err} onClose={()=>setErr("")} />

        {/* TAB 0 — SCORE */}
        {tab===0 && (
          <div className="riq-fade">
            <div style={S.card}>
              <div style={S.sec}>📄 Paste Your Resume</div>
              <textarea style={S.ta} placeholder="Paste your full resume text here…"
                value={resume} onChange={e=>setResume(e.target.value)} />
              <UploadBtn onText={setResume} disabled={loading} />
            </div>
            <div style={S.card}>
              <div style={S.sec}>💼 Job Description <span style={{ color:"#334155", fontWeight:400 }}>(optional — greatly improves accuracy)</span></div>
              <textarea style={{ ...S.ta, minHeight:110 }}
                placeholder="Paste the job ad to get a precise match score and missing keywords…"
                value={jobDesc} onChange={e=>setJobDesc(e.target.value)} />
            </div>
            <button style={S.btn(loading)} disabled={loading} onClick={analyse}>
              {loading?"🔍 Analysing…":"⚡ Analyse My Resume — FREE"}
            </button>
            {loading && <Spinner msg={loadMsg} />}
            {scoreData && !loading && (
              <ScorePanel data={scoreData} copied={copied} onCopy={copy}
                resultRef={resultRef} resume={resume} jobDesc={jobDesc} loading={loading} />
            )}
          </div>
        )}

        {/* TAB 1 — BUILD */}
        {tab===1 && (
          <div className="riq-fade">
            <div style={S.card}>
              <div style={S.sec}>🛠️ Your Details</div>
              <div style={S.g2}>
                {[["Full Name *","name","e.g. Anil Singh"],["Target Role *","role","e.g. Dispatch Officer"],
                  ["Years of Experience","exp","e.g. 4 years in freight & logistics"],
                  ["Key Skills","skills","e.g. SAP S/4HANA, Dispatch, WHS, Forklift LF"]
                ].map(([lbl,key,ph])=>(
                  <div key={key}>
                    <label style={S.lbl}>{lbl}</label>
                    <input style={S.inp} placeholder={ph} value={form[key]}
                      onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop:16 }}>
                <label style={S.lbl}>Key Achievements <span style={{ color:"#334155", fontWeight:400 }}>(numbers are powerful)</span></label>
                <textarea style={{ ...S.ta, minHeight:100 }}
                  placeholder="e.g. Processed 200+ daily shipments, reduced errors by 30%, managed Woodside Energy contract…"
                  value={form.achievements} onChange={e=>setForm(f=>({...f,achievements:e.target.value}))} />
              </div>
              <div style={{ marginTop:14 }}>
                <label style={S.lbl}>Education</label>
                <input style={S.inp} placeholder="e.g. Master of IT, Southern Cross University, 2024"
                  value={form.edu} onChange={e=>setForm(f=>({...f,edu:e.target.value}))} />
              </div>
              <button style={S.btn(loading)} disabled={loading} onClick={buildResume}>
                {loading?"🛠️ Building…":"⚡ Generate My Resume — FREE"}
              </button>
            </div>
            {loading && <Spinner msg={loadMsg} />}
            {builtData && !loading && (
              <div ref={resultRef} className="riq-fade" style={{ marginTop:24 }}>
                <div style={S.card}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12, marginBottom:16 }}>
                    <div style={S.sec}>📄 Your AI Resume</div>
                    <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                      <span style={{ padding:"4px 12px", background:"#00e5a015", border:"1px solid #00e5a033",
                        borderRadius:99, color:"#00e5a0", fontSize:13, fontWeight:700 }}>
                        ATS: {Number(builtData.atsScore)||0}/100
                      </span>
                      <button style={S.ghost} onClick={()=>copy(builtData.resume)}>{copied?"✅ Copied!":"📋 Copy"}</button>
                      <button style={{ ...S.ghost, borderColor:"#00e5a044", color:"#00e5a0", background:"#00e5a010" }}
                        onClick={()=>downloadDocx(builtData.resume,"Built_Resume.docx")}>⬇️ Download .docx</button>
                    </div>
                  </div>
                  <pre style={{ whiteSpace:"pre-wrap", fontSize:13, color:"#94a3b8", lineHeight:1.9,
                    fontFamily:"inherit", background:"rgba(255,255,255,0.02)", padding:20,
                    borderRadius:10, border:"1px solid rgba(255,255,255,0.06)" }}>
                    {builtData.resume}
                  </pre>
                  {builtData.keywordsIncluded?.length>0 && (
                    <div style={{ marginTop:16 }}>
                      <div style={{ ...S.sec, marginBottom:10 }}>✅ ATS Keywords Embedded</div>
                      {builtData.keywordsIncluded.map((k,i)=><Chip key={i} text={k} color="#00e5a0" />)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2 — JOB MATCH */}
        {tab===2 && (
          <div className="riq-fade">
            <div style={S.card}>
              <div style={S.sec}>🔍 Job Match Analyser</div>
              <label style={S.lbl}>Your Resume</label>
              <textarea style={S.ta} placeholder="Paste your resume…" value={resume} onChange={e=>setResume(e.target.value)} />
              <UploadBtn onText={setResume} disabled={loading} />
              <label style={{ ...S.lbl, marginTop:16 }}>Job Description</label>
              <textarea style={S.ta} placeholder="Paste the job ad…" value={jobDesc} onChange={e=>setJobDesc(e.target.value)} />
              <button style={S.btn(loading)} disabled={loading} onClick={analyse}>
                {loading?"🔍 Matching…":"⚡ Calculate My Match — FREE"}
              </button>
            </div>
            {loading && <Spinner msg={loadMsg} />}
            {scoreData && !loading && (
              <ScorePanel data={scoreData} copied={copied} onCopy={copy}
                resultRef={resultRef} resume={resume} jobDesc={jobDesc} loading={loading} />
            )}
          </div>
        )}

        {/* TAB 3 — INTERVIEW */}
        {tab===3 && (
          <div className="riq-fade">
            <div style={S.card}>
              <div style={S.sec}>💬 Interview Coach</div>
              <label style={S.lbl}>Job Description</label>
              <textarea style={S.ta}
                placeholder="Paste the job description to get role-specific questions with STAR-method tips…"
                value={jobDesc} onChange={e=>setJobDesc(e.target.value)} />
              <button style={S.btn(loading)} disabled={loading} onClick={prepInterview}>
                {loading?"💬 Generating…":"⚡ Generate Questions — FREE"}
              </button>
            </div>
            {loading && <Spinner msg={loadMsg} />}
            {ivData && !loading && (
              <div ref={resultRef} className="riq-fade" style={{ marginTop:24 }}>
                {ivData.keyCompetencies?.length>0 && (
                  <div style={S.card}>
                    <div style={S.sec}>🎯 Key Competencies Being Assessed</div>
                    <div>{ivData.keyCompetencies.map((k,i)=><Chip key={i} text={k} color="#7c5cfc" />)}</div>
                  </div>
                )}
                {ivData.questions?.map((q,i)=>(
                  <div key={i} style={S.card}>
                    <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                      <span style={{ background:"linear-gradient(135deg,#7c5cfc,#5b8cff)", borderRadius:99,
                        width:28, height:28, minWidth:28, display:"flex", alignItems:"center",
                        justifyContent:"center", fontSize:11, fontWeight:800, color:"#fff", flexShrink:0 }}>Q{i+1}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, color:"#e2e8f0", fontWeight:600, marginBottom:8, lineHeight:1.5 }}>{q.q}</div>
                        <span style={{ padding:"2px 10px", background:"#7c5cfc14", border:"1px solid #7c5cfc33",
                          borderRadius:99, color:"#7c5cfc", fontSize:11, fontFamily:"'Space Mono',monospace" }}>{q.type}</span>
                        {q.tip && (
                          <div style={{ marginTop:10, padding:"10px 14px", background:"#00e5a008",
                            border:"1px solid #00e5a022", borderRadius:8, fontSize:12, color:"#64748b", lineHeight:1.6 }}>
                            💡 <strong style={{ color:"#00e5a0" }}>Tip:</strong> {q.tip}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {ivData.redFlags?.length>0 && (
                  <div style={S.card}>
                    <div style={S.sec}>🚩 Watch Out For</div>
                    {ivData.redFlags.map((f,i)=><div key={i} style={{ ...S.stripe(false), marginBottom:10 }}>{f}</div>)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 4 — MARKET INTEL */}
        {tab===4 && (
          <div className="riq-fade">
            <div style={S.card}>
              <div style={S.sec}>📈 Why ResumeIQ Pro Wins</div>
              <div style={S.g2}>
                {[{icon:"🆓",title:"100% Free Forever",desc:"No subscription, no credit card. Every feature free."},
                  {icon:"⚡",title:"Real-Time Claude AI",desc:"Powered by Claude — the most capable AI model available."},
                  {icon:"🎯",title:"ATS Intelligence",desc:"Reverse-engineers ATS used by 99% of top employers."},
                  {icon:"✨",title:"One-Click Optimizer",desc:"Rewrites your resume to 95+ ATS score with before/after comparison and instant download."},
                  {icon:"🔑",title:"Keyword Gap Analysis",desc:"Identifies exactly which keywords recruiters are scanning for."},
                  {icon:"💬",title:"Interview Coach",desc:"Role-specific questions with STAR-method tips built in."},
                ].map((x,i)=>(
                  <div key={i} style={{ ...S.card, padding:20, marginBottom:0 }}>
                    <div style={{ fontSize:28, marginBottom:10 }}>{x.icon}</div>
                    <div style={{ fontWeight:700, fontSize:15, marginBottom:8 }}>{x.title}</div>
                    <div style={{ fontSize:13, color:"#64748b", lineHeight:1.6 }}>{x.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ ...S.hiCard }}>
              <div style={{ fontSize:32, marginBottom:12 }}>🚀</div>
              <div style={{ fontWeight:800, fontSize:20, marginBottom:8 }}>Save $600/year vs paid tools</div>
              <div style={{ color:"#64748b", fontSize:14 }}>Everything Jobscan, Teal & Zety offer — combined — completely free.</div>
            </div>
          </div>
        )}

        <div style={{ textAlign:"center", paddingTop:20, color:"#1e293b", fontSize:11, fontFamily:"'Space Mono',monospace" }}>
          ResumeIQ Pro v5 • Powered by Claude AI • Free for Job Seekers
        </div>
      </div>
    </div>
  );
}
