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
