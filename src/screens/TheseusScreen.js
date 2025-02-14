import React from 'react';

import Box from '@material-ui/core/Box';

import useSession from '../hooks/useSession';

import AVAMenu from '../components/sections/AVAMenu';
import ConnectMenu from '../components/sections/ConnectMenu';
import FormFillB from '../components/forms/FormFillB';

import { useCookies } from 'react-cookie';

export default () => {
  const { state } = useSession();
  const { patient, session } = state;
  const [cookies, , removeCookie] = useCookies(['AVAuser', 'AVAaction']);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(registration => {
        registration.update();
      })
      .catch(error => {
        console.error(error.message);
        throw error.message;
      });
  }

  if (cookies.AVAaction) {
    if (cookies.AVAaction.document) {
      return (
        <FormFillB
          request={{
            document_id: cookies.AVAaction.document,
            person_id: cookies.AVAaction.docUser,
            mode: 'new'

          }}
          onClose={async (ignore_me, statusObj) => {
            removeCookie("AVAaction");
            if (statusObj.document_status !== 'aborted') {
              if (statusObj.nextAction) {
                if (statusObj.nextAction.action === 'logIn') {
                  sessionStorage.removeItem('AVASessionData');
                  let jumpTo = `${window.location.href.replace('refresh', 'theseus').split('?')[0]}?user=${statusObj.nextAction.target}`;
                  window.location.replace(jumpTo);
                }
              }
            }
            let jumpTo = window.location.href.replace('theseus', 'thankyou').split('?')[0];
            window.location.replace(jumpTo);
          }}
        />
      );
    }
    let jumpTo = window.location.href.replace('theseus', 'thankyou').split('?')[0];
    window.location.replace(jumpTo);
  }

  return (
    <Box>
      {(state.session.client_style && state.session.client_style.ui_tiles)
        ? <ConnectMenu pPerson={patient.person_id} patient={patient} pClient={session.client_id} />
        : <AVAMenu pPerson={patient.person_id} patient={patient} pClient={session.client_id} />
      }
    </Box>
  );
};
