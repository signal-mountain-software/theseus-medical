import React from 'react';

import Box from '@material-ui/core/Box';

import useSession from '../hooks/useSession';

import AVAMenu from '../components/sections/AVAMenu';
import ConnectMenu from '../components/sections/ConnectMenu';
import MainMenuV3 from '../components/sections/MainMenuV3';
import FormFillB from '../components/forms/FormFillB';
import MessageForm from '../components/forms/MessageForm';
import PeopleMaintenance from '../components/dialogs/PeopleMaintenance';

import { useCookies } from 'react-cookie';

export default () => {
  const { state } = useSession();
  const { patient, session } = state;
  const [cookies, , removeCookie] = useCookies(['AVAuser', 'AVAaction']);
  const ava_env = window.location.href.split('//')[1].slice(0, 1).toUpperCase();

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
            removeCookie("AVAaction", { path: '/' });
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
            window.location.replace(`${jumpTo}?client=${session.client_id}`);
          }}
        />
      );
    }
    else if (cookies.AVAaction.forms) {
      return (
        <PeopleMaintenance
          person_id={patient.person_id}
          options={{ sectionToShow: ['FormSection'] }}
          onClose={() => {
            removeCookie("AVAaction", { path: '/' });
          }}
        />
      );
    }
    else if (cookies.AVAaction.message) {
      let messageOptions = {
        newMessage: true,
      };
      if (cookies.AVAaction.recipient) {
        messageOptions.recipients = [{ person_id: cookies.AVAaction.recipient, person_name: cookies.AVAaction.recipient_name }];
      }
      if (cookies.AVAaction.thread_id) {
        messageOptions.newMessageThread = cookies.AVAaction.thread_id;
      }
      if (cookies.AVAaction.text) {
        messageOptions.messageText = cookies.AVAaction.text;
      }
      if (cookies.AVAaction.subject) {
        messageOptions.subject = cookies.AVAaction.subject;
      }
      return (
        <MessageForm
          pPerson={cookies.AVAaction.sender}
          pClient={cookies.AVAaction.client_id}
          pMessageList={[]}
          onReset={() => {
            removeCookie("AVAaction", { path: '/' });
            window.close();
          }}
          options={messageOptions}
        />
      );
    }
    let jumpTo = window.location.href.replace('theseus', 'thankyou').split('?')[0];
    window.location.replace(`${jumpTo}?client=${session.client_id}`);
  }

  const startAt = state.session.url_parameters?.start || null;

  return (
    <Box>
      {(state.session.client_style && state.session.client_style.ui_v3 && (ava_env !== 'D' || (state.session.client_style && state.session.client_style.ui_v3Dev)))
        ? <MainMenuV3 {...(startAt ? { start_at: startAt } : {})} />
        :
        ((state.session.client_style && state.session.client_style.ui_tiles)
        ? <ConnectMenu pPerson={patient.person_id} patient={patient} pClient={session.client_id} />
        : <AVAMenu pPerson={patient.person_id} patient={patient} pClient={session.client_id} />)
      }
    </Box>
  );
};
