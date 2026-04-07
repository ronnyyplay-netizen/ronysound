import { useState, useCallback, useEffect } from 'react';
import Header from '@/components/Header';
import TransportControls from '@/components/TransportControls';
import WaveformDisplay from '@/components/WaveformDisplay';
import InputMeter from '@/components/InputMeter';
import TrackList from '@/components/TrackList';
import type { TrackEQSettings } from '@/components/TrackList';
import ExportDialog from '@/components/ExportDialog';
import MixExportDialog from '@/components/MixExportDialog';
import StemSeparator from '@/components/StemSeparator';
import SpectrumAnalyzer from '@/components/SpectrumAnalyzer';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import type { TrackFXSettings, VoicePreset } from '@/components/TrackEffects';
import { defaultFX } from '@/components/TrackEffects';

interface MixState {
  eqs: Record<string, TrackEQSettings>;
  fxs: Record<string, TrackFXSettings>;
}

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
    inputSource,
    isMonitoring,
    noiseReduction,
    playbackAnalyser,
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
    setInputSource,
    toggleMonitoring,
    setNoiseReduction,
    updatePlaybackEQ,
    updatePlaybackFX,
  } = useAudioRecorder();

  const { state: mixState, set: setMixState, undo, redo, canUndo, canRedo } = useUndoRedo<MixState>({ eqs: {}, fxs: {} });

  const trackEQs = mixState.eqs;
  const trackFXs = mixState.fxs;

  const handleEQChange = useCallback((trackId: string, eq: TrackEQSettings) => {
    setMixState(prev => ({ ...prev, eqs: { ...prev.eqs, [trackId]: eq } }));
  }, [setMixState]);

  const handleFXChange = useCallback((trackId: string, fx: TrackFXSettings) => {
    setMixState(prev => ({ ...prev, fxs: { ...prev.fxs, [trackId]: fx } }));
  }, [setMixState]);

  const handleApplyPreset = useCallback((trackId: string, preset: VoicePreset) => {
    setMixState(prev => ({
      eqs: { ...prev.eqs, [trackId]: preset.eq },
      fxs: { ...prev.fxs, [trackId]: { ...defaultFX, ...preset.fx } },
    }));
  }, [setMixState]);

  const currentTrack = currentTrackIndex !== null ? tracks[currentTrackIndex] : null;
  const currentEQ = currentTrack ? (trackEQs[currentTrack.id] ?? { bass: 0, mid: 0, treble: 0, volume: 0 }) : { bass: 0, mid: 0, treble: 0, volume: 0 };
  const currentFX = currentTrack ? (trackFXs[currentTrack.id] ?? defaultFX) : defaultFX;

  useEffect(() => {
    if (isPlaying && currentTrack) {
      updatePlaybackEQ(currentEQ);
    }
  }, [currentEQ, isPlaying, currentTrack, updatePlaybackEQ]);

  useEffect(() => {
    if (isPlaying && currentTrack) {
      updatePlaybackFX(currentFX);
    }
  }, [currentFX, isPlaying, currentTrack, updatePlaybackFX]);

  const handlePlay = useCallback((index?: number) => {
    const idx = index ?? currentTrackIndex;
    if (idx === null || !tracks[idx]) return;
    const track = tracks[idx];
    const eq = trackEQs[track.id] ?? { bass: 0, mid: 0, treble: 0, volume: 0 };
    const fx = trackFXs[track.id] ?? defaultFX;
    playTrack(idx, eq, fx);
  }, [currentTrackIndex, tracks, trackEQs, trackFXs, playTrack]);

  const playbackProgress = currentTrack && currentTrack.duration > 0
    ? playbackTime / currentTrack.duration
    : 0;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header
        onImport={importAudioFile}
        inputSource={inputSource}
        isMonitoring={isMonitoring}
        noiseReduction={noiseReduction}
        isRecording={isRecording}
        onInputSourceChange={setInputSource}
        onMonitoringChange={toggleMonitoring}
        onNoiseReductionChange={setNoiseReduction}
      />
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
          onPlay={() => handlePlay()}
          onPause={pausePlayback}
          onStopPlayback={stopPlayback}
        />
        <div className="flex items-center gap-2">
          <ExportDialog track={currentTrack} eq={currentEQ} />
          <MixExportDialog tracks={tracks} trackEQs={trackEQs} />
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden min-h-0">
        <WaveformDisplay
          waveformData={currentTrack?.waveformData ?? []}
          isRecording={isRecording}
          analyserData={analyserData}
          playbackProgress={playbackProgress}
        />
        <SpectrumAnalyzer
          analyserNode={playbackAnalyser}
          isActive={isPlaying}
        />
        <InputMeter level={inputLevel} isRecording={isRecording} />
      </div>
      <div className="h-80 border-t border-border bg-card overflow-hidden flex flex-col">
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
              trackFXs={trackFXs}
              onPlay={handlePlay}
              onDelete={deleteTrack}
              onRename={renameTrack}
              onDownload={downloadTrack}
              onSelect={setCurrentTrackIndex}
              onEQChange={handleEQChange}
              onFXChange={handleFXChange}
              onApplyPreset={handleApplyPreset}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undo}
              onRedo={redo}
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
