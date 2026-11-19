# Product Brief

Status: User-approved direction, November 20, 2026.

## Purpose

LoomWiki helps people maintain a coherent knowledge base from incoming information. AI does the organizing work; the user reviews what becomes accepted knowledge.

This is not primarily a text editor. The core product question is: how should incoming evidence change the existing knowledge base?

## Workflow

**Inbox → AI proposal → Review → Knowledge**

- Inbox preserves source information and exposes processing state and errors.
- AI identifies whether to create a page or update an existing page and explains the proposed change.
- Review presents the prior content, proposed statements, quotes, and unresolved disagreements.
- Acceptance makes the change effective and records history. Rejection leaves knowledge unchanged.
- A later source can lead to another proposal for the same page.

## Review policy

The first version automates preparation, not approval. Processing begins only after the user chooses to send a source to the model. All page changes require acceptance. Later automation of low-risk changes requires separate product evidence and agreement.

The user may accept a page that retains unresolved perspectives. A review note explains the decision but does not erase the conflict or its sources.

## Initial scope

Local Web, one user, text and Markdown input, one proposed page per processing run, citation inspection, acceptance/rejection, revision history, and explicit errors/retry.

## Outside this version

Background imports, collaboration, hosting, vector search, arbitrary Agent tools, multi-page restructuring, automatic factual adjudication, and native desktop packaging.
