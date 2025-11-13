import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, remove, update, push, query, orderByChild, equalTo } from 'firebase/database';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';
import type { Content } from '@/types/content';
import type { UserProfile, MyListItem } from '@/types/user';

// Firebase configuration for UniTvFilm
const firebaseConfig = {
  apiKey: "AIzaSyAWr4do1UXOBd5Hd08OxNv-yztUOlH6wQM",
  databaseURL: "https://unitvfilm-678d5-default-rtdb.firebaseio.com/",
  projectId: "unitvfilm-678d5",
  appId: "1:989230761933:android:4ac80dd1790f962c996684"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

export const addContent = async (content: Omit<Content, 'id'>) => {
  const contentRef = ref(database, 'contents');
  const newContentRef = push(contentRef);
  const contentWithId = { ...content, id: newContentRef.key };
  await set(newContentRef, contentWithId);
  return contentWithId;
};

export const getAllContents = async (): Promise<Content[]> => {
  const contentRef = ref(database, 'contents');
  const snapshot = await get(contentRef);
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data);
  }
  return [];
};

export const getContentsByCategory = async (category: string): Promise<Content[]> => {
  const contents = await getAllContents();
  return contents.filter(content => content.category === category);
};

export const updateContent = async (id: string, updates: Partial<Content>) => {
  const contentRef = ref(database, `contents/${id}`);
  await update(contentRef, updates);
};

export const deleteContent = async (id: string) => {
  const contentRef = ref(database, `contents/${id}`);
  await remove(contentRef);
};

// Authentication functions
export const signUp = async (email: string, password: string, isPremium: boolean = false) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  
  // Create user profile
  const profile: UserProfile = {
    id: user.uid,
    email: user.email || '',
    isPremium,
    createdAt: new Date().toISOString(),
  };
  
  await set(ref(database, `profiles/${user.uid}`), profile);
  return userCredential;
};

export const signIn = async (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const logOut = async () => {
  return signOut(auth);
};

export const onAuthChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// User Profile functions
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const profileRef = ref(database, `profiles/${userId}`);
  const snapshot = await get(profileRef);
  if (snapshot.exists()) {
    return snapshot.val();
  }
  return null;
};

export const updateUserProfile = async (userId: string, updates: Partial<UserProfile>) => {
  const profileRef = ref(database, `profiles/${userId}`);
  await update(profileRef, updates);
};

// My List functions
export const addToMyList = async (userId: string, content: Content) => {
  const myListRef = ref(database, `myList/${userId}`);
  const newItemRef = push(myListRef);
  const item: MyListItem = {
    id: newItemRef.key!,
    contentId: content.id,
    content,
    addedAt: new Date().toISOString(),
  };
  await set(newItemRef, item);
  return item;
};

export const removeFromMyList = async (userId: string, itemId: string) => {
  const itemRef = ref(database, `myList/${userId}/${itemId}`);
  await remove(itemRef);
};

export const getMyList = async (userId: string): Promise<MyListItem[]> => {
  const myListRef = ref(database, `myList/${userId}`);
  const snapshot = await get(myListRef);
  if (snapshot.exists()) {
    const data = snapshot.val();
    return Object.values(data);
  }
  return [];
};

export const isInMyList = async (userId: string, contentId: string): Promise<boolean> => {
  const myListRef = ref(database, `myList/${userId}`);
  const snapshot = await get(myListRef);
  if (snapshot.exists()) {
    const data = snapshot.val();
    const items: MyListItem[] = Object.values(data);
    return items.some(item => item.contentId === contentId);
  }
  return false;
};

export { database, auth };
export type { Content };
