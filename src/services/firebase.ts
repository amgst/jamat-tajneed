// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAnalytics } from "firebase/analytics";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  QuerySnapshot,
  connectFirestoreEmulator
} from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import type { Member, Family, AuthUser } from '../types';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAa6zRE_7TKpT5nVq3VmO8Kr5-h12PpfGM",
  authDomain: "jamat-tajneed-44f6d.firebaseapp.com",
  projectId: "jamat-tajneed-44f6d",
  storageBucket: "jamat-tajneed-44f6d.firebasestorage.app",
  messagingSenderId: "794157972693",
  appId: "1:794157972693:web:2f012a4f481c5dbc38f65c",
  measurementId: "G-QGXD60BLHC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Connect to emulators in development
const USE_EMULATOR = import.meta.env.VITE_USE_EMULATOR === 'true';

if (USE_EMULATOR) {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
    console.log('Connected to Firestore emulator');
  } catch (error) {
    console.log('Firestore emulator already connected or not available');
  }
} else {
  console.log('Using production Firestore');
}

// Collection names in Firestore
const MEMBERS_COLLECTION = 'members';
const FAMILIES_COLLECTION = 'families';

// --- Auth Services (Removed Firebase Auth functions) ---
// These functions are no longer part of this service as per your request.
// Login is now handled by a hardcoded PIN in AuthContext.

// --- Member Services (using Firestore) ---
/**
 * Adds a new member to the Firestore 'members' collection.
 * @param member - The member data to add (excluding 'id').
 * @returns A Promise that resolves with the ID of the newly created document.
 */
export const addMember = async (member: Omit<Member, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, MEMBERS_COLLECTION), {
    ...member,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  return docRef.id;
};

/**
 * Updates an existing member's data in Firestore.
 * @param id - The ID of the member document to update.
 * @param updates - An object containing the fields to update.
 * @returns A Promise that resolves when the document is successfully updated.
 */
export const updateMember = async (id: string, updates: Partial<Member>): Promise<void> => {
  const memberRef = doc(db, MEMBERS_COLLECTION, id);
  await updateDoc(memberRef, {
    ...updates,
    updatedAt: new Date().toISOString()
  });
};

/**
 * Deletes a member document from Firestore.
 * @param id - The ID of the member document to delete.
 * @returns A Promise that resolves when the document is successfully deleted.
 */
export const deleteMember = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, MEMBERS_COLLECTION, id));
};

/**
 * Retrieves a single member document from Firestore by its ID.
 * @param id - The ID of the member document to retrieve.
 * @returns A Promise that resolves with the Member object or null if not found.
 */
export const getMember = async (id: string): Promise<Member | null> => {
  const docSnap = await getDoc(doc(db, MEMBERS_COLLECTION, id));
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Member;
  }
  return null;
};

/**
 * Retrieves all members from the Firestore 'members' collection, ordered by name.
 * @returns A Promise that resolves with an array of Member objects.
 */
export const getAllMembers = async (): Promise<Member[]> => {
  const q = query(collection(db, MEMBERS_COLLECTION), orderBy('name'));
  const querySnapshot: QuerySnapshot = await getDocs(q); // Removed <DocumentData> from here
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }) as Member);
};

/**
 * Retrieves members filtered by a specific family ID.
 * @param familyId - The ID of the family to filter members by.
 * @returns A Promise that resolves with an array of Member objects belonging to the specified family.
 */
export const getMembersByFamily = async (familyId: string): Promise<Member[]> => {
  const q = query(
    collection(db, MEMBERS_COLLECTION),
    where('familyId', '==', familyId),
    orderBy('name')
  );
  const querySnapshot: QuerySnapshot = await getDocs(q); // Removed <DocumentData> from here
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }) as Member);
};

/**
 * Retrieves members filtered by a specific Tanzeem.
 * @param tanzeem - The Tanzeem to filter members by.
 * @returns A Promise that resolves with an array of Member objects belonging to the specified Tanzeem.
 */
export const getMembersByTanzeem = async (tanzeem: string): Promise<Member[]> => {
  const q = query(
    collection(db, MEMBERS_COLLECTION),
    where('tanzeem', '==', tanzeem),
    orderBy('name')
  );
  const querySnapshot: QuerySnapshot = await getDocs(q); // Removed <DocumentData> from here
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }) as Member);
};

// --- Family Services (using Firestore) ---
/**
 * Adds a new family to the Firestore 'families' collection.
 * @param family - The family data to add (excluding 'id').
 * @returns A Promise that resolves with the ID of the newly created document.
 */
export const addFamily = async (family: Omit<Family, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, FAMILIES_COLLECTION), {
    ...family,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  return docRef.id;
};

/**
 * Updates an existing family's data in Firestore.
 * @param id - The ID of the family document to update.
 * @param updates - An object containing the fields to update.
 * @returns A Promise that resolves when the document is successfully updated.
 */
export const updateFamily = async (id: string, updates: Partial<Family>): Promise<void> => {
  const familyRef = doc(db, FAMILIES_COLLECTION, id);
  await updateDoc(familyRef, {
    ...updates,
    updatedAt: new Date().toISOString()
  });
};

/**
 * Deletes a family document from Firestore.
 * @param id - The ID of the family document to delete.
 * @returns A Promise that resolves when the document is successfully deleted.
 */
export const deleteFamily = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, FAMILIES_COLLECTION, id));
};

/**
 * Retrieves a single family document from Firestore by its ID.
 * @param id - The ID of the family document to retrieve.
 * @returns A Promise that resolves with the Family object or null if not found.
 */
export const getFamily = async (id: string): Promise<Family | null> => {
  const docSnap = await getDoc(doc(db, FAMILIES_COLLECTION, id));
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Family;
  }
  return null;
};

/**
 * Retrieves all families from the Firestore 'families' collection, ordered by family name.
 * @returns A Promise that resolves with an array of Family objects.
 */
export const getAllFamilies = async (): Promise<Family[]> => {
  const q = query(collection(db, FAMILIES_COLLECTION), orderBy('familyName'));
  const querySnapshot: QuerySnapshot = await getDocs(q); // Removed <DocumentData> from here
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }) as Family);
};
