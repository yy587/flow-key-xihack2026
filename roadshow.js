const audio=document.querySelector('#roadshowAudio');
const fileInput=document.querySelector('#recordingFile');
const status=document.querySelector('#recordingStatus');
let objectURL=null;
let clipName='采访 · 团队提供录音';
audio.addEventListener('loadedmetadata',()=>{
  const duration=Math.floor(audio.duration);
  status.textContent=`${clipName} · ${Math.floor(duration/60)}:${String(duration%60).padStart(2,'0')}`;
});
audio.addEventListener('error',()=>{status.textContent='音频暂时无法播放，请刷新或选择 MP3 / WAV 文件。';});
fileInput.addEventListener('change',()=>{
  const file=fileInput.files?.[0];
  if(!file)return;
  audio.pause();
  if(objectURL)URL.revokeObjectURL(objectURL);
  objectURL=URL.createObjectURL(file);
  clipName=file.name;
  audio.src=objectURL;
  audio.load();
  status.textContent=`已导入：${file.name}`;
});
// Pause the roadshow clip before live analysis to avoid feeding it back to the mic.
document.querySelector('#microphoneSourceButton').addEventListener('click',()=>audio.pause());
document.querySelector('#startButton').addEventListener('click',()=>audio.pause());
window.addEventListener('pagehide',()=>{audio.pause();if(objectURL)URL.revokeObjectURL(objectURL);});
