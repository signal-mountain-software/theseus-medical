import React from 'react';
import useSession from '../../hooks/useSession';
import Box from '@material-ui/core/Box';
import { cl } from '../../util/AVAUtilities';
import GroupForm from '../forms/GroupForm';
import ShowCalendar from '../dialogs/ShowCalendar';
import ImageGallery from 'react-image-gallery';
import "react-image-gallery/styles/css/image-gallery.css";
import { useSnackbar } from 'notistack';

export default ({ filter = {}, onClose }) => {

  const [reactData, setReactData] = React.useState({
    carousel_status: 'loading',
    progressMessage: 'Building Group List',
    saveState: {},
    current_index: 0,
    visible_y: window.window.innerHeight,
    visible_x: window.window.innerWidth
  });
  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  cl(forceRedisplay);

  const { state } = useSession();
  reactData.saveState = state;

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  const gallery = React.useRef(null);

  const { enqueueSnackbar } = useSnackbar();

  const renderVideoUrl = (video) => {
    return (
      <Box >
        <video controls
          height={`${.55 * reactData.visible_y}px`}
          width={`${.5 * reactData.visible_x}px`}
        >
          <source src={video.original} />
        </video>
      </Box>
    );
  };
  let imageList = [
    'https://theseus-medical-storage.s3.amazonaws.com/ademo.jpg',
    'https://theseus-medical-storage.s3.amazonaws.com/public/patients/aconklin.jpg',
    'https://theseus-medical-storage.s3.amazonaws.com/Picture+st+pats.png',
    'https://theseus-medical-storage.s3.amazonaws.com/s3.jpg',
    'https://theseus-medical-storage.s3.amazonaws.com/public/IMG_2270.mov',
    'https://theseus-medical-storage.s3.amazonaws.com/public/patients/ballen.jpg',
    'https://theseus-medical-storage.s3.amazonaws.com/public/patients/bsherrill.jpg',
    'https://theseus-medical-storage.s3.amazonaws.com/s2.jpg',
    'https://theseus-medical-storage.s3.amazonaws.com/s1.jpg',
    'https://theseus-medical-storage.s3.amazonaws.com/public/documents/2021-04-15+14.59.27.mp4'
  ];

  let AVAdata = [
    { slide_type: 'person', person_id: 'ademo' },
    { slide_type: 'person', person_id: 'aconklin' },
    { slide_type: 'event', event_id: 'oncampus_fc7bd3#20240313' },
    { slide_type: 'event', event_id: 'oncampus_fc7bd3#20240313' },
    { slide_type: 'video', video_url: 'https://theseus-medical-storage.s3.amazonaws.com/public/IMG_2270.mov' },
    { slide_type: 'person', person_id: 'ballen' },
    { slide_type: 'person', person_id: 'bsherrill' },
    { slide_type: 'event', event_id: 'oncampus_fc7bd3#20240313' },
    { slide_type: 'event', event_id: 'oncampus_fc7bd3#20240313' },
    { slide_type: 'video', video_url: 'https://theseus-medical-storage.s3.amazonaws.com/public/documents/2021-04-15+14.59.27.mp4' }
  ];

  const buildDashboard = async () => {
    reactData.carousel_status = 'loading';
    setReactData(reactData);
    reactData.slideShow = [];
    imageList.forEach((this_image, x) => {
      reactData.slideShow[x] = {
        original: this_image,
        originalHeight: `${.55 * reactData.visible_y}px`,
        originalWidth: `${.5 * reactData.visible_y}px`,
        thumbnail: this_image,
        thumbnailHeight: `${.1 * reactData.visible_y}px`,
        thumbnailWidth: `${.1 * reactData.visible_y}px`,
        AVA: AVAdata[x]
      };
      let extension = this_image.split('.').pop();
      switch (extension) {
        case 'mov':
        case 'mp4': {
          reactData.slideShow[x].renderItem = renderVideoUrl.bind(reactData.slideShow[x]);
          reactData.slideShow[x].thumbnail = 'https://ava-icons.s3.amazonaws.com/movie.png';
          break;
        }
        default: { }
      }
    });

    if (reactData.slideShow.length === 0) {
      enqueueSnackbar(`Nothing was loaded`, { variant: 'error', persist: false });
      onClose();
    }
    reactData.carousel_status = 'carousel';
    setReactData(reactData);
    setForceRedisplay(forceRedisplay => !forceRedisplay);
  };



  React.useEffect(() => {
    async function initialize() {
      await buildDashboard();
    }
    if (!reactData.hasOwnProperty('slideShow')) { initialize(); }
  }, [filter]);  // eslint-disable-line react-hooks/exhaustive-deps


  // ******************

  return (
    <React.Fragment>
      {(reactData.carousel_status === 'carousel') &&
        reactData.slideShow &&
        (reactData.slideShow.length > 0) &&
        <ImageGallery ref={gallery}
          items={reactData.slideShow}
          showThumbnails={true}
          slideInterval={10000}
          showNav={false}
          showFullscreenButton={false}
          autoPlay={true}
          startIndex={reactData.current_index}
          onClick={(content) => {
            cl(content);
            reactData.current_index = gallery.current.state.currentIndex;
            if (reactData.slideShow[reactData.current_index].hasOwnProperty('AVA') && reactData.slideShow[reactData.current_index].AVA.slide_type) {
              switch (reactData.slideShow[reactData.current_index].AVA.slide_type) {
                case 'person': {
                  if (reactData.saveState.accessList) {
                    reactData.carousel_status = `show_person`;
                    reactData.selected_image = reactData.slideShow[reactData.current_index];
                    setReactData(reactData);
                    setForceRedisplay(forceRedisplay => !forceRedisplay);
                  }
                  else {
                    cl('We will send a message telling to wait a bit');
                  }
                  break;
                }
                case 'event': {
                  if (reactData.saveState.accessList) {
                    reactData.carousel_status = `show_event`;
                    reactData.selected_image = reactData.slideShow[reactData.current_index];
                    setReactData(reactData);
                    setForceRedisplay(forceRedisplay => !forceRedisplay);
                  }
                  else {
                    cl('We will send a message telling to wait a bit');
                  }
                  break;
                }
                default: {

                }
              }
            }
          }}
        />
      }
      {(reactData.carousel_status === 'show_person') &&
        <GroupForm
          groupMemberList={reactData.saveState.accessList}
          peopleList={[reactData.selected_image.AVA.person_id]}
          pPatient={reactData.saveState.session.patient_id}
          pPatientName={reactData.saveState.session.patient_display_name}
          pClient={reactData.saveState.session.client_id}
          pGroup={['*all']}
          onReset={() => {
            reactData.carousel_status = 'carousel';
            setReactData(reactData);
            setForceRedisplay(forceRedisplay => !forceRedisplay);
            return;
          }}
        />
      }
      {(reactData.carousel_status === 'show_event') &&
        <ShowCalendar
          patient={Object.assign(reactData.saveState.patient, reactData.saveState.session)}
          OGpatient={Object.assign(reactData.saveState.patient, reactData.saveState.session)}
          peopleList={["SMSoft//AVT_brothers", "SMSoft//AVT_leadership", "SMSoft//AVT_residents", "SMSoft//AVT_staff"]}
          currentEvent={[reactData.selected_image.AVA.event_id]}
          eventClient={'JohnsonAud'}
          calendarMode={'view'}
          onClose={() => {
            reactData.carousel_status = 'carousel';
            setReactData(reactData);
            setForceRedisplay(forceRedisplay => !forceRedisplay);
            return;
          }}
        />
      }
    </React.Fragment>
  );
};