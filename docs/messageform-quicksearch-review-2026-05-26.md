# MessageForm + QuickSearch Recipient Rules Review

Saved: 2026-05-26

## Scope reviewed
- src/components/forms/MessageForm.js
- src/components/sections/QuickSearch.js
- src/util/AVAGroups.js
- Supporting checks in GroupForm.js, SendMessageDialog.js, QuickAdd.js, withBootstrap.js

## Confirmed behavior
1. MessageForm opens QuickSearch with options from session/client style.
2. QuickSearch returns mixed selection objects (person, group, preferred recipient bundle).
3. MessageForm stores those as newMessageRecipients and expands them at send time:
   - person -> person_id
   - group -> GRP:<group_id>
   - preferred bundle -> personList members
4. Reply-to recipients are also enforced into recipient_key if not already present.

## Important option wiring (MessageForm -> QuickSearch)
- withGroups: toggled by showGroupList/withGroupList
- restrictGroups: state.session.client_style.restrict_groups
- withPreferred: toggled by showPreferredList/withPreferredList
- hidePeople: inverse of withIndividualList
- showAll: state.session.client_style.show_all_people ?? !restrict_groups
- pickAndGo: true
- keepSelections: true

## Access rights shape conclusion
- For QuickSearch path, access rights are consistent with "allowlist of group IDs" semantics.
- Source of truth is AVAGroups.accountAccess(...), which builds and assigns accessList[client_id].groups as an array of allowed group IDs.
- QuickSearch checks group visibility with includes(group_id), matching that array model.

## Cross-file caveat found
- Not all modules treat accessList.groups the same way:
  - QuickSearch path: array allowlist behavior.
  - Some other modules (for example GroupForm/SendMessageDialog) still use map-like or level-style lookups.
- This is a potential consistency risk if data shape changes or mixed payloads are introduced.

## People-list filtering answer (from this review)
- People shown in QuickSearch are mostly constrained indirectly by prebuilt accessList.
- That is not exactly identical to the group-panel runtime restrictGroups branch, but it generally aligns with access constraints from accountAccess.

## Practical decision matrix (compact)
| Condition | Groups shown | People shown | Preferred shown |
|---|---|---|---|
| withGroups=false | Hidden | Depends on hidePeople/showAll/search | Depends on withPreferred |
| withGroups=true, restrictGroups=false | Allowed groups via access list + optional tree/public checks | Access-list people (or all if showAll path enabled) | If enabled by withPreferred |
| withGroups=true, restrictGroups=true | More restrictive subset (leaf/non-parent style behavior in QuickSearch) | Access-list people (search/filter rules still apply) | If enabled by withPreferred |
| hidePeople=true | Unchanged group logic | Hidden list (search behavior depends on QuickSearch options/state) | Unchanged |
| withPreferred=false | Unchanged | Unchanged | Hidden |

## If you revisit this later
- Start in MessageForm where QuickSearch is invoked and where selections are converted in sendMessage().
- Then verify QuickSearch initialize/filter/countSelections paths.
- If hardening is needed, add a shared normalization helper so accessList.groups supports both array and map shapes safely.
