import React from 'react';

import Typography from '@material-ui/core/Typography';
import { Box, Checkbox, IconButton, TextField, Button } from '@material-ui/core';
import { makeName } from '../../util/AVAPeople';
import { makeDate } from '../../util/AVADateTime';

import { AVATextStyle, AVAclasses } from '../../util/AVAStyles';

import DeleteIcon from '@material-ui/icons/Delete';
import ArrowDownwardIcon from '@material-ui/icons/ArrowDownward';
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';

export default ({ currentValues, errorList, setError, updateField, reactData }) => {

  const AVAClass = AVAclasses();

  return (
    <Box
      key={`PersonNotesSection_masterBox`}
      flexGrow={2} px={2} pt={2} pb={4} display='flex' flexDirection='column'
    >
      {currentValues.peopleRec.person_notes
        && currentValues.peopleRec.person_notes.map((this_note, i) => (
          <Box
            style={{
              borderRadius: '30px 30px 30px 30px',
            }}
            border={1}
            p={2}
            marginBottom={1}
            maxWidth={'95%'}
            display='flex' flexDirection='column' key={`message_fragment_${i}`}
          >
            <Box key={`header_message_${i}`}
              display='flex' flexDirection='row'
              flexWrap={'noWrap'}
              marginTop={1}
              marginBottom={1}
              alignItems={'center'}
              justifyContent={'space-between'}
            >
              <Box sx={{ display: 'none', visibility: 'hidden' }} >
                {!this_note.note_id &&
                  <Typography>
                    {this_note.note_id = `${new Date().getTime()}_${i}`}
                  </Typography>
                }
                {!this_note.name &&
                  <Typography>
                    {this_note.name = `${(currentValues.peopleRec.name?.first
                      ? (currentValues.peopleRec.name?.first + "'s").replace("s's", "s'")
                      : currentValues.peopleRec.person_id)} note #${i + 1}`}
                  </Typography>
                }
              </Box>
              <Box
                display='flex'
                flexDirection='row'
                flexGrow={1}
              >
                <TextField
                  id='noteName'
                  style={{ width: '-webkit-fill-available' }}
                  key={`note_name_${i}__${this_note.name}`}
                  defaultValue={this_note.name}
                  onBlur={async (event) => {
                    if (!currentValues.peopleRec.person_notes[i]) {
                      currentValues.peopleRec.person_notes[i] = this_note;
                    }
                    currentValues.peopleRec.person_notes[i].name = event.target.value;
                    await updateField({
                      updateList:
                        [{
                          tableName: 'peopleRec',
                          fieldName: 'person_notes',
                          newData: currentValues.peopleRec.person_notes
                        }]
                    });
                  }}
                  helperText='Quick Name/Description'
                />
              </Box>
              <Box
                display='flex'
                flexDirection='row'
                alignItems={'center'}
                marginLeft={0.5}
              >
                {(i < (currentValues.peopleRec.person_notes.length - 1)) &&
                  <IconButton
                    key={`down_button-${i}`}
                    size={'small'}
                    onClick={async () => {
                      currentValues.peopleRec.person_notes.splice(i, 1);
                      currentValues.peopleRec.person_notes.splice(i + 1, 0, this_note);
                      let updateObj = {
                        updateList:
                          [{
                            tableName: 'peopleRec',
                            fieldName: 'person_notes',
                            newData: currentValues.peopleRec.person_notes
                          }]
                      };
                      await updateField(updateObj);
                    }}
                  >
                    <ArrowDownwardIcon size={'small'} />
                  </IconButton>
                }
                {(i > 0) &&
                  <IconButton
                    key={`up_button-${i}`}
                    size={'small'}
                    onClick={async () => {
                      currentValues.peopleRec.person_notes.splice(i, 1);
                      currentValues.peopleRec.person_notes.splice(i - 1, 0, this_note);
                      let updateObj = {
                        updateList:
                          [{
                            tableName: 'peopleRec',
                            fieldName: 'person_notes',
                            newData: currentValues.peopleRec.person_notes
                          }]
                      };
                      await updateField(updateObj);
                    }}
                  >
                    <ArrowUpwardIcon size={'small'} />
                  </IconButton>
                }
                <IconButton
                  key={`delete_button-${i}`}
                  size={'small'}
                  onClick={async () => {
                    currentValues.peopleRec.person_notes.splice(i, 1);
                    let updateObj = {
                      updateList:
                        [{
                          tableName: 'peopleRec',
                          fieldName: 'person_notes',
                          newData: currentValues.peopleRec.person_notes
                        }]
                    };
                    let instructions = [];
                    for (let errorField in errorList) {
                      if (errorField.startsWith('person_notes__')) {
                        const errorIndex = Number(errorField.split(/.*(?:_|^)(.*)/gm)[1]);
                        if (errorIndex >= i) {
                          instructions.unshift({
                            errorField,
                            isError: false
                          });
                        }
                        if (errorIndex > i) {
                          instructions.push(Object.assign({},
                            errorList[errorField],
                            { errorField: errorField.replace(`_${errorIndex}`, `_${errorIndex - 1}`) }
                          ));
                        }
                      }
                    }
                    if (instructions.length > 0) {
                      updateObj.errorObj = instructions;
                    }
                    await updateField(updateObj);
                  }}
                >
                  <DeleteIcon size={'small'} />
                </IconButton>
              </Box>
            </Box>


            <Box >
              <Box
                display='flex'
                flexDirection='row'
                flexGrow={1}
              >
                <TextField
                  id='noteText'
                  style={{ width: '-webkit-fill-available' }}
                  key={`note_name_${i}__${this_note.noteText}`}
                  defaultValue={this_note.noteText}
                  multiline
                  variant={'outlined'}
                  onBlur={async (event) => {
                    if (!currentValues.peopleRec.person_notes[i]) {
                      currentValues.peopleRec.person_notes[i] = this_note;
                    }
                    currentValues.peopleRec.person_notes[i].noteText = event.target.value;
                    currentValues.peopleRec.person_notes[i].user_id = reactData.user_id;
                    currentValues.peopleRec.person_notes[i].user_name = await makeName(reactData.user_id);
                    currentValues.peopleRec.person_notes[i].last_update = makeDate(new Date().getTime()).absolute;
                    await updateField({
                      updateList:
                        [{
                          tableName: 'peopleRec',
                          fieldName: 'person_notes',
                          newData: currentValues.peopleRec.person_notes
                        }]
                    });
                  }}
                  helperText='Note'
                />
              </Box>
            </Box>

            <Box
              display='flex'
              flexDirection='row'
              alignItems={'center'}
              key={`urgent_option__${i}`}
              style={{ paddingTop: '2px', marginTop: '4px', marginBottom: '4px', marginLeft: '-12px', textWrapStyle: 'balance' }}
            >
              <Checkbox
                aria-label={`urgent_checkbox__${i}`}
                name={`urgent_checkbox__${i}`}
                key={`urgent_checkbox__${i}`}
                size='small'
                checked={this_note.urgent || false}
                onClick={async () => {
                  if (!currentValues.peopleRec.person_notes[i]) {
                    currentValues.peopleRec.person_notes[i] = this_note;
                  }
                  currentValues.peopleRec.person_notes[i].urgent = !currentValues.peopleRec.person_notes[i].urgent;
                  await updateField({
                    updateList:
                      [{
                        tableName: 'peopleRec',
                        fieldName: 'person_notes',
                        newData: currentValues.peopleRec.person_notes
                      }]
                  });
                }}
                disableRipple
                inputProps={{ 'aria-labelledby': `message_routing_3` }}
              />
              <Typography
                style={AVATextStyle({ size: 0.8 })}
              >
                {`Highlight/Important?`}
              </Typography>
            </Box>

            <Box
              justifyItems={'end'}
            >
              <Typography
                style={AVATextStyle({ size: 0.5, margin: { top: 1 } })}
              >
                {`by: ${this_note.user_name || reactData.user_id}`}
              </Typography>
              <Typography
                style={AVATextStyle({ size: 0.5, margin: { top: 0 } })}
              >
                {`on: ${makeDate(this_note.last_update || new Date()).absolute}`}
              </Typography>
              <Typography
                style={AVATextStyle({ size: 0.5, margin: { top: 0 } })}
              >
                {`note ID: ${this_note.note_id}`}
              </Typography>
            </Box>
          </Box>
        ))}
      <Box
        display='flex'
        flexDirection='column'
        alignItems={'flex-start'}
        marginTop={2}
        marginBottom={1}
      >
        <Button
          onClick={async () => {
            if (!currentValues.peopleRec.person_notes) {
              currentValues.peopleRec.person_notes = [];
            }
            currentValues.peopleRec.person_notes.push({
              name: `${(currentValues.peopleRec.name?.first ? (currentValues.peopleRec.name?.first + "'s").replace("s's", "s'") : 'My')} note #${currentValues.peopleRec.person_notes.length + 1}`
            });
            await updateField({
              updateList:
                [{
                  tableName: 'peopleRec',
                  fieldName: 'person_notes',
                  newData: currentValues.peopleRec.person_notes
                }]
            });
          }}
          className={AVAClass.AVAButton}
          style={{ marginLeft: 0, backgroundColor: 'white', color: 'black' }}
          size='small'
        >
          {'Add a Note'}
        </Button>
      </Box>
    </Box>
  );
};
