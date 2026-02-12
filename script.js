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

const hideLoadingScreen = () => {
  loadingScreen.classList.add('loaded');
  setTimeout(() => {
    loadingScreen.style.display = 'none';
  }, 600);
};

// If model is already loaded, hide screen immediately
if (modelViewer.loaded) {
  hideLoadingScreen();
} else {
  // Otherwise wait for load event
  modelViewer.addEventListener('load', hideLoadingScreen);
}

// Ensure screen hides if there's an error (so users can see the poster/error state)
modelViewer.addEventListener('error', (error) => {
  console.error("Error loading model:", error);
  hideLoadingScreen();
});