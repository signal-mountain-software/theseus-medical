import React from 'react';
import useSession from '../../hooks/useSession';
// import { AVAclasses } from '../../util/AVAStyles';
import { cl } from '../../util/AVAUtilities';
import ImageGallery from 'react-image-gallery';
import { useSnackbar } from 'notistack';

export default ({ filter = {}, onClose }) => {

  const [reactData, setReactData] = React.useState({
    loading: true,
    progressMessage: 'Building Group List',
  });
  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  const { state } = useSession();
  cl(state.session.user_id);

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  const { enqueueSnackbar } = useSnackbar();

  // const AVAClass = AVAclasses();

  const buildDashboard = async () => {
    reactData.loading = true;
    setReactData(reactData);
    reactData.slideShow = [];
    reactData.slideShow[0] = {
      original: "https://theseus-medical-storage.s3.amazonaws.com/ademo.jpg",
      originalHeight: 200,
      originalWidth: 200,
    };
    reactData.slideShow[1] = {
      original: "https://theseus-medical-storage.s3.amazonaws.com/aloy120_original.jpg",
      originalHeight: 200,
      originalWidth: 200,
    };
    if (reactData.slideShow.length === 0) {
      enqueueSnackbar(`Nothing was loaded`, { variant: 'error', persist: false });
      onClose();
    }
    reactData.loading = false;
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
      (true || forceRedisplay) && !reactData.loading && reactData.slideShow && reactData.slideShow.length > 0 &&
        <ImageGallery items={reactData.slideShow} showThumbnails={false} />
  );
};