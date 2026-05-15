import React, { useState } from 'react';

import Typography from '@material-ui/core/Typography';
import {
  Box, Checkbox, IconButton, TextField, Button,
  Select, MenuItem, Dialog, DialogContent, DialogActions,
  FormControl, InputLabel
} from '@material-ui/core';
import { makeName } from '../../util/AVAPeople';
import { makeDate } from '../../util/AVADateTime';

import { AVATextStyle, AVAclasses } from '../../util/AVAStyles';

import DeleteIcon from '@material-ui/icons/Delete';

const NOTES_PER_CATEGORY = 5;
const DEFAULT_CATEGORY = 'General';

export default ({ currentValues, errorList, setError, updateField, reactData }) => {

  const AVAClass = AVAclasses();

  const [editingNote, setEditingNote] = useState(null);           // { index, note, isNew }
  const [expandedCategories, setExpandedCategories] = useState(new Set());

  const allNotes = currentValues.peopleRec.person_notes || [];

  // Category list from client_style; always includes DEFAULT_CATEGORY
  const categories = reactData.note_categories || [DEFAULT_CATEGORY];

  // Group notes by category; preserve original array index for saves; sort by timestamp desc
  const notesByCategory = {};
  allNotes.forEach((note, index) => {
    const cat = note.category || DEFAULT_CATEGORY;
    if (!notesByCategory[cat]) { notesByCategory[cat] = []; }
    notesByCategory[cat].push({ note, index });
  });
  for (const cat in notesByCategory) {
    notesByCategory[cat].sort((a, b) => {
      // urgent notes first, then most-recent first
      if (a.note.urgent && !b.note.urgent) { return -1; }
      if (!a.note.urgent && b.note.urgent) { return 1; }
      const tsA = a.note.note_timestamp || a.index;
      const tsB = b.note.note_timestamp || b.index;
      return tsB - tsA;
    });
  }

  const handleToggleExpand = (cat) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) { next.delete(cat); } else { next.add(cat); }
      return next;
    });
  };

  const handleNoteClick = (index, note) => {
    setEditingNote({ index, note: { ...note } });
  };

  const handleCloseEdit = () => {
    setEditingNote(null);
  };

  const handleSaveNote = async () => {
    if (!editingNote) { return; }
    const { index, note, isNew } = editingNote;
    const categoryToSave = note.category || DEFAULT_CATEGORY;
    const updatedNote = {
      ...note,
      category: categoryToSave,
      user_id: reactData.user_id,
      user_name: await makeName(reactData.user_id),
      note_timestamp: new Date().getTime(),
      last_update: makeDate(new Date().getTime()).absolute,
    };
    if (isNew) {
      if (!currentValues.peopleRec.person_notes) {
        currentValues.peopleRec.person_notes = [];
      }
      currentValues.peopleRec.person_notes.push(updatedNote);
    } else {
      if (!currentValues.peopleRec.person_notes[index]) {
        currentValues.peopleRec.person_notes[index] = {};
      }
      Object.assign(currentValues.peopleRec.person_notes[index], updatedNote);
    }
    await updateField({
      updateList: [{ tableName: 'peopleRec', fieldName: 'person_notes', newData: currentValues.peopleRec.person_notes }]
    });
    setEditingNote(null);
  };

  const handleDeleteNote = async (index) => {
    if (index === null || index === undefined) {
      setEditingNote(null);
      return;
    }
    currentValues.peopleRec.person_notes.splice(index, 1);
    await updateField({
      updateList: [{ tableName: 'peopleRec', fieldName: 'person_notes', newData: currentValues.peopleRec.person_notes }]
    });
    setEditingNote(null);
  };

  const handleAddNote = () => {
    const newIndex = (currentValues.peopleRec.person_notes || []).length;
    const newNote = {
      note_id: `${new Date().getTime()}_${newIndex}`,
      note_timestamp: new Date().getTime(),
      name: `${(currentValues.peopleRec.name?.first
        ? (currentValues.peopleRec.name?.first + "'s").replace("s's", "s'")
        : 'My')} note #${newIndex + 1}`,
      category: DEFAULT_CATEGORY,
    };
    setEditingNote({ index: null, note: newNote, isNew: true });
  };

  return (
    <Box
      key={`PersonNotesSection_masterBox`}
      flexGrow={2} px={2} pt={2} pb={4} display='flex' flexDirection='column'
    >

      {/* ── Category sections ── */}
      {Object.keys(notesByCategory).sort().map(cat => {
        const notesInCat = notesByCategory[cat];
        const isExpanded = expandedCategories.has(cat);
        const visibleNotes = isExpanded ? notesInCat : notesInCat.slice(0, NOTES_PER_CATEGORY);
        const hiddenCount = notesInCat.length - NOTES_PER_CATEGORY;
        return (
          <Box key={`category_section_${cat}`} mb={2}>

            {/* Category header */}
            <Typography style={AVATextStyle({ bold: true, size: 1.0 })}>
              {cat}
            </Typography>

            {/* Note rows */}
            <Box pl={2} mt={0.5}>
              {visibleNotes.map(({ note, index }) => (
                <Box
                  key={`note_row_${note.note_id || index}`}
                  onClick={() => handleNoteClick(index, note)}
                  display='flex'
                  flexDirection='column'
                  mb={0.5}
                  py={0.5}
                  style={{
                    cursor: 'pointer',
                    borderBottom: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    ...(note.urgent ? {
                      borderLeft: '4px solid #f54927',
                      paddingLeft: '6px',
                      backgroundColor: '#f7e6e6',
                    } : {}),
                  }}
                >
                  <Typography style={AVATextStyle({ size: 0.9, bold: note.urgent || false })}>
                    {note.name || `Note ${index + 1}`}
                  </Typography>
                  {note.noteText &&
                    <Typography
                      noWrap
                      style={AVATextStyle({ size: 0.75, color: '#666666' })}
                    >
                      {note.noteText}
                    </Typography>
                  }
                  <Typography style={AVATextStyle({ size: 0.6 })}>
                    {[note.user_name || reactData.user_id, makeDate(note.last_update || new Date()).absolute]
                      .filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
              ))}

              {/* More / less pill */}
              {hiddenCount > 0 &&
                <Button
                  size='small'
                  style={{
                    borderRadius: '12px',
                    border: '1px solid #bbb',
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    marginTop: '4px',
                    paddingLeft: '10px',
                    paddingRight: '10px',
                    minHeight: 0,
                  }}
                  onClick={() => handleToggleExpand(cat)}
                >
                  {isExpanded ? 'less...' : `more... (${hiddenCount} more)`}
                </Button>
              }
            </Box>
          </Box>
        );
      })}

      {/* ── Add a Note section ── */}
      <Box display='flex' flexDirection='column' alignItems='flex-start' marginTop={2} marginBottom={1}>
        <Button
          onClick={handleAddNote}
          className={AVAClass.AVAButton}
          style={{ marginLeft: 0, backgroundColor: 'white', color: 'black' }}
          size='small'
        >
          {'Add a Note'}
        </Button>
      </Box>

      {/* ── Edit Note Dialog ── */}
      {editingNote &&
        <Dialog
          open={true}
          onClose={handleCloseEdit}
          fullWidth
          maxWidth='sm'
          PaperProps={{ style: { borderRadius: '30px', padding: '8px' } }}
        >
          <DialogContent>
            <Box display='flex' flexDirection='column'>

              {/* Category picker */}
              <Box mb={2}>
                <FormControl size='small' fullWidth>
                  <InputLabel id='note-category-label'>Category</InputLabel>
                  <Select
                    labelId='note-category-label'
                    value={editingNote.note.category || DEFAULT_CATEGORY}
                    onChange={e => {
                      const val = e.target.value;
                      setEditingNote(prev => ({ ...prev, note: { ...prev.note, category: val } }));
                    }}
                  >
                    {[...new Set([...categories, editingNote.note.category || DEFAULT_CATEGORY])].sort().map(c => (
                      <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <TextField
                label='Quick Name/Description'
                value={editingNote.note.name || ''}
                onChange={e => {
                  const val = e.target.value;
                  setEditingNote(prev => ({ ...prev, note: { ...prev.note, name: val } }));
                }}
                style={{ marginBottom: '16px' }}
                fullWidth
              />

              <TextField
                label='Note'
                value={editingNote.note.noteText || ''}
                onChange={e => {
                  const val = e.target.value;
                  setEditingNote(prev => ({ ...prev, note: { ...prev.note, noteText: val } }));
                }}
                multiline
                minRows={3}
                variant='outlined'
                fullWidth
                style={{ marginBottom: '8px' }}
              />

              <Box display='flex' flexDirection='row' alignItems='center' style={{ marginLeft: '-12px' }}>
                <Checkbox
                  size='small'
                  checked={editingNote.note.urgent || false}
                  onChange={e => {
                    const checked = e.target.checked;
                    setEditingNote(prev => ({ ...prev, note: { ...prev.note, urgent: checked } }));
                  }}
                />
                <Typography style={AVATextStyle({ size: 0.8 })}>
                  {'Highlight/Important?'}
                </Typography>
              </Box>

              {!editingNote.isNew &&
                <Box mt={1}>
                  <Typography style={AVATextStyle({ size: 0.5, margin: { top: 1 } })}>
                    {`by: ${editingNote.note.user_name || reactData.user_id}`}
                  </Typography>
                  <Typography style={AVATextStyle({ size: 0.5, margin: { top: 0 } })}>
                    {`on: ${makeDate(editingNote.note.last_update || new Date()).absolute}`}
                  </Typography>
                  <Typography style={AVATextStyle({ size: 0.5, margin: { top: 0 } })}>
                    {`note ID: ${editingNote.note.note_id}`}
                  </Typography>
                </Box>
              }
            </Box>
          </DialogContent>

          <DialogActions style={{ paddingBottom: '16px', paddingLeft: '16px', paddingRight: '16px' }}>
            {!editingNote.isNew &&
              <IconButton size='small' onClick={() => handleDeleteNote(editingNote.index)} title='Delete this note'>
                <DeleteIcon />
              </IconButton>
            }
            <Box flexGrow={1} />
            <Button
              onClick={handleCloseEdit}
              className={AVAClass.AVAButton}
              style={{ backgroundColor: 'white', color: 'black' }}
              size='small'
            >
              {'Cancel'}
            </Button>
            <Button
              onClick={handleSaveNote}
              className={AVAClass.AVAButton}
              style={{ backgroundColor: 'white', color: 'black' }}
              size='small'
            >
              {'Save'}
            </Button>
          </DialogActions>
        </Dialog>
      }

    </Box>
  );
};
