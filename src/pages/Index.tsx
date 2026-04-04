import Header from '@/components/Header';
import TransportControls from '@/components/TransportControls';
import WaveformDisplay from '@/components/WaveformDisplay';
import InputMeter from '@/components/InputMeter';
import TrackList from '@/components/TrackList';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

const Index = () => {
  const {
    isRecording,
    recordingTime,
    tracks,
    currentTrackIndex,
    isPlaying,
    playbackTime,
    analyserData,
    inputLevel,
    startRecording,
    stopRecording,
    playTrack,
    pausePlayback,
    stopPlayback,
    deleteTrack,
    renameTrack,
    downloadTrack,
    setCurrentTrackIndex,
  } = useAudioRecorder();

  const currentTrack = currentTrackIndex !== null ? tracks[currentTrackIndex] : null;
  const playbackProgress = currentTrack && currentTrack.duration > 0
    ? playbackTime / currentTrack.duration
    : 0;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header />
      <TransportControls
        isRecording={isRecording}
        isPlaying={isPlaying}
        recordingTime={recordingTime}
        playbackTime={playbackTime}
        currentTrackDuration={currentTrack?.duration ?? null}
        hasTrack={tracks.length > 0}
        onRecord={startRecording}
        onStop={stopRecording}
        onPlay={() => playTrack()}
        onPause={pausePlayback}
        onStopPlayback={stopPlayback}
      />
      <div className="flex-1 flex overflow-hidden">
        <WaveformDisplay
          waveformData={currentTrack?.waveformData ?? []}
          isRecording={isRecording}
          analyserData={analyserData}
          playbackProgress={playbackProgress}
        />
        <InputMeter level={inputLevel} isRecording={isRecording} />
      </div>
      <TrackList
        tracks={tracks}
        currentTrackIndex={currentTrackIndex}
        isPlaying={isPlaying}
        onPlay={playTrack}
        onDelete={deleteTrack}
        onRename={renameTrack}
        onDownload={downloadTrack}
        onSelect={setCurrentTrackIndex}
      />
    </div>
  );
};

export default Index;
