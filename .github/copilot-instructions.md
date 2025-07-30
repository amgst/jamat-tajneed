# Copilot Instructions for Jamaat Ahmadiyya Muridke Membership Management System

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview
This is a React TypeScript membership management system for Jamaat Ahmadiyya Muridke built with:
- **Frontend**: React + TypeScript + Vite
- **UI Library**: Ant Design (use built-in components only, no custom CSS)
- **Backend**: Firebase (Auth & Firestore)
- **Routing**: React Router DOM
- **Date Handling**: Day.js
- **Charts**: @ant-design/charts
- **CSV Handling**: PapaParse

## Architecture Guidelines
- Use TypeScript interfaces for all data structures
- Implement proper error handling and loading states
- Use Ant Design components exclusively for UI
- Follow React best practices with hooks and functional components
- Use Firebase Firestore for data persistence
- Implement proper authentication flow

## Key Features
1. Member Registration & Management
2. Family Grouping
3. Dashboard with Statistics
4. Search & Filtering
5. Import/Export (CSV)
6. Authentication

## Tanzeem Classification Rules
- **Boys**: Under 7: Saf-e-Awal, 7-15: Atfal, 15-40: Khuddam, 40+: Ansar
- **Girls**: 7-15: Nasirat, 15+: Lajna

## Code Style
- Use functional components with hooks
- Keep components small and focused
- Use proper TypeScript typing
- Implement proper error boundaries
- Use consistent naming conventions
- Add proper JSDoc comments for complex functions
