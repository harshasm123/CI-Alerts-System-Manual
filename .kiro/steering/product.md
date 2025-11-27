# Product Overview

## CI Alert System

Production-grade AWS competitive intelligence platform for pharmaceutical industry. Automatically ingests drug/molecule news from multiple sources (PubMed, FDA, EMA, ClinicalTrials.gov, WIPO), processes with AI (AWS Bedrock Claude), and delivers personalized daily digest emails at 9 AM UTC based on user-defined molecule watchlists.

## Core Features

- Secure authentication via AWS Cognito (email-based sign-in)
- User molecule watchlists with CRUD operations
- AI-powered insights using Amazon Bedrock Nova Pro
- Daily automated ingestion (midnight UTC) and digest emails (9 AM UTC)
- React web UI with dashboard, insights viewer, and settings
- RESTful API with JWT authentication on all endpoints
- CloudWatch monitoring with alarms and dashboards

## Target Users

Pharmaceutical companies, biotech firms, and healthcare organizations tracking competitive intelligence on specific drug molecules and compounds.

## Key Differentiators

- Fully serverless, production-ready AWS architecture
- Cost-optimized (~$10-15/month for light usage)
- Multi-source data ingestion with intelligent AI processing
- Personalized per-user watchlists and email preferences
