import { chooseEventSlot, getGroupDisplayDepths } from './GroupControl';

jest.mock('../../hooks/useSession', () => () => ({ state: {} }));
jest.mock('../../util/AVAUtilities', () => ({}));
jest.mock('../../util/AVACalendars', () => ({}));
jest.mock('../../util/AVAGroups', () => ({}));
jest.mock('../../util/AVAPeople', () => ({}));
jest.mock('../../util/AVADateTime', () => ({}));
jest.mock('../../util/AVAStyles', () => ({}));
jest.mock('../dialogs/PeopleMaintenance', () => () => null);
jest.mock('../dialogs/GroupMaintenance', () => () => null);
jest.mock('../dialogs/ExportFilterPrompt', () => () => null);
jest.mock('./MessageForm', () => () => null);
jest.mock('./GroupPhotoDirectory', () => () => null);
jest.mock('./AVAConfirm', () => () => null);

describe('chooseEventSlot', () => {
  it('uses the person_id as the slot for participant sign-ups', () => {
    expect(chooseEventSlot({ signup_type: 'participant', slots: { other: { owner: 'x' } } }, 'p1')).toEqual({ slot: 'p1' });
  });

  describe('getGroupDisplayDepths', () => {
    it('aligns independent tree roots and indents only their descendants', () => {
      expect(getGroupDisplayDepths({
        residents: { group_type: 'admin', level: 2 },
        neighborhood: { group_type: 'admin', level: 3 },
        street: { group_type: 'admin', level: 4 },
        other: { group_type: 'admin', level: 2 },
        __PUBLIC_GROUPS__: { group_type: 'header', level: 1 },
        club: { group_type: 'public', level: 2 },
        __PRIVATE_GROUPS__: { group_type: 'header', level: 1 },
        committee: { group_type: 'private', level: 2 },
      })).toEqual({
        residents: 0, neighborhood: 1, street: 2, other: 0,
        __PUBLIC_GROUPS__: 0, club: 1, __PRIVATE_GROUPS__: 0, committee: 1,
      });
    });

    it('does not indent a standalone hierarchy or a group without a displayed header', () => {
      expect(getGroupDisplayDepths({
        residents: { group_type: 'admin', level: 5 },
        child: { group_type: 'admin', level: 6 },
        club: { group_type: 'public', level: 2 },
      })).toEqual({ residents: 0, child: 1, club: 0 });
    });
  });

  it('reports a participant who is already attending', () => {
    expect(chooseEventSlot({ signup_type: undefined, slots: { p1: { owner: 'fam' } } }, 'p1')).toEqual({ alreadyAttending: true });
  });

  it('treats a released participant slot as available again', () => {
    expect(chooseEventSlot({ slots: { p1: { owner: '' } } }, 'p1')).toEqual({ slot: 'p1' });
  });

  it('takes the first open slot (sorted) for time/seats sign-ups', () => {
    const occ = { signup_type: 'time', slots: { '1000': { owner: null }, '0900': { owner: 'a' }, '0930': { owner: '' } } };
    expect(chooseEventSlot(occ, 'p1')).toEqual({ slot: '0930' });
  });

  it('reports a time/seats attendee already holding a slot', () => {
    const occ = { signup_type: 'seats', slots: { 's#1': { owner: 'p1' }, 's#2': { owner: null } } };
    expect(chooseEventSlot(occ, 'p1')).toEqual({ alreadyAttending: true });
  });

  it('reports a full time/seats occurrence', () => {
    const occ = { signup_type: 'seats', slots: { 's#1': { owner: 'a' }, 's#2': { owner: 'b' } } };
    expect(chooseEventSlot(occ, 'p1')).toEqual({ full: true });
  });
});
