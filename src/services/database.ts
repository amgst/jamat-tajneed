import { connectDataConnect, getDataConnect } from 'firebase/data-connect';
import { getApp } from 'firebase/app';

// Initialize Data Connect
const app = getApp();
export const dataConnect = getDataConnect(app, {
  connector: 'example',
  location: 'us-central1',
  service: 'jamat-tajneed'
});

// Connect to Data Connect
connectDataConnect(dataConnect);

export default dataConnect;