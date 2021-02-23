import React from 'react';
import TextField from '@material-ui/core/TextField';

export default ({ open, label, value, message, onChange, onKeyPress, onError }) => {
  const keyWords = ['.org', 'org/', 'com/', '.com', 'http', '.mp', '.doc', '.pdf'];

  React.useEffect(() => {
    if (!open) {
      onError(false);
    }
  }, [open, onError]);

  React.useEffect(() => {
    if (!value || value === '') {
      onError(true);
    } else {
      onError(false);
    }
  }, [value, onError]);

  if (keyWords.some(element => value.includes(element))) {
    let linkMessage1 = `We've tried to open ${message} in another window.`;
    let linkMessage2 = `If it didn't open, try tapping on `;
    let linkMessage3 = `. `;
    return (
      <React.Fragment key={`link-panel`}>
        <p>
          <div>{linkMessage1}</div>
          <div>
            {linkMessage2}
            <a href={value} target="_blank" rel="noopener noreferrer">this link</a>
            {linkMessage3}
          </div>
        </p>
      </React.Fragment>
    )
  }
  else {
    return (
      <TextField
        pt={13}
        value={value}
        multiline
        label={label}
        type='message'
        variant='outlined'
        onChange={onChange}
        onKeyPress={onKeyPress}
        InputLabelProps={{ shrink: true }}
        fullWidth
      />
    )
  }
};
