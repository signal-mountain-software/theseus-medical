import React from 'react';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import withStyles from '@material-ui/core/styles/withStyles';

const BaseTooltip = withStyles(theme => ({
  tooltip: {
    backgroundColor: '#f5f5f9',
    color: 'rgba(0, 0, 0, 0.87)',
    maxWidth: 220,
    fontSize: theme.typography.pxToRem(12),
    border: '1px solid #dadde9',
  },
}))(Tooltip);

export default ({ title, body, children }) => (
  <BaseTooltip
    title={
      <>
        <Typography color='inherit'>{title}</Typography>
        {body}
      </>
    }>
    {children}
  </BaseTooltip>
);
