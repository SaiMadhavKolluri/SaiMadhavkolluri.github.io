// Handles loading the events for <model-viewer>'s slotted progress bar
const onProgress = (event) => {
  const progressBar = event.target.querySelector('.progress-bar');
  const updatingBar = event.target.querySelector('.update-bar');
  updatingBar.style.width = `${event.detail.totalProgress * 100}%`;
  if (event.detail.totalProgress === 1) {
    progressBar.classList.add('hide');
    event.target.removeEventListener('progress', onProgress);
  } else {
    progressBar.classList.remove('hide');
  }
};
document.querySelector('model-viewer').addEventListener('progress', onProgress);

// Handle loading screen
const modelViewer = document.querySelector('model-viewer');
const loadingScreen = document.getElementById('loading-screen');

modelViewer.addEventListener('load', () => {
  // Hide loading screen when model is ready
  loadingScreen.classList.add('loaded');
  
  // Optional: Remove it from DOM after transition helps performance
  setTimeout(() => {
    loadingScreen.style.display = 'none';
  }, 600); // match CSS transition time
});