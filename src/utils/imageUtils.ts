/**
 * Image handling utilities for local storage
 */

export interface ImageFile {
  name: string;
  base64: string;
  size: number;
  type: string;
}

/**
 * Convert File to base64 string
 */


/**
 * Generate a default avatar based on name
 */
export const generateAvatarFromName = (name: string): string => {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background colors
  const colors = [
    '#1890ff', '#52c41a', '#faad14', '#f5222d',
    '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'
  ];

  // Get initials
  const initials = name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');

  // Select color based on name
  const colorIndex = name.length % colors.length;
  const backgroundColor = colors[colorIndex];

  // Draw background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, 100, 100);

  // Draw initials
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, 50, 50);

  return canvas.toDataURL('image/png');
};

/**
 * Get image display URL (for use in img src)
 */
export const getImageDisplayUrl = (base64OrUrl: string): string => {
  if (!base64OrUrl) return '';

  // If it's already a data URL or blob URL, return as is
  if (base64OrUrl.startsWith('data:') || base64OrUrl.startsWith('blob:')) {
    return base64OrUrl;
  }

  // If it's a regular URL, return as is
  if (base64OrUrl.startsWith('http')) {
    return base64OrUrl;
  }

  // Otherwise, assume it needs data URL prefix
  return `data:image/jpeg;base64,${base64OrUrl}`;
};
