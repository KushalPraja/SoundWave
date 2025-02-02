// Global variables and constants
let song;
let fft;
let lines = [];
const NUM_LINES = 50;       // Maximum number of lines stored
const LINE_SPACING = 4;    // Spacing between lines
const AMPLITUDE = 150;      // Base amplitude of the wave
let isPlaying = false;
let currentHue = 0;
let smoothedVolume = 0;
let smoothedBass = 0;
let smoothedTreble = 0;
const EDGE_PADDING = 50;    // Padding to zero-out the edges
const BASS_INTENSITY = 5;      // Multiplier for bass impact (try 1.0 - 4.0)
const TREBLE_INTENSITY = 5;    // Multiplier for treble impact (try 1.0 - 3.0)
const CURVE_SMOOTHNESS = 0.7;    // Controls curve smoothness (0.1 - 1.0, higher = smoother)
const MAX_CURVES = 3;            // Maximum number of major curves (2 - 5)
const ANIMATION_SPEED = 0.025;   // Speed of animation (0.01 - 0.05, higher = faster)


function preload() {
  song = loadSound('song.mp3');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  fft = new p5.FFT(0.8, 512);  // Higher FFT resolution
  colorMode(HSL);
  
  // Initialize the lines array
  initializeLines();
  
  // Create UI elements
  createUI();
  
  // Set initial volume
  song.setVolume(0.5);
}

function initializeLines() {
  // Pre-fill the lines array with empty arrays
  lines = [];
  for (let i = 0; i < NUM_LINES; i++) {
    lines.push(new Array(width).fill(0));
  }
}

function draw() {
  // Draw animated gradient background
  setGradientBackground();
  
  // Audio analysis
  let spectrum = fft.analyze();
  let bass = fft.getEnergy("bass");
  let treble = fft.getEnergy("treble");
  let mid = fft.getEnergy("mid");
  let volume = song.getVolume();
  
  // Smooth audio values with adaptive smoothing factors
  smoothedVolume = lerp(smoothedVolume, volume, 0.15);
  smoothedBass = lerp(smoothedBass, bass, 0.12);
  smoothedTreble = lerp(smoothedTreble, treble, 0.1);
  
  // Update wave lines based on audio analysis
  updateLines(spectrum, smoothedBass, smoothedTreble, mid, smoothedVolume);
  
  // Draw the updated visualization
  drawVisualization();
  
  // Update UI elements (progress bar, time, etc.)
  updateUI();
  
  // Gradually update the color cycle using a dynamic step based on treble
  currentHue = (currentHue + map(smoothedTreble, 0, 255, 0.08, 0.15)) % 360;
}

function updateLines(spectrum, bass, treble, mid, volume) {
  let newLine = [];
  let step = 5;
  let currentAmplitude = AMPLITUDE * (1 + volume * 0.8);
  let time = frameCount * 0.015;
  
  // Define the center region where the effect should occur
  let centerStart = width * 0.3;  // Start at 30% of width
  let centerEnd = width * 0.7;    // End at 70% of width

  for (let x = 0; x < width; x += step) {
    let index = floor(map(x, 0, width, 0, spectrum.length));
    let value = map(spectrum[index], 0, 255, 0, currentAmplitude);
    
    // Calculate distance from center as a percentage (0 to 1)
    let normalizedX = x / width;
    let distanceFromCenter = abs(normalizedX - 0.5) * 2; // Will be 0 at center, 1 at edges
    
    // Create smooth transition between effect and straight lines
    let transitionMultiplier = 0;
    if (x > centerStart && x < centerEnd) {
      // Smooth transition in the center region
      let normalizedPosition = (x - centerStart) / (centerEnd - centerStart);
      transitionMultiplier = sin(normalizedPosition * PI); // Creates smooth bell curve
    }

    // Apply audio effects only in the center region
    let audioEffect = 0;
    if (transitionMultiplier > 0) {
      let bassWave = sin(time * 0.8 + x * 0.002) * map(bass, 0, 255, 0, 20);
      let trebleWave = sin(time * 2.0 + x * 0.007) * map(treble, 0, 255, 0, 10);
      let midWave = cos(time + x * 0.005) * map(mid, 0, 255, 0, 15);
      
      audioEffect = (bassWave + trebleWave + midWave) * transitionMultiplier;
    }

    // Add some subtle noise for texture in the center
    let noise = random(-2, 2) * transitionMultiplier;
    
    // Combine all effects
    let y = value * transitionMultiplier + audioEffect + noise;
    
    newLine[x] = -y; // Negative to make peaks go up
  }

  lines.unshift(newLine);
  if (lines.length > NUM_LINES) {
    lines.pop();
  }
  // Completely flatten old lines over time
  for (let i = 1; i < lines.length; i++) {
    for (let j = 0; j < lines[i].length; j++) {
      lines[i][j] = lerp(lines[i][j], 0, 0.06); // Adjust the 0.1 value to control flattening speed
    }
  }
}

function drawVisualization() {
  let bassIntensity = map(smoothedBass, 0, 255, 0.8, 1.5);

  for (let i = 0; i < lines.length; i++) {
    let opacity = map(i, 0, lines.length, 1, 0.12);
    let brightness = map(i, 0, lines.length, 90, 35);

    stroke(currentHue, 85, brightness, opacity);
    strokeWeight(1.5 * bassIntensity);
    noFill();

    beginShape();
    // Start with straight line
    vertex(0, i * LINE_SPACING + height / 3);
    
    // Draw the main curve with smooth transitions
    for (let x = 0; x < width; x += 5) {
      let yOffset = i * LINE_SPACING + height / 3;
      let y = yOffset + lines[i][x];
      
      if (x === 0 || x >= width - 5) {
        // Use regular vertex for straight edges
        vertex(x, yOffset);
      } else {
        // Use curveVertex for smooth curves in the middle
        curveVertex(x, y);
      }
    }
    
    // End with straight line
    vertex(width, i * LINE_SPACING + height / 3);
    endShape();
  }
}

function createUI() {
  let controls = createDiv('').id('controls');
  controls.html(`
    <div class="player-container">
      <div class="top-controls">
        <div class="song-info">
          <span class="song-title">Now Playing</span>
          <span class="time-display">0:00 / 0:00</span>
        </div>
        <div class="volume-container">
          <i class="volume-icon">🔊</i>
          <input type="range" id="volumeSlider" min="0" max="1" step="0.01" value="0.5">
        </div>
      </div>
      <div class="progress-container">
        <div class="progress-bar">
          <div class="progress-fill"></div>
        </div>
      </div>
      <div class="main-controls">
        <button id="playButton" class="play-button">
          <span class="play-icon">▶</span>
        </button>
      </div>
    </div>
  `);
  
  // Add event listeners for play/pause and volume change
  select('#playButton').mousePressed(togglePlay);
  select('#volumeSlider').input(() => {
    let vol = select('#volumeSlider').value();
    song.setVolume(vol);
    updateVolumeIcon(vol);
  });
}

function setGradientBackground() {
  // Define two colors for the gradient using the current hue values
  let c1 = color(currentHue, 20, 15);
  let c2 = color((currentHue + 180) % 360, 20, 8);
  
  // Draw the gradient by interpolating line-by-line
  for (let y = 0; y < height; y++) {
    let inter = map(y, 0, height, 0, 1);
    let c = lerpColor(c1, c2, inter);
    stroke(c);
    line(0, y, width, y);
  }
}

function updateUI() {
  if (song.isPlaying()) {
    let progress = song.currentTime() / song.duration();
    select('.progress-fill').style('width', (progress * 100) + '%');
    
    let currentTime = formatTime(song.currentTime());
    let totalTime = formatTime(song.duration());
    select('.time-display').html(`${currentTime} / ${totalTime}`);
    
    // Update the visualization intensity based on the current volume
    let volumeScale = map(smoothedVolume, 0, 1, 0.5, 2);
    document.documentElement.style.setProperty('--intensity-scale', volumeScale);
  }
}

function formatTime(seconds) {
  let minutes = Math.floor(seconds / 60);
  seconds = Math.floor(seconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function togglePlay() {
  if (isPlaying) {
    song.pause();
    select('.play-icon').html('▶');
  } else {
    song.play();
    select('.play-icon').html('⏸');
  }
  isPlaying = !isPlaying;
}

function updateVolumeIcon(volume) {
  let icon = select('.volume-icon');
  if (volume > 0.5) icon.html('🔊');
  else if (volume > 0) icon.html('🔉');
  else icon.html('🔇');
}

// Consolidated windowResized function: resize canvas and reinitialize lines.
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  initializeLines();
}

// Insert modern CSS styles for the UI and overall presentation
document.head.insertAdjacentHTML('beforeend', `
  <style>
    body {
      margin: 0;
      overflow: hidden;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    
    .player-container {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(10px);
      padding: 15px 20px;
      color: white;
    }
    
    .top-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    
    .song-info {
      display: flex;
      flex-direction: column;
    }
    
    .song-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    
    .time-display {
      font-size: 12px;
      opacity: 0.8;
    }
    
    .volume-container {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .progress-container {
      margin: 10px 0;
    }
    
    .progress-bar {
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      overflow: hidden;
    }
    
    .progress-fill {
      height: 100%;
      background: rgb(29, 185, 84);
      width: 0%;
      transition: width 0.1s linear;
    }
    
    .main-controls {
      display: flex;
      justify-content: center;
      margin-top: 10px;
    }
    
    .play-button {
      background: white;
      border: none;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s ease;
    }
    
    .play-button:hover {
      transform: scale(1.05);
    }
    
    .play-icon {
      color: black;
      font-size: 18px;
    }
    
    input[type="range"] {
      -webkit-appearance: none;
      width: 100px;
      height: 4px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
      outline: none;
    }
    
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 12px;
      height: 12px;
      background: white;
      border-radius: 50%;
      cursor: pointer;
    }
  </style>
`);

document.head.insertAdjacentHTML('beforeend', `
  <style>
    :root {
      --intensity-scale: 1;
    }
    
    .visualization-container {
      transform: scale(var(--intensity-scale));
      transition: transform 0.1s ease;
    }
    
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(var(--intensity-scale)); }
      100% { transform: scale(1); }
    }
  </style>
`);
