// Murray's FSM - Network Utilities
// ==================================

import * as Network from 'expo-network';
import { appState$ } from '../store';

// Check network status
export const checkNetworkStatus = async (): Promise<boolean> => {
  try {
    const networkState = await Network.getNetworkStateAsync();
    const isOnline = networkState.isConnected && networkState.isInternetReachable;
    appState$.isOnline.set(isOnline ?? false);
    return isOnline ?? false;
  } catch (error) {
    console.error('Error checking network status:', error);
    return false;
  }
};

// Setup network listener
export const setupNetworkListener = () => {
  // Check initial status
  checkNetworkStatus();

  // Poll network status every 10 seconds
  const interval = setInterval(checkNetworkStatus, 10000);

  return () => clearInterval(interval);
};
