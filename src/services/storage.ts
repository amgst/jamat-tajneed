import * as jsonServices from './jsonStorage';
import * as fileServices from './fileStorage';
// import * as firebaseServices from './firebase.ts';

const useJsonStorage = import.meta.env.VITE_USE_JSON_STORAGE === 'true';
const useFileStorage = import.meta.env.VITE_USE_FILE_STORAGE === 'true';

// Determine which storage to use (priority: file > json)
const storageServices = useFileStorage ? fileServices : jsonServices;

// Auth services
export const signIn = storageServices.signIn;
export const logout = storageServices.logout;
export const onAuthChange = storageServices.onAuthChange;

// Member services
export const addMember = storageServices.addMember;
export const updateMember = storageServices.updateMember;
export const deleteMember = storageServices.deleteMember;
export const getMember = storageServices.getMember;
export const getAllMembers = storageServices.getAllMembers;
export const getMembersByTanzeem = storageServices.getMembersByTanzeem;

// Family services
export const addFamily = storageServices.addFamily;
export const updateFamily = storageServices.updateFamily;
export const deleteFamily = storageServices.deleteFamily;
export const getFamily = storageServices.getFamily;
export const getAllFamilies = storageServices.getAllFamilies;

// Get current user (JSON/File storage only)
export const getCurrentUser = (): any => {
  if (useFileStorage || useJsonStorage) {
    const storageKey = useFileStorage ? 'file_auth' : 'auth_user';
    const storedUser = localStorage.getItem(storageKey);
    return storedUser ? JSON.parse(storedUser) : null;
  }
  return null;
};