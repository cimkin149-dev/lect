// Privacy Policy + Terms of Service screens (roadmap Phase 5).
//
// IMPORTANT: this is a FIRST DRAFT that describes what the app actually does
// today (see supabase/schema.sql + the migrations). It has NOT been reviewed
// by a lawyer and must be before anyone relies on it. Fill in the placeholders
// in LEGAL below, then remove the draft banner by setting LEGAL.isDraft = false.

import React from "react";

export const LEGAL = {
  isDraft: true,
  productName: "SEMAI",
  operatorName: "SayMyTech Developers",
  contactEmail: "stevearchie256@gmail.com",
  address: "10002, Kampala, Uganda",
  effectiveDate: "8 October 2026",
};

const h2 = { fontSize: 16, margin: "26px 0 8px", color: "#EDEFF2", fontFamily: "'Space Grotesk', sans-serif" };
const p = { fontSize: 14, lineHeight: 1.65, color: "#B8BEC9", margin: "0 0 10px" };
const li = { fontSize: 14, lineHeight: 1.65, color: "#B8BEC9", marginBottom: 6 };

function LegalShell({ title, onBack, children }) {
  return (
    <div className="setup-screen">
      <div className="setup-header">
        <div className="join-eyebrow">{LEGAL.productName}</div>
        <h1 className="join-title">{title}</h1>
        <button className="skip-link" onClick={onBack}>← Back</button>
      </div>
      {LEGAL.isDraft && (
        <div className="db-status warn" role="note" style={{ display: "block" }}>
          Draft — this document has not yet been reviewed by a lawyer and may change before it is final.
        </div>
      )}
      <div className="legal-body" style={{ maxWidth: 720 }}>
        <p style={p}>Effective: {LEGAL.effectiveDate}</p>
        {children}
        <p style={{ ...p, marginTop: 28 }}>
          Questions about this document: {LEGAL.contactEmail}.
        </p>
        <button className="skip-link" onClick={onBack}>← Back</button>
      </div>
    </div>
  );
}

export function PrivacyPolicyScreen({ onBack }) {
  return (
    <LegalShell title="Privacy Policy" onBack={onBack}>
      <p style={p}>
        This policy explains what personal data {LEGAL.productName} collects, why, who it is shared with, and the choices you have. In
        plain terms: we collect only what the app needs to run lectures, save your courses and show lecturers how their sessions went.
      </p>

      <h2 style={h2}>1. Who is responsible</h2>
      <p style={p}>
        {LEGAL.operatorName} ("we") runs {LEGAL.productName} and decides how your data is used. Contact: {LEGAL.contactEmail}, {LEGAL.address}.
      </p>

      <h2 style={h2}>2. What we collect</h2>
      <ul>
        <li style={li}><strong>Account details</strong> (lecturers, and students who choose to sign in): your email address and a password. Passwords are handled by our authentication provider and stored only in hashed form; we cannot read them.</li>
        <li style={li}><strong>Course content</strong> (lecturers): course code, title, institution, teaching tone, voice settings, an ElevenLabs voice ID if you choose one, and the modules and slides you create or upload. An ElevenLabs API key, if you enter one, stays in your browser tab and is never saved to our database.</li>
        <li style={li}><strong>Session records</strong> (students): when you finish or leave a lecture we save the course and module, the name you typed (or your account), how far you got, how many questions you asked, the transcript of the session (the lecture text, your questions and the AI's answers), an AI-written summary, and timestamps. If you are not signed in, the record is linked only to the name you typed, not to any account.</li>
        <li style={li}><strong>Learning activity</strong>: while you attend a lecture we record how you interact with it: which slides you view and for how long, when you pause or move on, when you ask a question (how long it was and which part of the slide it was about, not a recording), the "Got it / Unsure / I'm lost" buttons you press, and your answers to short quiz questions (which option you chose, whether it was right, how long you took and how sure you said you were). It is used to personalise the lecture and to help your lecturer see which parts of a lecture need improving. It is linked to a random code kept in your browser (and to your account if you are signed in), and never includes your name or email.</li>
        <li style={li}><strong>Research (optional)</strong>: only if you tick the box when joining a lecture, an anonymised copy of that learning activity may also be used for education research, with results reported in aggregate so that no individual can be identified. Leaving the box unticked changes nothing about the lecture. You can change your choice at any time; it applies from your next session.</li>
        <li style={li}><strong>Flagged questions</strong>: when the AI is not confident in an answer, the question, the AI's answer, the slide title and your typed name or account name are saved so the lecturer can review and correct it.</li>
        <li style={li}><strong>Error logs</strong>: if the app crashes, we record a technical error message, the page address (without any query string), your browser type and the app version. We do not put your email, tokens or lecture text into error logs. We aim to delete error logs after 90 days.</li>
        <li style={li}><strong>Speed measurements</strong>: we record how long AI answers and the lecturer's voice take to respond (durations in milliseconds, which AI provider answered, and the length of the text, never the text itself, your name or your email) so we can make lectures faster and spot outages. We aim to delete these after 90 days.</li>
        <li style={li}><strong>Stored in your browser</strong>: if you sign in, a sign-in token is kept in your browser's local storage so you stay signed in. Signing out removes it.</li>
      </ul>

      <h2 style={h2}>3. Why we use it</h2>
      <p style={p}>
        To run lectures and answer questions; to save lecturers' courses; to show lecturers past sessions, summaries and flagged
        questions; to show signed-in students their own history; to keep the service secure and fix faults. We do not sell your data and
        we do not use it for advertising.
      </p>

      <h2 style={h2}>4. Who else processes your data</h2>
      <ul>
        <li style={li}><strong>Supabase</strong>: database, sign-in and server functions. Our project is hosted in the EU West (Ireland) region.</li>
        <li style={li}><strong>Google (Gemini AI)</strong>: lecture material and slide text, and student questions with the surrounding context, are sent to Google's Gemini service to generate slides, spoken explanations, answers, notes and summaries. This happens through our server function so our AI key is never exposed.</li>
        <li style={li}><strong>Groq (backup AI provider)</strong>: only when Google's service is unavailable or over capacity, the same lecture material or student question may be sent to Groq instead, to produce the answer, so that a lecture is not interrupted. Groq's servers are in the United States.</li>
        <li style={li}><strong>ElevenLabs</strong> (only if a lecturer turns it on): the text of what the lecturer voice says is sent from your browser to ElevenLabs to produce speech.</li>
        <li style={li}><strong>Your browser's speech features</strong>: if you use the microphone to ask a question, speech recognition is performed by your browser, and depending on the browser (for example Chrome) your audio may be sent to that browser vendor's service. We do not receive or store your audio.</li>
        <li style={li}><strong>Hosting and fonts</strong>: the app is delivered by our hosting provider (currently Netlify) and loads fonts from Google Fonts, which can see your IP address when fonts load.</li>
      </ul>
      <p style={p}>Some of these providers process data outside Uganda, including in Ireland and the United States.</p>

      <h2 style={h2}>5. Who can see your data</h2>
      <ul>
        <li style={li}>Lecturers can see session records, transcripts, summaries and flagged questions for <em>their own courses</em>, including the names students typed. Lecturers cannot see other lecturers' data.</li>
        <li style={li}>Signed-in students can see their own session history. Nobody else can see it except the lecturer of that course and the people who run the service.</li>
        <li style={li}>Course content you save is readable by students so that they can attend it.</li>
        <li style={li}>The people who run the service can access the database for support, security and maintenance.</li>
      </ul>

      <h2 style={h2}>6. How long we keep it</h2>
      <p style={p}>
        Account, course and session data is kept until you delete it or delete your account. Error logs are described above.
        Backups held by our providers may keep copies for a short period after deletion.
      </p>

      <h2 style={h2}>7. Your choices and rights</h2>
      <ul>
        <li style={li}><strong>Download your data</strong>: signed-in lecturers and students can use "Download my data" in the app to get a copy as a file.</li>
        <li style={li}><strong>Delete your account</strong>: use "Delete my account" in the app. For a <em>student</em> account this permanently deletes your account, your saved session history and your learning activity. For a <em>lecturer</em> account this permanently deletes your account, your courses and modules, the flagged questions on them, and the session records students saved for those courses.</li>
        <li style={li}><strong>Not signed in?</strong> Sessions recorded under only a typed name are not linked to an account, so the app cannot find them for you. Email us with the name, course and approximate date and we will help remove them.</li>
        <li style={li}>You can also ask us to correct your data, restrict or object to its use, or withdraw consent, by emailing {LEGAL.contactEmail}.</li>
        <li style={li}>If you are in Uganda you may complain to the Personal Data Protection Office under the Data Protection and Privacy Act, 2019, if you believe your data has been mishandled.</li>
      </ul>

      <h2 style={h2}>8. Security</h2>
      <p style={p}>
        Connections use HTTPS. Access to data is restricted by database rules so that people can only read and change what belongs to them
        or their courses. No system is perfectly secure, and we cannot guarantee absolute security.
      </p>

      <h2 style={h2}>9. Children</h2>
      <p style={p}>
        {LEGAL.productName} is intended for university and college lecturers and students. It is not directed at children. If a user is under 18, a parent,
        guardian or the institution should supervise their use.
      </p>

      <h2 style={h2}>10. Changes</h2>
      <p style={p}>If we change this policy in a way that matters, we will update the effective date above and, where we can, tell you in the app.</p>
    </LegalShell>
  );
}

export function TermsScreen({ onBack }) {
  return (
    <LegalShell title="Terms of Service" onBack={onBack}>
      <p style={p}>
        By creating an account or using {LEGAL.productName} you agree to these terms. If you do not agree, please do not use the service.
      </p>

      <h2 style={h2}>1. The service</h2>
      <p style={p}>
        {LEGAL.productName} lets lecturers turn their course material into AI-delivered lectures and lets students attend them and ask
        questions. {LEGAL.operatorName} ("we") provides it.
      </p>

      <h2 style={h2}>2. Accounts</h2>
      <p style={p}>
        You are responsible for keeping your password safe and for what happens under your account. Give accurate details and tell us if you
        think your account has been misused. You can delete your account at any time from inside the app.
      </p>

      <h2 style={h2}>3. Lecturers: your content</h2>
      <ul>
        <li style={li}>You keep ownership of the course material you upload. You give us permission to store it, process it with AI, and show it to students you invite, only to run the service.</li>
        <li style={li}>You promise that you have the right to use what you upload (for example, you wrote it or your institution allows it) and that it is lawful.</li>
        <li style={li}>You are responsible for reviewing AI-generated slides and answers before relying on them in teaching, and for following up on questions the AI flags for you.</li>
        <li style={li}>Deleting your account deletes your courses and the student session records attached to them, as described in the Privacy Policy.</li>
      </ul>

      <h2 style={h2}>4. Students</h2>
      <p style={p}>
        Use the service for learning. Do not try to disrupt it, access other people's data, or use it to harass anyone. What you type or say
        in a session is saved in that session's record and can be seen by the course's lecturer, as the Privacy Policy explains.
      </p>

      <h2 style={h2}>5. AI can be wrong</h2>
      <p style={p}>
        Lectures, answers, notes and summaries are generated by AI and can contain mistakes. The service tries to say so and flag questions it
        is unsure about, but it cannot catch every error. Check important information against your course materials and your lecturer. Do not rely on
        the service alone for assessment decisions, medical, legal or safety matters.
      </p>

      <h2 style={h2}>6. Acceptable use</h2>
      <p style={p}>
        Do not use the service to break the law, to upload content that infringes others' rights or is harmful, to attempt to break or overload the
        service (including automated misuse of the AI features), or to reverse engineer it except where the law allows.
      </p>

      <h2 style={h2}>7. Availability</h2>
      <p style={p}>
        We work to keep the service running but provide it "as is", without promises that it will always be available, error-free, or suitable for
        a particular purpose. We may change or stop features. Features that depend on third parties (such as AI or voice providers) may be
        limited by those providers.
      </p>

      <h2 style={h2}>8. Liability</h2>
      <p style={p}>
        To the extent the law allows, we are not liable for indirect or consequential losses arising from use of the service, and our total
        liability is limited to the amount you paid us for it in the previous 12 months (which may be zero). Nothing here limits liability that cannot be
        limited by law.
      </p>

      <h2 style={h2}>9. Ending use</h2>
      <p style={p}>
        You can stop using the service and delete your account at any time. We may suspend or end access if these terms are broken or to protect the
        service or other users.
      </p>

      <h2 style={h2}>10. Governing law and changes</h2>
      <p style={p}>
        These terms are governed by the laws of Uganda. We may update them; if a change matters we will update the effective date above, and
        continuing to use the service afterwards means you accept the updated terms.
      </p>
    </LegalShell>
  );
}

// Small footer links, reused on the role-select and sign-in screens.
export function LegalLinks({ onOpen }) {
  return (
    <div style={{ marginTop: 14, fontSize: 12, color: "#8890A0" }}>
      <button className="skip-link inline" style={{ margin: 0 }} onClick={() => onOpen("privacy")}>Privacy Policy</button>
      {" · "}
      <button className="skip-link inline" style={{ margin: 0 }} onClick={() => onOpen("terms")}>Terms of Service</button>
    </div>
  );
}
