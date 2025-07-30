// Mock authentication for development purposes
// Replace this with actual Firebase authentication in production

export const MOCK_USER = {
  email: 'admin@jamaatahmadiyya.org',
  password: 'admin123',
  uid: 'mock-admin-uid',
  displayName: 'DGSH Admin'
};

export const mockSignIn = async (email: string, password: string) => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (email === MOCK_USER.email && password === MOCK_USER.password) {
    return {
      uid: MOCK_USER.uid,
      email: MOCK_USER.email,
      displayName: MOCK_USER.displayName
    };
  } else {
    throw new Error('Invalid credentials');
  }
};

export const mockSignOut = async () => {
  await new Promise(resolve => setTimeout(resolve, 500));
};

// Mock local storage for persistence
const AUTH_KEY = 'mockAuth';

export const saveAuthState = (user: { uid: string; email: string; displayName?: string }) => {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
};

export const getAuthState = () => {
  const saved = localStorage.getItem(AUTH_KEY);
  return saved ? JSON.parse(saved) : null;
};

export const clearAuthState = () => {
  localStorage.removeItem(AUTH_KEY);
};
