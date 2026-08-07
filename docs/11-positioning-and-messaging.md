# Positioning & Messaging — Professional Services Firms

**Status**: Draft for review.
**Companion to**: `10-saas-product-scope.md`. Every claim in this document maps to a scoped capability in that one — if a claim has no build behind it, it is marked ⏳ with the phase that delivers it.
**Product name**: unresolved. `[Product]` throughout. See §11.

---

## 1. The Strategic Choice: Which Category We Compete In

Positioning is mostly the decision about **what shelf the buyer mentally puts you on**, because that determines who you're compared against and which budget line pays for you.

Four available shelves, and the trade-off on each:

| Shelf | Budget exists? | Comparison set | Risk |
|---|---|---|---|
| CRM | Yes, small in this segment | HubSpot, Salesforce | Judged on pipeline reporting we won't win on |
| Document management | Yes, large | iManage, NetDocuments, SharePoint | Judged on migration tooling and integrations we won't have for a year |
| Practice management | Yes, largest | Clio, Karbon, Practice Ignition | Judged on time recording and billing, which we don't do |
| **New category** | No | Nothing | Category creation takes years and a budget we don't have |

### Recommendation

**Anchor on document management, differentiate on the relationship layer and the AI.**

The reasoning: document management is where the *pain* is loudest and the budget is already allocated, and it's the category where the incumbents are most disliked. Firms complain about iManage's cost and SharePoint's chaos constantly; they rarely complain about their CRM, because most don't have one worth complaining about.

Do **not** attempt category creation. "Client intelligence platform" and similar coinages require a category-king marketing budget and three years. Be a better-understood thing on a shelf the buyer already shops from, and let the differentiators do the work.

### The competitor that actually beats us

Not iManage. **The shared drive plus Outlook plus a spreadsheet.** In this segment, most lost deals are lost to "we'll carry on as we are" — not to another vendor. Every piece of messaging must be built to beat inertia first and competitors second. Concretely: the cost of the status quo must be made vivid, because firms have normalised it completely.

---

## 2. Positioning Statement

> For **managing partners and practice leaders at professional services firms** who need client relationships and confidential documents in one place but cannot put privileged material into general-purpose tools,
> **[Product]** is a **client and matter platform**
> that keeps the relationship, the documents, and the AI inside a single confidentiality boundary.
>
> Unlike CRMs that can't safely hold privileged files, or document systems that don't know who the client is,
> **[Product] treats the matter as the unit of both** — so the file, the people, the deadlines, and the access record are one object.

### The one-line version

**Your client work doesn't need software that stores files. It needs one that knows what's in them.**

### The paragraph version

Professional firms run their most valuable work across a shared drive, an inbox, and someone's memory. [Product] brings the client relationship and the confidential documents into one system, organised around the matter rather than the folder — encrypted with keys only your firm holds, with an AI that answers from your own approved material and cites its sources. Nothing leaves your confidentiality boundary. Nothing is a guess.

---

## 3. Buyer Map

Four people, three of whom can kill the deal.

### 3.1 Managing Partner / Practice Head — *economic buyer*

| | |
|---|---|
| **Cares about** | Firm risk, partner time, client retention, not looking foolish in front of a client |
| **Trigger to buy** | A near-miss — a document sent to the wrong party, a missed renewal, a departing partner who took relationships with them |
| **Kills the deal** | Anything that sounds like the software gives professional advice; anything that increases regulatory exposure |
| **Lead with** | "Every matter's history, in one place, when the partner who ran it leaves." |
| **Never say** | "AI-powered decisions." They hear *unaccountable*. |

### 3.2 Practice Manager / Operations Lead — *champion*

| | |
|---|---|
| **Cares about** | Chasing fee earners for filing, onboarding new staff, finding things, audit prep |
| **Trigger** | Growth — the informal system that worked at 20 people breaks at 50 |
| **Kills the deal** | Migration effort they'll personally absorb |
| **Lead with** | "Stop being the search engine for your own firm." |
| **This is who you sell to.** They feel the pain daily and will build the internal case | |

### 3.3 IT / Risk / Compliance — *veto holder*

| | |
|---|---|
| **Cares about** | Where data lives, who can read it, what happens on breach, whether the AI trains on their data |
| **Trigger** | None — they never initiate, they only block |
| **Kills the deal** | Vague encryption answers, no DPA, no pen test, overstated security claims |
| **Lead with** | The security page, the subprocessor list, and a straight answer about the AI (§7.2) |
| **Rule** | Answer this persona in writing, precisely, before they ask. Being the vendor with the *clearest* answer wins more than being the vendor with the *strongest* one. |

### 3.4 Fee Earner — *user, and the reason it fails*

| | |
|---|---|
| **Cares about** | Billable hours. Nothing else. |
| **Kills the deal** | Any workflow that adds clicks between them and the work — after purchase, via non-adoption |
| **Lead with** | "Finds it faster than asking the person who wrote it." |
| **Design constraint** | Every feature must be justifiable in seconds saved, or it will not be used |

---

## 4. Differentiators and Their Proof

Four claims. Each needs a proof point, or it's noise.

### 4.1 Confidential by architecture

**Claim**: Your material is encrypted with keys unique to your firm, and the genuinely sensitive documents are encrypted in your browser where we can't read them at all.

**Proof**: Per-tenant KMS keys; two-tier classification (Working / Sealed); ethical walls that deny access at the engagement level, overriding role permissions; database-level tenant isolation via row-level security. (Scope §2, §3.2, §5.1) ⏳ Phases 0–1

**Why it wins**: Every competitor says "bank-level encryption." Almost none can explain their key hierarchy. Being specific *is* the differentiation.

**Honesty constraint**: Working-tier documents are readable by our servers — that's what makes search and AI possible. Say so plainly. (Scope §2.2)

### 4.2 One record for the relationship and the documents

**Claim**: The matter is one object — parties, team, documents, deadlines, and access history together.

**Proof**: The `Engagement` entity as the organising unit and the confidentiality boundary; typed relationships between documents; conflict checking across parties. (Scope §4.2, §6.3) ⏳ Phases 2–3

**Why it wins**: This is the structural claim no incumbent can match without a rewrite. CRMs bolt on file storage; DMSes bolt on contacts. Neither treats the matter as primary.

### 4.3 An AI that never guesses

**Claim**: Answers come from your firm's own approved documents, with a citation to the source and version. When the answer isn't in your material, it says so.

**Proof**: Retrieval restricted to approved documents within the user's clearance; citations to document and version; explicit "not found in your material" path; drafting only from firm-approved precedent. (Scope §6.1, §6.5) ⏳ Phase 3

**Why it wins**: The entire market is selling AI fluency. Professional firms are frightened of fluency without accountability. Selling *bounded* AI to a liability-carrying buyer inverts the category's messaging in our favour.

### 4.4 A defensible record

**Claim**: Every view, download, and share is logged in a record that can't be quietly altered — including by us.

**Proof**: Hash-chained access and audit logs; share grants with expiry, watermarking, and download limits; retention policies and legal hold. (Scope §4.3, §5.5) ⏳ Phases 1–2

**Why it wins**: Answers the question every security review asks and most vendors fumble: *could an administrator alter the history?*

---

## 5. Message Hierarchy

Ordered by what to say first when you have thirty seconds.

1. **The matter is one object.** Relationship, documents, deadlines, access record — together, not scattered across four systems.
2. **Confidential by architecture.** Per-firm keys; browser-side encryption for the sensitive ones; ethical walls enforced in the database.
3. **AI that cites its sources.** Grounded in your approved material, or it says it doesn't know.

Everything else — search, versioning, approvals, sharing, retention — is supporting detail. Firms expect those and won't pay extra for them, but their absence loses deals.

---

## 6. Competitive Frames

### vs. the shared drive (the real competitor)

Don't attack it — firms are attached to it and attacking it insults the person who set it up. Make the cost visible instead:

> "How long would it take to find every document from a matter you closed three years ago, if the partner who ran it has left?"

Then quantify: partner hours spent searching, the renewal that was missed, the file that went to the wrong recipient. Inertia breaks on a specific remembered incident, not on a feature list.

### vs. generic CRM (HubSpot, Salesforce)

> "It'll track your pipeline. Ask what happens when you need to put the client's confidential file against the record."

Concede freely: they have better pipeline reporting and a bigger integration marketplace. Win on the fact that professional firms' actual work product can't live there.

### vs. DMS incumbents (iManage, NetDocuments, SharePoint)

> "They'll store the document. They can't tell you who the client is, what's due, or what's in it."

Against SharePoint specifically, the wedge is structure — SharePoint is a blank canvas that becomes a swamp. Against iManage, it's cost and interface age. Be careful: they have twenty years of integrations and migration tooling. Don't fight on breadth.

### vs. practice management (Clio, Karbon)

> "They run your billing. We run your knowledge. Most firms need both."

Position as complementary, not competing — and build the integration early. Fighting the billing system is fighting the system of record for revenue, which is unwinnable.

### vs. ChatGPT / Copilot

> "It's fluent about everything and accountable for nothing. Ours only knows what your firm has approved — and shows you where it got it."

The strongest frame available, because the buyer already has this anxiety and no one is resolving it for them.

### Where we genuinely don't fit — say so

Firms under five people (no budget, no compliance pressure). Firms needing time recording and billing as the primary system. Firms mid-migration onto an incumbent DMS. Walking away early buys credibility that comes back as referrals.

---

## 7. Objection Handling

### 7.1 "We already have SharePoint / a shared drive."

> "Most firms we work with do. The question isn't storage — it's whether you can see everything about a client in one place: who's involved, what's been sent, what's due, and who's opened it. What does that take you today?"

Reframe from storage to retrieval and accountability.

### 7.2 "Is our data used to train your AI?" *(the most important one)*

> "No. We use providers configured for zero data retention — your material isn't retained or trained on, and that's in our contract with them and in our DPA with you. Your documents are indexed only within your own firm's isolated store."

Have this in writing on the security page before the first sales call. This single question kills more AI deals in professional services than price. (Scope §5.6)

### 7.3 "How do we know you can't read our documents?"

The honest answer, which is more persuasive than a comfortable one:

> "For working documents, we can — that's what makes search and AI possible, and any vendor claiming otherwise while offering both isn't being straight with you. For documents you mark Sealed, they're encrypted in your browser before they reach us, so we hold only ciphertext. You choose which is which."

Buyers in this segment have heard enough vendor over-claiming to reward precision. (Scope §2.2)

### 7.4 "Do you have SOC 2?"

Before certification:

> "Not yet — we're in the evidence-collection period, with the report expected [date]. What we can give you now is our penetration test summary, our security architecture, our DPA, and our subprocessor list."

Never imply certification you don't hold. One discovered exaggeration ends the relationship and the reference. (Scope §5.7)

### 7.5 "We can't move twenty years of files."

> "You don't move all of it. Start with open matters — that's where the pain is. Historic material can be bulk-imported in the background or left where it is and linked."

Migration fear is the top post-demo stall. Have a named migration process, not a promise. (Scope §7)

### 7.6 "Our partners won't use it."

> "They probably won't, at first — partners adopt what saves them time in the first week. That's why the entry point is search and retrieval, not data entry. Nobody has to fill in a form to get value."

Adoption is the real churn risk. Say it before they do.

### 7.7 "It's more expensive than what we use now."

> "Compared to the shared drive, yes. Compare it to one partner-hour a week spent looking for things, across your fee earners."

Anchor against billable rates, which are high in this segment and make the ROI arithmetic trivial.

---

## 8. Vertical Adaptation Layer

The core positioning holds across professional services. The **vocabulary must not be generic** — using the wrong word signals you don't know the profession, and in this segment that's disqualifying within one sentence.

| Concept | Law | Accounting / Audit | Consulting |
|---|---|---|---|
| Engagement | Matter | Engagement | Engagement / Project |
| Client entity | Client / Party | Client | Client / Account |
| Confidentiality basis | Privilege | Confidentiality + independence | NDA / commercial sensitivity |
| Wall | Ethical wall / Chinese wall | Independence safeguard | Conflict screen |
| Pre-acceptance check | Conflict check | Independence & conflict check | Conflict check |
| Deliverable | Advice / Document | Report / Opinion | Deliverable |
| Practitioner | Fee earner | Practitioner | Consultant |
| Regulator concern | SRA / Bar rules | ICAEW/ACCA, audit regulator | Generally none |

### Per-vertical lead

| | Primary pain | Lead differentiator | Compliance bar |
|---|---|---|---|
| **Law** | Conflicts, privilege, matter history | Confidential by architecture (§4.1) | Highest — SRA, privilege obligations |
| **Accounting** | Independence, deadlines, working papers | Defensible record (§4.4) | High — regulator inspection |
| **Consulting** | Knowledge reuse, proposals, staff churn | AI that never guesses (§4.3) | Lowest — commercial only |

**If forced to pick one to lead with: law.** Highest willingness to pay, sharpest pain, and the compliance bar that clears every other vertical for free. The cost is the longest sales cycle and the hardest security review — which is precisely why it should shape the product now rather than later.

---

## 9. Homepage Draft

> # Your client work doesn't need software that stores files. It needs one that knows what's in them.
>
> Every matter — the people, the documents, the deadlines, the access record — in one place. Encrypted with keys only your firm holds.
>
> **[Book a walkthrough]** · **[Read the security architecture]**
>
> ---
>
> ### 🔒 Confidential by architecture
> Encrypted with per-firm keys. Sealed documents are encrypted in your browser, where we can't read them. Ethical walls enforced at the database, not by policy.
>
> ### 🔗 The matter is one object
> The relationship and the documents, finally in the same record. Not a CRM with a file attachment. Not a folder with a contact field.
>
> ### 📎 An AI that never guesses
> Answers drawn from your firm's approved material, with a citation to the source and version. When it isn't in your documents, it says so.
>
> ---
>
> Basic document management tells you where the file is.
> **[Product] tells you what's in it, who's seen it, and what's due.**

Note the second call-to-action. Linking the security architecture from the homepage is unusual and disproportionately effective with this buyer — the veto-holder (§3.3) self-serves, and the confidence signal reaches the economic buyer indirectly.

---

## 10. Words We Don't Use

A discipline list. Each has a specific reason.

| Never | Why |
|---|---|
| "Zero-knowledge" (product-wide) | Untrue for the working tier. Tier-specific claims only. (Scope §2.2) |
| "AI-powered decisions" | Reads as unaccountable to a liability-carrying buyer |
| "Tells you what to do next" | Sounds like professional advice; creates real exposure |
| "Military-grade encryption" | Means nothing; signals we're not technical |
| "Revolutionary", "game-changing", "cutting-edge" | Conservative buyer; novelty is a risk signal, not a benefit |
| "Replaces your [DMS/practice management]" | Rip-and-replace framing triggers the migration objection immediately |
| "Fully automated" | Implies work happening without professional oversight |
| Any unearned compliance claim | One discovered exaggeration ends the deal and the reference |

**Preferred register**: precise, unhurried, faintly understated. This buyer is persuaded by specificity and made suspicious by enthusiasm. Where a competitor writes *"AI-powered intelligence that transforms your firm,"* we write *"It cites its sources."*

---

## 11. Open Items

1. **Product name.** Unresolved. Needs to work alongside Keyvantic as the parent brand — sub-brand, standalone, or descriptive.
2. **Vertical to lead.** §8 recommends law. Confirms the vocabulary throughout, the integration priorities, and the compliance sequence.
3. **Pricing and packaging.** §7.7 anchors on billable-hour arithmetic; the actual model is still open (Scope §9.6).
4. **Proof assets not yet built**, in order of sales impact:
   - Security architecture page — needed before the first sales call (§7.2, §7.3)
   - DPA and subprocessor list — needed before the first paying customer
   - Penetration test summary — needed before general availability
   - Two named case studies — the single highest-converting asset, and unavailable until design partners have run for a quarter
5. **Claims currently ahead of the build.** Everything marked ⏳ in §4. Sales must not lead with a Phase 3 claim during a Phase 1 product. Re-review this document at the end of each phase and move ⏳ items to shipped.
