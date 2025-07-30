// Reset script to clear localStorage and reload fresh sample data
// Run this in browser console: window.resetAppData()

(window as any).resetAppData = () => {
  // Clear all app data from localStorage
  localStorage.removeItem('tajneed_members');
  localStorage.removeItem('tajneed_families'); 
  localStorage.removeItem('tajneed_auth_user');
  
  console.log('App data cleared! Please refresh the page to load fresh sample data.');
  
  // Optionally auto-refresh
  if (confirm('Data cleared! Refresh page to load new sample data?')) {
    window.location.reload();
  }
};

console.log('Reset function loaded! Call window.resetAppData() to clear all data and refresh.');
