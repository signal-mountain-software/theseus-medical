# Copilot Coding Agent Instructions for Theseus Medical

## Project Overview
- This is a large React 16.13.1 + Material-UI v4 application, bootstrapped with Create React App.
- Major features include: group assignment workflows, messaging (with template variables), rich text editing, and dynamic forms.
- Backend integration is via AWS Amplify and DynamoDB (see `amplify/` and `src/util/AVAUtilities.js`).
- State management is mostly local React state, with some global session state (`src/components/contexts/Session/`).

## Key Architectural Patterns
- **Component Organization:**
  - Forms: `src/components/forms/`
  - Dialogs: `src/components/dialogs/`
  - Sections: `src/components/sections/`
  - Utilities: `src/util/`
- **Messaging System:**
  - Rich text via ReactQuill (see `MessageForm.js`, `MessageTemplateManager.js`, `RichTextEditor.js`).
  - Template variables are dynamically loaded from `state.session.message_template_variables` and inserted as `<<variable>>`.
- **Group Assignment:**
  - Hierarchical tri-state checkboxes for group selection (see `FormManagement.js`).
  - Defensive filtering and validation to prevent orphaned parent selections.
- **Confirmation Dialogs:**
  - Use `AVAConfirm` for all critical user confirmations (unsaved changes, exit, delete, etc.) for consistent UX.

## Developer Workflows
- **Build/Run:**
  - Use `npm start` for development, `npm run build` for production.
- **Testing:**
  - Use `npm test` for interactive test runner.
- **Debugging:**
  - Console logging is common for debugging; look for `console.log` in components.
- **Amplify Backend:**
  - Backend config in `amplify/backend/` and `src/util/AVAUtilities.js`.

## Project-Specific Conventions
- **Template Variables:** Always use `<<variable>>` format for insertion; never hardcode variable lists—load from session state.
- **Dialogs:** All confirmation dialogs should use `AVAConfirm` for consistency.
- **Component Props:** Most components expect props like `reactData`, `updateReactData`, and session/context objects.
- **Defensive Coding:** Use `.filter()` and null checks to avoid rendering errors with dynamic data.

## Integration Points
- **AWS Amplify:** Used for authentication, API, and storage. See `amplify/` and `src/util/AVAUtilities.js`.
- **DynamoDB:** Data models for groups, messages, templates are managed in backend and referenced in frontend state.
- **ReactQuill:** Rich text editor for messages and templates; use `forwardRef` for programmatic access.

## Examples
- See `src/components/forms/MessageForm.js` for dynamic variable insertion and Quill integration.
- See `src/components/dialogs/MessageTemplateManager.js` for template management and confirmation dialog usage.
- See `src/components/forms/FormManagement.js` for group assignment logic and tri-state checkboxes.

---

If any conventions or workflows are unclear, ask the user for clarification or examples from the codebase before proceeding.
