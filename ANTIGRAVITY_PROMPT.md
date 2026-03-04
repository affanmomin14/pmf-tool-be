# Antigravity Browser Automation Prompt

You are a QA tester. Your job is to go to `http://localhost:3000` and run through the PMF assessment flow multiple times using different test case combos. The entire app is a single-page React app — there are NO separate routes. Everything happens on `/` with state-driven UI transitions.

## How the UI Works

1. **Landing page** loads at `http://localhost:3000`. Click the **"Start Free Assessment"** button (it's a shimmering dark button in the hero section with `aria-label="Start free assessment"`).
2. You'll see **Question 1 of 5**. Questions appear one at a time.
3. **Q1, Q2, Q4, Q5** are text areas (`textarea[aria-label="Your answer"]`). Type your answer (must be at least 10 characters). A green checkmark appears when ready. Then click the **"Continue"** button (`button[aria-label="Submit answer"]`).
4. **Q3** is a grid of 8 clickable option cards. Click one and it auto-advances after ~300ms. No "Continue" button needed.
5. After each answer, a micro-insight toast appears for ~2 seconds. **Wait for it to disappear** before interacting with the next question.
6. After Q5, an **analysis loading screen** appears. The backend pipeline runs (classification → research → scoring → report generation). **This takes 25-60 seconds.** Wait for it to finish.
7. A **preview screen** with 3 cards appears. There's an email input (`input[type="email"]`) and an **"Unlock"** button (`button[aria-label="Unlock full report"]`). Enter an email and click Unlock.
8. The **full report** renders. Scroll through it to verify it loaded. Look for the PMF score, scorecard, market analysis, competitors, recommendations, and bottom line sections.

## Important Timing Notes

- Wait ~2 seconds after each answer submission for the micro-insight toast to clear.
- After Q5 submission, the pipeline takes **25-60 seconds**. Do NOT click anything during this time. Just wait for the analysis screen to transition to the preview screen.
- After clicking "Unlock", wait a few seconds for the report to load.
- Between test runs, **refresh the page** (`http://localhost:3000`) to reset state and start fresh.

## Test Runs to Execute

Run the following 5 test combos in order. After each full run, scroll the report to verify it rendered, then refresh and start the next one.

---

### Run 1: Strong PMF (expect score 70-85+)

| Question | What to type / click |
|----------|---------------------|
| Q1 (textarea) | `We build an AI-powered code review tool that catches security vulnerabilities before merge. Primary users are senior engineers at mid-size fintech companies.` |
| Q2 (textarea) | `40% of users who complete onboarding return within 48 hours and create at least 3 projects in the first week. Our NPS is 72.` |
| Q3 (click option) | Click **"Word of Mouth / Referral"** |
| Q4 (textarea) | `They say they'd be stuck. There's nothing else that does what we do for fintech security reviews specifically.` |
| Q5 (textarea) | `Hiring senior engineers fast enough to keep up with enterprise demand. We have more inbound than we can handle.` |
| Email gate | Enter `strong-pmf@test.com` and click Unlock |
| **Verify** | Score should be 70+. Stage should be "Strong PMF" or "Early PMF". Report should show developer tools category. Competitors section should list real code review / security tools. |

---

### Run 2: Early PMF — B2C Consumer App (expect score 50-65)

| Question | What to type / click |
|----------|---------------------|
| Q1 (textarea) | `A mobile app that helps college students split rent and shared expenses with roommates. Primary users are students aged 18-24 in shared housing.` |
| Q2 (textarea) | `We have 5,000 monthly active users and 20% are active weekly. Students tell us it's way simpler than Venmo for recurring shared bills.` |
| Q3 (click option) | Click **"Social Media / Content"** |
| Q4 (textarea) | `They usually mention Venmo or Splitwise, but say we're simpler for recurring shared expenses like rent and utilities.` |
| Q5 (textarea) | `Scaling beyond college campuses into the general young professional market. Our current growth is all campus ambassadors.` |
| Email gate | Enter `early-pmf@test.com` and click Unlock |
| **Verify** | Score should be 45-65. Stage should be "Early PMF" or "Approaching PMF". Category should be FinTech or Personal Finance. Competitors should include Venmo, Splitwise. |

---

### Run 3: Approaching PMF — Crowded Market (expect score 35-50)

| Question | What to type / click |
|----------|---------------------|
| Q1 (textarea) | `A project management and productivity tool for remote teams that combines task tracking, docs, and team chat in one workspace.` |
| Q2 (textarea) | `People seem to like it. We get occasional positive feedback but nothing systematic yet. About 100 users signed up last month.` |
| Q3 (click option) | Click **"Paid Ads (Google, Meta, etc.)"** |
| Q4 (textarea) | `It depends on the user. Some would use Notion, some Asana, some Monday.com, some just go back to Slack and Google Docs. Lots of options out there.` |
| Q5 (textarea) | `A well-funded competitor just raised $50M and is building nearly the same feature set. We need to differentiate fast or we'll get squeezed out.` |
| Email gate | Enter `approaching@test.com` and click Unlock |
| **Verify** | Score should be 30-50. Stage should be "Approaching PMF" or "Pre-PMF". Category should be Productivity. Competitors section should list Notion, Asana, Monday.com. Threat levels should mostly be high. |

---

### Run 4: Pre-PMF — Vague Early Stage (expect score 15-35)

| Question | What to type / click |
|----------|---------------------|
| Q1 (textarea) | `We're building an AI-powered platform for businesses. It helps with various workflows and automation. Still figuring out the exact ICP.` |
| Q2 (textarea) | `We haven't launched yet, but a few friends tried it and said it was interesting. No real metrics yet.` |
| Q3 (click option) | Click **"No clear channel yet"** |
| Q4 (textarea) | `We haven't asked this question to any users yet since we're still in development. Probably ChatGPT or manual processes.` |
| Q5 (textarea) | `Running out of money before we find product-market fit. We have maybe 4 months of runway left and no revenue.` |
| Email gate | Enter `pre-pmf@test.com` and click Unlock |
| **Verify** | Score should be 15-35. Stage should be "Pre-PMF". Classification confidence should be low/medium. Report should flag vague positioning and lack of traction. |

---

### Run 5: Niche B2B — Hardware + Software (expect score 45-65)

| Question | What to type / click |
|----------|---------------------|
| Q1 (textarea) | `IoT sensors that monitor soil moisture for commercial vineyards, paired with a dashboard for automated irrigation scheduling. Users are vineyard operations managers.` |
| Q2 (textarea) | `Vineyards using our system report 30% water savings and 15% yield improvement in the first season. Three wineries renewed annual contracts without negotiation.` |
| Q3 (click option) | Click **"Partnerships / Integrations"** |
| Q4 (textarea) | `They say they'd go back to manual soil testing and gut-feel irrigation timing. One customer said it would cost them $200k in crop losses per season.` |
| Q5 (textarea) | `Hardware supply chain delays. Our sensor components have 16-week lead times and we can't onboard new vineyards fast enough for the growing season.` |
| Email gate | Enter `niche-b2b@test.com` and click Unlock |
| **Verify** | Score should be 45-65. Category should be AgTech or IoT. Competitors may be sparse. Report should recognize niche market with strong unit economics. |

---

## After All 5 Runs

Summarize what you observed:
- Did all 5 runs complete without errors?
- Did the scores roughly match the expected ranges?
- Did the report render fully each time (scorecard, market, competitors, recommendations, bottom line)?
- Did the analysis loading screen transition smoothly to preview?
- Were there any crashes, blank screens, or stuck states?
- Did the email gate unlock the report each time?
- Note any bugs, UI glitches, or unexpected behavior.

## Selectors Quick Reference

| Element | Selector |
|---------|----------|
| Start button | `button[aria-label="Start free assessment"]` or the large shimmering button in the hero |
| Text answer | `textarea[aria-label="Your answer"]` |
| Continue button | `button[aria-label="Submit answer"]` — only visible for text questions |
| Q3 options | Clickable cards with labels like "Word of Mouth / Referral", "Paid Ads (Google, Meta, etc.)" etc. |
| Email input | `input[type="email"][aria-label="Email address"]` |
| Unlock button | `button[aria-label="Unlock full report"]` |
| Progress indicator | Shows "Question X of 5" above each question |
