# PMF Assessment — Test Cases

## Q1: "What does your product do in one sentence, and who is the primary user?"

| # | Test Case | Answer Text | Expected Behavior |
|---|-----------|------------|-------------------|
| 1.1 | Well-defined SaaS | `We build an AI-powered code review tool that catches security vulnerabilities before merge. Primary users are senior engineers at mid-size fintech companies.` | High confidence. Category: Developer Tools. ICP specificity: 4-5. Maturity: launched/scaling. |
| 1.2 | Vague/early stage | `We're building something around productivity for teams.` | Medium/low confidence. Category: Productivity. ICP specificity: 1-2. Maturity: idea/mvp. |
| 1.3 | B2C consumer app | `A mobile app that helps college students split rent and shared expenses with roommates.` | Category: FinTech/Personal Finance. ICP: college students. Problem type: acquisition or activation. |
| 1.4 | Marketplace/platform | `We connect freelance 3D artists with game studios who need character models. Both sides use our escrow and revision management system.` | Two-sided marketplace. Category: Creative Tools/Marketplace. Complex ICP extraction. |
| 1.5 | Hardware + Software | `IoT sensors that monitor soil moisture for commercial vineyards, with a dashboard for irrigation scheduling.` | Category: AgTech/IoT. Niche B2B. Competitors may be sparse in research. |
| 1.6 | Minimum length (boundary) | `CRM for vet` | Exactly 10 chars. Should pass garbage check but get low confidence, vague classification. |
| 1.7 | Below minimum (reject) | `hi there` | 8 chars → `ValidationError`: Q1 too short (< 10 chars). Pipeline should NOT call LLM. |
| 1.8 | Empty string (reject) | `` | Empty → `ValidationError`. Hard block before classification. |
| 1.9 | Gibberish | `asdfghjkl zxcvbnm qwerty poiuytr` | Passes length check (>10) but LLM should return `{"error": "..."}` garbage detection. |
| 1.10 | Max length stress | 2000-character detailed product description | Should pass validation. Classification should extract key info despite verbosity. |

---

## Q2: "What is the single strongest signal that users find value in your product?"

| # | Test Case | Answer Text | Expected Behavior |
|---|-----------|------------|-------------------|
| 2.1 | Quantitative metric | `40% of users who complete onboarding return within 48 hours and create at least 3 projects in the first week.` | Strong traction signal. Traction: growing/established. Scoring boost on retention/activation. |
| 2.2 | Qualitative anecdote | `Users tell us they can't go back to their old workflow. One customer said "this saved my team 10 hours a week".` | Moderate signal. Traction: early/growing. Qualitative but valid. |
| 2.3 | Revenue signal | `We have 3 enterprise customers paying $5k/month each, all renewed without being asked.` | Strong monetization signal. Traction: growing. Problem type likely NOT monetization. |
| 2.4 | No signal/pre-launch | `We haven't launched yet, but 200 people signed up for the waitlist from a single Twitter post.` | Traction: early. Pre-launch interest. Maturity: mvp/beta. |
| 2.5 | Negative honesty | `Honestly, most users sign up and never come back. We have about 5% retention after 30 days.` | Low retention signal. Problem type: retention or activation. Traction: none/early. |
| 2.6 | Vague/non-answer | `People seem to like it.` | Low specificity. Should still classify but with lower confidence in traction assessment. |
| 2.7 | NPS-based | `Our NPS is 72, which is in the top quartile for B2B SaaS. Promoters mention speed and simplicity.` | Strong quantitative signal. Established traction. |

---

## Q3: "What is your primary distribution channel today?" (single_select)

| # | Test Case | Answer Value | Expected Behavior |
|---|-----------|-------------|-------------------|
| 3.1 | Organic search | `organic-search` | Maps to SEO-driven. Classification: distribution = organic. Sales model analysis anchored. |
| 3.2 | Paid ads | `paid-ads` | Paid acquisition. Research should look at CAC benchmarks. |
| 3.3 | Referral/WOM | `referral` | Strong PMF signal if paired with good Q2. Natural virality indicator. |
| 3.4 | Outbound sales | `outbound` | Sales-led model. Typically B2B/enterprise. Sales model rec should align. |
| 3.5 | Partnerships | `partnerships` | Partnership-driven. Category/market fit analysis should consider integration ecosystems. |
| 3.6 | Community | `community` | Community-led growth. Relevant for dev tools, open source, niche markets. |
| 3.7 | Social media | `social-media` | Content/social distribution. Typically B2C or SMB B2B. |
| 3.8 | No channel yet | `none` | Pre-distribution. Problem type likely: acquisition. Pipeline should note this gap. |

---

## Q4: "What happens when you ask a paying customer 'What would you use if our product didn't exist?'"

| # | Test Case | Answer Text | Expected Behavior |
|---|-----------|------------|-------------------|
| 4.1 | Spreadsheet fallback | `Most say they'd go back to spreadsheets or manual tracking. Nobody mentions a direct competitor.` | Strong differentiation. No direct substitutes. Competitors: indirect only. |
| 4.2 | Named competitor | `They usually mention Notion or Coda, but say we're better for project tracking because of our timeline view.` | Direct competition. `likely_competitors` should include Notion, Coda. Positioning gap identified. |
| 4.3 | Nothing/would be stuck | `They say they'd be stuck. There's nothing else that does what we do for veterinary clinics specifically.` | Very strong PMF signal. Niche monopoly. High retention scoring expected. |
| 4.4 | Build in-house | `Our enterprise customers say they'd build something internally, which would take 6-12 months and cost $500k+.` | B2B enterprise signal. Strong value prop (build vs buy). Monetization potential high. |
| 4.5 | Multiple alternatives | `It depends — some would use Slack, some would use Discord, some would use Microsoft Teams. We're competing with all of them.` | Crowded market. Multiple strong competitors. Threat levels high. Positioning critical. |
| 4.6 | Haven't asked | `We haven't actually asked this question to our users yet.` | Missing data. Lower confidence on competitive positioning. |
| 4.7 | Would do nothing | `They say they just wouldn't do it at all. The task isn't important enough to find an alternative.` | Weak signal — nice-to-have, not must-have. Problem type: monetization or retention. |

---

## Q5: "What is the biggest risk that could prevent you from reaching PMF in the next 6 months?"

| # | Test Case | Answer Text | Expected Behavior |
|---|-----------|------------|-------------------|
| 5.1 | Runway/funding | `Running out of runway before finding a scalable acquisition channel. We have about 8 months of cash left.` | Financial risk. Problem type: acquisition. Urgency high. |
| 5.2 | Long sales cycle | `Enterprise buyers have a 6-month sales cycle we can't sustain. We need to close deals faster or find SMB customers.` | Sales-cycle risk. Problem type: monetization. Sales model rec should address. |
| 5.3 | Technical/product | `Our AI model accuracy is only 78% and customers need 95%+ to trust it for production use. We need a breakthrough in our ML pipeline.` | Technical risk. Problem type: activation/retention. Product maturity issue. |
| 5.4 | Competition | `A well-funded competitor just raised $50M and is copying our exact feature set. We need to differentiate fast.` | Competitive risk. Research should deep-dive competitors. Positioning recs critical. |
| 5.5 | Regulation | `New EU regulations might require us to completely redesign our data handling, which would take 3-4 months of engineering.` | Regulatory risk. Market analysis should flag. External factor. |
| 5.6 | Team/hiring | `We can't hire fast enough. We need 3 senior engineers and the market is brutal.` | Operational risk. Not directly a PMF blocker but affects execution speed. |
| 5.7 | Overconfident/no risk | `I don't see any major risks. We're growing and customers love us.` | Possible blind spot. Reality check in report should probe this. |
| 5.8 | Market timing | `The market isn't ready yet. We're 12-18 months ahead of demand and need to educate buyers first.` | Timing risk. Problem type: positioning. Market analysis should evaluate readiness. |

---

## Full Pipeline End-to-End Combos

| Combo | Q1 | Q2 | Q3 | Q4 | Q5 | Expected Stage |
|-------|----|----|----|----|----|----|
| **Strong PMF** | AI code review for fintech engineers | 40% D7 retention, NPS 72 | `referral` | "They'd be stuck, nothing else does this" | "Hiring fast enough" | Strong PMF (70-85+) |
| **Early PMF** | Expense splitting for college students | 5k MAU, 20% weekly active | `social-media` | "Venmo or Splitwise but we're simpler" | "Scaling beyond campuses" | Early PMF (50-65) |
| **Approaching** | Productivity tool for teams | "People seem to like it" | `paid-ads` | "Notion, Asana, Monday — lots of options" | "$50M competitor copying us" | Approaching (35-50) |
| **Pre-PMF** | "Something around AI" | Haven't launched yet | `none` | Haven't asked customers | "Running out of money" | Pre-PMF (15-30) |
| **Garbage reject** | "hi" | — | — | — | — | `ValidationError` at Q1 |
