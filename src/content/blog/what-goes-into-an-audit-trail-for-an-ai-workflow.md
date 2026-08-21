---
title: What goes into an audit trail for an AI workflow
category: Systems
readingMinutes: 7
publishedAt: "2026-08-20"
updatedAt: "2026-08-20"
summary: An audit trail for an AI workflow must reconstruct a decision as it stood when it was made, using only the evidence retained with the case.
---

An audit trail for an AI workflow must reconstruct a decision as it stood when it was made, using only the evidence retained with the case.

## Introduction

The question always arrives in the same form: show me why the system did that, for this case, on this date. Sometimes it comes from an internal auditor, sometimes from a supervisor, occasionally from a customer's lawyer. It is never a general question about the model. It is always about one case, months after the fact.

Most teams answer it by pulling up a conversation log. The prompt is there, the response is there, and the timestamp is there. It is not enough, and the reason it is not enough is worth being precise about. A conversation log tells you what was said. An audit trail has to let someone reconstruct the decision as it stood at the moment it was made, using only the record.

Those are different requirements, and the second one is the one you get asked about.

## Reconstructing a decision

Take a straightforward case. An onboarding file comes in, the system reads the incorporation documents, checks the ownership structure against a register, assembles the file and puts it in front of an analyst. The analyst approves it. Eleven months later, someone wants to know why.

To answer that from the record, you need seven things.

The inputs as they arrived, not as they exist now. The document may have been superseded, the register entry may have been updated, the customer record may have been edited twice since. What matters is what the system was looking at.

The sources it retrieved, with versions. If the system applied a policy, you need to know which version of that policy it read, not which version is current. This is where most retrieval systems are weakest, because they index documents without treating the version as part of the identity of the document.

The model and its configuration. Which model, which version, what temperature, what system instruction, what tools it was allowed to call. Model providers deprecate and silently update. If your record says only that a decision came from a model, you have recorded almost nothing.

The output, in full, including the parts nobody looked at.

The human action. Who saw it, what they saw, what they did, and how long it took. If the analyst edited the summary before approving, both versions belong in the record. The gap between what the system proposed and what the person approved is often the most interesting line in the whole trail.

The exception path, when there was one. What failed, what was retried, what a person did about it. Systems get reviewed on their bad days.

The component versions of everything above, so that if the same case is replayed later, you can tell whether a difference in the outcome is a difference in the case or a difference in the system.

## Everything is not the same as enough

The first instinct after reading a list like that is to log everything. We have had that instinct and acted on it, and it was the wrong call in both directions.

Logging every event produces a volume nobody can search, which means that when the question comes, the answer takes three days of engineering time instead of five minutes of an analyst's. It also creates a second copy of sensitive data with its own classification, its own retention obligation and its own access problem. An audit trail that a supervisor cannot be shown because it contains more than the case file did is a liability wearing the costume of a control.

The useful frame is narrower. Decide which steps are consequential, meaning a person could reasonably be asked to defend them, and record those completely. Record everything else at the level you would need to debug, with a shorter retention. The line moves per use case, and it is a design decision made before the logging is configured.

## Where the trail lives

The second mistake is more expensive and less visible. The trail gets stored wherever the AI platform stores it, which is usually the vendor's system.

That works until you change vendors, or the vendor changes its retention policy, or you need to hand the record to someone who is not going to be given a login. Evidence about your cases belongs in your systems, under your retention rules, reachable by your case identifier. The AI platform is a component. Components get replaced, and the record of what happened to a customer eleven months ago should not be replaced with them.

Practically this means the workflow [writes its trail to your storage](/ai-first-enterprise/private-ai) as it goes, keyed to the case, rather than the platform accumulating it and exposing an export.

## Process documentation is not case evidence

The third mistake is the one that survives longest, because it looks like the work is done.

An organisation writes a thorough description of how the AI workflow operates, gets it approved, and files it. Then the question comes about one case, and the description cannot answer it, because a description of how something normally works is not evidence about a specific instance.

Both are needed. The description explains the design and the controls. The trail answers the question about case 4471. When an audit goes badly, it is usually because the organisation had the first one and assumed it covered the second.

## What this costs if you leave it

Building this into the design costs a modest amount, mostly in deciding what counts as consequential and in wiring storage that is not the vendor's. Adding it after a system is live costs considerably more, because the interesting parts are the ones that were never captured. You cannot reconstruct the version of a policy the system read six months ago if you never recorded that it read a version at all.

The uncomfortable part is that nothing about this shows up in a pilot. A pilot is judged on whether the output is good, and the output is good. The trail matters at the point where the system stops being an experiment and starts being something a person has to defend, and by then the design decisions have already been made.

That is the argument for [settling it in week one](/ai-first-enterprise/ai-audit), when it is a conversation, rather than in month eight, when it is a rebuild.
