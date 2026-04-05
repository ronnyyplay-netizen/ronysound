import { useState, useCallback } from 'react';
import Header from '@/components/Header';
import TransportControls from '@/components/TransportControls';
import WaveformDisplay from '@/components/WaveformDisplay';
import InputMeter from '@/components/InputMeter';
import TrackList from '@/components/TrackList';
import type { TrackEQSettings } from '@/components/TrackList';
import ExportDialog from '@/components/ExportDialog';
import MultitrackTimeline from '@/components/MultitrackTimeline';
import StemSeparator from '@/components/StemSeparator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useMultitrackPlayer } from '@/hooks/useMultitrackPlayer';

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
    importAudioFile,
    setCurrentTrackIndex,
    addTrack,
  } = useAudioRecorder();

  const [trackEQs, setTrackEQs] = useState<Record<string, TrackEQSettings>>({});

  const multitrack = useMultitrackPlayer();

  const handleEQChange = useCallback((trackId: string, eq: TrackEQSettings) => {
    setTrackEQs(prev => ({ ...prev, [trackId]: eq }));
    // Update real-time EQ if playing in timeline
    multitrack.applyEQToNodes(trackId, eq);
  }, [multitrack]);

  const handlePlayTimeline = useCallback(() => {
    multitrack.playTimeline(tracks, trackEQs, multitrack.timelinePosition);
  }, [multitrack, tracks, trackEQs]);

  const currentTrack = currentTrackIndex !== null ? tracks[currentTrackIndex] : null;
  const currentEQ = currentTrack ? (trackEQs[currentTrack.id] ?? { bass: 0, mid: 0, treble: 0, volume: 0 }) : { bass: 0, mid: 0, treble: 0, volume: 0 };
  const playbackProgress = currentTrack && currentTrack.duration > 0
    ? playbackTime / currentTrack.duration
    : 0;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header onImport={importAudioFile} />
      <div className="border-b border-border bg-card px-5 py-1 flex items-center justify-between">
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
        <ExportDialog track={currentTrack} eq={currentEQ} />
      </div>
      <div className="flex-1 flex overflow-hidden min-h-0">
        <WaveformDisplay
          waveformData={currentTrack?.waveformData ?? []}
          isRecording={isRecording}
          analyserData={analyserData}
          playbackProgress={playbackProgress}
        />
        <InputMeter level={inputLevel} isRecording={isRecording} />
      </div>
      <MultitrackTimeline
        tracks={tracks}
        timelineTracks={multitrack.timelineTracks}
        trackEQs={trackEQs}
        isPlaying={multitrack.isTimelinePlaying}
        position={multitrack.timelinePosition}
        duration={multitrack.timelineDuration}
        onPlay={handlePlayTimeline}
        onStop={multitrack.stopTimeline}
        onSeek={multitrack.seekTimeline}
        onAddTrack={multitrack.addToTimeline}
        onRemoveTrack={multitrack.removeFromTimeline}
        onToggleMute={multitrack.toggleMute}
        onToggleSolo={multitrack.toggleSolo}
        onUpdateTrack={multitrack.updateTimelineTrack}
        onEQChange={handleEQChange}
      />
      <TrackList
        tracks={tracks}
        currentTrackIndex={currentTrackIndex}
        isPlaying={isPlaying}
        trackEQs={trackEQs}
        onPlay={playTrack}
        onDelete={deleteTrack}
        onRename={renameTrack}
        onDownload={downloadTrack}
        onSelect={setCurrentTrackIndex}
        onEQChange={handleEQChange}
      />
    </div>
  );
};

export default Index;
