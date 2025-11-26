/**
 * Extracts frames from a video file in a robust manner.
 * The function will determine the optimal number of frames to extract (up to 16).
 * @param videoFile The video file to process.
 * @returns A promise that resolves to an array of base64-encoded image strings.
 */
export const extractFramesFromVideo = (
  videoFile: File,
): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const frames: string[] = [];
    const videoUrl = URL.createObjectURL(videoFile);

    if (!context) {
      URL.revokeObjectURL(videoUrl);
      return reject(new Error('Failed to get canvas context.'));
    }

    video.preload = 'metadata';
    video.src = videoUrl;

    const cleanup = () => {
      URL.revokeObjectURL(videoUrl);
    };

    video.onloadedmetadata = async () => {
      try {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const duration = video.duration;

        if (!isFinite(duration) || duration <= 0) {
          throw new Error("Video has an invalid duration or format.");
        }
        
        // Determine the number of frames to extract based on duration, with a max of 16
        const framesToExtract = Math.min(Math.ceil(duration), 16);
        const interval = duration / framesToExtract;
        
        // Ensure the first frame is captured if interval is 0
        if (interval === 0 && framesToExtract > 0) {
            video.currentTime = 0;
            await new Promise<void>((res) => video.addEventListener('seeked', () => res(), { once: true }));
            context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            const base64Data = canvas.toDataURL('image/jpeg').split(',')[1];
            frames.push(base64Data);
        } else {
            for (let i = 0; i < framesToExtract; i++) {
              // Seek to the precise time
              video.currentTime = i * interval;
              
              // Wait for the seek operation to complete
              await new Promise<void>((res, rej) => {
                const timeoutId = setTimeout(() => rej(new Error('Video seek timed out.')), 3000);
                const listener = () => {
                  clearTimeout(timeoutId);
                  res();
                };
                video.addEventListener('seeked', listener, { once: true });
              });
              
              context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
              const base64Data = canvas.toDataURL('image/jpeg').split(',')[1];
              frames.push(base64Data);
            }
        }
        
        cleanup();
        resolve(frames);

      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Failed to load video. The file may be corrupt or in an unsupported format.'));
    };
  });
};