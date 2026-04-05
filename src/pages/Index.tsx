import { useState, useCallback } from 'react';
import Header from '@/components/Header';
import TransportControls from '@/components/TransportControls';
import WaveformDisplay from '@/components/WaveformDisplay';
import InputMeter from '@/components/InputMeter';
import TrackList from '@/components/TrackList';
import type { TrackEQSettings } from '@/components/TrackList';
import ExportDialog from '@/components/ExportDialog';
import StemSeparator from '@/components/StemSeparator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
    importAudioFile,
    setCurrentTrackIndex,
    addTrack,
  } = useAudioRecorder();

  const [trackEQs, setTrackEQs] = useState<Record<string, TrackEQSettings>>({});

  const handleEQChange = useCallback((trackId: string, eq: TrackEQSettings) => {
    setTrackEQs(prev => ({ ...prev, [trackId]: eq }));
  }, []);

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
      <div className="h-72 border-t border-border bg-card overflow-hidden flex flex-col">
        <Tabs defaultValue="tracks" className="flex flex-col h-full">
          <TabsList className="mx-4 mt-2 w-fit h-8">
            <TabsTrigger value="tracks" className="text-xs px-3 py-1">Faixas</TabsTrigger>
            <TabsTrigger value="stems" className="text-xs px-3 py-1">🎛️ Separar Stems</TabsTrigger>
          </TabsList>
          <TabsContent value="tracks" className="flex-1 overflow-hidden m-0">
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
          </TabsContent>
          <TabsContent value="stems" className="flex-1 overflow-y-auto m-0">
            <StemSeparator
              track={currentTrack}
              onAddStemAsTrack={addTrack}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
