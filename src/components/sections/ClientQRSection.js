import React from 'react';
import { Box, Typography } from '@material-ui/core/';

import { AVATextStyle } from '../../util/AVAStyles';
import QRCode from 'qrcode';

export default ({ currentValues, reactData, updateReactData, updateField }) => {

    // QR Code state and generation
    const [qrCodeDataUrl, setQrCodeDataUrl] = React.useState('');
    const [qrLoginDataUrl, setQrLoginDataUrl] = React.useState('');

    // Extract client_id for stable dependency tracking
    const client_id = currentValues.customizationRecs?.client_name?.client_id || reactData.client_id;

    // Generate QR code when component loads or client_id changes
    React.useEffect(() => {
        const generateQRCode = async () => {
            try {
                if (client_id) {
                    // Generate QR code for account creation
                    const qrUrl = `https://dev.smsoftware.io/?create=${client_id}`;
                    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
                        width: 200,
                        margin: 2,
                        color: {
                            dark: '#000000',
                            light: '#FFFFFF'
                        }
                    });
                    setQrCodeDataUrl(qrDataUrl);

                    // Generate QR code for login
                    const qrLoginUrl = `https://dev.smsoftware.io/?client=${client_id}`;
                    const qrLoginDataUrl = await QRCode.toDataURL(qrLoginUrl, {
                        width: 200,
                        margin: 2,
                        color: {
                            dark: '#000000',
                            light: '#FFFFFF'
                        }
                    });
                    setQrLoginDataUrl(qrLoginDataUrl);
                }
            } catch (error) {
                console.error('Error generating QR code:', error);
            }
        };

        generateQRCode();
    }, [client_id]);

    return (
        <Box
            key={`qrSection_masterBox`}
            flexGrow={2} px={2} py={4} display='flex' flexDirection='column'
        >

            {/* QR Code for New Accounts */}
            <Box display='flex' alignItems='flex-start'
                justifyContent='flex-start' flexDirection='column'
                marginBottom={4}
            >
                <Typography
                    style={AVATextStyle({ margin: { right: 0.5, bottom: 1 } })}
                >
                    {'QR for New Accounts'}
                </Typography>
                <Box display='flex' alignItems='center'
                    justifyContent='flex-start' flexDirection='row'
                    marginTop={1}
                >
                    {qrCodeDataUrl && (
                        <img
                            src={qrCodeDataUrl}
                            alt="QR Code for New Accounts"
                            style={{
                                border: '2px solid #ccc',
                                borderRadius: '8px',
                                padding: '8px',
                                backgroundColor: 'white'
                            }}
                        />
                    )}
                    <Box display='flex' flexDirection='column' marginLeft={2}>
                        <Typography
                            style={AVATextStyle({ size: 0.8, margin: { bottom: 0.5 } })}
                        >
                            Scan this QR code to access the account creation page
                        </Typography>
                        <Typography
                            style={AVATextStyle({ size: 0.7, color: '#666' })}
                        >
                            URL: https://dev.smsoftware.io/?create={client_id}
                        </Typography>
                    </Box>
                </Box>
            </Box>

            {/* QR Code for Login */}
            <Box display='flex' alignItems='flex-start'
                justifyContent='flex-start' flexDirection='column'
            >
                <Typography
                    style={AVATextStyle({ margin: { right: 0.5, bottom: 1 } })}
                >
                    {'QR for Login'}
                </Typography>
                <Box display='flex' alignItems='center'
                    justifyContent='flex-start' flexDirection='row'
                    marginTop={1}
                >
                    {qrLoginDataUrl && (
                        <img
                            src={qrLoginDataUrl}
                            alt="QR Code for Login"
                            style={{
                                border: '2px solid #ccc',
                                borderRadius: '8px',
                                padding: '8px',
                                backgroundColor: 'white'
                            }}
                        />
                    )}
                    <Box display='flex' flexDirection='column' marginLeft={2}>
                        <Typography
                            style={AVATextStyle({ size: 0.8, margin: { bottom: 0.5 } })}
                        >
                            Scan this QR code to log into AVA
                        </Typography>
                        <Typography
                            style={AVATextStyle({ size: 0.7, color: '#666' })}
                        >
                            URL: https://dev.smsoftware.io/?client={client_id}
                        </Typography>
                    </Box>
                </Box>
            </Box>

        </Box >
    );
};