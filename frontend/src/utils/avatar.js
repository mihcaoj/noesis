/**
 * Generates an URL for a fallback avatar using UI Avatars service
 */
export const getFallbackAvatar = (username) => {
  return `https://ui-avatars.com/api/?name=${username}&background=c4a99a&color=f5f5f5`;
};
