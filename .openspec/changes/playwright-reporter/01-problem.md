# Problem Statement

## Context
Test Eyes is a test analytics dashboard. Currently it requires manual JUnit XML parsing to collect test data. Customers want a simpler integration.

## Problem
Customers with Playwright tests need an easy way to collect test analytics without manual setup. They want:
- Install npm package
- Configure playwright.config.ts
- Run tests
- Get analytics dashboard automatically

## Goals
1. Zero-friction integration for Playwright users
2. Automatic flaky test detection
3. Data aggregation across multiple test runs
4. Self-hosted dashboard on GitHub Pages
