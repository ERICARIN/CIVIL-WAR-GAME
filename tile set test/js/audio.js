const musicPlaylist = [
    'music/Julian R. Fogel - A las Barricadas.mp4',
    'music/videoplayback.m4a'
];

let currentTrackIndex = 0;
const audio = new Audio();
let musicEnabled = true;
let isAudioInitialized = false;
let isSeekingNextTrack = false; // Flag to prevent multiple rapid calls

function playNextTrack() {
    if (isSeekingNextTrack || musicPlaylist.length === 0 || !musicEnabled) return;
    isSeekingNextTrack = true;

    currentTrackIndex = (currentTrackIndex + 1) % musicPlaylist.length;
    audio.src = musicPlaylist[currentTrackIndex];
    audio.load(); // Explicitly load the new source
    
    const playPromise = audio.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            // Reset flag only after playback has successfully started
            isSeekingNextTrack = false;
        }).catch(error => {
            console.error("Failed to play next track:", error);
            // Reset flag on error to allow potential future retries
            isSeekingNextTrack = false;
        });
    }
}

function initAudio() {
    if (isAudioInitialized) return;
    audio.volume = 0.5;

    // The standard 'ended' event for track changes
    audio.addEventListener('ended', playNextTrack);

    // Fallback mechanism using 'timeupdate' for files where 'ended' might not fire reliably (e.g., some video formats)
    audio.addEventListener('timeupdate', () => {
        if (audio.duration > 0 && audio.duration - audio.currentTime < 1.0) {
            playNextTrack();
        }
    });

    audio.addEventListener('error', (e) => {
        console.error("Audio Element Error:", e);
        isSeekingNextTrack = false; // Reset flag on error
    });

    if (musicPlaylist.length > 0) {
        audio.src = musicPlaylist[currentTrackIndex];
    }
    isAudioInitialized = true;

    if (musicEnabled) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error("Music playback failed on init:", error);
                musicEnabled = false;
                if(document.getElementById('musicChk')) document.getElementById('musicChk').checked = false;
            });
        }
    }
}

function toggleMusic(enabled) {
    musicEnabled = enabled;
    if (!isAudioInitialized) {
        return; // initAudio will be called from startGame and will handle playback
    }

    if (enabled) {
        if (audio.paused) {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error("Music playback failed on toggle:", error);
                });
            }
        }
    } else {
        audio.pause();
    }
}

// Sound effects are not implemented yet, but we can have a placeholder function
let sfxEnabled = true;
function toggleSfx(enabled) {
    sfxEnabled = enabled;
}