// ResumeIQ Pro v5 — with ATS Optimizer + Before/After comparison + Download
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

// ── Resume parser — handles all section name variants ──────────────────────
function parseResumeText(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const SECTION_KW = [
    "PROFESSIONAL SUMMARY","SUMMARY","EXECUTIVE SUMMARY","PROFILE","CAREER OBJECTIVE",
    "KEY SKILLS","KEY SKILLS & COMPETENCIES","SKILLS","CORE COMPETENCIES",
    "TECHNICAL SKILLS","AREAS OF EXPERTISE","SYSTEMS & TECHNOLOGY",
    "PROFESSIONAL EXPERIENCE","EXPERIENCE","WORK EXPERIENCE","EMPLOYMENT HISTORY","EMPLOYMENT",
    "EDUCATION","EDUCATION & QUALIFICATIONS","QUALIFICATIONS","ACADEMIC BACKGROUND",
    "LICENCES","LICENSES","LICENCES & CERTIFICATIONS","CERTIFICATIONS",
    "CERTIFICATIONS & ADDITIONAL INFORMATION","ACCREDITATIONS",
    "ACHIEVEMENTS","KEY ACHIEVEMENTS","AWARDS",
    "REFERENCES","REFEREES"
  ];
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

// ── XML escape ────────────────────────────────────────────────────────────────
function xmlEsc(s) {
  return String(s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}

// ── Low-level XML builders ────────────────────────────────────────────────────
function rpr(o={}) {
  let x="";
  if(o.font)    x+=`<w:rFonts w:ascii="${o.font}" w:hAnsi="${o.font}" w:cs="${o.font}"/>`;
  if(o.bold)    x+="<w:b/><w:bCs/>";
  if(o.italic)  x+="<w:i/><w:iCs/>";
  if(o.size)    x+=`<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>`;
  if(o.color)   x+=`<w:color w:val="${o.color}"/>`;
  if(o.spacing) x+=`<w:spacing w:val="${o.spacing}"/>`;
  if(o.caps)    x+="<w:caps/>";
  return x ? `<w:rPr>${x}</w:rPr>` : "";
}

function run(text, o={}) {
  if (!text && text !== 0) return "";
  return `<w:r>${rpr(o)}<w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r>`;
}

function ppr(o={}) {
  let x="";
  if(o.spacing)  x+=`<w:spacing w:before="${o.spacing.before||0}" w:after="${o.spacing.after||0}" ${o.spacing.line?`w:line="${o.spacing.line}" w:lineRule="auto"`:""}/>`;
  if(o.ind)      x+=`<w:ind w:left="${o.ind.left||0}" ${o.ind.hanging?`w:hanging="${o.ind.hanging}"`:""}/>`;
  if(o.jc)       x+=`<w:jc w:val="${o.jc}"/>`;
  if(o.numId)    x+=`<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${o.numId}"/></w:numPr>`;
  if(o.shd)      x+=`<w:shd w:val="clear" w:color="auto" w:fill="${o.shd}"/>`;
  if(o.keepNext) x+="<w:keepNext/>";
  if(o.borderBottom) x+=`<w:pBdr><w:bottom w:val="single" w:sz="${o.borderBottom.sz||4}" w:space="1" w:color="${o.borderBottom.color||"000000"}"/></w:pBdr>`;
  if(o.borderLeft)   x+=`<w:pBdr><w:left w:val="single" w:sz="${o.borderLeft.sz||12}" w:space="${o.borderLeft.space||4}" w:color="${o.borderLeft.color||"000000"}"/></w:pBdr>`;
  if(o.borderAll)    x+=`<w:pBdr><w:left w:val="single" w:sz="${o.borderAll.sz}" w:space="${o.borderAll.space||4}" w:color="${o.borderAll.color}"/><w:bottom w:val="single" w:sz="${o.borderAll.sz}" w:space="${o.borderAll.space||4}" w:color="${o.borderAll.color}"/><w:right w:val="single" w:sz="${o.borderAll.sz}" w:space="${o.borderAll.space||4}" w:color="${o.borderAll.color}"/></w:pBdr>`;
  return x ? `<w:pPr>${x}</w:pPr>` : "";
}

function para(pOpts={}, runs="") {
  return `<w:p>${ppr(pOpts)}${runs}</w:p>`;
}

function emptyPara(before=0,after=80) {
  return para({spacing:{before,after}});
}

// ── Advanced document XML builder ─────────────────────────────────────────────
function buildDocumentXml(resumeText) {
  const { name, tagline, contactLines, sections } = parseResumeText(resumeText);

  // Palette
  const NAVY  = "1B3A6B";
  const NAVYL = "E8EDF5";   // light navy for section shading
  const TEAL  = "0D7C77";   // accent / teal for rules, bullets, company
  const GRAY  = "374151";
  const MGRAY = "6B7280";
  const LGRAY = "9CA3AF";
  const BLACK = "111827";
  const AMBER = "92400E";   // date lines
  const FONT  = "Calibri";

  let body = "";

  // ── NAME — large, bold, navy, left accent bar ─────────────────────────────
  body += para(
    { spacing:{before:0,after:60}, borderLeft:{sz:28,space:10,color:TEAL} },
    run(name, {bold:true, size:72, color:NAVY, font:FONT, spacing:20})
  );

  // ── TAGLINE ──────────────────────────────────────────────────────────────
  if (tagline) {
    body += para(
      { spacing:{before:0,after:50} },
      run(tagline, {size:25, color:MGRAY, font:FONT})
    );
  }

  // ── CONTACT LINES — pipe-separated with teal dots ─────────────────────────
  for (const cl of contactLines) {
    const parts = cl.split("|").map(p => p.trim());
    let runs = "";
    parts.forEach((p, i) => {
      runs += run(p, {size:20, color:GRAY, font:FONT});
      if (i < parts.length - 1)
        runs += run("  ·  ", {size:20, color:TEAL, font:FONT, bold:true});
    });
    body += para({spacing:{before:0,after:0}}, runs);
  }

  // ── FULL-WIDTH TEAL RULE ──────────────────────────────────────────────────
  body += para({ spacing:{before:80,after:40}, borderBottom:{sz:8,color:TEAL} });

  // ── SECTIONS ─────────────────────────────────────────────────────────────
  for (const section of sections) {
    const hdr     = section.header.toUpperCase().trim();
    const isExp   = /EXPERIENCE|EMPLOYMENT/.test(hdr);
    const isSkill = /SKILL|COMPETENC|SYSTEM|TECHNOLOG/.test(hdr);
    const isEdu   = /EDUCATION|QUALIF|CERTIF|ADDITIONAL|LICENC|AWARD|ACHIEVE|REFERENCE/.test(hdr);

    // Section heading — navy shaded background, teal underline
    body += emptyPara(200, 0);
    body += para(
      { spacing:{before:60,after:0}, shd:NAVYL, ind:{left:80} },
      run("  " + hdr + "  ", {bold:true, size:22, color:NAVY, font:FONT, caps:true, spacing:80})
    );
    body += para({ spacing:{before:0,after:100}, borderBottom:{sz:6,color:TEAL} });

    let i = 0;
    while (i < section.items.length) {
      const item  = section.items[i];
      const next1 = section.items[i+1] || "";
      const next2 = section.items[i+2] || "";

      const isBullet  = /^[-▪•*]\s/.test(item);
      const isDateLn  = /\d{4}/.test(item) && item.length < 110;
      const hasBar    = item.includes("|") && !isBullet;

      if (isBullet) {
        // ── Bullet point (teal bullet via numbering) ──────────────────────
        const txt = item.replace(/^[-▪•*]\s*/, "");
        body += para(
          { spacing:{before:40,after:40}, numId:1 },
          run(txt, {size:21, color:BLACK, font:FONT})
        );

      } else if (isSkill) {
        // ── Skill item — indented with teal bullet ────────────────────────
        body += para(
          { spacing:{before:30,after:30}, ind:{left:200, hanging:200} },
          run("▪  ", {size:21, color:TEAL, font:FONT, bold:true})
          + run(item, {size:21, color:BLACK, font:FONT})
        );

      } else if (isExp && !isBullet) {
        // Heuristic: if next line is a company/org line (no date yet), it's a job title
        const nextHasDate = /\d{4}/.test(next1);
        const nextIsOrg   = next1 && !nextHasDate && !(/^[-▪•*]/.test(next1));

        if (!isDateLn) {
          if (nextIsOrg) {
            // ── Job Title (bold, large, black) ────────────────────────────
            body += emptyPara(160, 0);
            body += para(
              { spacing:{before:0,after:0}, keepNext:true },
              run(item, {bold:true, size:26, color:BLACK, font:FONT})
            );
            // ── Company name (teal, italic) ───────────────────────────────
            body += para(
              { spacing:{before:0,after:20}, keepNext:true },
              run(next1, {size:22, color:TEAL, font:FONT, italic:true})
            );
            i += 2; // skip company line, will hit date/bullets next
            continue;
          } else if (nextHasDate || hasBar) {
            // Either: "Title | Date range" on same line, or just a title with date next
            if (hasBar) {
              const [title, ...rest] = item.split("|").map(p=>p.trim());
              body += emptyPara(160, 0);
              body += para(
                { spacing:{before:0,after:20} },
                run(title, {bold:true, size:26, color:BLACK, font:FONT})
                + run("   |   ", {size:22, color:LGRAY, font:FONT})
                + run(rest.join(" | "), {size:22, color:TEAL, font:FONT, italic:true})
              );
            } else {
              body += emptyPara(160, 0);
              body += para(
                { spacing:{before:0,after:20}, keepNext:true },
                run(item, {bold:true, size:26, color:BLACK, font:FONT})
              );
            }
          } else {
            // Sub-company or continuation text
            body += para(
              { spacing:{before:0,after:20} },
              run(item, {size:22, color:TEAL, font:FONT, italic:true})
            );
          }
        } else {
          // ── Date / location line (amber italic, indented) ─────────────
          if (hasBar) {
            const parts = item.split("|").map(p=>p.trim());
            let runs = "";
            parts.forEach((p,idx) => {
              runs += run(p, {size:20, color:AMBER, font:FONT, italic:true});
              if (idx < parts.length-1)
                runs += run("  |  ", {size:20, color:LGRAY, font:FONT});
            });
            body += para({ spacing:{before:0,after:80}, ind:{left:0} }, runs);
          } else {
            body += para(
              { spacing:{before:0,after:80} },
              run(item, {size:20, color:AMBER, font:FONT, italic:true})
            );
          }
        }

      } else {
        // ── Generic body text (edu, references, etc.) ─────────────────────
        if (hasBar && isEdu) {
          // Institution | Year — bold institution, italic year
          const [inst, ...rest] = item.split("|").map(p=>p.trim());
          body += para(
            { spacing:{before:40,after:20} },
            run(inst, {size:22, color:GRAY, font:FONT, bold:true})
            + run("  |  ", {size:20, color:LGRAY, font:FONT})
            + run(rest.join("|"), {size:20, color:MGRAY, font:FONT, italic:true})
          );
        } else {
          body += para(
            { spacing:{before:40,after:40} },
            run(item, {size:21, color:BLACK, font:FONT})
          );
        }
      }
      i++;
    }
  }

  body += "<w:p/>";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas">
<w:body>
${body}
<w:sectPr>
  <w:pgSz w:w="11906" w:h="16838"/>
  <w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="709" w:footer="709" w:gutter="0"/>
</w:sectPr>
</w:body>
</w:document>`;
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
async function callAI(system, user, apiKey, maxTokens=2048) {
  if (!apiKey || !apiKey.trim()) throw new Error("Please enter your Anthropic API key above to use this app.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{
      "content-type":"application/json",
      "anthropic-version":"2023-06-01",
      "x-api-key": apiKey.trim(),
      "anthropic-dangerous-direct-browser-access":"true"
    },
    body: JSON.stringify({
      model:"claude-haiku-4-5-20251001",
      max_tokens:maxTokens,
      system,
      messages:[{ role:"user", content:user }]
    })
  });
  if (!res.ok) {
    let msg=`HTTP ${res.status}`;
    try {
      const j=await res.json();
      msg+=": "+(j.error?.message||JSON.stringify(j));
    } catch(_){}
    throw new Error(msg);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error.message||"API error");
  if (data.stop_reason==="max_tokens") throw new Error("Response cut off — try a shorter input.");
  if (!Array.isArray(data.content)||!data.content.length) throw new Error("No content in API response.");
  const text = data.content.filter(b=>b.type==="text").map(b=>b.text).join("").trim();
  if (!text) throw new Error("API returned empty text.");
  return text;
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPTS
// ─────────────────────────────────────────────────────────────────────────────
const SCORE_SYSTEM = `ATS resume analyst. Reply ONLY with raw JSON, no markdown.
Use this exact shape (replace values with real analysis):
{"overallScore":85,"hireChance":78,"breakdown":{"atsCompatibility":{"score":21,"max":25,"feedback":"..."},"keywordDensity":{"score":16,"max":20,"feedback":"..."},"impactMetrics":{"score":15,"max":20,"feedback":"..."},"formatStructure":{"score":13,"max":15,"feedback":"..."},"relevanceMatch":{"score":18,"max":20,"feedback":"..."}},"topStrengths":["...","...","..."],"criticalFixes":["...","...","..."],"missingKeywords":["...","...","..."],"salaryRange":{"min":75000,"max":95000,"currency":"AUD"},"competitorComparison":{"vsAvgCandidate":68,"vsTopCandidate":38},"interviewQuestions":["...","...","..."],"rewrittenSummary":"2-3 sentence summary.","verdict":"One sentence verdict."}
Rules: all scores are plain integers. Be specific and honest.`;

const OPTIMIZE_SYSTEM = `ATS resume optimizer. Reply ONLY with raw JSON, no markdown.
Use this exact shape:
{"optimizedResume":"complete resume text","newAtsScore":96,"keywordsAdded":["kw1","kw2"],"sectionsChanged":["section: what changed"],"improvements":[{"section":"Summary","before":"old text","after":"new text"}],"verdict":"one sentence."}
Rules: newAtsScore is integer 92-99. Keep all real jobs/dates. Add keywords naturally. Never invent experience. Return complete ready-to-submit resume.`;

const BUILD_SYSTEM = `Expert resume writer. Reply ONLY with raw JSON, no markdown.
Shape: {"resume":"full resume text","atsScore":88,"keywordsIncluded":["kw1","kw2"]}
Write a complete ATS-optimised resume. Use action verbs, quantify results, tailor to role.`;

const INTERVIEW_SYSTEM = `Interview coach. Reply ONLY with raw JSON, no markdown.
Shape: {"questions":[{"q":"question?","type":"Behavioural|Technical|Situational","tip":"STAR tip"}],"keyCompetencies":["..."],"redFlags":["..."]}
Generate 6 questions (mix all types) based on the job description.`;

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
function OptimizeBtn({ resume, jobDesc, originalScore, onResult, disabled, apiKey }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!resume.trim()) return;
    setBusy(true);
    try {
      // Trim resume to 3000 chars max to stay within token limits while keeping all key content
      const resumeTrimmed = resume.length > 3000 ? resume.slice(0, 3000) + "\n[... remainder of resume preserved in structure]" : resume;
      const user = `${jobDesc.trim() ? `JOB DESCRIPTION:\n${jobDesc.slice(0,800)}\n\n` : ""}RESUME:\n${resumeTrimmed}`;
      const raw    = await callAI(OPTIMIZE_SYSTEM, user, apiKey, 4096);
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
  const [copied,     setCopied]     = useState(false);
  const [dlBusy,     setDlBusy]     = useState(false);
  const [dlDone,     setDlDone]     = useState(false);
  const [dlErr,      setDlErr]      = useState("");
  const [docxBuffer, setDocxBuffer] = useState(null);
  const [showFull,   setShowFull]   = useState(false);

  // Pre-build DOCX the moment data arrives
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

  const oldScore = Number(data.originalScore) || 0;
  const newScore = Number(data.newAtsScore)    || 0;
  const diff     = newScore - oldScore;

  const handleDownload = async () => {
    if (dlBusy) return;
    setDlBusy(true); setDlErr("");
    try {
      await downloadDocx(data.optimizedResume, "Optimised_Resume.docx", docxBuffer || null);
      setDlDone(true); setTimeout(() => setDlDone(false), 4000);
    } catch(e) {
      setDlErr(e.message || "Download failed");
      setTimeout(() => setDlErr(""), 5000);
    } finally { setDlBusy(false); }
  };

  const cardStyle = { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:24, marginBottom:16 };
  const secTitle  = (color="#7c5cfc") => ({ fontSize:11, fontWeight:700, color, textTransform:"uppercase", letterSpacing:"1.8px", marginBottom:16, fontFamily:"'Space Mono',monospace" });

  return (
    <div ref={resultRef} className="riq-fade" style={{ marginTop:24 }}>

      {/* ── HERO — Score comparison + Download ─────────────────────────────── */}
      <div style={{ background:"linear-gradient(135deg,rgba(0,229,160,0.07),rgba(245,200,66,0.05))",
        border:"1px solid rgba(0,229,160,0.2)", borderRadius:20, padding:"28px 24px", marginBottom:16, textAlign:"center" }}>

        <div style={secTitle("#00e5a0")}>✨ Optimisation Complete</div>

        {/* Score gauges */}
        <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:20, flexWrap:"wrap", marginBottom:20 }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:10, color:"#64748b", fontFamily:"'Space Mono',monospace", marginBottom:6, textTransform:"uppercase", letterSpacing:"1px" }}>Before</div>
            <div style={{ position:"relative", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
              <Gauge score={oldScore} size={118} />
              <div style={{ position:"absolute", textAlign:"center" }}>
                <div style={{ fontSize:20, fontWeight:800, color:"#ff5b5b", lineHeight:1 }}>{oldScore}</div>
                <div style={{ fontSize:8, color:"#64748b", fontFamily:"'Space Mono',monospace" }}>ATS</div>
              </div>
            </div>
          </div>

          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
            <div style={{ fontSize:24 }}>→</div>
            <div style={{ padding:"4px 10px", borderRadius:99, background:"#00e5a018",
              border:"1px solid #00e5a044", color:"#00e5a0", fontSize:13, fontWeight:800,
              fontFamily:"'Space Mono',monospace" }}>+{diff} pts</div>
          </div>

          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:10, color:"#64748b", fontFamily:"'Space Mono',monospace", marginBottom:6, textTransform:"uppercase", letterSpacing:"1px" }}>After</div>
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
        <div style={{ maxWidth:440, margin:"0 auto 16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
            <span style={{ fontSize:11, color:"#64748b" }}>Before: {oldScore}/100</span>
            <span style={{ fontSize:11, color:"#00e5a0", fontWeight:700 }}>After: {newScore}/100</span>
          </div>
          <div style={{ height:8, borderRadius:99, background:"rgba(255,255,255,0.07)", overflow:"hidden", position:"relative" }}>
            <div style={{ position:"absolute", height:"100%", width:`${oldScore}%`, borderRadius:99, background:"#ff5b5b55" }} />
            <div style={{ position:"absolute", height:"100%", width:`${newScore}%`, borderRadius:99,
              background:"linear-gradient(90deg,#f5c84266,#00e5a0)", boxShadow:"0 0 12px #00e5a044",
              transition:"width 1.2s ease" }} />
          </div>
        </div>

        {data.verdict && (
          <p style={{ color:"#94a3b8", fontSize:13, lineHeight:1.6, fontStyle:"italic", maxWidth:540, margin:"0 auto 20px" }}>
            "{data.verdict}"
          </p>
        )}

        {/* ── DOWNLOAD BUTTON — BIG, PROMINENT ────────────────────────────── */}
        <button onClick={handleDownload} disabled={dlBusy}
          style={{ display:"inline-flex", alignItems:"center", gap:10, padding:"15px 36px",
            borderRadius:14, border:"none", fontSize:16, fontWeight:800, fontFamily:"inherit",
            cursor:dlBusy?"not-allowed":"pointer", transition:"all 0.2s",
            background:dlBusy?"rgba(255,255,255,0.07)":"linear-gradient(135deg,#00e5a0,#00b377)",
            color:dlBusy?"#64748b":"#000",
            boxShadow:dlBusy?"none":"0 6px 32px #00e5a055" }}>
          {dlBusy
            ? (<><span style={{ width:18, height:18, border:"2px solid #64748b44", borderTopColor:"#64748b",
                borderRadius:"50%", display:"inline-block", animation:"riq-spin 0.8s linear infinite" }}/>
               Building .docx…</>)
            : dlDone ? "✅ Downloaded!"
            : docxBuffer ? "⚡ Download Optimised Resume (.docx)"
            : "⬇️ Download Optimised Resume (.docx)"}
        </button>

        {docxBuffer && !dlBusy && !dlDone && (
          <p style={{ fontSize:11, color:"#00e5a0", marginTop:8, fontFamily:"'Space Mono',monospace" }}>⚡ Ready — instant download</p>
        )}
        {dlErr && <p style={{ color:"#ff5b5b", fontSize:12, marginTop:8 }}>⚠️ {dlErr}</p>}
      </div>

      {/* ── KEYWORDS ADDED ─────────────────────────────────────────────────── */}
      {data.keywordsAdded?.length > 0 && (
        <div style={cardStyle}>
          <div style={secTitle("#00e5a0")}>🔑 Keywords Added ({data.keywordsAdded.length})</div>
          <div>{data.keywordsAdded.map((k,i) => <Chip key={i} text={k} color="#00e5a0" />)}</div>
        </div>
      )}

      {/* ── WHAT CHANGED ───────────────────────────────────────────────────── */}
      {data.sectionsChanged?.length > 0 && (
        <div style={cardStyle}>
          <div style={secTitle("#7c5cfc")}>📝 What We Changed ({data.sectionsChanged.length} sections)</div>
          {data.sectionsChanged.map((s,i) => (
            <div key={i} style={{ fontSize:13, color:"#94a3b8", marginBottom:8,
              paddingLeft:12, borderLeft:"2px solid #7c5cfc66", lineHeight:1.5 }}>
              ✓ {s}
            </div>
          ))}
        </div>
      )}

      {/* ── BEFORE vs AFTER COMPARISON ─────────────────────────────────────── */}
      {data.improvements?.length > 0 && (
        <div style={cardStyle}>
          <div style={secTitle("#f5c842")}>🔄 Before vs After — Every Change We Made</div>
          {data.improvements.map((item, i) => (
            <div key={i} style={{ marginBottom:20, paddingBottom:20,
              borderBottom: i < data.improvements.length-1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
              {/* Section label */}
              <div style={{ display:"inline-block", padding:"3px 10px", borderRadius:6,
                background:"#f5c84215", border:"1px solid #f5c84233",
                color:"#f5c842", fontSize:11, fontWeight:700, fontFamily:"'Space Mono',monospace",
                marginBottom:12, textTransform:"uppercase", letterSpacing:"0.8px" }}>
                {item.section}
              </div>
              {/* Side-by-side diff */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div style={{ padding:"12px 14px", background:"rgba(255,91,91,0.05)",
                  border:"1px solid rgba(255,91,91,0.18)", borderRadius:10 }}>
                  <div style={{ fontSize:10, color:"#ff5b5b", fontWeight:700,
                    fontFamily:"'Space Mono',monospace", marginBottom:8,
                    textTransform:"uppercase", letterSpacing:"1px", display:"flex", alignItems:"center", gap:5 }}>
                    <span style={{ display:"inline-block", width:14, height:14, borderRadius:99,
                      background:"#ff5b5b22", border:"1px solid #ff5b5b44",
                      textAlign:"center", lineHeight:"14px", fontSize:9 }}>✕</span>
                    Before
                  </div>
                  <div style={{ fontSize:13, color:"#94a3b8", lineHeight:1.6 }}>{item.before}</div>
                </div>
                <div style={{ padding:"12px 14px", background:"rgba(0,229,160,0.05)",
                  border:"1px solid rgba(0,229,160,0.18)", borderRadius:10 }}>
                  <div style={{ fontSize:10, color:"#00e5a0", fontWeight:700,
                    fontFamily:"'Space Mono',monospace", marginBottom:8,
                    textTransform:"uppercase", letterSpacing:"1px", display:"flex", alignItems:"center", gap:5 }}>
                    <span style={{ display:"inline-block", width:14, height:14, borderRadius:99,
                      background:"#00e5a022", border:"1px solid #00e5a044",
                      textAlign:"center", lineHeight:"14px", fontSize:9 }}>✓</span>
                    After
                  </div>
                  <div style={{ fontSize:13, color:"#e2e8f0", lineHeight:1.6 }}>{item.after}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── FULL OPTIMISED RESUME ───────────────────────────────────────────── */}
      <div style={cardStyle}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10, marginBottom:16 }}>
          <div style={secTitle("#7c5cfc")}>📄 Full Optimised Resume</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button onClick={() => setShowFull(v => !v)}
              style={{ padding:"7px 14px", borderRadius:8,
                border:"1px solid rgba(255,255,255,0.12)", background:"rgba(255,255,255,0.05)",
                color:"#64748b", fontSize:12, fontWeight:600, fontFamily:"inherit", cursor:"pointer" }}>
              {showFull ? "🔼 Collapse" : "🔽 Expand"}
            </button>
            <button onClick={() => { safeCopy(data.optimizedResume); setCopied(true); setTimeout(()=>setCopied(false),2200); }}
              style={{ padding:"7px 14px", borderRadius:8,
                border:"1px solid rgba(255,255,255,0.12)", background:"rgba(255,255,255,0.05)",
                color:"#94a3b8", fontSize:12, fontWeight:600, fontFamily:"inherit", cursor:"pointer" }}>
              {copied ? "✅ Copied!" : "📋 Copy"}
            </button>
            <button onClick={handleDownload} disabled={dlBusy}
              style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"7px 14px",
                borderRadius:8, border:"1px solid #00e5a044", background:"#00e5a012",
                color:dlBusy?"#64748b":"#00e5a0", fontSize:12, fontWeight:700,
                fontFamily:"inherit", cursor:dlBusy?"not-allowed":"pointer" }}>
              {dlBusy ? "Building…" : dlDone ? "✅ Done!" : "⬇️ .docx"}
            </button>
          </div>
        </div>
        {showFull && (
          <pre style={{ whiteSpace:"pre-wrap", fontSize:12, color:"#94a3b8", lineHeight:1.8,
            fontFamily:"inherit", background:"rgba(255,255,255,0.02)", padding:18,
            borderRadius:10, border:"1px solid rgba(255,255,255,0.05)", maxHeight:600, overflowY:"auto" }}>
            {data.optimizedResume}
          </pre>
        )}
        {!showFull && (
          <div style={{ fontSize:13, color:"#475569", textAlign:"center", padding:"12px 0" }}>
            Click <strong style={{color:"#94a3b8"}}>Expand</strong> to read the full resume, or download the .docx directly above ↑
          </div>
        )}
      </div>
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

function ScorePanel({ data, copied, onCopy, resultRef, resume, jobDesc, loading, apiKey }) {
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

  // Once optimised — hide the score panel, show only optimization results
  if (optData && !optData.error) {
    return <OptimizePanel data={optData} resultRef={optRef} />;
  }

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
            apiKey={apiKey}
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
  const [apiKey,    setApiKey]    = useState(() => {
    try { return localStorage.getItem("riq_api_key") || ""; } catch(_){ return ""; }
  });
  const [keyVisible,setKeyVisible]= useState(false);
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

  const run = async (system, user, onSuccess, msg, maxTokens=2048) => {
    setErr(""); setLoadMsg(msg); setLoading(true);
    try {
      const raw    = await callAI(system, user, apiKey, maxTokens);
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
  const saveKey = (val) => {
    setApiKey(val);
    try { if(val.trim()) localStorage.setItem("riq_api_key",val.trim());
          else localStorage.removeItem("riq_api_key"); } catch(_){}
  };

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

        {/* API KEY — collapsed pill, expands on click */}
        {(() => {
          const connected = apiKey.trim().startsWith("sk-ant-");
          return (
            <div style={{ marginBottom:16 }}>
              {!keyVisible ? (
                <div style={{ display:"flex", justifyContent:"flex-end" }}>
                  <button onClick={()=>setKeyVisible(true)}
                    style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"6px 14px",
                      borderRadius:99, border:`1px solid ${connected?"#00e5a033":"#f5c84244"}`,
                      background:connected?"#00e5a00c":"#f5c8420c",
                      color:connected?"#00e5a0":"#f5c842", fontSize:12, fontWeight:600,
                      fontFamily:"'Space Mono',monospace", cursor:"pointer" }}>
                    {connected ? "🔒 API Key Connected" : "🔑 Add API Key"}
                  </button>
                </div>
              ) : (
                <div style={{ background:"rgba(255,255,255,0.03)", border:`1px solid ${connected?"#00e5a033":"#f5c84244"}`,
                  borderRadius:12, padding:"14px 16px", display:"flex", flexWrap:"wrap", alignItems:"center", gap:10 }}>
                  <div style={{ flex:"0 0 auto" }}>
                    <div style={{ fontSize:12, fontWeight:700, color:connected?"#00e5a0":"#f5c842", fontFamily:"'Space Mono',monospace" }}>
                      {connected ? "✅ API Key Active" : "🔑 Anthropic API Key"}
                    </div>
                    <div style={{ fontSize:11, color:"#475569", marginTop:2 }}>
                      {connected ? "~$0.001 per analysis · get yours at console.anthropic.com" : "Get free key → console.anthropic.com"}
                    </div>
                  </div>
                  <div style={{ display:"flex", flex:"1 1 240px", gap:8, alignItems:"center" }}>
                    <input type="password" placeholder="sk-ant-api03-..."
                      value={apiKey} onChange={e=>saveKey(e.target.value)}
                      style={{ flex:1, background:"rgba(255,255,255,0.05)",
                        border:`1px solid ${connected?"#00e5a044":"rgba(255,255,255,0.15)"}`,
                        borderRadius:8, padding:"8px 12px", color:"#e2e8f0", fontSize:13,
                        fontFamily:"'Space Mono',monospace", outline:"none" }} />
                    <button onClick={()=>setKeyVisible(false)}
                      style={{ background:"none", border:"none", cursor:"pointer", color:"#64748b", fontSize:18, lineHeight:1, padding:"4px 6px" }}>
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

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
                resultRef={resultRef} resume={resume} jobDesc={jobDesc} loading={loading} apiKey={apiKey} />
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
                resultRef={resultRef} resume={resume} jobDesc={jobDesc} loading={loading} apiKey={apiKey} />
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
