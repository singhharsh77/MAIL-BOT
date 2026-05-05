/*************** CONFIGURATION ***************/
const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
const SPREADSHEET_ID = "1nODiCiTgZyY3cYugN1PhgG73z_DFy74lpzMcmi2VDDc";
/********************************************/


/*************************************************
                WEB APP
*************************************************/

function doGet() {
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("Cold Email Generator for Recruiters")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


/*************************************************
                TEMPLATE LIBRARY
*************************************************/

function getTemplateLibrary() {
  return {
    devops_cloud:   "DevOps/Cloud/SRE Engineer outreach email",
    sde:            "Software Development Engineer outreach email",
    soc_cybersecurity: "Cybersecurity/SOC outreach email",
    ai_ml:          "AI/ML Engineer outreach email",
    frontend:       "Frontend/Full-Stack Developer outreach email",
    follow_up:      "Follow-up email",
    thank_you:      "Interview thank-you email"
  };
}


/*************************************************
                ROLE CLASSIFIER
  Maps any position string → one of the 5 role keys.
  Uses prioritised keyword matching so a string like
  "AI + Cloud Intern" → ai_ml (more specific wins).
*************************************************/

function getTemplateFromPosition(position) {
  if (!position) return "sde";

  const p = position.toLowerCase().trim();

  // Priority 1 – Cybersecurity / SOC
  // NOTE: Use word-level split to avoid false matches.
  // e.g. "associate" contains the letters s-o-c but must NOT match SOC.
  // We test every individual word token so partial substrings never trigger.
  const words = p.split(/[\s\/\-,()&+]+/).filter(Boolean);
  const cyberKeywords    = new Set(["soc","cyber","cybersec","security","infosec","pentest","penetration"]);
  const aiKeywords       = new Set(["ai","ml","nlp","genai","llm","data"]);
  const devopsKeywords   = new Set(["devops","cloud","sre","infrastructure","infra","aws","gcp","azure",
                                     "k8s","kubernetes","terraform","platform","reliability"]);
  const frontendKeywords = new Set(["react","frontend","fullstack","angular","vue","ui","ux"]);

  // Phrase-level checks (multi-word)
  if (/machine.?learning|artificial.?intel|full.?stack|ci.?cd/.test(p)) {
    if (/machine.?learning|artificial.?intel/.test(p)) return "ai_ml";
    if (/full.?stack/.test(p)) return "frontend";
  }

  // Word-level checks in priority order
  if (words.some(w => cyberKeywords.has(w)))    return "soc_cybersecurity";
  if (words.some(w => aiKeywords.has(w)))        return "ai_ml";
  if (words.some(w => devopsKeywords.has(w)))    return "devops_cloud";
  if (words.some(w => frontendKeywords.has(w)))  return "frontend";

  // Default – SDE (backend, Java, general dev, intern, fresher, associate, etc.)
  return "sde";
}


/*************************************************
                RESUME LINKS
  One resume per role key.
*************************************************/

function getResumeLink(role) {
  const resumeLinks = {
    devops_cloud: "https://drive.google.com/file/d/12BGy4rCy43F6a1LidRwfjn3kMYJPkyUj/view?usp=sharing",
    sde:          "https://drive.google.com/file/d/1iU3IftV5CYmjh6pF-b8T78-kzlMj7WT8/view?usp=sharing",
    soc_cybersecurity: "https://docs.google.com/document/d/168qqWZ7iWlL9-0eonlk3mT7s1IL0PzgoPezfRoxieIk/edit?usp=sharing",
    ai_ml:        "https://drive.google.com/file/d/1iU3IftV5CYmjh6pF-b8T78-kzlMj7WT8/view?usp=sharing", // 
    frontend:     "https://drive.google.com/file/d/1iU3IftV5CYmjh6pF-b8T78-kzlMj7WT8/view?usp=sharing"  //  
  };
  return resumeLinks[role] || resumeLinks.sde;
}


/*************************************************
                SYSTEM PROMPTS
*************************************************/

function getRoleSpecificSystemPrompt(templateKey) {
  const prompts = {
    devops_cloud:
      "You are writing a professional cold email for DevOps, Cloud Engineering, or SRE roles. " +
      "Highlight cloud infrastructure (AWS/GCP), CI/CD pipelines, automation, Kubernetes, Terraform, and reliability engineering.",

    sde:
      "You are writing a professional cold email for Software Engineering roles. " +
      "Highlight programming skills, system design, backend development, and software delivery experience.",

    soc_cybersecurity:
      "You are writing a professional cold email for Cybersecurity or SOC roles. " +
      "Highlight threat detection, SOC operations, SIEM tools, incident response, and security best practices.",

    ai_ml:
      "You are writing a professional cold email for AI/ML or Data Science roles. " +
      "Highlight machine learning, model deployment, cloud-based AI services, data pipelines, and Python expertise.",

    frontend:
      "You are writing a professional cold email for Frontend or Full-Stack Developer roles. " +
      "Highlight React, TypeScript, UI/UX sensibility, REST API integration, and modern web development.",

    follow_up:
      "Write a professional follow-up email for a job application already submitted.",

    thank_you:
      "Write a short, warm, professional thank-you email after a technical interview."
  };

  return prompts[templateKey] || prompts.sde;
}


/*************************************************
                AI PROMPT BUILDER
*************************************************/

function buildRoleSpecificPrompt(context) {
  return `
Generate a concise professional cold email.

Candidate Information:
- Name: Harsh Singh
- Title: Junior Cloud / Software Enthusiast
- Phone: +91-77429 85867
- Email: haharshsingh57@gmail.com
- Portfolio: terminal-singh-harsh-com.vercel.app
- LinkedIn: https://www.linkedin.com/in/harsh-singh-781332248/
- GitHub: https://github.com/singhharsh77

Recipient Details:
- Company: ${context.companyName || "your company"}
- Recruiter: ${context.recruiterName || "Hiring Manager"}
- Position: ${context.positionTitle || "Software Engineer"}

Instructions:
• Keep email 150-200 words
• Reference the specific role and company by name
• Mention internship productivity improvement (MAIL BOT project – 40% improvement)
• Express strong, genuine interest in this specific company
• Professional, confident tone
• No closing signature (handled separately)

Return ONLY the email body text, no subject line.
`;
}


/*************************************************
                SUBJECT GENERATION
*************************************************/

function getEmailSubject(templateKey, position) {
  const subjects = {
    devops_cloud:       "Application – DevOps / Cloud / SRE Engineer",
    sde:                "Application – Software Engineer",
    soc_cybersecurity:  "Application – Cybersecurity Role",
    ai_ml:              "Application – AI / ML Engineer",
    frontend:           "Application – Frontend / Full-Stack Developer",
    follow_up:          "Following up on my application",
    thank_you:          "Thank you for the interview"
  };
  return subjects[templateKey] || (position ? `Application – ${position}` : "Job Application");
}


/*************************************************
                GEMINI EMAIL GENERATION
*************************************************/

function generateEmailPreview(context) {
  try {
    const systemPrompt = getRoleSpecificSystemPrompt(context.template);
    const userPrompt   = buildRoleSpecificPrompt(context);
    const prompt       = systemPrompt + "\n\n" + userPrompt;

    const apiUrl =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
      GEMINI_API_KEY;

    const response = UrlFetchApp.fetch(apiUrl, {
      method:      "post",
      contentType: "application/json",
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
      }),
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      Logger.log("Gemini failed (HTTP " + response.getResponseCode() + ") → fallback");
      return fallbackEmail(context);
    }

    const data = JSON.parse(response.getContentText());
    const body = data?.candidates?.[0]?.content?.parts?.[0]?.text || fallbackEmail(context).body;

    return {
      subject: getEmailSubject(context.template, context.positionTitle),
      body:    body
    };

  } catch (error) {
    Logger.log("Gemini exception → fallback: " + error.message);
    return fallbackEmail(context);
  }
}


/*************************************************
                FALLBACK EMAIL
*************************************************/

function fallbackEmail(context) {
  const role      = context.positionTitle || context.position || "open position";
  const company   = context.companyName   || "your organization";
  const recruiter = context.recruiterName || "Hiring Manager";

  return {
    subject: `Application – ${role}`,
    body: `Dear ${recruiter},

I hope you are doing well.

I recently came across the ${role} opportunity at ${company} and wanted to express my strong interest.

I am a Computer Science student with hands-on experience in software development, cloud infrastructure, and automation. During my last internship I built an internal tool called MAIL BOT that improved operational productivity by over 40%, working closely with engineering teams in an agile environment.

My interests lie in building scalable systems, developing efficient software solutions, and applying modern technologies such as cloud platforms, automation pipelines, and AI-driven tools to solve real-world problems.

I would welcome the opportunity to contribute to ${company} and would be grateful to discuss how my background and skills can add value to your team.

Thank you for your time and consideration.

Best regards`
  };
}


/*************************************************
                SEND EMAIL
*************************************************/

function sendFinalEmail(emailData) {
  if (!emailData.to || !emailData.to.includes("@")) {
    throw new Error("Invalid email address: " + emailData.to);
  }

  MailApp.sendEmail(
    emailData.to,
    emailData.subject,
    emailData.body,
    {
      htmlBody: formatEmailHTML(emailData.body, emailData.role),
      name: "Harsh Singh",
      cc: emailData.cc || ""
    }
  );

  return "success";
}


/*************************************************
                GOOGLE SHEET READER
*************************************************/

function getSheetData() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getActiveSheet();
  const data  = sheet.getDataRange().getValues();

  return data.slice(1)                       // skip header row
    .filter(row => row[0])                   // skip empty rows
    .map((row, idx) => ({
      rowIndex:      idx + 2,                // 1-indexed, +1 for header
      email:         row[0],
      recruiterName: row[1],
      position:      row[2],
      jobDescription:row[3],
      jobId:         row[4],
      companyName:   row[5],
      status:        row[6]
    }));
}


/*************************************************
                UPDATE SHEET STATUS
*************************************************/

function updateSheetStatus(rowIndex, status) {
  SpreadsheetApp.openById(SPREADSHEET_ID)
    .getActiveSheet()
    .getRange(rowIndex, 7)
    .setValue(status);
}


/*************************************************
                BULK EMAIL SENDER
  ✅ Generates a FRESH email template per role.
  ✅ Caches by role key so identical roles reuse
     the same Gemini call (saves quota).
  ✅ Sends role-specific resume link.
*************************************************/

function sendBulkEmails(context) {
  const recipients       = getSheetData();
  const pendingRecipients = recipients.filter(r => r.status !== "Sent");

  if (pendingRecipients.length === 0) {
    throw new Error("No pending emails found.");
  }

  // Cache: roleKey → { subject, body }  (one Gemini call per unique role)
  const templateCache = {};
  const results       = [];

  for (const r of pendingRecipients) {
    try {
      const roleKey = getTemplateFromPosition(r.position);
      Logger.log("Row " + r.rowIndex + " | position: '" + r.position + "' → role: " + roleKey);

      // Generate & cache template for this role (one Gemini call per unique role)
      if (!templateCache[roleKey]) {
        const emailContext = {
          ...context,
          companyName:   r.companyName,
          recruiterName: r.recruiterName,
          positionTitle: r.position,
          template:      roleKey
        };

        // ── Fallback-safe generation ──────────────────────────────────────────
        // generateEmailPreview() has its own try/catch and returns a fallback
        // on Gemini failure, so templateCache[roleKey] is ALWAYS populated here.
        // This guarantees the bulk loop never stops due to an API error.
        try {
          Logger.log("Generating Gemini template for role: " + roleKey);
          templateCache[roleKey] = generateEmailPreview(emailContext);
        } catch (genErr) {
          // Should never reach here (generateEmailPreview catches internally),
          // but belt-and-suspenders: cache the fallback so we don't retry.
          Logger.log("Unexpected generation error for " + roleKey + " → using fallback: " + genErr.message);
          templateCache[roleKey] = fallbackEmail(emailContext);
        }
        // ─────────────────────────────────────────────────────────────────────
      }

      const tmpl = templateCache[roleKey];

      sendFinalEmail({
        to:      r.email,
        subject: tmpl.subject,
        body:    tmpl.body,
        role:    roleKey,
        cc:      context.cc || ""
      });

      updateSheetStatus(r.rowIndex, "Sent");
      results.push({ email: r.email, role: roleKey, status: "success" });

    } catch (error) {
      Logger.log("Error for " + r.email + ": " + error.message);
      updateSheetStatus(r.rowIndex, "Failed: " + error.message);
      results.push({ email: r.email, status: "error", message: error.message });
    }

    Utilities.sleep(400); // stay within Gmail sending rate limits
  }

  Logger.log("Bulk send complete. Results: " + JSON.stringify(results));
  return results;
}


/*************************************************
                EMAIL HTML TEMPLATE
*************************************************/

function formatEmailHTML(content, role) {
  const resumeLink = getResumeLink(role);

  const htmlContent = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background-color:#f4f6fb;padding:20px;margin:0;">
  <div style="max-width:750px;margin:0 auto;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background-color:#0a1c3f;color:#ffffff;padding:25px;">
      <h2 style="margin:0;font-size:24px;">Mail Bot – Application Outreach</h2>
    </div>

    <!-- Body -->
    <div style="background-color:#ffffff;padding:30px;border:1px solid #d9e2ef;">
      <p style="font-size:15px;color:#222;line-height:1.8;">${htmlContent}</p>

      <!-- Resume CTA -->
      <div style="margin:30px 0;text-align:center;">
        <a href="${resumeLink}" target="_blank"
           style="background-color:#0a1c3f;color:#ffffff;padding:12px 28px;border-radius:6px;
                  font-size:15px;text-decoration:none;display:inline-block;font-weight:bold;">
          📄 View Resume
        </a>
      </div>

      <!-- Signature -->
      <p style="font-size:16px;color:#000;line-height:1.8;">
        Best Regards,<br>
        <strong>Harsh Singh</strong><br>
        <a href="https://www.credly.com/badges/40cbf9e6-2e99-4c50-b88d-5ea115ed2d60"
           style="color:#000;text-decoration:none;">
          <strong>AWS Certified Solutions Architect – Associate 🔗</strong>
        </a><br>
        Junior Cloud / Software Enthusiast
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color:#0a1c3f;color:#ffffff;padding:24px;text-align:center;font-size:13px;line-height:2;">
      <p style="margin:0 0 8px;font-size:16px;"><strong>Harsh Singh</strong></p>
      <p style="margin:0 0 4px;">Junior Cloud / Software Enthusiast</p>
      <p style="margin:0 0 12px;">
        📞 <strong>Phone:</strong> +91-77429 85867 &nbsp;|&nbsp;
        ✉️ <strong>Email:</strong> haharshsingh57@gmail.com
      </p>
      <p style="margin:0 0 4px;">🌐 <strong>Portfolio:</strong>
        <a href="https://terminal-singh-harsh-com.vercel.app" style="color:#4da6ff;text-decoration:none;">terminal-singh-harsh-com.vercel.app</a>
      </p>
      <p style="margin:0 0 4px;">💼 <strong>LinkedIn:</strong>
        <a href="https://www.linkedin.com/in/harsh-singh-781332248/" style="color:#4da6ff;text-decoration:none;">linkedin.com/in/harsh-singh-781332248</a>
      </p>
      <p style="margin:0 0 4px;">💻 <strong>GitHub:</strong>
        <a href="https://github.com/singhharsh77" style="color:#4da6ff;text-decoration:none;">github.com/singhharsh77</a>
      </p>
      <p style="margin:0 0 12px;">🏅 <strong>Credly:</strong>
        <a href="https://credly.com/users/harsh-singh.7fa52a4d" style="color:#4da6ff;text-decoration:none;">credly.com/users/harsh-singh.7fa52a4d</a>
      </p>
      <p style="margin:0;font-size:12px;opacity:0.75;">Mail Bot | Made by <strong>Harsh Singh</strong></p>
    </div>

  </div>
</body>
</html>`;
}
