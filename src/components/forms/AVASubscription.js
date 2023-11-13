import React from 'react';
import { updateDb, makeArray } from '../../util/AVAUtilities';
import { makeName } from '../../util/AVAPeople';
import useSession from '../../hooks/useSession';
import AVAConfirm from '../forms/AVAConfirm';

import Dialog from '@material-ui/core/Dialog';


export default ({ defaults, onClose }) => {

  // Constants and React state variables
  const { state } = useSession();
  let defaultValues = {};
  makeArray(defaults).forEach(d => {
    defaultValues = Object.assign(defaultValues, d);
  })
  const [mode, setMode] = React.useState(defaultValues.options.mode);
  
  if (mode === 'newSubscription') {
    return (
      <Dialog
        open={true}
        p={2}
        fullScreen
      >
        <AVAConfirm
          promptText={[
            'Welcome to AVA!',
            '[style={size:1.2,top:0}]You will be redirected to our subscription partner site.',
            `[style={size:1.2,top:0}]Return here after you've completed that form.`,
            '[style={size:1.2,top:0}]Thank you!',
            '',
          ]}
          cancelText={`Cancel`}
          confirmText={`Subscribe`}
          onCancel={onClose}
          onConfirm={() => {
            window.open(defaultValues.options.link || 'https://buy.stripe.com/3cs5lzbSS9RXecwcMN', 'AVA Subscription');
            setMode('checkSubscription');            
          }}
        />
      </Dialog>
    );
  }
  else if (mode === 'checkSubscription') {
    return (
      <Dialog
        open={true}
        p={2}
        fullScreen
      >
        <AVAConfirm
          promptText={[
            'Tap below to continue'
          ]}
          cancelText={`I didn't subscribe this time`}
          confirmText={`Yes! I subscribed!`}
          onCancel={async () => {
            setMode('end');
            onClose();
          }}
          onConfirm={async () => {
            let respID = makeArray(state.session.responsible_for)[0];
            let respName = await makeName(respID);
            await updateDb(
              [
                {
                  "table": "People",
                  "key": { "person_id": state.session.patient_id },
                  "data": {
                    "clients": [
                      {
                        "groups": [
                          "friends&family",
                          "ALL",
                          "_TOP_"
                        ],
                        "id": state.session.client_id
                      }
                    ],
                    "groups": [
                      "friends&family",
                      "ALL",
                      "_TOP_"
                    ]
                  }
                },
                {
                  "table": "SessionsV2",
                  "key": { "session_id": state.session.patient_id },
                  "data": {
                    "assigned_to": "friends&family",
                    "subscription_status": "pending",
                    "patient_id": respID,
                    "patient_display_name": respName,

                  }
                }
              ]
            );
            window.location.replace(`${window.location.href.split('?')[0]}?rel=${new Date().getTime()}`);
          }}
        />
      </Dialog>
    );
  }
  else if (mode === 'cancelSubscription') {
    return (
      <Dialog
        open={true}
        p={2}
        fullScreen
      >
        <AVAConfirm
          promptText={[
            'Tap below to continue',
            '',
            '[style={size:0.5}]It may take up to seven days for your billing to be updated.'
          ]}
          cancelText={`Ooops.  I didn't mean to cancel!`}
          confirmText={`Yes.  Please cancel my subscription.`}
          onCancel={async () => {
            setMode('end');
            onClose();
          }}
          onConfirm={async () => {
            await updateDb(
              [
                {
                  "table": "People",
                  "key": { "person_id": state.session.person_id },
                  "data": {
                    "clients": [
                      {
                        "groups": [
                          "friends&family_pending"
                        ],
                        "id": "AVA_Demo"
                      }
                    ],
                    "groups": [
                      "friends&family_pending"
                    ]
                  }
                },
                {
                  "table": "SessionsV2",
                  "key": { "session_id": state.session.person_id },
                  "data": {
                    "assigned_to": "friends&family_pending",
                    "subscription_status": "cancelled"
                  }
                }
              ]
            );
            window.location.replace(`${window.location.href.split('?')[0]}?rel=${new Date().getTime()}`);
          }}
        />
      </Dialog>
    );
  }
};
