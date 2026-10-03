const audio=document.querySelector('#roadshowAudio');
const status=document.querySelector('#recordingStatus');
audio.addEventListener('loadedmetadata',()=>{status.hidden=true;});
audio.addEventListener('error',()=>{
  status.hidden=false;
  status.textContent='音频暂时无法播放，请刷新后重试。';
});
// Pause the roadshow clip before live analysis to avoid feeding it back to the mic.
document.querySelector('#microphoneSourceButton').addEventListener('click',()=>audio.pause());
document.querySelector('#startButton').addEventListener('click',()=>audio.pause());
window.addEventListener('pagehide',()=>audio.pause());
