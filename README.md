## Branch Promotion Guardrail

Expected promotion flow:

`local -> test -> develop -> master`

This repo includes a shared Git `pre-push` hook at `.githooks/pre-push` that warns when pushing to any branch other than `test`.

Enable it locally once per clone:

```bash
git config core.hooksPath .githooks
```

The hook is warning-only (it does not block the push).

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Menu Item Add Permissions

In the MainMenuV3 item editor, menu items (`menu_itemType: "menu"`) include
`Who can add items under "<short description>"?`. This edits the item's
`allow_add` array independently of its `available_to` visibility rules.
Both use the same user/group/special-value picker and allow/deny rules.
Non-menu items do not show this control or write `allow_add`.

## Adding Function Menu Items

Master accounts can select **Function** in MainMenuV3's add-item dialog and the
shared AddMenuItemDialog used by group menus. Supply the exact target name and
a JSON object for params (`{}` is valid); these are saved as `call.target` and
`call.params` on a `menu_itemType: "function"` record. Nested `options`,
`defaults`, `request`, and string tokens such as `<sessionRec>` are preserved.
The usual title, color, and visibility controls still apply.

**Copy function from** lists Function entries in the same client. Hover over an
entry to preview its target and params, or select it to populate the editable
fields. Copying does not change title, color, or access. Function creation is
master-only; the new card's `available_to` rules determine who can see it.

## Responsive Form Prompts

FormFillB treats configured prompt widths as preferred sizes, capped by the
available container width (including field margins). Selection labels wrap
within their prompt boxes on narrow screens; wider screens retain the requested
size when space permits.

## Form Stage Locking

FormBuilder's section padlock toggles `on_entry_lock` on the following stage,
using FormFillB's stage order (`complete` is always last). The last section's
stage therefore targets `complete`. Blue means enabled; gray means disabled.
Save the form to persist the toggle. Sections sharing a stage share this setting.
This retains the existing runtime behavior: locking happens during a save when
the target stage is current. A stage skipped because its answers are already
valid does not trigger its entry lock.

## Cloning Forms

Clone copies the last saved form, including attributes not modeled by the editor.
After a successful clone, the form list refreshes and selects, focuses, and scrolls
to the new copy. Cloning from the editor returns to the list; unsaved changes
require confirmation before they are discarded. Failed clones leave the editor
open and display an error.

## QuickAdd Person Classification

Every entry in the client's `new_account_form` customization must explicitly
configure `person_type` as one of `staff`, `family`, `core`, or `guest`.
For example, an entry with `"account_type": "camper"` can use
`"person_type": "core"`. This classification is separate from account
types, group membership, and access permissions.

`core` identifies the primary population served by the client, such as residents,
campers, or students. Its generic display label is "Core Member"; it does not
describe access privileges, activity status, or who operates the app.

An additional internal value, `admin` (displayed as "Internal Administrator"),
identifies technical-support accounts. It is managed only by database
administrators, not assigned by `new_account_form`. QuickAdd preserves existing
`admin` classifications without offering reclassification and rejects `admin`
in account-creation configuration. This value does not grant permissions;
authorization continues to use the existing access controls.

QuickAdd blocks saving when the selected entry has a missing or invalid
`person_type`. New People records use the configured value. Existing records
with an absent or null value receive it automatically; matching values are
preserved. Different non-null values (except database-managed `admin`, and
including invalid legacy values) require
an explicit choice to keep the current classification or change it. Other form
fields and preauthorization data cannot override that classification decision.

## Supplying a QuickAdd Configuration

QuickAdd accepts an optional `new_account_form` prop containing a **single entry**
(not the client's full configuration array):

```jsx
<QuickAdd
  onClose={handleClose}
  new_account_form={{
    account_type: 'visitor',
    person_type: 'guest',
    field_list: ['first_name', 'last_name'],
    default_groups: ['guests'],
    family_role: 'none'
  }}
/>
```

The supplied entry replaces initial account-type selection, including when
adding to an existing family. It takes precedence over a database entry with the
same `account_type`; other database entries remain available for configured
follow-on accounts. The caller's object is copied, not mutated.

The same field loading, required-field validation, group assignment, completion,
person classification, and admin/group eligibility rules apply. Invalid or
ineligible supplied entries show an error rather than falling back to another
type. URL and login-preauthorization entry points retain their existing
verification requirements, and authorization must name the supplied
`account_type`. An absent or null prop preserves the existing selection flow.

## Form Group Removals

FormFillB's stage `on_complete_groups` / `on_entry_groups` rules and final-save
`options.group_assignments` remove membership from each named group **and all
currently joined descendants**. Removals finish before the paired additions run.
For example, `{ "remove": ["Parent"], "add": ["Child1"] }` clears memberships
throughout Parent's subtree, then joins Child1 and restores its ancestors.
Use actual group IDs in these lists.

On every save, FormFillB reevaluates `on_complete_groups` independently for each
stage with a visible, active section and no section validation errors. An earlier
hidden or incomplete stage does not block group rules in a later eligible stage.
Hidden-only and sectionless stages are excluded; the synthetic `complete` stage
still requires overall completion. Passing rules run on first stage completion,
including preset/default answers. Subsequently, a field-gated rule runs only
when one of its referenced `showIf` / `ignoreIf` field values differs from the
last-saved answer and its current gate passes. Resulting group lists are not
used to suppress these changes. Unconditional completion rules run only on first
completion; unchanged answers do not repair external membership changes.
`group_completed_stages` is persisted on the document to track independent
completion across saves and reopening. Older documents infer prior completion
from their saved stage order until this history is written. Entry group rules
run on stage entry or a relevant field change, not unchanged repeat saves.
Later stages
retain exact-group-ID last-mention precedence; current-stage entry rules apply
after completion rules. Stage ordering, form status, locking, and non-group
completion eligibility are unchanged.
Messages, notifications, and tasks retain their existing change/transition
triggers. Group mutations also run existing `onAdd` / `onRemove` group rules.

Shared utility callers opt in with
`removeMember(personId, clientId, groupIds, { includeDescendants: true })`.
Omitting the option preserves the existing named-group removal behavior.
The opt-in reads a fresh hierarchy and all active membership pages, retains
unrelated memberships, cleans up orphaned ancestors, and awaits existing
`onRemove` rules. Those rules retain their existing side effects and error handling.
Direct removal read/write failures stop FormFillB's paired additions and report
a save error. These multi-record updates are sequential, not transactional;
a failure can leave partially applied removals.

## Login Account-Creation Authorization

LoginModuleV2 always opens the authorization-code step for new accounts.
When `client_style.preAuth.require_pre_auth` is truthy, a code must be entered
manually, and the instructions name the client to contact for help.
When that setting is missing or falsy, the user can enter a code or tap **Skip**
beside **Continue**. Skip validates `client_style.preAuth.default_code` within
the current client's PreAuthorization records and passes the matched code to
QuickAdd through the existing `login_preauth` flow. It does not create an
account without a valid code. Missing or unrecognized defaults show a warning
and leave the user at the prompt to enter a valid code.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.<br />
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br />
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.<br />
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.<br />
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br />
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: https://facebook.github.io/create-react-app/docs/code-splitting

### Analyzing the Bundle Size

This section has moved here: https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size

### Making a Progressive Web App

This section has moved here: https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app

### Advanced Configuration

This section has moved here: https://facebook.github.io/create-react-app/docs/advanced-configuration

### Deployment

This section has moved here: https://facebook.github.io/create-react-app/docs/deployment

### `npm run build` fails to minify

This section has moved here: https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify
