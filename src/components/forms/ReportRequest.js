import React from 'react';
import Dialog from '@material-ui/core/Dialog';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import useSession from '../../hooks/useSession';

import { titleCase, lambda } from '../../util/AVAUtilities';
import AVATextInput from './AVATextInput';

export default ({ report_id, title, buttonText, requestor, options, onClose }) => {

  const { state } = useSession();
  const isMobile = useMediaQuery(theme => theme.breakpoints.down('sm')); // checks if current device is a smart phone

  const [reactData] = React.useState({
    imageSize: options.safeMode ? 50 : (isMobile ? 100 : 150),
    report_id,
    title,
    buttonText,
    options: [options].flat(),
    payload: {
      client_id: state.session.client_id,
      requestor: requestor || state.session.user_id
    },
    lambda_parms: {
      FunctionName: `arn:aws:lambda:us-east-1:125549937716:function:${report_id}`,
      InvocationType: 'RequestResponse',
      LogType: 'Tail'
    },
    alert: false
  });

  // ******************

  return (
    <Dialog
      open={true}
      p={2}
      fullScreen
    >
      <AVATextInput
        titleText={reactData.title || 'Report Options'}
        promptText={reactData.options.map((this_option, oNdx) => { return (this_option.prompt || titleCase(this_option.field) || `Field ${oNdx}`); })}
        buttonText={reactData.buttonText || 'Submit'}
        valueText={reactData.options.map((this_option) => { return (this_option.default_value || ''); })}
        onCancel={() => {
          onClose({
            alert: {
              severity: 'info',
              title: 'Cancelled',
              message: `You cancelled the ${reactData.title} request.`
            }
          });
        }}
        onSave={async (response) => {
          let targetObj = {};
          for (let [ndx, this_response] of response.entries()) {
            targetObj[reactData.options[ndx].field_name] = this_response;
          }
          reactData.lambda_parms.Payload = JSON.stringify(Object.assign(reactData.payload, targetObj));
          let goodSubmit = true;
          lambda
            .invoke(reactData.lambda_parms)
            .promise()
            .catch(err => {
              onClose({
                alert: {
                  severity: 'error',
                  title: 'Error',
                  message: `AVA encountered an error while requesting your report.  Error is ${err.message}`
                }
              });
              goodSubmit = false;
            });
          if (goodSubmit) {
            onClose({
              alert: {
                severity: 'success',
                title: 'Submitted',
                message: `Your ${reactData.title} report was successfully submitted.\n\rYou'll receive a message when it's complete. `
              }
            });
          }
        }}
      />
    </Dialog >
  );
};