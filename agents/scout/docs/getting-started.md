# Getting started with Lumen

Lumen is a product analytics platform. You send events from your app, and Lumen turns them into funnels, retention charts and dashboards.

## Create a project

Every workspace starts with one project. Create more projects from **Settings → Projects**. Each project has its own write key, and events never mix between projects.

## Install the snippet

Install the JavaScript SDK with `npm install @lumen/browser` and call `lumen.init("<write key>")` once on page load. Server-side SDKs exist for Node, Python and Go.

## Your first event

Call `lumen.track("Signed Up", { plan: "pro" })`. Events show up in the Live view within 10 seconds.
