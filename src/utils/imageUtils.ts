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
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Validate image file
 */
export const validateImageFile = (file: File): { isValid: boolean; error?: string } => {
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'Only JPEG, PNG, GIF, and WebP images are allowed'
    };
  }

  // Check file size (max 2MB)
  const maxSize = 2 * 1024 * 1024; // 2MB in bytes
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'Image size must be less than 2MB'
    };
  }

  return { isValid: true };
};

/**
 * Resize image to maximum dimensions while maintaining aspect ratio
 */
export const resizeImage = (
  base64: string, 
  maxWidth: number = 400, 
  maxHeight: number = 400,
  quality: number = 0.8
): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve(base64); // Return original if canvas not supported
        return;
      }

      // Calculate new dimensions
      let { width, height } = img;
      
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      // Set canvas size and draw image
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to base64
      const resizedBase64 = canvas.toDataURL('image/jpeg', quality);
      resolve(resizedBase64);
    };
    
    img.src = base64;
  });
};

/**
 * Process uploaded image file
 */
export const processImageFile = async (file: File): Promise<{ success: boolean; data?: string; error?: string }> => {
  try {
    // Validate file
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    // Convert to base64
    const base64 = await fileToBase64(file);
    
    // Resize image
    const resizedImage = await resizeImage(base64);
    
    return { success: true, data: resizedImage };
  } catch {
    return { 
      success: false, 
      error: 'Failed to process image. Please try again.' 
    };
  }
};

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
