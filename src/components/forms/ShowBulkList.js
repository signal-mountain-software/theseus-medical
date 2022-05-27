import React from 'react';

import Box from '@material-ui/core/Box';

import Typography from '@material-ui/core/Typography';

import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';

import IconButton from '@material-ui/core/IconButton';
import EditIcon from '@material-ui/icons/Edit';
import DeleteIcon from '@material-ui/icons/Delete';

import makeStyles from '@material-ui/core/styles/makeStyles';
import EditObservation from '../forms/EditObservation';

const useStyles = makeStyles(theme => ({
  containerBox: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
  },
  table: {
    maxWidth: '95%',
  },
  listRow: {
    maxWidth: '100%',
    alignItems: 'center'
  },
  detailRow: {
    maxWidth: '20%',
    minWidth: '20%',
    paddingRight: 3
  }
}));

export default ({ pClient, workingList, showList }) => {

  let working_date = '';

  const classes = useStyles();
  const [bulkItemList, setBulkItemList] = React.useState(workingList);
  const [forceRedisplay, setForceRedisplay] = React.useState(1);
  const [editMode, setEditMode] = React.useState(false);
  const [selectedObservation, setSelectedObservation] = React.useState({});
  const [updateIndex, setUpdateIndex] = React.useState();

  function sentenceCase(pString) {
    return (!pString ? '' : pString.slice(0, 1).toUpperCase() + pString.slice(1).toLowerCase());
  }

  const handleEditObservation = async (pItem, pIndex) => {
    setEditMode(true);
    let pObs = {
      composite_key: pClient + '~' + pItem.type + '_' + pItem.date.getFullYear() + '.' + (pItem.date.getMonth() + 1) + '.' + pItem.date.getDate(),
      observation_code: pItem.item
    }
    setSelectedObservation(pObs);
    setUpdateIndex(pIndex);
  };

  const onReset = (updatedRow) => {
    let workingArray = bulkItemList;
    workingArray[updateIndex].type = updatedRow.composite_key.split(/[~_]/g).slice(1, -1).join('_').trim();
    workingArray[updateIndex].item = updatedRow.observation_code;
    console.log(updatedRow);
    setBulkItemList(workingArray);
    setForceRedisplay(forceRedisplay + 1);
  }

  const handleDeleteItem = async (pItem, pIndex) => {
    let workingArray = bulkItemList;
    let removedItem = workingArray.splice(pIndex, 1);
    console.log(removedItem);
    setBulkItemList(workingArray);
    setForceRedisplay(forceRedisplay + 1);
  };


  React.useEffect(() => {
    console.log('change made to list');
  }, [bulkItemList]);  // eslint-disable-line react-hooks/exhaustive-deps


  return (
    forceRedisplay > 0 &&
    <Box >
      <List >
        {bulkItemList.map((this_item, index) => (
          <React-fragment key={this_item.item + 'frag' + index} >
            {this_item.date.toDateString() !== working_date ?
              <ListItem
                key={this_item.item + 'rhead' + index}
                style={{
                  width: '100%',
                  paddingRight: 0,
                  marginBottom: '0px',
                  marginTop: (index === 0 ? '0px' : '50px')
                }}
                cols={1}
              >
                <Box flexGrow={1}>
                  <Typography
                    key={this_item.item + 'dhead' + index}
                    className={classes.noDisplay}
                    variant='h5'
                  >
                    {working_date = this_item.date.toDateString()}
                  </Typography>
                </Box>
              </ListItem>
              :
              <ListItem
                key={this_item.item + 'r' + index}
                style={{ marginBottom: '0px', marginTop: '0px' }}
                cols={1}
                sx={{ maxWidth: '99%' }}
              >
                <Box
                  display='flex'
                  flexGrow={1}
                  flexDirection='row'
                  justifyContent='flex-start'
                  alignItems='start'
                  className={classes.listRow}
                >
                  <Box className={classes.detailRow}>
                    <Typography noWrap={true} variant='subtitle1'>{sentenceCase(this_item.type)}</Typography>
                  </Box>
                  <Box flexGrow={1}>
                    <Typography noWrap={false} variant='h6'>{this_item.item}</Typography>
                  </Box>
                  <IconButton
                    aria-label="edit_icon"
                    onClick={() => {
                        handleEditObservation(this_item, index);
                    }}
                    edge="end"
                  >
                    {<EditIcon />}
                  </IconButton>
                  <IconButton
                    aria-label="search_icon"
                    onClick={() => { handleDeleteItem(this_item, index); }}
                    edge="end"
                  >
                    {<DeleteIcon />}
                  </IconButton>
                </Box>
              </ListItem>
            }
          </React-fragment>
        ))}
          {editMode &&
            <EditObservation
            observation={selectedObservation}
            showDialog={editMode}
            handleClose={(updatedRow) => {
              setEditMode(false);
              onReset(updatedRow);
            }}
            handleCancel={() => {
              setEditMode(false);
            }}
            />
          }
      </List>
    </Box >
  );
};